import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw } from "@/lib/notify";

/**
 * 매일 03:00 KST (vercel.json crons: 18:00 UTC) — 14일 무료 관리 (기획1 /mainplan #membership)
 *  1) D-3 · D-1 문자 안내 (settings.phone 이 있는 trial 사이트)
 *  2) trial_ends_at 지난 trial → expired (RLS 가 공개를 끊는다). 삭제는 30일 뒤 사람이 어드민에서.
 * 인증: Vercel 이 CRON_SECRET 을 Bearer 로 보낸다. env 가 없으면 운영자 호출만 허용하기 위해 거부.
 */
export const dynamic = "force-dynamic";

/**
 * D-3·D-1 안내 문자 (2026-09-06 단축).
 * EUC-KR 90바이트를 넘기면 솔라피가 LMS(장문)로 보내 요금이 3배가량 붙는다. 구 문구는 155바이트였다.
 * 상호명을 넣지 않는 이유도 같다 — business_name 은 스키마상 최대 40자라 그것만으로 예산을 넘긴다.
 * 사장님은 링크의 슬러그로 자기 가게를 알아본다. 슬러그가 최댓값(30자)이어도 87바이트로 SMS 안이다.
 */
function nudgeText(days: number, slug: string) {
  return `온스토리 무료 ${days}일 남음. 정회원 49,000원 onstori.com/${slug}/edit`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = sbAdmin();
  const now = Date.now();
  const day = 86_400_000;
  const out = { nudged: 0, expired: 0 };

  // 1) 안내 문자 — 만료까지 3일/1일 남은 사이트 (하루 한 번 도는 크론이므로 24시간 창)
  const { data: soon } = await sb
    .from("sites")
    .select("slug, business_name, settings, trial_ends_at")
    .eq("status", "trial")
    .gte("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + 3.5 * day).toISOString());
  for (const s of soon ?? []) {
    const left = Math.ceil((new Date(s.trial_ends_at).getTime() - now) / day);
    if (left !== 3 && left !== 1) continue;
    const phone = (s.settings as { phone?: string } | null)?.phone;
    if (!phone) continue;
    if (await sendSmsRaw(phone, nudgeText(left, s.slug))) out.nudged++;
  }

  // 2) 만료 처리
  const { data: exp } = await sb
    .from("sites")
    .update({ status: "expired" })
    .eq("status", "trial")
    .lt("trial_ends_at", new Date(now).toISOString())
    .select("slug");
  out.expired = exp?.length ?? 0;

  console.log(JSON.stringify({ evt: "cron_expire", ...out }));
  return NextResponse.json(out);
}
