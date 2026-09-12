import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw, notifyChannels } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { ALIMTALK_QUESTIONS } from "@/config/questions";
import {
  readWeekly, shouldSend, deadlineText, hasBannedPhrase, withOptOut, pickOnePerPhone,
  phoneKey, safeBusinessName, sentThisWeekToPhone,
  type Weekly,
} from "@/lib/weekly";
import { trialInfo } from "@/lib/trial";
import { isPremade, premadeReason } from "@/lib/premade";
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
  const out = {
    looked: 0, due: 0, sent: 0, failed: 0, skippedSuspended: 0, noPhone: 0,
    samePhone: 0, sameWeekPhone: 0, stampFailed: 0, skippedPremade: 0,
  };

  /* 살아 있는 사이트만 본다 — 정지된 곳에 촬영을 독려하면 화만 난다 */
  const { data: sites, error } = await sb
    .from("sites")
    /* ★ 주인 정보를 함께 읽는다 — 「미리 만들어 둔 곳인가」를 판정해야 한다 (2026-09-13) */
    .select("id, slug, business_name, settings, status, trial_ends_at, suspended_at, updated_at, owner_id, anon_id")
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

    /**
     * ★★★ **미리 만들어 둔 홈페이지에는 한 통도 보내지 않는다.** (2026-09-13 상무님 지적)
     *
     * ⚠ 위저드가 네이버·카카오에서 **그 가게의 진짜 번호**를 불러와 넣는다. 그리고 주 1회는
     *   켜진 채로 심긴다. 그런데 여기서 **「주인이 있는가」를 안 봤다** —
     *   목요일에 만든 견본이 **다음 날 아침 9시**에 곧바로 대상이 됐다.
     *   계약도 안 한 가게 사장님께 우리 이름으로 문자가 가는 길이었다.
     * ★ 판정은 `lib/premade.ts` 한 곳에 있다. 만료 크론도 같은 것을 쓴다.
     */
    if (isPremade(s)) {
      out.skippedPremade++;
      console.log(JSON.stringify({ evt: "weekly_skip_premade", slug: s.slug, why: premadeReason(s) }));
      continue;
    }

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

  /* ════ ②-2 «번호별» 이번 주 발송 기록 ════ (2026-09-13 점검에서 잡힌 것)
     ⚠ 위의 `pickOnePerPhone` 은 **같은 실행에서 동시에 후보가 된 경우**만 막는다.
       한 분이 사이트를 둘 갖고 **요일을 다르게** 골랐다면 두 실행 모두 후보가 하나씩이라
       그 함수가 아무것도 못 막고, 그 주에 두 통이 간다.
     ★ 그래서 «살아 있는 전체 사이트»에서 같은 번호를 쓰는 형제를 모아, 그중 하나라도
       이번 주에 보냈으면 건너뛴다. 그리고 보낸 뒤에는 **형제 전부에** 시각을 찍는다. */
  const byPhone = new Map<string, { id: string; settings: Record<string, unknown>; w: Weekly }[]>();
  for (const s of sites ?? []) {
    if (isPremade(s)) continue;                     // ★ 형제 목록에도 넣지 않는다
    const settings = (s.settings as Record<string, unknown>) ?? {};
    const w = readWeekly(settings);
    const phone = (w?.phone?.trim() || (settings.phone as string) || "").trim();
    if (!phone) continue;
    const k = phoneKey(phone);
    const list = byPhone.get(k) ?? [];
    list.push({ id: s.id as string, settings, w: (w ?? {}) as Weekly });
    byPhone.set(k, list);
  }

  /* ════ ③ 보낸다 ════ */
  for (const c of chosen) {
    const siblings = byPhone.get(phoneKey(c.phone)) ?? [];
    if (sentThisWeekToPhone(siblings.map((x) => x.w), now)) {
      out.sameWeekPhone++;
      console.log(JSON.stringify({ evt: "weekly_phone_already_sent_this_week", slug: c.slug }));
      continue;
    }

    const link = storyLinkUrl(c.slug, "https://onstori.com");
    /* ★★ 알림톡에 실을 수 있는 질문만 고른다 (2026-09-12 지시 D5).
       「~해 주세요」로 끝나는 명령문 8개는 광고성으로 읽혀 **반려 사유**가 된다.
       ⚠ 문자와 알림톡이 **같은 문장**을 쓰게 둔다 — 두 벌을 만들면 한쪽만 고쳐진다. */
    const askable = ALIMTALK_QUESTIONS;
    const q = askable[Math.floor(Math.random() * askable.length)];
    /* ★★ 「60초만 말씀해 주세요」를 **뺐다.** 행동을 시키는 문장이 알림톡 반려 사유다.
       무엇을 하라는 말은 **링크 너머 녹화 화면**이 한다 — 거기서 하면 문제가 없다.
       ★ 대신 «언제까지»를 넣는다. 유효기간이 있어야 「배송물」로 읽힌다(김팀장 조사). */
    /* ★★ 상호를 **소독해서** 싣는다 (2026-09-13). 사장님이 바꿀 수 있는 값이 우리 발신번호로
       그대로 나가면 사칭 문자가 된다 — `safeBusinessName` 주석 참고. */
    const name = safeBusinessName(c.businessName);
    const body = `[온스토리] ${name} 사장님, 이번 주 질문이 도착했어요.\n"${q.text}"\n${deadlineText(now)}까지 열어 보실 수 있어요.\n${link}`;
    /* ★ 첫 통이면 거부 안내를 붙인다 (C안). `lastSentAt` 이 비었다 = 처음 가는 문자다. */
    const text = withOptOut(body, !c.w.lastSentAt);

    /* ★ 보내기 «전»에 스스로 검사한다 — 반려 사유가 될 말이 섞이면 안 보낸다.
       ⚠⚠ **상호는 검사 대상에서 뺀다** (2026-09-13 점검). 전에는 상호가 섞인 본문 전체를 봤는데,
         그러면 「○○이벤트」·「무료견적○○」 같은 **흔한 상호를 가진 사장님이 영영 못 받는다.**
         돈 내고 산 기능이 그분에게만 조용히 안 되는 것이 더 나쁘다.
       ⚠ 대신 상호에 그런 말이 있으면 **로그로 남긴다** — 알림톡을 열 때 사람이 봐야 한다. */
    const ours = withOptOut(
      `[온스토리] 이번 주 질문이 도착했어요.\n"${q.text}"\n${deadlineText(now)}까지 열어 보실 수 있어요.\n${link}`,
      !c.w.lastSentAt,
    );
    const banned = hasBannedPhrase(ours);
    if (banned) {
      console.error(JSON.stringify({ evt: "weekly_banned_phrase", slug: c.slug, banned }));
      out.failed++; continue;
    }
    const inName = hasBannedPhrase(name);
    if (inName) console.warn(JSON.stringify({ evt: "weekly_name_has_banned", slug: c.slug, word: inName }));

    const ok = await sendSmsRaw(c.phone, text);
    if (!ok) { out.failed++; continue; }
    out.sent++;

    /* ★ 보낸 뒤에 찍는다. 먼저 찍으면 발송 실패 시 그 주를 통째로 건너뛴다.
       ★★ **같은 번호를 쓰는 형제 사이트에도 함께 찍는다** (2026-09-13) —
         안 찍으면 요일이 다른 형제가 이번 주에 한 통 더 보낸다.
       ⚠ 저장 결과를 **버리지 않는다.** 못 찍으면 다음 날 크론이 또 보낸다 —
         「같은 주에 두 번 가지 않는다」는 약속이 조용히 깨지는 자리다. */
    const stamp = new Date().toISOString();
    const targets = siblings.length ? siblings : [{ id: c.id, settings: c.settings, w: c.w }];
    for (const t of targets) {
      const { error: upErr } = await sb.from("sites")
        .update({ settings: { ...t.settings, weekly: { ...t.w, lastSentAt: stamp } } })
        .eq("id", t.id);
      if (upErr) {
        out.stampFailed++;
        console.error(JSON.stringify({ evt: "weekly_stamp_failed", id: t.id, err: upErr.message.slice(0, 160) }));
      } else t.w.lastSentAt = stamp;     // 같은 실행 안에서도 다시 안 보내게
    }
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
