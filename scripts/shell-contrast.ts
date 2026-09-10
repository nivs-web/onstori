/**
 * 껍데기 대비 검사 — 어드민 콘솔·사장님 편집화면 (2026-09-09, S2⑦).
 *
 * `scripts/design-contrast.ts` 는 **브랜드 색 200조합**을 검사한다.
 * 이 스크립트는 그게 안 보는 **면·글자 짝**을 잰다 — 바탕/카드면/본문/보조글자/제목/토스트/버튼.
 *
 * 실행: `npx tsx scripts/shell-contrast.ts`
 *
 * ⚠ 이 검사가 없어서 어두운 어드민의 보조 글자(.t-caption)가 2.67:1 로 반년 가까이 묻혀 있었다.
 */
import { MODE_TOKENS, COLORS, STYLES } from "../config/design";
import { brandRamp, contrast, hexToHsl, relLum } from "../lib/design-tokens";

const lum = (hex: string) => { const [h, s, l] = hexToHsl(hex); return relLum(h, s, l); };
const parseHsl = (v: string) => { const m = v.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!; return relLum(+m[1], +m[2], +m[3]); };

const N900 = "#1A2722"; // globals.css :root --n-900 (45행 실측)
type Row = { 이름: string; 대비: string; 기준: number; 통과: string };
const rows: Row[] = [];
const check = (name: string, a: number, b: number, min: number) => {
  const c = contrast(a, b);
  rows.push({ 이름: name, 대비: c.toFixed(2) + ":1", 기준: min, 통과: c >= min ? "✅" : "❌" });
};

for (const mode of ["light", "dark"] as const) {
  const M = MODE_TOKENS[mode];
  const surface = lum(M["--surface"]);
  const canvas = lum(M["--canvas"]);
  const textSoft = mode === "dark" ? lum(M["--text-3"]) : lum("#50665E"); // 다크는 --text-3 로 되돌림, 밝은 화면은 --n-700 그대로
  const text = lum(M["--text"]);
  const strong = lum(M["--text-strong"]);
  check(`[${mode}] 본문 --text / 카드면 --surface`, text, surface, 4.5);
  check(`[${mode}] 본문 --text / 바탕 --canvas`, text, canvas, 4.5);
  check(`[${mode}] 보조 --text-soft / 카드면 --surface`, textSoft, surface, 4.5);
  check(`[${mode}] 제목 --text-strong / 카드면 --surface`, strong, surface, 4.5);
}

// 토스트 — 배경 --n-900 은 모드와 무관한 원시 토큰
const n900 = lum(N900);
check(`[dark] 토스트 글자 --text-strong / 배경 --n-900`, lum(MODE_TOKENS.dark["--text-strong"]), n900, 4.5);
check(`[light] 토스트 글자 --n-0(#FFFFFF) / 배경 --n-900`, lum("#FFFFFF"), n900, 4.5);

// 초록 «면» 버튼 — 색 20개 전부 (다크에서 --brand-solid = --brand-3, 글자 --on-solid = --brand-9)
let worst = { name: "", c: 99 };
for (const col of COLORS) {
  const r = brandRamp(col.hex);
  const bg = parseHsl(r["--brand-3"]);
  const fg = parseHsl(r["--brand-9"]);
  const c = contrast(bg, fg);
  if (c < worst.c) worst = { name: col.name, c };
}
rows.push({ 이름: `[dark] 초록 면 버튼 최악 (${worst.name})`, 대비: worst.c.toFixed(2) + ":1", 기준: 4.5, 통과: worst.c >= 4.5 ? "✅" : "❌" });

/* 참고용 한 줄 — 2026-09-09 이전 값. 이게 왜 고쳐졌는지 남긴다(고의로 ❌ 다) */
const BEFORE = contrast(lum("#50665E"), lum(MODE_TOKENS.dark["--surface"]));
console.table(rows);
console.log("스타일", STYLES.length, "벌은 색을 바꾸지 않는다(간격·모서리·굵기만) — 대비에 영향 없음");
console.log(`참고 — 2026-09-09 이전 어두운 화면의 보조글자(--text-soft = --n-700)는 ${BEFORE.toFixed(2)}:1 이었다. 그래서 고쳤다.`);
const fail = rows.filter((r) => r.통과 === "❌");
if (fail.length) { console.error(`❌ 미달 ${fail.length}건`); process.exit(1); }
console.log("✅ 껍데기 대비 미달 0건");
