/**
 * X(트위터)로 나가는 글에서 **주소를 지운다.** (2026-09-11)
 *
 * ★★ 왜 돈이 걸린 문제인가: X 는 글에 외부 링크가 들어가면 요금이 **13배** 뛴다
 *   ($0.015 → $0.200). 한 건이 아니라 올릴 때마다다.
 *
 * ★★ **화면에서 막는 것으로는 부족하다.** 글의 원본(`story_entries.question`)은
 *   녹화 화면이 보낸 값이고(`/api/story/submit` 이 그대로 받는다), 그 화면은 사장님 폰에서 돈다.
 *   누가 화면을 조작해 URL 을 심으면 그대로 X 까지 간다. 그래서 **서버가, 보내기 직전에** 지운다.
 *
 * ★ 무엇을 지우나 — **X 가 «링크»로 알아보는 것**을 지운다. 그것이 요금을 올리는 기준이다.
 *   · `https://…` `http://…` 같은 주소
 *   · `www.…`
 *   · 껍데기 없는 주소 — `onstori.com/sample` · `bit.ly/abc` · `me2.do/x` · `naver.co.kr`
 *   · 숨긴 모양 — `onstori[.]com` · `onstori(.)com` · `hxxps://…`
 *
 * ⚠ **넘치게 지우는 쪽을 고른다.** 잘못 지우면 글자 몇 개를 잃지만,
 *   덜 지우면 **요금이 13배** 된다. 손해의 크기가 다르다.
 *   ⚠ 「onstori 점 com」처럼 사람이 읽는 모양은 지우지 않는다 — X 도 링크로 세지 않아 요금이 안 오른다.
 */

/** 짧은 주소·흔한 끝말. 「.ly」(bit.ly) 「.gd」(is.gd) 「.do」(me2.do) 「.in」(lnkd.in) 같은 것을 반드시 넣는다 */
const TLD = [
  "com", "net", "org", "io", "co", "kr", "me", "ly", "gg", "app", "dev", "xyz", "info", "biz",
  "tv", "cc", "to", "link", "page", "site", "shop", "store", "blog", "news", "club", "online",
  "live", "art", "ai", "be", "it", "us", "uk", "jp", "cn", "de", "fr", "ru", "eu", "in", "id",
  "vn", "tw", "hk", "sg", "au", "ca", "nz", "br", "mx", "es", "nl", "se", "no", "fi", "dk",
  "pl", "cz", "tr", "za", "ph", "th", "my", "gl", "gd", "do", "la", "sh", "st", "fm", "am",
  "pw", "ws", "tk", "cf", "ga", "ml", "im", "cat", "pro", "top", "vip", "one", "run", "fyi",
].join("|");

/** 숨긴 점을 제 모양으로 되돌린다 — 이것부터 해야 아래 검사가 걸린다 */
function unmask(s: string): string {
  return s
    .replace(/\s*[[({<]\s*\.\s*[\])}>]\s*/g, ".")   // example[.]com · example (.) com
    .replace(/\bh\s*x\s*x\s*p(s?)\s*:/gi, "http$1:") // hxxp:// · hxxps://
    .replace(/\bh\s*t\s*t\s*p(s?)\s*:/gi, "http$1:"); // h t t p : //
}

const RE_PROTO = /\b(?:https?|ftp):\/\/\S+/gi;
const RE_WWW = /\bwww\.\S+/gi;
/** 껍데기 없는 주소 — 끝말이 위 목록에 있을 때만. 뒤에 /경로 ?물음 #표시가 붙어도 함께 지운다 */
const RE_BARE = new RegExp(
  String.raw`\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${TLD})\b(?:[/?#][^\s]*)?`,
  "gi",
);

/** 주소가 하나라도 들어 있나 — **보내기 직전 마지막 확인**에 쓴다 */
export function hasUrl(text: string): boolean {
  const s = unmask(text ?? "");
  return RE_PROTO.test(s) || RE_WWW.test(s) || RE_BARE.test(s);
}

/**
 * 주소를 지우고 남은 글을 돌려준다.
 * ⚠ 지운 자리에 「(링크 제거)」 같은 말을 넣지 않는다 — 그 자체가 지저분하고,
 *   사장님이 원했던 글이 아니게 된다. 대신 화면이 **미리** 「X 에는 링크가 안 들어가요」라고 알린다.
 */
export function stripUrls(text: string): string {
  let s = unmask(text ?? "");
  s = s.replace(RE_PROTO, " ").replace(RE_WWW, " ").replace(RE_BARE, " ");
  return s.replace(/[ \t ]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
}

/**
 * ★ 그 SNS 로 보낼 글을 만든다. **X 만 주소를 지운다** — 다른 곳은 링크가 있어야 손님이 찾아온다.
 *
 * ⚠ 이 함수를 거치지 않고 caption 을 어댑터에 직접 넘기지 마라. 돈이 걸린 자리다.
 */
export function captionFor(provider: string, text: string): string {
  return provider === "x" ? stripUrls(text) : text;
}
