import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sendSmsRaw, sendEmailRaw, notifyChannels, notifyTargets } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { pickQuestions } from "@/config/questions";
import { isPremade, premadeReason } from "@/lib/premade";
import { hasBannedPhrase, safeBusinessName } from "@/lib/weekly";
import { canUse, lockedPayload } from "@/lib/plan-gate";
import { isValidPhone, formatPhone } from "@/lib/phone";

/**
 * [녹화 링크 메일로 받기] · [녹화 링크 문자로 받기] — 에디터(소유자)에서 호출.
 *
 * ★★ **2026-09-16 대표님 지시로 «두 갈래 + 받는 곳 직접 입력»으로 바꿨다.**
 *   전에는 버튼 하나였고, 누르는 «즉시» 사이트에 적힌 번호로 문자가 나갔다.
 *   지금은 이렇다:
 *     ① 화면이 먼저 `probe` 로 물어본다 — 「기본으로 채워 넣을 메일·번호가 뭔가,
 *        이 사장님이 문자를 쓸 수 있나」. **probe 는 아무것도 보내지 않는다.**
 *     ② 사장님이 받는 곳을 고치고 [보내기]를 눌러야 그때 `mode` 가 실려 온다.
 *
 * ⚠ **`mode` 가 없으면 «절대» 보내지 않는다(probe 로 본다).** 옛 화면이 브라우저에
 *   캐시로 남아 `{slug}` 만 보내도 문자가 새 나가면 안 된다 — 그 길을 여기서 막는다.
 *
 * 🔴 **문자는 정회원만.** 판정은 `lib/plan-gate.ts` 의 `canUse(site,"sms")` 하나가 한다.
 *   잠겼으면 **402**(결제 필요)로 `lockedPayload("sms")` 를 돌려준다 — 화면은 그 문구를
 *   그대로 보여 주고 [정회원 결제하기] 로 보낸다. **버튼을 숨기지 않는다**(대표님 방침).
 * ★ 메일은 «무조건 가는 길»이라 잠그지 않는다 — 건당 비용이 거의 0원이다(lib/notify.ts).
 */

type Mode = "email" | "sms";

/** 메일 주소 꼴인가 — 최소 검사. 진짜 존재하는지는 Resend 가 답으로 알려 준다 */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string; anonId?: string; mode?: string; to?: string; probe?: boolean;
  };
  const r = await loadOwnedSite(String(body.slug ?? ""), body.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const origin = new URL(req.url).origin.replace("http://localhost", "https://onstori.com").replace(/^http:\/\/127[^/]*/, "https://onstori.com");
  const link = storyLinkUrl(r.site.slug, origin.startsWith("https://onstori.com") ? "https://onstori.com" : origin);
  const q = pickQuestions(1)[0];
  const channels = notifyChannels();
  /* 🔴 문자 자물쇠 — 판정은 한 곳(`canUse`)만 한다. 여기서 날짜를 다시 세지 않는다 */
  const smsLocked = !canUse(r.site, "sms");

  /**
   * ★ **받는 곳 «기본값»** — 사장님이 매번 손으로 치시지 않게 미리 채워 드린다.
   *   `notifyTargets` 는 「설정 → 사이트에 적힌 번호 / 로그인 메일」 순으로 찾는다(lib/notify.ts).
   *   그 규칙을 여기에 다시 적지 않는다 — 두 곳이 정하면 반드시 어긋난다.
   */
  const targets = await notifyTargets(r.site.id as string);
  const sitePhone = (r.site.settings as { phone?: string } | null)?.phone ?? "";
  const fillPhone = formatPhone(targets.phone || sitePhone);
  const fillEmail = targets.email ?? "";

  const mode: Mode | null = body.mode === "email" || body.mode === "sms" ? body.mode : null;

  /* ── ① 물어보기만 하는 길 — 아무것도 보내지 않는다 ─────────────────── */
  if (body.probe || !mode) {
    return NextResponse.json({
      ok: true, probe: true, sent: false, link, question: q.text,
      fill: { email: fillEmail, phone: fillPhone },
      smsLocked, lock: smsLocked ? lockedPayload("sms") : null,
      ready: { sms: channels.sms, email: channels.email },
    });
  }

  /* ── ② 실제로 보내는 길 — [보내기] 를 눌렀을 때만 여기로 온다 ────────── */
  if (mode === "sms" && smsLocked) {
    /* 🔴 402 = 「결제하세요」. 401(로그인)·403(권한)과 반드시 구별되어야 한다 */
    return NextResponse.json({ ...lockedPayload("sms"), link, question: q.text }, { status: 402 });
  }

  const to = String(body.to ?? "").trim();
  if (mode === "sms" && !isValidPhone(to)) {
    return NextResponse.json({ error: "받을 전화번호를 다시 확인해 주세요.", link, question: q.text }, { status: 400 });
  }
  if (mode === "email" && !looksLikeEmail(to)) {
    return NextResponse.json({ error: "받을 이메일 주소를 다시 확인해 주세요.", link, question: q.text }, { status: 400 });
  }

  /**
   * ★★★ **이 문장이 금지어 검사를 안 거치고 있었다.** (2026-09-13 상무님 지적 10)
   *
   * ⚠ 「60초만 **말씀해 주세요**」 — `BANNED_IN_NOTIFY` 에 그대로 들어 있는 말이다.
   *   행동을 시키는 문장은 광고성으로 읽혀 **알림톡 심사 반려 사유**가 된다. 주간 크론은
   *   보내기 전에 스스로 검사하는데(app/api/cron/weekly), **이 창구만 그냥 나갔다.**
   * ★ 그래서 ①문장에서 그 말을 빼고 ②주간 크론과 **같은 검사**를 여기서도 거친다.
   *   무엇을 하라는 말은 **링크 너머 녹화 화면**이 한다 — 거기서 하면 문제가 없다.
   *
   * ★ 상호도 **소독해서** 싣는다(`safeBusinessName`) — 사장님이 바꿀 수 있는 값이
   *   우리 발신번호로 그대로 나가면 사칭 문자가 된다. 주간 크론과 같은 규칙이다.
   */
  const name = safeBusinessName(r.site.business_name as string);
  const text = `[온스토리] ${name} 사장님, 이번 주 질문이 도착했어요.\n"${q.text}"\n아래 링크를 브라우저에서 열어 주세요. (카톡 안에서 열리면 '기본 브라우저로 열기')\n${link}`;

  /* ⚠ 검사는 **우리 문장만** 본다. 상호가 섞인 본문 전체를 보면 「○○이벤트」 같은 흔한
     상호를 가진 사장님이 영영 못 받는다 — 주간 크론에서 이미 배운 것이다.
     ⚠ 이 검사는 **문자(알림톡 심사)** 때문에 있다. 메일은 심사가 없어 검사에 걸리지 않는다 —
       메일까지 막으면 「무조건 가는 길」이 사라진다(2026-09-13 대표님 결정 6). */
  const ours = `[온스토리] 사장님, 이번 주 질문이 도착했어요.\n"${q.text}"\n아래 링크를 브라우저에서 열어 주세요. (카톡 안에서 열리면 '기본 브라우저로 열기')\n${link}`;
  const banned = mode === "sms" ? hasBannedPhrase(ours) : null;

  /**
   * ★★★ **문자가 나가는 «다섯째» 자리다.** (2026-09-13 상무님 지적 10)
   *
   * ⚠ 주간 크론·만료 크론에는 자물쇠를 걸었는데 **여기는 안 걸려 있었다.**
   *   `loadOwnedSite` 는 **운영자를 그냥 통과시킨다**(lib/site-owner.ts) — 즉 회장님이
   *   견본 편집화면에서 [녹화 링크 문자로 받기] 를 누르시면 **그 가게 진짜 번호로** 문자가 간다.
   *   위저드가 네이버·카카오에서 불러온 번호라, 계약도 안 한 가게 사장님께 간다.
   *
   * ★ 판정은 `lib/premade.ts` 한 곳을 그대로 쓴다. 자물쇠를 또 만들지 않는다.
   * ★ 링크는 그대로 돌려준다 — 회장님이 **이 기기에서 바로 열어** 견본을 채우실 수 있어야 한다.
   *   막는 것은 «보내기»뿐이다.
   * ⚠ **메일도 함께 막는다.** 받는 곳을 손으로 칠 수 있게 되었어도, 기본값으로 채워지는 값이
   *   그 가게의 진짜 메일이라 그대로 [보내기] 를 누르면 같은 사고가 난다.
   */
  const premade = isPremade(r.site);

  let sent = false;
  let failWhy = "";
  if (premade) {
    console.log(JSON.stringify({ evt: "sendlink_skip_premade", slug: r.site.slug, mode, why: premadeReason(r.site) }));
  } else if (banned) {
    /* ⚠ 조용히 보내지 않는다 — 사람이 문구를 고쳐야 하는 일이다 */
    console.error(JSON.stringify({ evt: "sendlink_banned_phrase", slug: r.site.slug, banned }));
  } else if (mode === "sms") {
    if (!channels.sms) failWhy = "문자 채널이 아직 연결되지 않았어요. 아래 링크를 바로 열어 주세요.";
    else sent = await sendSmsRaw(to, text);
  } else {
    if (!channels.email) failWhy = "메일 채널이 아직 연결되지 않았어요. 아래 링크를 바로 열어 주세요.";
    /* ★ 제목은 본문 첫 줄과 같은 말이다 — 받는 분이 열기 전에도 무슨 메일인지 안다 */
    else sent = await sendEmailRaw(to, `[온스토리] ${name} 사장님, 이번 주 질문이 도착했어요.`, text);
  }

  if (!sent && !premade && !banned && !failWhy) {
    /* ⚠ 열쇠는 있는데 발송이 실패한 경우 — 「보냈습니다」로 보이면 안 된다 */
    failWhy = mode === "sms" ? "문자를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요." : "메일을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.";
  }

  return NextResponse.json({
    ok: true, sent, mode, link, question: q.text,
    /* ★ 사장님이 «직접 친 값»을 그대로 돌려준다 — 화면이 「○○로 보냈습니다」에 쓴다 */
    to: sent ? (mode === "sms" ? formatPhone(to) : to) : null,
    /* ★ 왜 안 갔는지 화면이 말할 수 있게 한다 — 조용히 «안 감»이면 고장으로 보인다 */
    blocked: premade
      ? "미리 만들어 둔 곳이라 보내지 않았어요. 아래 링크를 바로 열어 주세요."
      : banned
        ? "문자 문구에 쓸 수 없는 말이 섞여 보내지 않았어요. 아래 링크를 바로 열어 주세요."
        : failWhy || null,
  });
}
