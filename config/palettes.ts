/**
 * 온보딩 4단계 분위기 — 다크/화이트 × 8색.
 * 스키마(lib/schema.ts) 변경 없음: 화이트 → theme.palette 'clean', 다크 → 'premium', 색 → theme.accent(hex).
 * 렌더러(components/sections PALETTES)는 palette 로 바탕·글자색을, accent 로 포인트색을 쓴다.
 * (기획1 /mainplan #onboarding · 2026-09-05)
 */

export interface AccentColor { id: string; name: string; hex: string; desc: string }

export const ACCENTS: AccentColor[] = [
  { id: "forest", name: "포레스트", hex: "#1E5F4B", desc: "차분한 신뢰" },
  { id: "teal", name: "틸", hex: "#0E7365", desc: "깔끔한 전문가" },
  { id: "cobalt", name: "코발트", hex: "#1E5BD7", desc: "믿음직한 기술" },
  { id: "terra", name: "테라코타", hex: "#B4643C", desc: "따뜻한 손길" },
  { id: "mustard", name: "머스터드", hex: "#B8860B", desc: "밝은 활기" },
  { id: "plum", name: "플럼", hex: "#6B3FA0", desc: "감각적인 공간" },
  { id: "rose", name: "로즈", hex: "#C2426A", desc: "부드러운 케어" },
  { id: "charcoal", name: "차콜", hex: "#3A3F47", desc: "묵직한 프리미엄" },
];

export type Tone = "light" | "dark";

/** 온보딩 선택 → 기존 스키마 값 */
export function themeFor(tone: Tone, accentId: string): { palette: "clean" | "premium"; accent: string } {
  const a = ACCENTS.find((x) => x.id === accentId) ?? ACCENTS[0];
  return { palette: tone === "dark" ? "premium" : "clean", accent: a.hex };
}

/** 미니 미리보기용 바탕·글자색 (components/sections PALETTES 와 동일 값) */
export const TONE_PREVIEW: Record<Tone, { bg: string; ink: string; muted: string; card: string }> = {
  light: { bg: "#FFFFFF", ink: "#17202B", muted: "#66707E", card: "#F3F5F8" },
  dark: { bg: "#12151B", ink: "#F2EEE6", muted: "#9BA0AB", card: "#1D222D" },
};
