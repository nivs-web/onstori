import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { MEMBERSHIP_PRICE } from "@/lib/trial";

/**
 * 토스 결제 승인 — successUrl 에서 호출. 서버가 시크릿 키로 confirm 하고, 성공 시 정회원(active)으로.
 * 검증: orderId 가 그 사이트의 pending_order 와 같고, 금액이 서버 기준(49,000)과 같을 때만 승인한다 (규칙 4).
 * paid_at/payment 컬럼은 20260905 마이그레이션 — 아직 적용 전이면 status/plan 만 갱신하고 결제 원장은 settings 에 남긴다.
 */
export async function POST(req: Request) {
  const { paymentKey, orderId, amount, slug } = await req.json().catch(() => ({}));
  const secret = process.env.TOSS_SECRET_KEY?.trim();
  if (!secret) return NextResponse.json({ error: "결제가 아직 준비되지 않았어요" }, { status: 503 });
  if (typeof paymentKey !== "string" || typeof orderId !== "string" || typeof slug !== "string") {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  if (Number(amount) !== MEMBERSHIP_PRICE) return NextResponse.json({ error: "금액이 맞지 않아요" }, { status: 400 });

  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("id, slug, status, settings").eq("slug", slug).maybeSingle();
  if (!site) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const pending = (site.settings as { pending_order?: { orderId?: string } } | null)?.pending_order;
  if (!pending || pending.orderId !== orderId) return NextResponse.json({ error: "주문 정보가 맞지 않아요" }, { status: 409 });

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
    body: JSON.stringify({ paymentKey, orderId, amount: MEMBERSHIP_PRICE }),
  });
  const pay = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error(JSON.stringify({ evt: "toss_confirm_fail", slug, status: res.status, code: pay.code, msg: pay.message }));
    return NextResponse.json({ error: String(pay.message ?? "결제 승인에 실패했어요") }, { status: 402 });
  }

  const now = new Date().toISOString();
  const payment = { paymentKey, orderId, amount: MEMBERSHIP_PRICE, approvedAt: pay.approvedAt ?? now, method: pay.method ?? null };
  const settings = { ...(site.settings as Record<string, unknown>), pending_order: null, last_payment: payment };
  const full = await sb.from("sites").update({ status: "active", plan: "light", paid_at: now, payment, settings }).eq("id", site.id);
  if (full.error) {
    // 마이그레이션 전(paid_at 없음) — 최소 갱신으로 재시도
    await sb.from("sites").update({ status: "active", plan: "light", settings }).eq("id", site.id);
  }
  console.log(JSON.stringify({ evt: "membership_paid", slug, orderId }));
  return NextResponse.json({ ok: true });
}
