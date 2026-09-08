/**
 * 테마 엔진 — **디자인 축의 단일 출처** (2026-09-08 회장님 지시, S0).
 *
 * 스타일·모드·색·서체·대상·분위기카드 목록이 전부 여기 있다.
 * 화면·라우트·컴포넌트는 값을 직접 적지 않고 **이 파일에서 읽는다.**
 *
 * ★ 왜 한 파일인가: 지시 [8] — 「스타일 5→15, 카드 40→80 으로 늘린다.
 *   스타일 하나 = CSS 토큰 덩어리 하나 + 목록 배열 한 줄. 그 둘만 더하면 끝나야 한다.」
 *   목록이 코드 곳곳에 흩어지면 그게 불가능해진다. `config/` 는 하위 폴더가 0개인
 *   평평한 구조라(파일 14개) 폴더를 새로 파지 않고 파일 하나로 둔다.
 *
 * ★ 컴포넌트 안에 `if (style === "bold")` 같은 조건문을 쓰지 마라. 전부 토큰으로만 갈린다.
 *
 * ⚠ 여기에는 **값 목록**만 둔다. 그 값으로 계산하는 일(색 램프·대비 보정)은
 *   `lib/design-tokens.ts` 다 — CLAUDE.md 의 「config = 제품 정책(값 목록),
 *   lib = 로직」 구분을 지킨다.
 *
 * ⚠ 소상공인에게 「스타일·서체·모드」라는 말을 **절대 보여주지 않는다**(지시 [0]).
 *   사장님이 보는 낱말은 「분위기」·「색」·「글씨체」뿐이다. 그래서 아래 타입에는
 *   운영자용 이름(`adminName`)과 사장님용 이름(`name`)이 따로 있다.
 */

/* ─────────────────────────── 스타일 (운영자 전용 낱말) ─────────────────────────── */

/** 스타일 id. 늘릴 때는 이 유니온과 STYLES 배열, 그리고 S1 의 토큰 덩어리 셋만 손댄다. */
export type StyleId = "basic" | "quiet" | "bold" | "warm" | "refined";

export interface Style {
  id: StyleId;
  /** 운영자 화면에만 쓴다. 사장님에게는 스타일이라는 개념 자체를 보이지 않는다. */
  adminName: string;
  /** 어드민 목록에서 고를 때 옆에 붙는 한 줄 */
  adminDesc: string;
}

export const STYLES: Style[] = [
  { id: "basic", adminName: "기본", adminDesc: "지금 온스토리 화면. 새 스타일의 기준점" },
  { id: "quiet", adminName: "조용한", adminDesc: "여백이 넓고 자간이 느슨하다" },
  { id: "bold", adminName: "또렷한", adminDesc: "굵고 각지고 빠르다" },
  { id: "warm", adminName: "따뜻한", adminDesc: "모서리가 둥글고 움직임이 부드럽다" },
  { id: "refined", adminName: "정갈한", adminDesc: "모서리가 없고 자간이 넓다" },
];

/**
 * 스타일 한 벌이 덮어쓰는 CSS 값 **42개**. 스타일을 늘릴 때는 여기에 덩어리 하나만 더하면 된다.
 *
 * ★ 컴포넌트는 이 값을 직접 읽지 않는다. 서버가 고른 한 벌만 화면에 심고,
 *   컴포넌트는 늘 `var(--r-md)` 처럼 이름으로만 쓴다.
 *
 * ★ **basic = 지금 화면이다.** basic/밝은/온스토리초록으로 켜면 화면이 지금과 같아야 한다.
 *
 * ⚠ 시안 값에서 **세 곳을 고쳤다** (2026-09-08, CLAUDE.md 규칙 11 준수):
 *   · basic `--t-h3` — 시안은 18px 고정인데 지금은 PC 에서 20px 로 커진다. **지금 값을 쓴다.**
 *   · bold `--w-title` 800 → **700** — 굵기는 400·500·600·700 넷뿐이다.
 *   · bold `--lh-display` 1.14 → **1.2** — 한글은 제목 행간을 1.2 아래로 내리지 않는다.
 *
 * ⚠ 시안의 49개 중 **7개를 뺐다.** 스타일이 건드리면 안 되는 것들이다:
 *   · `--t-body` `--lh-body` — 본문 크기·행간은 읽기 쉬움의 바닥이라 스타일마다 흔들면 안 된다.
 *     `:root` 에 17px · 1.68 로 고정한다(규칙 11).
 *   · `--font-title` `--font-body` — 이건 스타일이 아니라 **서체 축**의 것이다.
 *   · `--r-full` `--w-body` `--s-1` — 5벌이 값이 같다. `:root` 에 두면 손님이 받는 양이 줄어든다.
 *
 * ⚠ 표기가 `-.035em` 처럼 0 이 생략돼 있다. 지금 globals.css 의 `-0.035em` 과 **CSS 로는 같은 값**이다.
 *   시안 원문을 기계로 읽어 온 것이라 일부러 손대지 않았다 — 손으로 옮기면 틀린다.
 */
export const STYLE_TOKENS: Record<StyleId, Record<string, string>> = {
  basic: { "--r-xs": "4px", "--r-sm": "6px", "--r-md": "10px", "--r-lg": "16px", "--w-title": "700", "--w-sub": "600", "--w-label": "500", "--ls-display": "-.035em", "--ls-h1": "-.032em", "--ls-h2": "-.028em", "--ls-h3": "-.024em", "--ls-body": "-.015em", "--ls-eyebrow": ".02em", "--lh-display": "1.32", "--lh-h1": "1.36", "--lh-h2": "1.4", "--t-display": "clamp(2.25rem,1.55rem + 2.8vw,3.5rem)", "--t-h1": "clamp(1.75rem,1.3rem + 1.8vw,2.5rem)", "--t-h2": "clamp(1.375rem,1.15rem + .9vw,1.75rem)", "--t-h3": "clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem)", "--t-small": ".9375rem", "--t-caption": ".8125rem", "--s-2": "6px", "--s-3": "8px", "--s-4": "16px", "--s-5": "24px", "--s-6": "32px", "--s-7": "48px", "--s-8": "64px", "--s-9": "96px", "--s-10": "120px", "--dur-1": "120ms", "--dur-2": "200ms", "--dur-3": "320ms", "--dur-rv": "700ms", "--rv-y": "28px", "--ease": "cubic-bezier(.25,.46,.45,.94)", "--ease-hover": "cubic-bezier(.25,.8,.25,1)", "--ease-spring": "cubic-bezier(.34,1.32,.64,1)", "--hv-scale": "1.08", "--hv-lift": "8px", "--bw": "1px" },
  quiet: { "--r-xs": "3px", "--r-sm": "4px", "--r-md": "6px", "--r-lg": "10px", "--w-title": "600", "--w-sub": "500", "--w-label": "500", "--ls-display": "-.02em", "--ls-h1": "-.018em", "--ls-h2": "-.016em", "--ls-h3": "-.014em", "--ls-body": "-.008em", "--ls-eyebrow": ".1em", "--lh-display": "1.42", "--lh-h1": "1.46", "--lh-h2": "1.5", "--t-display": "clamp(2rem,1.4rem + 2.4vw,3rem)", "--t-h1": "clamp(1.5rem,1.2rem + 1.4vw,2.125rem)", "--t-h2": "clamp(1.25rem,1.1rem + .7vw,1.5rem)", "--t-h3": "1.0625rem", "--t-small": ".875rem", "--t-caption": ".75rem", "--s-2": "8px", "--s-3": "12px", "--s-4": "20px", "--s-5": "32px", "--s-6": "44px", "--s-7": "64px", "--s-8": "88px", "--s-9": "128px", "--s-10": "160px", "--dur-1": "140ms", "--dur-2": "240ms", "--dur-3": "360ms", "--dur-rv": "520ms", "--rv-y": "12px", "--ease": "cubic-bezier(.4,0,.2,1)", "--ease-hover": "cubic-bezier(.4,0,.2,1)", "--ease-spring": "cubic-bezier(.4,0,.2,1)", "--hv-scale": "1.03", "--hv-lift": "3px", "--bw": "1px" },
  bold: { "--r-xs": "2px", "--r-sm": "3px", "--r-md": "4px", "--r-lg": "6px", "--w-title": "700", "--w-sub": "700", "--w-label": "600", "--ls-display": "-.045em", "--ls-h1": "-.042em", "--ls-h2": "-.036em", "--ls-h3": "-.03em", "--ls-body": "-.018em", "--ls-eyebrow": ".06em", "--lh-display": "1.2", "--lh-h1": "1.2", "--lh-h2": "1.26", "--t-display": "clamp(2.75rem,1.8rem + 3.6vw,4.25rem)", "--t-h1": "clamp(2rem,1.45rem + 2.2vw,2.875rem)", "--t-h2": "clamp(1.5rem,1.25rem + 1.1vw,2rem)", "--t-h3": "1.25rem", "--t-small": ".9375rem", "--t-caption": ".8125rem", "--s-2": "6px", "--s-3": "8px", "--s-4": "14px", "--s-5": "20px", "--s-6": "28px", "--s-7": "40px", "--s-8": "56px", "--s-9": "80px", "--s-10": "104px", "--dur-1": "90ms", "--dur-2": "150ms", "--dur-3": "240ms", "--dur-rv": "420ms", "--rv-y": "20px", "--ease": "cubic-bezier(.2,.8,.2,1)", "--ease-hover": "cubic-bezier(.2,.8,.2,1)", "--ease-spring": "cubic-bezier(.34,1.32,.64,1)", "--hv-scale": "1.1", "--hv-lift": "6px", "--bw": "2px" },
  warm: { "--r-xs": "8px", "--r-sm": "12px", "--r-md": "18px", "--r-lg": "26px", "--w-title": "700", "--w-sub": "600", "--w-label": "500", "--ls-display": "-.028em", "--ls-h1": "-.026em", "--ls-h2": "-.022em", "--ls-h3": "-.018em", "--ls-body": "-.01em", "--ls-eyebrow": ".04em", "--lh-display": "1.36", "--lh-h1": "1.42", "--lh-h2": "1.46", "--t-display": "clamp(2.25rem,1.55rem + 2.8vw,3.5rem)", "--t-h1": "clamp(1.75rem,1.3rem + 1.8vw,2.5rem)", "--t-h2": "clamp(1.375rem,1.15rem + .9vw,1.75rem)", "--t-h3": "1.125rem", "--t-small": ".9375rem", "--t-caption": ".8125rem", "--s-2": "8px", "--s-3": "12px", "--s-4": "18px", "--s-5": "28px", "--s-6": "36px", "--s-7": "52px", "--s-8": "72px", "--s-9": "104px", "--s-10": "132px", "--dur-1": "140ms", "--dur-2": "260ms", "--dur-3": "400ms", "--dur-rv": "760ms", "--rv-y": "24px", "--ease": "cubic-bezier(.34,1.2,.64,1)", "--ease-hover": "cubic-bezier(.34,1.2,.64,1)", "--ease-spring": "cubic-bezier(.34,1.5,.64,1)", "--hv-scale": "1.06", "--hv-lift": "10px", "--bw": "1px" },
  refined: { "--r-xs": "0px", "--r-sm": "0px", "--r-md": "2px", "--r-lg": "3px", "--w-title": "500", "--w-sub": "500", "--w-label": "500", "--ls-display": ".01em", "--ls-h1": ".008em", "--ls-h2": ".006em", "--ls-h3": ".004em", "--ls-body": "-.004em", "--ls-eyebrow": ".24em", "--lh-display": "1.46", "--lh-h1": "1.5", "--lh-h2": "1.56", "--t-display": "clamp(2rem,1.4rem + 2.4vw,3.125rem)", "--t-h1": "clamp(1.5rem,1.2rem + 1.4vw,2.125rem)", "--t-h2": "clamp(1.25rem,1.1rem + .7vw,1.5rem)", "--t-h3": "1.0625rem", "--t-small": ".9375rem", "--t-caption": ".75rem", "--s-2": "8px", "--s-3": "14px", "--s-4": "24px", "--s-5": "36px", "--s-6": "52px", "--s-7": "76px", "--s-8": "104px", "--s-9": "144px", "--s-10": "184px", "--dur-1": "160ms", "--dur-2": "300ms", "--dur-3": "460ms", "--dur-rv": "900ms", "--rv-y": "16px", "--ease": "cubic-bezier(.22,.61,.36,1)", "--ease-hover": "cubic-bezier(.22,.61,.36,1)", "--ease-spring": "cubic-bezier(.22,.61,.36,1)", "--hv-scale": "1.04", "--hv-lift": "4px", "--bw": "1px" },
};

/**
 * 밝은/어두운이 덮어쓰는 CSS 값 **24개** — 면·선·글자·그림자·브랜드 역할.
 *
 * ⚠ 시안에서 **글자색 두 개를 우리 뜻대로 바꿨다.**
 *   시안의 `--text` 는 가장 진한 글자색(#1A2722)인데, 우리 `--text` 는 **본문 글자색**이다.
 *   그대로 가져오면 사이트 전체 본문이 확 진해져 「화면이 지금과 같다」가 깨진다.
 *   그래서 `--text` 는 지금 값(#50665E)을 지키고, 시안의 가장 진한 색은 `--text-strong` 으로 받는다.
 *   ⚠ 이건 **의도한 어긋남**이다. 다음 세션이 「시안과 다르다」며 되돌리면 사이트 본문이 전부 진해진다.
 */
export const MODE_TOKENS: Record<ModeId, Record<string, string>> = {
  light: { "--canvas": "#F2F6F4", "--surface": "#FFFFFF", "--surface-2": "#E9EFEC", "--surface-3": "#E5EBE9", "--border": "#E5EBE9", "--border-2": "#C9D4D0", "--text": "#50665E", "--text-2": "#2E4038", "--text-3": "#455A53", "--text-4": "#5E7169", "--placeholder": "#96A7A1", "--on-brand": "#FFFFFF", "--shadow-1": "0 1px 2px rgba(26,39,34,.05),0 6px 20px rgba(26,39,34,.06)", "--shadow-2": "0 20px 44px rgba(26,39,34,.14)", "--hv-shadow": "0 16px 32px rgba(26,39,34,.12)", "--brand-solid": "var(--brand-7)", "--brand-solid-h": "var(--brand-5)", "--on-solid": "#FFFFFF", "--brand-ink": "var(--brand-text)", "--brand-tint": "var(--brand-1)", "--brand-tint-2": "var(--brand-0)", "--brand-tint-ink": "var(--brand-8)", "--brand-ring": "var(--brand-1)", "--text-strong": "#1A2722" },
  dark: { "--canvas": "#101815", "--surface": "#18211E", "--surface-2": "#212B27", "--surface-3": "#2A3531", "--border": "#2A3531", "--border-2": "#3B4844", "--text": "#E5EBE9", "--text-2": "#D3DDD8", "--text-3": "#A9B8B2", "--text-4": "#8D9F98", "--placeholder": "#6E837B", "--on-brand": "#FFFFFF", "--shadow-1": "0 1px 2px rgba(0,0,0,.4),0 6px 20px rgba(0,0,0,.3)", "--shadow-2": "0 20px 44px rgba(0,0,0,.5)", "--hv-shadow": "0 16px 32px rgba(0,0,0,.45)", "--brand-solid": "var(--brand-3)", "--brand-solid-h": "var(--brand-2)", "--on-solid": "var(--brand-9)", "--brand-ink": "var(--brand-3)", "--brand-tint": "var(--brand-9)", "--brand-tint-2": "var(--brand-9)", "--brand-tint-ink": "var(--brand-2)", "--brand-ring": "var(--brand-8)", "--text-strong": "#EDF3F0" },
};

/* ─────────────────────────── 밝은/어두운 ─────────────────────────── */

export type ModeId = "light" | "dark";

export interface Mode {
  id: ModeId;
  adminName: string;
  /** 사장님 화면에서 분위기 카드를 밝은/어두운으로 나눠 보여줄 때 쓰는 낱말 */
  name: string;
}

export const MODES: Mode[] = [
  { id: "light", adminName: "화이트", name: "밝은" },
  { id: "dark", adminName: "다크", name: "어두운" },
];

/* ─────────────────────────── 색 20 ─────────────────────────── */

/**
 * 고를 수 있는 색 20개. v6 시안 `COLORS` 배열과 같다.
 *
 * ★ 이 hex 는 **씨앗값**이다. 실제 화면에 쓰이는 10단계 램프(`--brand-0..9`)는
 *   S1 의 `lib/design-tokens.ts` 가 여기서 계산한다. 계산에는 대비 보정이 들어가
 *   흰 글자가 4.6:1 을 넘을 때까지 명도를 낮춘다 — 그래서 **여기 적힌 hex 가 화면에
 *   그대로 나오지 않을 수 있다.** 보정을 빼면 노랑·하늘색에서 버튼 글자가 사라진다.
 *
 * ⚠ 사장님은 이 20개 말고 **직접 색상코드(#RRGGBB)를 넣을 수도** 있다(지시 [6]②).
 *   그러므로 저장 값은 색 id 가 아니라 **hex 문자열**이어야 한다. id 는 화면에서
 *   「3번 청록」처럼 이름을 붙여 주기 위한 것뿐이다.
 */
export interface BrandColor {
  id: string;
  name: string;
  hex: string;
}

export const COLORS: BrandColor[] = [
  { id: "onstori", name: "온스토리 초록", hex: "#005B2A" },
  { id: "deepgreen", name: "진초록", hex: "#14532D" },
  { id: "teal", name: "청록", hex: "#0F766E" },
  { id: "mint", name: "민트", hex: "#0D9488" },
  { id: "sky", name: "하늘", hex: "#0284C7" },
  { id: "blue", name: "파랑", hex: "#1D4ED8" },
  { id: "navy", name: "남색", hex: "#1E3A8A" },
  { id: "indigo", name: "인디고", hex: "#4338CA" },
  { id: "purple", name: "보라", hex: "#6D28D9" },
  { id: "magenta", name: "자주", hex: "#86198F" },
  { id: "pink", name: "분홍", hex: "#BE185D" },
  { id: "wine", name: "와인", hex: "#881337" },
  { id: "red", name: "빨강", hex: "#B91C1C" },
  { id: "orange", name: "주황", hex: "#C2410C" },
  { id: "amber", name: "호박", hex: "#B45309" },
  { id: "brown", name: "갈색", hex: "#78350F" },
  { id: "olive", name: "올리브", hex: "#4D7C0F" },
  { id: "lime", name: "라임", hex: "#3F6212" },
  { id: "slate", name: "청회색", hex: "#334155" },
  { id: "ink", name: "먹색", hex: "#27272A" },
];

/* ─────────────────────────── 글씨체 5 (손님 사이트 전용) ─────────────────────────── */

/**
 * 글씨체 5개. **손님 사이트(`/{상호}`)에서만 고를 수 있다** — CLAUDE.md 규칙 11.
 * onstori.com 첫 페이지·메뉴·`/admin`·`/{상호}/edit` 는 Pretendard 고정이고,
 * 그 화면들에는 글씨체 고르는 항목을 **만들지 않는다.**
 *
 * ⚠ 시안에는 여섯 번째 `serif-all`(명조 전체)이 있으나 **뺐다**(2026-09-08 회장님).
 *
 * ⚠ 사장님에게 「+405KB」 같은 용량을 보여주지 마라(지시 [6]③).
 *   무거운 것에는 `slowHint: true` 를 켜고 「글자가 조금 늦게 뜰 수 있어요」 한 줄만 쓴다.
 *
 * ⚠ 서체 파일은 **R2 자체 호스팅**이다. 구글 폰트 CDN 을 되살리지 않는다.
 *   `family` 는 CSS `font-family` 에 그대로 들어가는 이름이다 —
 *   ★ 손글씨(Nanum Pen Script)는 OFL 예약 이름(Reserved Font Name)이 걸려 있어
 *     서브셋본의 이름을 바꿔야 한다. 그 최종 이름이 정해지면 여기를 함께 고친다.
 */
export type FontId = "gothic" | "serif-title" | "hand-title" | "round-title" | "soft-all";

export interface Font {
  id: FontId;
  /** 사장님이 보는 이름 */
  name: string;
  /** 사장님이 보는 한 줄 */
  desc: string;
  /** 제목에 쓰는 글꼴 이름. gothic 이면 Pretendard 그대로 */
  titleFamily: string | null;
  /** 본문에 쓰는 글꼴 이름. null 이면 Pretendard */
  bodyFamily: string | null;
  /** 켜면 「글자가 조금 늦게 뜰 수 있어요」를 보여준다. 용량 숫자는 보여주지 않는다 */
  slowHint: boolean;
}

export const FONTS: Font[] = [
  { id: "gothic", name: "기본", desc: "지금 글씨체. 어떤 화면에서도 잘 읽혀요", titleFamily: null, bodyFamily: null, slowHint: false },
  { id: "serif-title", name: "명조 제목", desc: "제목이 붓글씨처럼 단정해요", titleFamily: "Noto Serif KR", bodyFamily: null, slowHint: true },
  { id: "hand-title", name: "손글씨 제목", desc: "제목이 손으로 쓴 것처럼 정겨워요", titleFamily: "Nanum Pen Script", bodyFamily: null, slowHint: false },
  { id: "round-title", name: "둥근 제목", desc: "제목이 동글동글 친근해요", titleFamily: "Jua", bodyFamily: null, slowHint: false },
  { id: "soft-all", name: "부드러운 전체", desc: "글씨 전체가 도톰하고 부드러워요", titleFamily: "Gowun Dodum", bodyFamily: "Gowun Dodum", slowHint: false },
];

/* ─────────────────────────── 대상 4 · 권한 ─────────────────────────── */

/**
 * 디자인을 따로 정할 수 있는 화면 넷. **서체는 shop 에서만 고른다**(지시 [1]).
 *
 * ★ 앞의 셋(site/admin/editor)에는 서체 고르는 항목을 화면에 **만들지 마라.**
 *   이유: onstori.com 속도가 1순위다. 한글 서체 하나가 수백 KB 이고
 *   명조를 빼서 LCP 8.3→5.2초를 얻었다. 되돌릴 수 없다.
 *
 * ★ `/{상호}/edit` 편집 UI 자체는 editor 설정을 따른다. 사장님 테마를 따라가지 않는다 —
 *   손글씨 테마를 고른 사장님의 편집 화면 글자까지 손글씨가 되면 못 쓴다(지시 [7]).
 *   단 미리보기 창 **안**은 당연히 사장님 테마로 보인다.
 *
 * ⚠ `canPickFont` 는 화면을 그릴 때의 기준이자 **저장 시 서버 검사 기준**이다.
 *   클라이언트가 보낸 값을 믿지 않는다(불변 규칙 4) — 셋에 대해 font 가 들어오면 버린다.
 */
export type DesignTarget = "site" | "admin" | "editor" | "shop";

export interface TargetSpec {
  id: DesignTarget;
  adminName: string;
  adminDesc: string;
  /** 누가 정하는가 */
  owner: "admin" | "owner";
  canPickFont: boolean;
}

export const TARGETS: TargetSpec[] = [
  { id: "site", adminName: "온스토리 홈", adminDesc: "onstori.com 손님이 보는 화면", owner: "admin", canPickFont: false },
  { id: "admin", adminName: "온스토리 어드민", adminDesc: "onstori.com/admin 운영자 화면", owner: "admin", canPickFont: false },
  { id: "editor", adminName: "소상공인 어드민", adminDesc: "onstori.com/{상호}/edit 사장님 편집 화면", owner: "admin", canPickFont: false },
  { id: "shop", adminName: "소상공인 사이트", adminDesc: "onstori.com/{상호} 손님 사이트 — 사장님이 고른다", owner: "owner", canPickFont: true },
];

/* ─────────────────────────── 기본값 ─────────────────────────── */

/**
 * `app_settings` 가 비어 있거나 DB 읽기가 실패했을 때 쓰는 값.
 *
 * ★ 루트 레이아웃이 이 값을 **동기적으로** 갖고 있어야 한다.
 *   DB 를 못 읽었다고 화면이 색 없이 뜨거나, 색이 나중에 덮이며 깜빡이면 안 된다.
 * ★ basic/light/온스토리초록 = 지금 화면이다. 그래서 기본값이 곧 「아무것도 안 바뀐 상태」다.
 */
export interface DesignSetting {
  style: StyleId;
  mode: ModeId;
  /** 브랜드색 hex. 20색 중 하나이거나 사장님이 직접 넣은 값 */
  color: string;
  /** shop 에서만 의미가 있다. 나머지 셋에서는 무시한다 */
  font?: FontId;
}

export const DEFAULTS: Record<DesignTarget, DesignSetting> = {
  site: { style: "basic", mode: "light", color: "#005B2A" },
  admin: { style: "basic", mode: "light", color: "#005B2A" },
  editor: { style: "basic", mode: "light", color: "#005B2A" },
  shop: { style: "basic", mode: "light", color: "#005B2A", font: "gothic" },
};

/* ─────────────────────────── 분위기 카드 ─────────────────────────── */

/**
 * 분위기 카드 — 이 기능의 **핵심 개념**(지시 [3]).
 *
 * 카드 하나 = { 이름, 스타일, 밝은/어두운, 기본색, 한 줄 설명 }.
 * 사장님은 카드 하나를 누르면 스타일·모드·색이 한 번에 바뀐다.
 * **안에 뭐가 들었는지 알 필요가 없다.** 그래서 카드에는 스타일 이름을 쓰지 않는다.
 *
 * ★ 카드는 **조합이지 새 CSS 가 아니다.** 5스타일 × 20색 × 2모드 = 200조합 중 40장을 고른 것이다.
 *   그래서 카드를 80장으로 늘려도 CSS 는 한 줄도 늘지 않는다.
 *
 * ★ 아래는 **씨앗값**이다. 실제 목록은 `theme_cards` 표에서 읽는다 —
 *   운영자가 어드민에서 만들고·고치고·순서를 바꾸고·켜고 끄기 때문이다.
 *   표가 비어 있으면 이 배열이 보인다(`config/admin-notes-seed.ts` 와 같은 방식).
 *
 * ⚠ 이름과 조합은 **S3 에서 회장님이 확정한다**(2026-09-08). 지금은 초안이다.
 * ⚠ 삭제는 지우지 않고 표시 변경으로 한다(불변 규칙 10). 그래서 씨앗에는 삭제 필드가 없다 —
 *   그건 표의 몫이다.
 */
export interface MoodCard {
  id: string;
  /** 사장님이 보는 이름. 업종 냄새는 나되 특정 업종에 갇히지 않게 */
  name: string;
  /** 사장님이 보는 한 줄 */
  blurb: string;
  style: StyleId;
  mode: ModeId;
  /** COLORS 의 id */
  colorId: string;
  /** 제작신청(위저드)에 노출할지. 화이트 8 · 다크 8 = 16장만 */
  inWizard: boolean;
}

export const MOOD_CARDS: MoodCard[] = [
  /* ── 밝은 20 ── */
  { id: "m01", name: "우리 동네 가게", blurb: "누구에게나 편안한 기본 얼굴", style: "basic", mode: "light", colorId: "onstori", inWizard: true },
  { id: "m02", name: "따뜻한 빵집", blurb: "둥글고 포근한 인상", style: "warm", mode: "light", colorId: "amber", inWizard: true },
  { id: "m03", name: "단단한 시공", blurb: "굵고 또렷해 믿음직해요", style: "bold", mode: "light", colorId: "navy", inWizard: true },
  { id: "m04", name: "깔끔한 사무실", blurb: "군더더기 없이 단정해요", style: "basic", mode: "light", colorId: "slate", inWizard: true },
  { id: "m05", name: "조용한 목공소", blurb: "여백이 넓어 차분해요", style: "quiet", mode: "light", colorId: "brown", inWizard: true },
  { id: "m06", name: "산뜻한 카페", blurb: "맑고 가벼운 느낌", style: "basic", mode: "light", colorId: "mint", inWizard: true },
  { id: "m07", name: "정갈한 찻집", blurb: "각을 없애고 넓게 띄웠어요", style: "refined", mode: "light", colorId: "olive", inWizard: true },
  { id: "m08", name: "아침 꽃집", blurb: "부드럽고 화사해요", style: "warm", mode: "light", colorId: "pink", inWizard: true },
  { id: "m09", name: "믿음직한 설비", blurb: "차분한 파랑으로 신뢰를", style: "basic", mode: "light", colorId: "blue", inWizard: false },
  { id: "m10", name: "새벽 반찬가게", blurb: "따뜻하고 부지런한 인상", style: "warm", mode: "light", colorId: "orange", inWizard: false },
  { id: "m11", name: "손끝 공방", blurb: "깊은 색에 조용한 여백", style: "quiet", mode: "light", colorId: "wine", inWizard: false },
  { id: "m12", name: "밝은 미용실", blurb: "산뜻하고 감각적이에요", style: "basic", mode: "light", colorId: "purple", inWizard: false },
  { id: "m13", name: "시원한 인테리어", blurb: "맑은 청록으로 깔끔하게", style: "basic", mode: "light", colorId: "teal", inWizard: false },
  { id: "m14", name: "활기찬 정육점", blurb: "힘 있고 눈에 잘 띄어요", style: "bold", mode: "light", colorId: "red", inWizard: false },
  { id: "m15", name: "단정한 학원", blurb: "차분하고 반듯해요", style: "refined", mode: "light", colorId: "indigo", inWizard: false },
  { id: "m16", name: "푸른 조경", blurb: "넓은 여백에 초록 한 줄", style: "quiet", mode: "light", colorId: "lime", inWizard: false },
  { id: "m17", name: "맑은 세탁소", blurb: "깨끗하고 시원해요", style: "basic", mode: "light", colorId: "sky", inWizard: false },
  { id: "m18", name: "온화한 떡집", blurb: "은은하고 정겨워요", style: "warm", mode: "light", colorId: "magenta", inWizard: false },
  { id: "m19", name: "든든한 철물점", blurb: "굵고 검어 묵직해요", style: "bold", mode: "light", colorId: "ink", inWizard: false },
  { id: "m20", name: "오래된 서점", blurb: "깊은 초록에 넓은 여백", style: "refined", mode: "light", colorId: "deepgreen", inWizard: false },

  /* ── 어두운 20 ── */
  { id: "m21", name: "밤에도 여는 가게", blurb: "어두운 바탕의 기본 얼굴", style: "basic", mode: "dark", colorId: "onstori", inWizard: true },
  { id: "m22", name: "늦은 밤 빵집", blurb: "어둡지만 따뜻해요", style: "warm", mode: "dark", colorId: "amber", inWizard: true },
  { id: "m23", name: "묵직한 시공", blurb: "어둡고 굵어 단단해요", style: "bold", mode: "dark", colorId: "navy", inWizard: true },
  { id: "m24", name: "차분한 사무실", blurb: "어두운 회색으로 단정하게", style: "basic", mode: "dark", colorId: "slate", inWizard: true },
  { id: "m25", name: "깊은 밤 공방", blurb: "어둠 속 나뭇결 같은 색", style: "quiet", mode: "dark", colorId: "brown", inWizard: true },
  { id: "m26", name: "밤바다 카페", blurb: "어두운 바탕에 맑은 민트", style: "basic", mode: "dark", colorId: "mint", inWizard: true },
  { id: "m27", name: "고요한 찻집", blurb: "가장 조용한 어두운 얼굴", style: "refined", mode: "dark", colorId: "olive", inWizard: true },
  { id: "m28", name: "어스름 꽃집", blurb: "어둡고 은은하게 화사해요", style: "warm", mode: "dark", colorId: "pink", inWizard: true },
  { id: "m29", name: "야간 설비", blurb: "밤에도 또렷한 파랑", style: "basic", mode: "dark", colorId: "blue", inWizard: false },
  { id: "m30", name: "새벽 주방", blurb: "어둠 속 따뜻한 주황", style: "warm", mode: "dark", colorId: "orange", inWizard: false },
  { id: "m31", name: "어두운 공방", blurb: "깊은 와인빛 여백", style: "quiet", mode: "dark", colorId: "wine", inWizard: false },
  { id: "m32", name: "깊은 살롱", blurb: "어둡고 감각적이에요", style: "basic", mode: "dark", colorId: "purple", inWizard: false },
  { id: "m33", name: "짙은 인테리어", blurb: "어두운 바탕에 청록 한 줄", style: "basic", mode: "dark", colorId: "teal", inWizard: false },
  { id: "m34", name: "불 켜진 정육점", blurb: "어둠 속 강한 빨강", style: "bold", mode: "dark", colorId: "red", inWizard: false },
  { id: "m35", name: "밤의 서재", blurb: "차분하고 깊어요", style: "refined", mode: "dark", colorId: "indigo", inWizard: false },
  { id: "m36", name: "숲속 조경", blurb: "어두운 숲 같은 초록", style: "quiet", mode: "dark", colorId: "lime", inWizard: false },
  { id: "m37", name: "푸른 밤 세탁소", blurb: "어두운 바탕에 시원한 하늘", style: "basic", mode: "dark", colorId: "sky", inWizard: false },
  { id: "m38", name: "자줏빛 떡집", blurb: "어둡고 은은해요", style: "warm", mode: "dark", colorId: "magenta", inWizard: false },
  { id: "m39", name: "검은 철물점", blurb: "가장 어둡고 굵어요", style: "bold", mode: "dark", colorId: "ink", inWizard: false },
  { id: "m40", name: "오래된 극장", blurb: "깊은 초록에 넓은 여백", style: "refined", mode: "dark", colorId: "deepgreen", inWizard: false },
];

/* ─────────────────────────── 옛 값 → 새 값 대응 ─────────────────────────── */

/**
 * 옛 온보딩 8색(`config/palettes.ts` ACCENTS) → 새 20색 대응표.
 *
 * ★ 이 표는 **이름을 붙이기 위한 것이지 기존 사이트를 자동으로 바꾸기 위한 것이 아니다.**
 *   2026-09-08 조사 결과, 옛 팔레트(clean/warm/premium/lively)의 바탕·글자색은
 *   새 엔진의 면·글자 토큰과 **같은 화면을 내지 않는다.** 기존 13곳을 그대로 옮기면
 *   13곳 전부 화면이 바뀐다. 그래서 기존 사이트는 옛 팔레트를 폴백으로 그대로 두고,
 *   사장님이 편집 화면에서 새 분위기를 **직접 고를 때만** 넘어간다.
 *   자세한 근거와 사이트별 표는 `docs/specs/테마엔진-S0-보고-2026-09-08.md`.
 *
 * ⚠ 색 거리는 hex→sRGB 유클리드로 계산했고 HSL 색상각으로 교차 확인했다.
 *   두 기준이 갈리는 색은 주석에 적어 둔다 — 사람이 보고 정해야 하는 자리다.
 */
export const LEGACY_ACCENT_MAP: Record<string, string> = {
  forest: "deepgreen",  // #1E5F4B → #14532D
  teal: "teal",         // #0E7365 → #0F766E  (거의 같은 색)
  cobalt: "blue",       // #1E5BD7 → #1D4ED8  (거리 13.1 — 사실상 같은 색)
  terra: "amber",       // #B4643C → #B45309  (거리 53.8 — 눈에 보이게 다르다. 갈색보다는 호박이 가깝다)
  mustard: "amber",     // #B8860B → #B45309
  plum: "purple",       // #6B3FA0 → #6D28D9
  rose: "pink",         // #C2426A → #BE185D
  charcoal: "slate",    // #3A3F47 → #334155  (거리 15.8 — 사실상 같은 색)
};

/* ─────────────────────────── 조회 함수 ─────────────────────────── */

export const styleById = (id: string): Style | undefined => STYLES.find((s) => s.id === id);
export const colorById = (id: string): BrandColor | undefined => COLORS.find((c) => c.id === id);
export const fontById = (id: string): Font | undefined => FONTS.find((f) => f.id === id);
export const targetById = (id: string): TargetSpec | undefined => TARGETS.find((t) => t.id === id);

/** 색 hex 에 붙일 이름. 20색에 없으면 「직접 고른 색」이라고 답한다. */
export function colorName(hex: string): string {
  const i = COLORS.findIndex((c) => c.hex.toUpperCase() === hex.toUpperCase());
  return i >= 0 ? `${i + 1}번 ${COLORS[i].name}` : `직접 고른 색 ${hex.toUpperCase()}`;
}

/** 제작신청(위저드)에 보여줄 카드. 화이트 8 · 다크 8 = 16장. */
export const wizardCards = (cards: MoodCard[] = MOOD_CARDS): MoodCard[] => cards.filter((c) => c.inWizard);

/**
 * 이 대상이 서체를 고를 수 있는가. **저장 전 서버에서도 이걸로 검사한다** —
 * 클라이언트가 보낸 값을 믿지 않는다(불변 규칙 4).
 */
export const canPickFont = (target: DesignTarget): boolean => targetById(target)?.canPickFont ?? false;
