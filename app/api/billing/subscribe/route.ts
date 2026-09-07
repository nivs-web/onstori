import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { MEMBERSHIP_NAME, MEMBERSHIP_PRICE } from "@/lib/trial";
import { issueBillingKey, charge, last4 } from "@/lib/toss";

/**
 * 정기결제 시작 — 카드 등록창(requestBillingAuth) 성공 후 successUrl 이 부른다.
 * 회장님 확정: 월 구독. 금액은 lib/trial.ts 참조.
 *
 * 하는 일 (순서가 중요하다)
 *   1) 소유권 확인 — 남의 사이트를 구독시킬 수 없다
 *   2) authKey → billingKey 발급
 *   3) billingKey 를 먼저 저장한다. ★ 청구보다 먼저다 —
 *      청구가 성공했는데 키를 못 남기면 돈은 받고 다음 달 청구를 못 하는 최악이 된다
 *   4) 첫 달 청구
 *   5) 성공하면 사이트를 active 로. 실패하면 구독을 failed 로 두고 사이트는 건드리지 않는다
 *
 * ⚠ 가맹 심사 전이라 실호출로 검증한 적이 없다. TOSS_SECRET_KEY 가 붙으면 테스트 키로 먼저 태울 것.
 * ⚠ 금액은 서버(lib/trial.ts)가 정한다 — 클라이언트 값을 믿지 않는다 (CLAUDE.md 규칙 4).
 */
export async function POST(req: Request) {
  const { authKey, customerKey, slug, anonId } = await req.json().catch(() => ({}));
  if (typeof authKey !== "string" || typeof customerKey !== "string" || typeof slug !== "string") {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }

  const owned = await loadOwnedSite(slug, anonId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === "forbidden" ? 403 : 404 });
  }
  const site = owned.site;
  const sb = sbAdmin();

  // 이미 구독 중이면 카드만 바꾸는 경우일 수 있다 — 중복 청구를 막기 위해 여기서 끊는다
  const { data: existing } = await sb.from("billing").select("site_id, status").eq("site_id", site.id).maybeSingle();
  if (existing?.status === "active") {
    return NextResponse.json({ error: "이미 정기결제가 등록돼 있어요." }, { status: 409 });
  }

  // 2) 빌링키 발급
  const issued = await issueBillingKey(authKey, customerKey);
  if (!issued.ok) {
    console.error(JSON.stringify({ evt: "billing_issue_failed", slug, code: issued.code }));
    return NextResponse.json({ error: issued.message }, { status: 402 });
  }
  const { billingKey, card } = issued.data;

  // 3) 청구보다 **먼저** 저장한다
  const nextCharge = new Date();
  nextCharge.setMonth(nextCharge.getMonth() + 1);
  const { error: saveErr } = await sb.from("billing").upsert(
    {
      site_id: site.id,
      customer_key: customerKey,
      billing_key: billingKey,
      card_company: card?.company ?? null,
      card_last4: last4(card?.number),
      status: "active",
      next_charge_at: nextCharge.toISOString(),
      fail_count: 0,
      canceled_at: null,
    },
    { onConflict: "site_id" }
  );
  if (saveErr) {
    // 키를 못 남겼으면 청구하지 않는다. 돈만 받고 관리 못 하는 상태를 만들지 않는다.
    console.error(JSON.stringify({ evt: "billing_save_failed", slug, err: saveErr.message }));
    return NextResponse.json({ error: "결제 수단을 저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  // 4) 첫 달 청구
  const orderId = `os-${site.slug}-${randomUUID().slice(0, 12)}`;
  const paid = await charge({
    billingKey,
    customerKey,
    amount: MEMBERSHIP_PRICE,
    orderId,
    orderName: `${MEMBERSHIP_NAME} (${site.business_name})`,
  });

  if (!paid.ok) {
    await sb.from("billing").update({ status: "failed", fail_count: 1 }).eq("site_id", site.id);
    await sb.from("payments").insert({
      site_id: site.id, site_slug: site.slug, order_id: orderId, kind: "recurring", amount: MEMBERSHIP_PRICE,
      status: "failed", fail_code: paid.code, fail_message: paid.message,
    });
    console.error(JSON.stringify({ evt: "billing_first_charge_failed", slug, code: paid.code }));
    return NextResponse.json({ error: paid.message }, { status: 402 });
  }

  // 5) 원장 기록 + 사이트 활성화
  await sb.from("payments").insert({
    site_id: site.id, site_slug: site.slug, order_id: orderId, kind: "recurring",
    payment_key: paid.data.paymentKey, amount: paid.data.totalAmount ?? MEMBERSHIP_PRICE,
    status: "paid", method: paid.data.method ?? null,
    approved_at: paid.data.approvedAt ?? new Date().toISOString(),
    raw: paid.data as unknown as Record<string, unknown>,
  });
  await sb.from("sites").update({ status: "active", plan: "light", paid_at: new Date().toISOString() }).eq("id", site.id);

  console.log(JSON.stringify({ evt: "subscription_started", slug: site.slug, orderId }));
  return NextResponse.json({ ok: true, nextChargeAt: nextCharge.toISOString(), cardLast4: last4(card?.number) });
}
