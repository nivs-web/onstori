import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 구독 해지 — 2026-09-06.
 *
 * ★ 해지는 가입만큼 쉬워야 한다. 전화나 이메일로만 받게 만들지 않는다.
 *   이 라우트가 마이페이지·수정 화면의 [해지] 버튼이 부르는 곳이다.
 *
 * 정책: 해지해도 **이미 결제한 이번 달은 끝까지 쓴다.** 다음 달부터 청구하지 않는다.
 *   즉시 정지시키지 않는 이유 — 이미 받은 돈에 해당하는 기간을 뺏으면 부당하다.
 *   next_charge_at 이 지나면 크론이 status='expired'(정지)로 넘기고, 거기서 60일 유예가 시작된다.
 *
 * 환불(청약철회)은 별개다. 약관 제5조 참조 — 이 라우트는 "다음 달부터 안 받기"만 한다.
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  if (typeof slug !== "string") return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const owned = await loadOwnedSite(slug, anonId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.error === "forbidden" ? 403 : 404 });
  }
  const sb = sbAdmin();

  const { data: bill } = await sb
    .from("billing")
    .select("site_id, status, next_charge_at")
    .eq("site_id", owned.site.id)
    .maybeSingle();
  if (!bill) return NextResponse.json({ error: "등록된 정기결제가 없어요." }, { status: 404 });
  if (bill.status === "canceled") {
    return NextResponse.json({ ok: true, alreadyCanceled: true, paidUntil: bill.next_charge_at });
  }

  const { error } = await sb
    .from("billing")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("site_id", owned.site.id);
  if (error) return NextResponse.json({ error: "해지 처리에 실패했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });

  console.log(JSON.stringify({ evt: "subscription_canceled", slug: owned.site.slug, paidUntil: bill.next_charge_at }));
  // 이미 낸 달은 끝까지 쓰신다 — 화면이 이 날짜를 그대로 보여준다
  return NextResponse.json({ ok: true, paidUntil: bill.next_charge_at });
}
