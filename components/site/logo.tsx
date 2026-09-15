/**
 * ONSTORI 워드마크 — **브랜드 자산의 단일 출처** (brand v1, 2026-09-15 전면 교체).
 *
 * ★ 왜 갈아엎었나 (2026-09-15 대표님 지시)
 *   옛 로고는 **PNG 160px** 이었다. 가볍긴 했지만 **확대하면 깨진다.**
 *   사장님이 편집화면을 확대하거나 큰 화면에서 보면 그대로 드러났다.
 *   brand v1 부터는 **SVG 가 원본**이다. 아무리 확대해도 안 깨진다.
 *
 * ★ 왜 `next/image` 가 아니라 `<picture>` 인가
 *   구형 사파리·구형 안드로이드 브라우저는 SVG 를 못 여는 경우가 있다.
 *   `<picture>` 는 **SVG 를 못 읽는 브라우저가 자동으로 PNG 로 내려간다.**
 *   `next/image` 로는 이 갈래를 만들 수 없다. 그래서 생 `<img>` 를 쓴다.
 *   ⚠ 대신 **width/height 를 반드시 같이 넣는다.** 없으면 로고가 들어오는 순간
 *     헤더가 튄다(CLS). 아래에서 height 만 받아 width 를 계산해 둘 다 넣는다.
 *
 * ★ 밝은/어두운 전환은 **이 컴포넌트가 스스로 한다.**
 *   부르는 쪽은 `<Logo height={20} />` 한 줄이면 된다.
 *   두 장을 다 그려 두고 CSS(`.logo-light`/`.logo-dark`)로 하나만 보인다 —
 *   ⚠ 스크립트로 src 를 바꾸면 화면이 처음 뜰 때 **잘못된 색이 한 번 스쳐 간다.**
 *   ⚠ OS 의 다크모드(`prefers-color-scheme`)를 쓰지 않는다. 우리는 **사이트 안에서 고른**
 *     `data-mode` 를 따른다. OS 기준으로 만들면 화면에서 다크로 바꿔도 로고가 안 따라온다.
 *
 * ★ 로고가 바뀌면 `public/brand/v2/` 를 새로 올리고 `NEXT_PUBLIC_BRAND_URL` 만 바꾼다.
 *   ⚠ **v1 폴더 안의 파일은 고치지 않는다.** 브라우저·CDN 이 파비콘을 몇 주씩 붙잡아
 *     두기 때문에, 같은 주소에 다른 그림을 올리면 옛 아이콘이 계속 보인다.
 *     주소(v1→v2)가 바뀌면 그 문제가 사라진다.
 */

const BASE = process.env.NEXT_PUBLIC_BRAND_URL ?? "/brand/v1";

/** 로고 원본 비율 (8840 × 1650). height 만 주면 width 가 정해진다 */
const RATIO = 8840 / 1650;

/**
 * `light` — 밝은 면에 놓는 로고 (ON #005B2A · STORI #192C2C)
 * `dark`  — 어두운 면에 놓는 로고 (ON #03B359 · STORI #F1E7D2)
 *
 * ⚠ 이름은 **바탕 화면 기준**이다. `light` = 밝은 화면용(로고는 진한 초록).
 * ⚠ 옛 `cream`·`white` 는 없앴다(2026-09-15 대표님). 어두운 면은 전부 `dark` 하나다.
 */
type Variant = "light" | "dark";

function Img({ variant, height, width, priority }: { variant: Variant; height: number; width: number; priority: boolean }) {
  const svg = `${BASE}/logo/onstori-${variant}.svg`;
  const png2 = `${BASE}/logo/onstori-${variant}@2x.png`;
  const png3 = `${BASE}/logo/onstori-${variant}@3x.png`;
  return (
    <picture>
      {/* SVG 를 읽는 브라우저는 여기서 끝난다 */}
      <source srcSet={svg} type="image/svg+xml" />
      {/* 못 읽는 브라우저만 아래 PNG 로 내려간다 */}
      <img
        src={png2}
        srcSet={`${png2} 2x, ${png3} 3x`}
        width={width}
        height={height}
        alt="온스토리 ONSTORI"
        decoding="async"
        /* 헤더 로고는 첫 화면에 있다 — 늦게 부르면 상단이 비어 보인다.
           ⚠ 푸터는 `priority={false}` 로 부른다. 페이지 맨 아래인데 먼저 부르면
              첫 화면 자원과 대역폭을 다툰다(2026-09-07 실측). */
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        style={{ height, width, display: "block" }}
      />
    </picture>
  );
}

export function Logo({
  height = 26,
  priority = false,
  variant,
}: {
  height?: number;
  priority?: boolean;
  /** 지정하면 그 색으로 **고정**한다. 안 주면 화면 밝기를 따라 자동으로 바뀐다 */
  variant?: Variant;
}) {
  const width = Math.round(height * RATIO);

  /* 색을 고정해야 하는 자리 — 손님 사이트의 어두운 띠처럼 화면 밝기와 무관한 곳 */
  if (variant) return <Img variant={variant} height={height} width={width} priority={priority} />;

  /* 자동 — 두 장을 다 그려 두고 CSS 가 하나만 보여 준다 */
  return (
    <>
      <span className="logo-light">
        <Img variant="light" height={height} width={width} priority={priority} />
      </span>
      <span className="logo-dark">
        <Img variant="dark" height={height} width={width} priority={priority} />
      </span>
    </>
  );
}

/**
 * 이메일 본문처럼 **SVG 가 막히는 곳** 전용.
 * 대부분의 메일 프로그램은 SVG 를 차단한다 — 거기서는 이걸 쓴다.
 * ⚠ 메일에는 `<picture>`·`srcSet` 도 안 먹는 곳이 있어 **PNG 한 장만** 건다.
 */
export function LogoRaster({ height = 40, variant = "light" }: { height?: number; variant?: Variant }) {
  const width = Math.round(height * RATIO);
  return (
    <img
      src={`${BASE}/logo/onstori-${variant}@2x.png`}
      width={width}
      height={height}
      alt="온스토리"
      style={{ height, width, display: "block" }}
    />
  );
}

/** 색·비율을 코드에서 쓸 일이 있을 때 — 숫자를 여기저기 적어 두지 않는다 */
export const BRAND = {
  base: BASE,
  ratio: RATIO,
  colors: {
    light: { on: "#005B2A", stori: "#192C2C" },
    dark: { on: "#03B359", stori: "#F1E7D2" },
    theme: "#005B2A",
  },
} as const;
