import {
  DEFAULTS, MODE_TOKENS, STYLE_TOKENS,
  type DesignSetting, type DesignTarget, type ModeId, type StyleId,
} from "@/config/design";

/**
 * 테마 엔진의 **계산** — 고른 색 하나에서 화면에 쓸 값 한 벌을 만든다 (2026-09-08, S1).
 *
 * 왜 lib 인가: `config/` 는 제품 정책(값 목록), `lib/` 은 로직이다(CLAUDE.md 폴더 역할).
 * 스타일·색·서체 **목록**은 `config/design.ts`, 그 목록으로 **계산**하는 것은 여기다.
 *
 * ★ 여기에는 DOM 이 없다. 시안(design-v6-admin.html)의 `applyBrand()` 는
 *   `document.documentElement.style` 을 직접 만졌지만, 우리는 **서버에서 계산해
 *   값만 돌려준다.** 브라우저는 계산하지 않는다 — 그래야 첫 화면에서 색이 깜빡이지 않고,
 *   계산 코드가 손님에게 내려가지 않는다.
 *
 * ★ **대비 보정이 이 파일의 존재 이유다.** 사장님이 노랑·하늘색을 고르면 보정 없이는
 *   버튼 위 흰 글자가 그대로 사라진다. 고른 색의 실제 밝기를 재서 흰 글자가
 *   4.6:1 을 넘을 때까지 **어둡게** 내린다(밝게 올리지는 않는다).
 */

/* ─────────────────────────── 색 계산 ─────────────────────────── */

/** #RRGGBB → [색상각 0~360, 채도 %, 밝기 %] */
export function hexToHsl(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const H = h / 360, S = s / 100, L = l / 100;
  if (!S) return [L, L, L];
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(H + 1 / 3), f(H), f(H - 1 / 3)];
}

/** 사람 눈이 느끼는 밝기(상대 휘도). WCAG 정의 그대로다. 0=검정 1=흰색 */
export function relLum(h: number, s: number, l: number): number {
  const c = hslToRgb(h, s, l).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** 두 휘도 사이의 대비비 (1:1 ~ 21:1) */
export const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * 배경 휘도 `bgLum` 위에서 목표 대비를 넘도록 **밝기를 낮춘다.**
 * ⚠ 원래 색보다 밝게는 절대 만들지 않는다 — 사장님이 고른 색보다 화사해지면 딴 색이 된다.
 */
export function capOn(h: number, s: number, l: number, bgLum: number, target: number): number {
  let lo = 4, hi = l, best = l;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (contrast(bgLum, relLum(h, s, m)) >= target) { best = m; lo = m; } else { hi = m; }
  }
  return Math.min(l, best);
}

/** 흰 글자가 읽히는 밝기까지 내린다 (버튼 면에 쓴다) */
export const capForWhite = (h: number, s: number, l: number, target = 4.6): number => capOn(h, s, l, 1, target);

const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

/** 0~4 단계의 밝기. 위로 갈수록 옅다 */
const LMIX = [0.97, 0.92, 0.84, 0.72, 0.58];

/**
 * 브랜드색 글자가 앉을 수 있는 **가장 어두운 밝은-면**의 휘도.
 *
 * ⚠ 시안은 이 자리에 `0.899` 라는 **고정 숫자**를 박아 뒀다. 그런데 실제 면
 *   (`--surface-3` = #E5EBE9)은 그보다 조금 어두워서, 하늘·호박·올리브·민트 넉 색이
 *   4.25~4.47:1 로 **기준(4.5)을 아슬하게 못 넘었다**(2026-09-08 200조합 전수 검사).
 *   숫자를 박지 않고 실제 면 색에서 재면 면 색을 바꿔도 저절로 따라온다.
 */
function surfaceLum(): number {
  const hex = MODE_TOKENS.light["--surface-3"] ?? "#E5EBE9";
  const [h, s, l] = hexToHsl(hex);
  return relLum(h, s, l);
}
const INK_BG_LUM = surfaceLum();

/**
 * 고른 색 하나 → **10단계 브랜드 램프 + 글자용 색**.
 *
 * 0~4 는 옅은 배경용(연한 띠·칩), 5~6 은 중간, **7 이 버튼 면**, 8~9 는 더 진한 단계다.
 * 7 은 흰 글자가 4.6:1 을 넘도록 내린 값이고, `--brand-text` 는 연회색 배경 위 글자용이다.
 */
export function brandRamp(hex: string): Record<string, string> {
  const [h, s0, l0] = hexToHsl(hex);
  const solid = capForWhite(h, s0, l0);
  const ink = capOn(h, s0, l0, INK_BG_LUM, 4.6);
  const L: number[] = [], S: number[] = [];
  for (let i = 0; i < 5; i++) { L[i] = LMIX[i] * 100; S[i] = Math.min(100, s0 * (0.30 + i * 0.13)); }
  L[5] = solid + (50 - solid) * 0.42; S[5] = Math.min(100, s0 * 0.90);
  L[6] = solid + (50 - solid) * 0.20; S[6] = Math.min(100, s0 * 0.96);
  L[7] = solid;                        S[7] = s0;
  L[8] = solid * 0.74;                 S[8] = Math.min(100, s0 * 1.02);
  L[9] = solid * 0.50;                 S[9] = Math.min(100, s0 * 1.04);

  const out: Record<string, string> = {};
  for (let i = 0; i < 10; i++) out[`--brand-${i}`] = hsl(h, S[i], L[i]);
  out["--brand-text"] = hsl(h, s0, ink);
  out["--brand-hex"] = hex;
  return out;
}

/* ─────────────────────────── 한 벌 만들기 ─────────────────────────── */

/**
 * 화면 하나에 심을 CSS 값 한 벌.
 *
 * ★ 스타일 5벌을 CSS 파일에 다 싣지 않는다. **고른 한 벌만** 여기서 만들어
 *   서버가 인라인으로 심는다 — 스타일을 15개로 늘려도 손님이 받는 양은 그대로다.
 */
export function themeVars(setting: DesignSetting): Record<string, string> {
  const style = (STYLE_TOKENS[setting.style] ? setting.style : "basic") as StyleId;
  const mode = (MODE_TOKENS[setting.mode] ? setting.mode : "light") as ModeId;
  return {
    ...STYLE_TOKENS[style],
    ...MODE_TOKENS[mode],
    ...brandRamp(/^#[0-9a-fA-F]{6}$/.test(setting.color) ? setting.color : "#005B2A"),
  };
}

/** `<html>`·래퍼에 붙일 `data-*` 속성. 서체는 손님 사이트에서만 붙는다 */
export function themeAttrs(setting: DesignSetting, target: DesignTarget): Record<string, string> {
  const a: Record<string, string> = { "data-style": setting.style, "data-mode": setting.mode };
  if (target === "shop" && setting.font) a["data-font"] = setting.font;
  return a;
}

/** 설정을 아직 못 읽었을 때 쓰는 값. DB 가 죽어도 화면이 색 없이 뜨지 않게 한다 */
export const defaultSetting = (target: DesignTarget): DesignSetting => DEFAULTS[target];
