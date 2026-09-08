import { COLORS, FONTS, MODE_TOKENS, STYLES, STYLE_TOKENS } from "../config/design";
import { brandRamp, contrast, hexToHsl, relLum } from "../lib/design-tokens";

/**
 * 대비 전수 검사 — **색을 잘못 고르면 버튼 글자가 사라지는 것**을 막는다.
 *
 * 스타일 5 × 색 20 × 모드 2 = 200조합을 전부 돌려, 글자가 배경 위에서
 * 읽히는지(WCAG 대비비)를 잰다. 하나라도 못 넘으면 종료 코드 1 로 죽는다.
 *
 * 실행: `npx tsx scripts/design-contrast.ts`
 *
 * ⚠ 이 검사가 없으면 노랑·하늘색을 고르는 순간 흰 글자가 흰 버튼 위에 놓인다.
 *   `lib/design-tokens.ts` 의 capForWhite/capOn 이 그걸 막는데, 그 보정이
 *   실제로 200조합 전부에서 통하는지는 재 봐야 안다.
 */

/** WCAG 기준 — 본문 4.5:1, 큰 글자(24px 이상 또는 굵은 19px 이상) 3:1 */
const BODY = 4.5;

function lumOfHex(hex: string): number {
  const [h, s, l] = hexToHsl(hex);
  return relLum(h, s, l);
}

/** `hsl(148 100% 18%)` 문자열의 휘도 */
function lumOfHsl(v: string): number {
  const m = /hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/.exec(v);
  if (!m) throw new Error(`hsl 파싱 실패: ${v}`);
  return relLum(Number(m[1]), Number(m[2]), Number(m[3]));
}

type Fail = { style: string; color: string; mode: string; pair: string; ratio: number; need: number };
const fails: Fail[] = [];
let checked = 0;

for (const style of STYLES) {
  for (const color of COLORS) {
    for (const mode of ["light", "dark"] as const) {
      const ramp = brandRamp(color.hex);
      const m = MODE_TOKENS[mode];
      const s = STYLE_TOKENS[style.id];
      if (!s) throw new Error(`스타일 토큰 없음: ${style.id}`);

      /** `var(--brand-N)` 을 실제 값으로 푼다 */
      const resolve = (v: string): string => {
        const r = /var\((--[\w-]+)\)/.exec(v);
        return r ? (ramp[r[1]] ?? m[r[1]] ?? v) : v;
      };
      const lum = (v: string): number => {
        const x = resolve(v);
        return x.startsWith("#") ? lumOfHex(x) : lumOfHsl(x);
      };

      const pairs: [string, string, string, number][] = [
        // 버튼 면 위의 글자 — 제일 크게 다치는 자리다
        ["주 버튼 글자", m["--on-solid"], m["--brand-solid"], BODY],
        /* 브랜드색 글자. ⚠ `--brand-text` 를 직접 재면 안 된다 — 그건 **밝은 배경 전용**으로
           계산한 값이고, 어두운 모드에서 화면에 실제로 쓰이는 것은 `--brand-ink` 다
           (밝은 모드 = --brand-text, 어두운 모드 = --brand-3). 2026-09-08 에 이걸 헷갈려
           「미달 120건」이라는 가짜 실패를 한 번 냈다. */
        ["브랜드 글자", m["--brand-ink"], m["--surface-2"], BODY],
        ["브랜드 글자(흰 면)", m["--brand-ink"], m["--surface"], BODY],
        ["브랜드 글자(제일 어두운 면)", m["--brand-ink"], m["--surface-3"], BODY],
        // 본문·보조 글자
        ["본문", m["--text"], m["--surface"], BODY],
        ["제목", m["--text-strong"], m["--surface"], BODY],
        ["본문(연회색 면)", m["--text"], m["--surface-2"], BODY],
        // 옅은 브랜드 띠 위의 브랜드 글자
        ["연한 띠 글자", m["--brand-tint-ink"], m["--brand-tint"], BODY],
      ];

      for (const [name, fg, bg, need] of pairs) {
        if (!fg || !bg) throw new Error(`토큰 없음: ${name} (${style.id}/${mode})`);
        const ratio = contrast(lum(fg), lum(bg));
        checked++;
        if (ratio < need) fails.push({ style: style.id, color: color.name, mode, pair: name, ratio, need });
      }
    }
  }
}

const combos = STYLES.length * COLORS.length * 2;
console.log(`조합 ${combos}개 (스타일 ${STYLES.length} × 색 ${COLORS.length} × 모드 2) · 대비 ${checked}건 검사`);
console.log(`손님 사이트는 여기에 글씨체 ${FONTS.length}개가 곱해지지만 글씨체는 색을 바꾸지 않는다.`);

if (fails.length === 0) {
  console.log("✅ 대비 미달 0건");
  process.exit(0);
}

console.log(`❌ 대비 미달 ${fails.length}건`);
const worst = fails.sort((a, b) => a.ratio - b.ratio).slice(0, 20);
for (const f of worst) {
  console.log(`  ${f.mode} · ${f.color} · ${f.style} · ${f.pair} = ${f.ratio.toFixed(2)}:1 (필요 ${f.need})`);
}
process.exit(1);
