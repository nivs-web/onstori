/**
 * **「어느 글자가 어느 글꼴 조각에 있나」 지도를 만든다.** (2026-09-16 지시 [5])
 *
 * ★★ 왜 필요한가: 로고 SVG 에 글꼴을 심으려면 **상호에 쓰인 글자가 든 조각**만 골라야 한다.
 *   Pretendard 는 `unicode-range` 로 92조각으로 쪼개져 있고(2.8MB), 그 정보는 `app/fonts.css` 에 있다.
 *
 * 🔴 **`app/fonts.css` 는 브라우저가 «주소로» 받을 수 없다.** Next 가 번들에 넣어 버려서
 *   `/fonts.css` 는 **404** 다(2026-09-16 운영에서 실측). 그래서 지도를 **미리 뽑아**
 *   `public/fonts/pretendard/ranges.json` 으로 둔다 — 그건 주소로 받을 수 있다.
 *
 * ⚠ 이 스크립트를 안 돌리면 `lib/logo-embed.ts` 가 조용히 실패하고, 사장님은
 *   **미리보기와 다른 로고**를 받는다. 그래서 `prebuild` 에 넣었다.
 *
 * 쓰는 법:  node scripts/build-font-ranges.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "app/fonts.css";
const OUT = "public/fonts/pretendard/ranges.json";

if (!existsSync(SRC)) {
  console.error(`⚠ ${SRC} 가 없습니다 — 지도를 만들지 못했습니다`);
  process.exit(1);
}

const css = readFileSync(SRC, "utf8");
const map = [];

/* @font-face 블록마다 «조각 주소»와 «담당 글자 범위»를 짝지어 꺼낸다 */
for (const block of css.split("@font-face").slice(1)) {
  const u = block.match(/url\((\/fonts\/[^)]+\.woff2)\)/);
  const r = block.match(/unicode-range:\s*([^;}]+)/i);
  if (!u || !r) continue;

  const ranges = [];
  for (const part of r[1].split(",")) {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) continue;
    const a = parseInt(m[1], 16);
    ranges.push([a, m[2] ? parseInt(m[2], 16) : a]);
  }
  if (ranges.length) map.push({ url: u[1], ranges });
}

if (!map.length) {
  console.error("⚠ 조각을 하나도 못 찾았습니다 — fonts.css 모양이 바뀌었을 수 있습니다");
  process.exit(1);
}

/**
 * ★ 범위를 «묶어서» 줄인다 — 붙어 있는 구간(U+ac00-ac01, U+ac02)은 한 구간으로 합친다.
 *   그냥 쓰면 53KB 인데, 이 지도는 **로고 만들 때마다** 받는 파일이라 작을수록 좋다.
 */
for (const m of map) {
  m.ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of m.ranges) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  m.ranges = merged;
}

writeFileSync(OUT, JSON.stringify(map), "utf8");

/* ★ 한글 음절(가~힣)을 담당하는 조각이 실제로 있는지 본다 — 없으면 한글 로고에 글꼴이 안 심긴다 */
const hasHangul = map.some((m) => m.ranges.some(([a, b]) => a <= 0xd7a3 && b >= 0xac00));
console.log(`글꼴 지도 ${map.length}조각 → ${OUT}`);
console.log(`  한글 음절을 담당하는 조각: ${hasHangul ? "있음 ✅" : "❌ 없음 — 한글 로고에 글꼴이 안 심깁니다"}`);
if (!hasHangul) process.exit(1);
