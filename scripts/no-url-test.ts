import { captionFor, hasUrl, stripUrls } from "../lib/sns/no-url";

/**
 * X 로 나가는 글에 주소가 남는지 검사. (2026-09-11)
 * ★ 돈이 걸린 자리다 — 하나라도 새면 요금이 13배가 된다. 실패하면 종료코드 1.
 * 실행: `npx tsx scripts/no-url-test.ts`
 */

/** 반드시 지워져야 하는 것 */
const MUST_GO = [
  "https://onstori.com/sample-interior",
  "http://example.com",
  "우리 홈페이지 https://onstori.com/dasan 놀러오세요",
  "www.naver.com 에서 검색",
  "onstori.com",
  "onstori.com/dasan-remodel",
  "bit.ly/3xYzAb",
  "t.co/abcdef",
  "me2.do/xyz",
  "is.gd/abc",
  "lnkd.in/abc",
  "goo.gl/maps/xyz",
  "vo.la/abcd",
  "naver.co.kr",
  "blog.naver.com/dasan",
  "저희 블로그 blog.naver.com/dasan 입니다",
  "onstori[.]com",
  "onstori(.)com",
  "hxxps://onstori.com/x",
  "instagram.com/onstori",
  "youtu.be/abc123",
  "shop.example.store/item?id=3#top",
  "여러 개 https://a.com 그리고 b.co.kr 둘 다",
];

/** 지워지면 안 되는 것 — 넘치게 지우다 멀쩡한 글을 망치면 안 된다 */
const MUST_STAY = [
  ["다산 리모델링입니다. 20년 했습니다.", "다산 리모델링입니다. 20년 했습니다."],
  ["1.5t 트럭으로 옮깁니다", "1.5t 트럭으로 옮깁니다"],
  ["오전 9.30 에 문 엽니다", "오전 9.30 에 문 엽니다"],
  ["가격은 3.5만원입니다", "가격은 3.5만원입니다"],
  ["onstori 점 com 으로 오세요", "onstori 점 com 으로 오세요"],
  ["A/S 는 1년입니다", "A/S 는 1년입니다"],
];

let bad = 0;

console.log("── 반드시 지워져야 하는 것 ──");
for (const t of MUST_GO) {
  const out = stripUrls(t);
  const left = hasUrl(out);
  if (left) { console.log(`  ❌ 남았다: ${JSON.stringify(t)} → ${JSON.stringify(out)}`); bad++; }
  else console.log(`  ✅ ${JSON.stringify(t)} → ${JSON.stringify(out)}`);
}

console.log("\n── 지워지면 안 되는 것 ──");
for (const [t, want] of MUST_STAY) {
  const out = stripUrls(t);
  if (out !== want) { console.log(`  ❌ 망가졌다: ${JSON.stringify(t)} → ${JSON.stringify(out)}`); bad++; }
  else console.log(`  ✅ ${JSON.stringify(t)}`);
}

console.log("\n── X 만 지운다(다른 곳은 링크가 있어야 손님이 온다) ──");
const sample = "우리 홈페이지 https://onstori.com/dasan 입니다";
for (const p of ["x", "instagram", "youtube"]) {
  const out = captionFor(p, sample);
  const ok = p === "x" ? !hasUrl(out) : out === sample;
  console.log(`  ${ok ? "✅" : "❌"} ${p}: ${JSON.stringify(out)}`);
  if (!ok) bad++;
}

console.log(`\n검사 ${MUST_GO.length + MUST_STAY.length + 3}건 · 실패 ${bad}건`);
process.exit(bad ? 1 : 0);
