import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { MEMBERSHIP_NAME, MEMBERSHIP_PRICE } from "@/lib/trial";

/**
 * 정회원 결제 시작 — 토스페이먼츠 결제위젯/SDK v2 용 주문 정보 (기획1 /mainplan #membership).
 * 금액은 서버(lib/trial.ts)가 정한다 — 클라이언트 값은 받지 않는다 (CLAUDE.md 규칙 4).
 * TOSS_CLIENT_KEY 가 없으면 ready:false — 모달은 "결제 준비 중"을 보여준다(가맹 완료 전).
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const clientKey = process.env.TOSS_CLIENT_KEY?.trim();
  if (!clientKey || !process.env.TOSS_SECRET_KEY?.trim()) {
    return NextResponse.json({ ready: false, amount: MEMBERSHIP_PRICE, orderName: MEMBERSHIP_NAME });
  }
  if (r.site.status === "active") return NextResponse.json({ ready: false, alreadyPaid: true, amount: MEMBERSHIP_PRICE, orderName: MEMBERSHIP_NAME });

  const orderId = `os-${r.site.slug}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const settings = { ...(r.site.settings as Record<string, unknown>), pending_order: { orderId, amount: MEMBERSHIP_PRICE, at: new Date().toISOString() } };
  await sbAdmin().from("sites").update({ settings }).eq("id", r.site.id);

  return NextResponse.json({
    ready: true,
    clientKey,
    orderId,
    amount: MEMBERSHIP_PRICE,
    orderName: `${MEMBERSHIP_NAME} (${r.site.business_name})`,
    customerKey: r.site.owner_id ?? `anon-${r.site.id}`,
  });
}
