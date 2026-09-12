import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw, notifyChannels } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { ALIMTALK_QUESTIONS } from "@/config/questions";
import {
  readWeekly, shouldSend, deadlineText, hasBannedPhrase, withOptOut, pickOnePerPhone,
  type Weekly,
} from "@/lib/weekly";
import { trialInfo } from "@/lib/trial";
import { refreshInstagramTokens, refreshTiktokTokens, finishStuckPosts, checkPublishedAlive } from "@/lib/sns/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 주 1회 촬영 알림 — **하루 한 번**(한국 09:00 · `vercel.json` 의 `0 0 * * *`) 돈다. (2026-09-12 개정)
 *
 * ★★ 왜 따로 만드나: `expire` 에 얹지 않는다(회장님 지시). 성격이 다르고,
 *   한쪽이 죽으면 둘 다 멈춘다. 만료 처리와 촬영 독려는 같이 죽으면 안 되는 일이다.
 *
 * ★★ ⚠ **옛 주석은 「매시 정각에 돈다」였다 — 사실이 아니었다.** Vercel 무료는 크론이
 *   하루 1회뿐이고, 그 착각 위에 판정을 짜서 결함 둘이 생겼다(고른 요일보다 하루 늦게 가고,
 *   토요일 늦은 시각을 고른 분께는 영영 안 갔다). 지금 판정은 **「오늘이 그 요일인가」**다 —
 *   자세한 것은 `lib/weekly.ts` 의 `shouldSend` 주석에 있다.
 *
 * ★★★ **같은 주에 두 번 가지 않는다.** `settings.weekly.lastSentAt` 이 **이번 주**(일요일 00:00 KST)
 *   안이면 건너뛴다. 크론이 겹쳐 돌거나 재시도해도 안전하다.
 *   ⚠ 보내기 **전에** 찍지 않고 **보낸 뒤에** 찍는다 — 먼저 찍으면 발송이 실패했을 때
 *     그 주를 통째로 건너뛴다.
 *
 * ★★ **한 번호에는 한 통만** (2026-09-12 지시 A2). 한 분이 사이트를 둘 가진 경우가 실제로 있어
 *   그대로 두면 같은 번호로 같은 날 두 통이 갔다. 그래서 보내기 **전에** 후보를 모아
 *   `pickOnePerPhone` 으로 한 곳만 남긴다. 고르는 규칙과 이유는 그 함수 주석에 있다.
 *
 * ★★ **첫 문자에는 거부 안내 한 줄**이 붙는다 (2026-09-12 회장님 결정 C안 · 지시 A1).
 *   동의 기록(`consents`)이 없는 기존 사장님들께 가는 첫 통이라, 끄는 길을 그 자리에서 드린다.
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
  const out = { looked: 0, due: 0, sent: 0, failed: 0, skippedSuspended: 0, noPhone: 0, samePhone: 0 };

  /* 살아 있는 사이트만 본다 — 정지된 곳에 촬영을 독려하면 화만 난다 */
  const { data: sites, error } = await sb
    .from("sites")
    .select("id, slug, business_name, settings, status, trial_ends_at, suspended_at, updated_at")
    .in("status", ["trial", "active"]);
  if (error) {
    console.error(JSON.stringify({ evt: "weekly_query_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const canSms = notifyChannels().sms;
  const now = new Date();

  /* ════ ① 보낼 때가 된 곳만 먼저 «모은다» ════
     ⚠ 바로 보내면 안 된다. 같은 번호를 걸러내려면 **전체 후보를 다 본 뒤에** 골라야 한다. */
  type Cand = {
    id: string; slug: string; businessName: string;
    settings: Record<string, unknown>; w: Weekly;
    phone: string; status: string | null; updatedAt: string | null;
  };
  const cands: Cand[] = [];

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

    cands.push({
      id: s.id as string,
      slug: s.slug as string,
      businessName: s.business_name as string,
      settings, w: w as Weekly, phone,
      status: (s.status as string) ?? null,
      updatedAt: (s.updated_at as string) ?? null,
    });
  }

  /* ════ ② 같은 번호는 한 곳만 ════
     ⚠ 조용히 버리지 않는다 — 어느 사이트를 어느 사이트 때문에 건너뛰었는지 로그에 남긴다.
       나중에 「왜 이 사이트만 문자가 안 오냐」는 물음에 답할 수 있어야 한다. */
  const { chosen, dropped } = pickOnePerPhone(cands);
  out.samePhone = dropped.length;
  for (const d of dropped) {
    console.log(JSON.stringify({ evt: "weekly_same_phone_skipped", slug: d.slug, inFavorOf: d.inFavorOf }));
  }

  /* ════ ③ 보낸다 ════ */
  for (const c of chosen) {
    const link = storyLinkUrl(c.slug, "https://onstori.com");
    /* ★★ 알림톡에 실을 수 있는 질문만 고른다 (2026-09-12 지시 D5).
       「~해 주세요」로 끝나는 명령문 8개는 광고성으로 읽혀 **반려 사유**가 된다.
       ⚠ 문자와 알림톡이 **같은 문장**을 쓰게 둔다 — 두 벌을 만들면 한쪽만 고쳐진다. */
    const askable = ALIMTALK_QUESTIONS;
    const q = askable[Math.floor(Math.random() * askable.length)];
    /* ★★ 「60초만 말씀해 주세요」를 **뺐다.** 행동을 시키는 문장이 알림톡 반려 사유다.
       무엇을 하라는 말은 **링크 너머 녹화 화면**이 한다 — 거기서 하면 문제가 없다.
       ★ 대신 «언제까지»를 넣는다. 유효기간이 있어야 「배송물」로 읽힌다(김팀장 조사). */
    const body = `[온스토리] ${c.businessName} 사장님, 이번 주 질문이 도착했어요.\n"${q.text}"\n${deadlineText(now)}까지 열어 보실 수 있어요.\n${link}`;
    /* ★ 첫 통이면 거부 안내를 붙인다 (C안). `lastSentAt` 이 비었다 = 처음 가는 문자다. */
    const text = withOptOut(body, !c.w.lastSentAt);

    /* ★ 보내기 «전»에 스스로 검사한다 — 반려 사유가 될 말이 섞이면 안 보낸다.
       ⚠ 조용히 안 보내지 않는다. 로그에 어느 말이 걸렸는지 적는다. */
    const banned = hasBannedPhrase(text);
    if (banned) {
      console.error(JSON.stringify({ evt: "weekly_banned_phrase", slug: c.slug, banned }));
      out.failed++; continue;
    }

    const ok = await sendSmsRaw(c.phone, text);
    if (!ok) { out.failed++; continue; }
    out.sent++;

    /* ★ 보낸 뒤에 찍는다. 먼저 찍으면 발송 실패 시 그 주를 통째로 건너뛴다. */
    await sb.from("sites")
      .update({ settings: { ...c.settings, weekly: { ...c.w, lastSentAt: new Date().toISOString() } } })
      .eq("id", c.id);
  }

  console.log(JSON.stringify({ evt: "weekly_done", ...out }));

  /* ★★ SNS 유지보수를 **여기에 얹는다** (2026-09-12 회장님 지시 1·8).
     ① 인스타 60일 토큰을 죽기 전에 갱신 ② 화면을 닫아 「받는 중」으로 멈춘 영상 마무리.

     ⚠ 왜 새 크론을 안 만드나: `vercel.json` 의 크론 한 줄이 배포 전체를 실패시킨 적이 있고
       (2026-09-12), 무료 요금제는 크론 개수에도 제한이 있다. 매일 도는 이 크론에 얹는 것이
       가장 안전하다. 나중에 분리할 때는 `lib/sns/maintenance.ts` 를 부르는 라우트만 새로 만들면 된다.
     ⚠ 문자 발송이 실패해도 유지보수는 돈다 — 위 반복문이 이미 끝난 뒤라 서로 막지 않는다. */
  const sns = { refresh: null as unknown, tiktok: null as unknown, finish: null as unknown, alive: null as unknown };
  try { sns.refresh = await refreshInstagramTokens(); }
  catch (e) { console.error(JSON.stringify({ evt: "sns_refresh_crashed", err: String(e).slice(0, 200) })); }
  /* ★ 틱톡 토큰은 24시간짜리다 — 인스타(60일)와 따로 민다 */
  try { sns.tiktok = await refreshTiktokTokens(); }
  catch (e) { console.error(JSON.stringify({ evt: "tt_refresh_crashed", err: String(e).slice(0, 200) })); }
  try { sns.finish = await finishStuckPosts(); }
  catch (e) { console.error(JSON.stringify({ evt: "sns_finish_crashed", err: String(e).slice(0, 200) })); }
  /* ③ 올린 글이 그쪽에서 지워졌는지 — 화면이 「올라갔어요」라고 거짓말하지 않게 (지시 2) */
  try { sns.alive = await checkPublishedAlive(); }
  catch (e) { console.error(JSON.stringify({ evt: "sns_alive_crashed", err: String(e).slice(0, 200) })); }
  console.log(JSON.stringify({ evt: "sns_maintenance_done", ...sns }));

  return NextResponse.json({ ...out, sns });
}
