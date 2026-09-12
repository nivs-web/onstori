/* 기간 출처: lib/trial.ts — 주석 속 설명 숫자다 */
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

  /**
   * ★★★ **해지하면 주 1회 문자를 끈다.** (2026-09-13 회장님 결정 1)
   *
   * ⚠ 왜 필요한가: 해지해도 사이트 상태는 `active` 그대로라 주 1회 크론의 필터
   *   (trial·active 만 본다)를 **매주 그냥 통과했다.** 그만두신 분께 계속 문자가 갔다 —
   *   명백한 무단 발송이다(2026-09-13 야간 점검에서 찾음).
   *
   * ★ 여기서 «끄는» 것이 가장 확실하다. 크론 쪽에서 결제 상태를 다시 보게 만들면
   *   조회가 하나 더 늘고, 그 조회가 실패하는 날 다시 새어 나간다.
   *   **끄는 일은 끄는 자리에서 한다.**
   * ⚠ 끄기에 실패해도 해지 자체는 되돌리지 않는다 — 사장님은 이미 해지를 누르셨다.
   *   대신 로그에 남겨 사람이 챙긴다.
   */
  try {
    const settings = (owned.site.settings as Record<string, unknown>) ?? {};
    const w = (settings.weekly as Record<string, unknown> | undefined) ?? {};
    const { error: offErr } = await sb.from("sites")
      .update({ settings: { ...settings, weekly: { ...w, on: false } } })
      .eq("id", owned.site.id);
    console.log(JSON.stringify({
      evt: offErr ? "cancel_weekly_off_failed" : "cancel_weekly_off",
      slug: owned.site.slug, err: offErr?.message?.slice(0, 120),
    }));
  } catch (e) {
    console.error(JSON.stringify({ evt: "cancel_weekly_off_error", err: String(e).slice(0, 160) }));
  }

  console.log(JSON.stringify({ evt: "subscription_canceled", slug: owned.site.slug, paidUntil: bill.next_charge_at }));
  // 이미 낸 달은 끝까지 쓰신다 — 화면이 이 날짜를 그대로 보여준다
  return NextResponse.json({ ok: true, paidUntil: bill.next_charge_at });
}
