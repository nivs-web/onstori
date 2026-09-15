/**
 * **글자 로고 만들기 — 모양·글꼴·심볼의 단일 출처.** (2026-09-16 대표님 지시 [5])
 *
 * ★★ 대표님 말씀: 「우리 로고 부분 너무 별로야.」 그래서 전면 개편한다.
 *
 * ★★★ **가장 중요한 요구 — 「아무것도 안 골라도 된다」**
 *   「선택 안 해도 된다는 인상이 있어야 해. 그래야 빠르게 결정하지」
 *   그러려면 **기본값이 예뻐야 한다.** 그래서 이 파일은 «기본값 한 장»에 가장 공을 들인다:
 *   상호명 · 한글 · 최대 굵은 워드 · Pretendard.
 *
 * ★ 크기·자간 조절기는 **사장님께 주지 않는다**(대표님 지시).
 *   「로고로 쓰기에 가장 예쁘고 완벽한 크기와 글자 간격으로 너가 만들어.」
 *   ⇒ 글자 수·글자 종류에 따라 이 파일이 **자동으로** 정한다.
 *
 * ⚠ **이 파일은 SVG «문자열»만 만든다.** 화면에 어떻게 넣을지는 부르는 쪽이 정한다.
 *   · 미리보기 → **인라인 SVG**(`dangerouslySetInnerHTML`). 그래야 우리 웹폰트가 먹는다
 *   · 저장 → `<img>`·파일이 되므로 **폰트를 심어야** 한다(`embedFont` 참고)
 */

/* ════════════════ 모양 5종 ════════════════ */

export type ShapeId = "ultra" | "bold" | "regular" | "symbol" | "emblem";

export const SHAPES: { id: ShapeId; label: string; hint: string }[] = [
  /* ★ 1번이 기본값이다. 대표님이 「가장 공들여 만들라」고 하신 자리 */
  { id: "ultra", label: "최대 굵은 워드", hint: "가장 두껍고 단단한 느낌" },
  { id: "bold", label: "굵은 워드", hint: "또렷하고 무난해요" },
  { id: "regular", label: "보통 워드", hint: "단정하고 조용해요" },
  { id: "symbol", label: "심볼 + 이름", hint: "그림이 함께 들어가요" },
  { id: "emblem", label: "엠블럼", hint: "동그란 테두리 안에" },
];

/* ════════════════ 글꼴 5종 ════════════════ */

export type FontId = "pretendard" | "heavy" | "rounded" | "serif" | "brush";

/**
 * ⚠ **정직하게 적는다 — 지금 저장소에 «자체 호스팅»된 글꼴은 Pretendard 하나뿐이다.**
 *   (`public/fonts/pretendard/` · 92조각 · `app/fonts.css`)
 *
 * 나머지 넷은 **보는 사람 컴퓨터에 그 글꼴이 있으면** 그것으로, 없으면 `fallback` 으로 그려진다.
 * ★ 그래서 넷은 **Pretendard 의 굵기·자간으로도 확실히 달라 보이게** 짰다 —
 *   글꼴이 없어도 「고른 것과 다른 로고」가 나오지는 않는다.
 *
 * 🔴 **제대로 하려면**: 글꼴 파일을 R2 에 올리고 글자를 **패스로 변환**해야 한다
 *   (SVG 안에서는 웹폰트가 안 먹는다 — 저장된 로고는 `<img>` 로 쓰인다).
 *   그 작업은 폰트 파일을 구하는 일이 먼저라 이번 묶음에 넣지 않았다. `docs/WAITING.md` 참고.
 */
export const FONTS: {
  id: FontId; label: string; sample: string;
  /** SVG·CSS 양쪽에 그대로 쓰는 글꼴 이름 목록 */
  stack: string;
  /** 이 글꼴일 때 더 줄 굵기 보정 (Pretendard 는 400~700 축이라 900 이 없다) */
  weight: number;
  /** 자간 — 굵을수록 좁혀야 로고처럼 보인다 */
  tracking: number;
}[] = [
  { id: "pretendard", label: "기본", sample: "가나다 ABC", weight: 700, tracking: -0.035,
    stack: `"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif` },
  { id: "heavy", label: "아주 굵게", sample: "가나다 ABC", weight: 700, tracking: -0.055,
    stack: `"Black Han Sans","Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif` },
  { id: "rounded", label: "둥글게", sample: "가나다 ABC", weight: 700, tracking: -0.02,
    stack: `"Gmarket Sans","Jua","Pretendard Variable",Pretendard,sans-serif` },
  { id: "serif", label: "명조", sample: "가나다 ABC", weight: 700, tracking: -0.01,
    stack: `"Nanum Myeongjo","NanumMyeongjo","Batang",serif` },
  { id: "brush", label: "손글씨", sample: "가나다 ABC", weight: 400, tracking: 0,
    stack: `"Nanum Brush Script","Nanum Pen Script","Gungsuh",cursive` },
];

/* ════════════════ 심볼 15개 ════════════════ */

/**
 * ⚠ **선(stroke) 아이콘이다.** 24×24 격자 · 굵기 2 · 끝은 둥글게 — 섞이면 지저분해진다.
 *   design v6 의 8개(집·문·창·붓·자·연장·가구·별)에 업종 7개를 더했다.
 */
export const SYMBOLS: { id: string; label: string; d: string }[] = [
  { id: "home", label: "집", d: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" },
  { id: "door", label: "문", d: "M6 3h12v18H6zM14.5 12h.01" },
  { id: "window", label: "창", d: "M4 4h16v16H4zM12 4v16M4 12h16" },
  { id: "brush", label: "붓", d: "M4 20c3 0 4-1.5 4-4M9.5 14.5 19 5a2 2 0 0 0-3-3L6.5 11.5" },
  { id: "ruler", label: "자", d: "M3 14.5 14.5 3l6 6L9 20.5zM8 9l2 2M11 6l2 2M5 12l2 2" },
  { id: "tool", label: "연장", d: "M14 6a4 4 0 0 1 5.5 5L21 12.5 12.5 21l-3-3L18 9.5 16.5 8A4 4 0 0 1 14 6z" },
  { id: "chair", label: "가구", d: "M6 4h12v9H6zM6 13v7M18 13v7M4 13h16" },
  { id: "star", label: "별", d: "m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z" },
  { id: "leaf", label: "잎", d: "M20 4c0 9-5 13-11 13-2 0-3-1-3-1M6 20C6 12 12 7 20 4" },
  { id: "cup", label: "컵", d: "M4 7h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h1.5a2.5 2.5 0 0 1 0 5H17" },
  { id: "scissors", label: "가위", d: "M6.5 6.5 17 17M17 7 6.5 17.5M7 7a2 2 0 1 0-.01-.01M7 19a2 2 0 1 0-.01-.01" },
  { id: "heart", label: "하트", d: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z" },
  { id: "bolt", label: "번개", d: "M13 2 5 13h6l-1 9 8-11h-6z" },
  { id: "scale", label: "저울", d: "M12 4v16M6 20h12M5 9h14M5 9l-2 5a3 3 0 0 0 4 0zM19 9l2 5a3 3 0 0 1-4 0z" },
  { id: "wheel", label: "바퀴", d: "M12 4a8 8 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0M12 4v4M12 16v4M4 12h4M16 12h4" },
];

/* ════════════════ 글자 폭 어림 ════════════════ */

/**
 * 한 글자의 «가로 폭»을 글자 크기(em) 대비로 어림잡는다.
 * ⚠ 정확한 값은 글꼴마다 다르지만, 로고는 **넘치지만 않으면** 된다 — 넉넉히 잡는다.
 */
function emWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[ㄱ-힣一-鿿ぁ-ヿ]/.test(ch)) w += 1;          // 한글·한자·가나 — 한 칸
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[a-z0-9]/.test(ch)) w += 0.55;
    else if (/\s/.test(ch)) w += 0.3;
    else w += 0.45;
  }
  return w || 1;
}

/** SVG 에 그대로 넣을 수 있게 위험한 글자를 바꾼다 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ════════════════ 로고 한 장 ════════════════ */

export type LogoInput = {
  /** 로고에 넣을 이름 — 상호명이 기본값이지만 사장님이 고칠 수 있다 */
  name: string;
  shape: ShapeId;
  font: FontId;
  /** 강조색 (#RRGGBB) */
  accent: string;
  /** 심볼 모양일 때만 */
  symbol?: string;
  /** 엠블럼 모양일 때만 — 기본 "OS" */
  initials?: string;
};

/** 기본값 — 아무것도 안 고른 사장님이 받는 로고 */
export const LOGO_DEFAULT: Pick<LogoInput, "shape" | "font"> = { shape: "ultra", font: "pretendard" };

const BOX = 512;

/**
 * **로고 SVG 한 장.**
 *
 * ★ 크기·자간은 여기서 «자동으로» 정한다 — 사장님께 조절기를 주지 않는다(대표님 지시).
 * ★ 글자가 많으면 크기를 줄이고, 그래도 작으면 **두 줄로 나눈다.** 읽을 수 없는 로고는 로고가 아니다.
 */
export function makeLogoSvg(input: LogoInput): string {
  const f = FONTS.find((x) => x.id === input.font) ?? FONTS[0];
  const name = (input.name || "온스토리").trim();
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent : "#005B2A";

  switch (input.shape) {
    case "symbol": return symbolLogo(name, f, accent, input.symbol);
    case "emblem": return emblemLogo(name, f, accent, input.initials);
    default: return wordLogo(name, f, accent, input.shape);
  }
}

/** 글자 크기와 줄 나눔을 한 번에 정한다 */
function fit(name: string, maxW: number, maxSize: number): { size: number; lines: string[] } {
  const one = emWidth(name);
  let size = Math.min(maxSize, maxW / one);
  if (size >= maxSize * 0.42) return { size: Math.round(size), lines: [name] };

  /* 두 줄 — 띄어쓰기가 있으면 거기서, 없으면 가운데서 */
  const sp = name.lastIndexOf(" ", Math.ceil(name.length / 2));
  const cut = sp > 0 ? sp : Math.ceil(name.length / 2);
  const lines = [name.slice(0, cut).trim(), name.slice(sp > 0 ? cut + 1 : cut).trim()].filter(Boolean);
  const widest = Math.max(...lines.map(emWidth), 1);
  size = Math.min(maxSize, maxW / widest);
  return { size: Math.round(size), lines };
}

/** ①②③ 워드마크 — 굵기만 다르다 */
function wordLogo(name: string, f: typeof FONTS[number], accent: string, shape: ShapeId): string {
  /* ★ 「최대 굵은 워드」가 기본값이다. 굵을수록 자간을 좁혀야 «로고»로 보인다 */
  const weight = shape === "ultra" ? Math.max(f.weight, 700) : shape === "bold" ? 600 : 500;
  const track = shape === "ultra" ? f.tracking - 0.02 : shape === "bold" ? f.tracking : f.tracking + 0.015;

  const { size, lines } = fit(name, BOX * 0.84, shape === "ultra" ? 150 : 130);
  const lh = size * 1.02;
  const top = BOX / 2 - ((lines.length - 1) * lh) / 2 + size * 0.34;

  const text = lines.map((ln, i) =>
    `<text x="${BOX / 2}" y="${Math.round(top + i * lh)}" text-anchor="middle" ` +
    `font-family='${f.stack}' font-weight="${weight}" font-size="${size}" ` +
    `letter-spacing="${(track * size).toFixed(1)}" fill="${accent}">${esc(ln)}</text>`,
  ).join("");

  return svg(`<rect width="${BOX}" height="${BOX}" fill="#FFFFFF"/>${text}`);
}

/** ④ 심볼 + 이름 */
function symbolLogo(name: string, f: typeof FONTS[number], accent: string, symbolId?: string): string {
  const sym = SYMBOLS.find((s) => s.id === symbolId) ?? SYMBOLS[0];
  const { size, lines } = fit(name, BOX * 0.8, 86);
  const lh = size * 1.06;

  /* 심볼은 위, 이름은 아래 — 24격자를 7배로 키워 168px 로 그린다 */
  const S = 7, sx = BOX / 2 - 12 * S, sy = 120;
  const icon =
    `<g transform="translate(${sx} ${sy}) scale(${S})" fill="none" stroke="${accent}" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${sym.d}"/></g>`;

  const top = 360 + size * 0.3;
  const text = lines.map((ln, i) =>
    `<text x="${BOX / 2}" y="${Math.round(top + i * lh)}" text-anchor="middle" ` +
    `font-family='${f.stack}' font-weight="${Math.max(f.weight, 600)}" font-size="${size}" ` +
    `letter-spacing="${(f.tracking * size).toFixed(1)}" fill="${accent}">${esc(ln)}</text>`,
  ).join("");

  return svg(`<rect width="${BOX}" height="${BOX}" fill="#FFFFFF"/>${icon}${text}`);
}

/** ⑤ 엠블럼 — 동그란 테두리 안에 이니셜, 아래에 이름 */
function emblemLogo(name: string, f: typeof FONTS[number], accent: string, initials?: string): string {
  const ini = (initials || "OS").trim().slice(0, 3).toUpperCase() || "OS";
  const iniSize = Math.round(Math.min(150, 250 / emWidth(ini)));
  const { size, lines } = fit(name, BOX * 0.72, 64);
  const lh = size * 1.05;

  const ring =
    `<circle cx="${BOX / 2}" cy="196" r="128" fill="none" stroke="${accent}" stroke-width="12"/>` +
    `<text x="${BOX / 2}" y="${196 + iniSize * 0.35}" text-anchor="middle" ` +
    `font-family='${f.stack}' font-weight="700" font-size="${iniSize}" ` +
    `letter-spacing="${(-0.02 * iniSize).toFixed(1)}" fill="${accent}">${esc(ini)}</text>`;

  const top = 396 + size * 0.3;
  const text = lines.map((ln, i) =>
    `<text x="${BOX / 2}" y="${Math.round(top + i * lh)}" text-anchor="middle" ` +
    `font-family='${f.stack}' font-weight="${Math.max(f.weight, 600)}" font-size="${size}" ` +
    `letter-spacing="${(f.tracking * size).toFixed(1)}" fill="${accent}">${esc(ln)}</text>`,
  ).join("");

  return svg(`<rect width="${BOX}" height="${BOX}" fill="#FFFFFF"/>${ring}${text}`);
}

const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" width="${BOX}" height="${BOX}">${inner}</svg>`;

/** 화면에 `<img>` 로 넣을 때 쓰는 주소 — ⚠ 이 방식은 웹폰트가 «안» 먹는다 */
export const svgDataUrl = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
