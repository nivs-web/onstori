import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sendSmsRaw, notifyChannels } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { pickQuestions } from "@/config/questions";
import { isPremade, premadeReason } from "@/lib/premade";
import { hasBannedPhrase, safeBusinessName } from "@/lib/weekly";

/**
 * [녹화 링크 문자로 받기] — 에디터(소유자)에서 호출. 문자에 이번 주 질문 1개 + 링크.
 * 문자 채널(솔라피) env 가 없으면 링크만 돌려준다 — 화면이 "지금 열기"로 안내한다.
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const origin = new URL(req.url).origin.replace("http://localhost", "https://onstori.com").replace(/^http:\/\/127[^/]*/, "https://onstori.com");
  const link = storyLinkUrl(r.site.slug, origin.startsWith("https://onstori.com") ? "https://onstori.com" : origin);
  const phone = (r.site.settings as { phone?: string } | null)?.phone ?? "";
  const q = pickQuestions(1)[0];
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
     상호를 가진 사장님이 영영 못 받는다 — 주간 크론에서 이미 배운 것이다. */
  const ours = `[온스토리] 사장님, 이번 주 질문이 도착했어요.\n"${q.text}"\n아래 링크를 브라우저에서 열어 주세요. (카톡 안에서 열리면 '기본 브라우저로 열기')\n${link}`;
  const banned = hasBannedPhrase(ours);

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
   *   막는 것은 «문자»뿐이다.
   */
  const premade = isPremade(r.site);

  let sent = false;
  if (premade) {
    console.log(JSON.stringify({ evt: "sendlink_skip_premade", slug: r.site.slug, why: premadeReason(r.site) }));
  } else if (banned) {
    /* ⚠ 조용히 보내지 않는다 — 사람이 문구를 고쳐야 하는 일이다 */
    console.error(JSON.stringify({ evt: "sendlink_banned_phrase", slug: r.site.slug, banned }));
  } else if (phone && notifyChannels().sms) {
    sent = await sendSmsRaw(phone, text);
  }

  return NextResponse.json({
    ok: true, sent, link, question: q.text,
    phone: sent && phone ? phone.replace(/(\d{3})\d+(\d{4})/, "$1****$2") : null,
    /* ★ 왜 안 갔는지 화면이 말할 수 있게 한다 — 조용히 «안 감»이면 고장으로 보인다 */
    blocked: premade
      ? "미리 만들어 둔 곳이라 문자를 보내지 않았어요. 아래 링크를 바로 열어 주세요."
      : banned
        ? "문자 문구에 쓸 수 없는 말이 섞여 보내지 않았어요. 아래 링크를 바로 열어 주세요."
        : null,
  });
}
