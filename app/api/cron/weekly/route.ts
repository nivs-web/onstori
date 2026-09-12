import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw, notifyChannels } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { pickQuestions } from "@/config/questions";
import { readWeekly, shouldSend } from "@/lib/weekly";
import { trialInfo } from "@/lib/trial";
import { refreshInstagramTokens, finishStuckPosts } from "@/lib/sns/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 주 1회 촬영 알림 — **매시 정각**에 돌며 「지금이 그 사장님의 요일·시간인가」를 본다. (2026-09-12)
 *
 * ★★ 왜 따로 만드나: `expire` 에 얹지 않는다(회장님 지시). 성격이 다르고,
 *   한쪽이 죽으면 둘 다 멈춘다. 만료 처리와 촬영 독려는 같이 죽으면 안 되는 일이다.
 *
 * ★★ 왜 매시 정각인가: 사장님이 **시간을 직접 고른다.** 분 단위로 받으면 크론을 분마다
 *   돌려야 하고 비용·복잡도가 확 오른다. 1시간 단위면 하루 24번으로 충분하다.
 *
 * ★★★ **같은 주에 두 번 가지 않는다.** `settings.weekly.lastSentAt` 을 보고 6일이 안 지났으면
 *   건너뛴다. 크론이 겹쳐 돌거나 재시도하면 두 번 가는데, 사장님에게는 그게 스팸이다.
 *   ⚠ 보내기 **전에** 찍지 않고 **보낸 뒤에** 찍는다 — 먼저 찍으면 발송이 실패했을 때
 *     그 주를 통째로 건너뛴다.
 *
 * ⚠ 알림톡은 아직 심사 전이라 **채널을 kakao 로 고른 사장님에게도 지금은 문자로 간다.**
 *   화면이 그 사실을 그대로 말한다(lib/weekly.ts KAKAO_READY).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = sbAdmin();
  const out = { looked: 0, due: 0, sent: 0, failed: 0, skippedSuspended: 0, noPhone: 0 };

  /* 살아 있는 사이트만 본다 — 정지된 곳에 촬영을 독려하면 화만 난다 */
  const { data: sites, error } = await sb
    .from("sites")
    .select("id, slug, business_name, settings, status, trial_ends_at, suspended_at")
    .in("status", ["trial", "active"]);
  if (error) {
    console.error(JSON.stringify({ evt: "weekly_query_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const canSms = notifyChannels().sms;
  const now = new Date();

  for (const s of sites ?? []) {
    out.looked++;
    const settings = (s.settings as Record<string, unknown>) ?? {};
    const w = readWeekly(settings);
    if (!shouldSend(w, now)) continue;
    out.due++;

    /* 무료가 끝났는데 만료 크론이 아직 안 돈 사이트를 거른다 — raw status 만 보면 놓친다 */
    if (trialInfo(s).expired) { out.skippedSuspended++; continue; }

    const phone = (w?.phone?.trim() || (settings.phone as string) || "").trim();
    if (!phone || !canSms) { out.noPhone++; continue; }

    const link = storyLinkUrl(s.slug as string, "https://onstori.com");
    const q = pickQuestions(1)[0];
    const text = `[온스토리] ${s.business_name} 사장님, 이번 주 질문이에요.\n"${q.text}"\n아래 링크를 브라우저에서 열고 60초만 말씀해 주세요.\n${link}`;

    const ok = await sendSmsRaw(phone, text);
    if (!ok) { out.failed++; continue; }
    out.sent++;

    /* ★ 보낸 뒤에 찍는다. 먼저 찍으면 발송 실패 시 그 주를 통째로 건너뛴다. */
    await sb.from("sites")
      .update({ settings: { ...settings, weekly: { ...(w ?? {}), lastSentAt: new Date().toISOString() } } })
      .eq("id", s.id);
  }

  console.log(JSON.stringify({ evt: "weekly_done", ...out }));

  /* ★★ SNS 유지보수를 **여기에 얹는다** (2026-09-12 회장님 지시 1·8).
     ① 인스타 60일 토큰을 죽기 전에 갱신 ② 화면을 닫아 「받는 중」으로 멈춘 영상 마무리.

     ⚠ 왜 새 크론을 안 만드나: `vercel.json` 의 크론 한 줄이 배포 전체를 실패시킨 적이 있고
       (2026-09-12), 무료 요금제는 크론 개수에도 제한이 있다. 매일 도는 이 크론에 얹는 것이
       가장 안전하다. 나중에 분리할 때는 `lib/sns/maintenance.ts` 를 부르는 라우트만 새로 만들면 된다.
     ⚠ 문자 발송이 실패해도 유지보수는 돈다 — 위 반복문이 이미 끝난 뒤라 서로 막지 않는다. */
  const sns = { refresh: null as unknown, finish: null as unknown };
  try { sns.refresh = await refreshInstagramTokens(); }
  catch (e) { console.error(JSON.stringify({ evt: "sns_refresh_crashed", err: String(e).slice(0, 200) })); }
  try { sns.finish = await finishStuckPosts(); }
  catch (e) { console.error(JSON.stringify({ evt: "sns_finish_crashed", err: String(e).slice(0, 200) })); }
  console.log(JSON.stringify({ evt: "sns_maintenance_done", ...sns }));

  return NextResponse.json({ ...out, sns });
}
