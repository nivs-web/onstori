/**
 * 🔴 **숏폼피드가 «한 홈페이지에» 싣는 최대 편수 — 단 하나의 출처.** (2026-09-17 지시 [38]·[39])
 *
 * ⚠⚠ **왜 `lib/shorts.ts` 가 아니라 여기인가:**
 *   `lib/shorts.ts` 는 `lib/storage.ts`(R2·S3 도구)를 끌어온다 — **서버에서만 도는 코드**다.
 *   편집화면(`videos-panel.tsx`)은 **화면 코드**라, 거기서 `lib/shorts.ts` 를 import 하면
 *   **손님 브라우저로 갈 뭉치에 S3 도구가 딸려 갈 위험**이 있다.
 *   (2026-09-17 에 `lib/admin-auth.ts` 로 **똑같은 병**을 겪었다 — 그때는 빌드가 아예 깨졌다.)
 *   ⇒ **아무 데서나 읽을 수 있는 `config/` 에** 둔다. 여기가 제품 정책의 단일 출처다.
 *
 * ⚠ 이 숫자를 **두 곳에 적지 마라.** 2026-09-17 까지 `lib/shorts.ts` 와
 *   `app/api/site/videos/route.ts` 에 **따로 20 이 박혀** 있었다. 한쪽만 고치면
 *   편집화면은 25편을 보여 주는데 홈페이지는 20편만 나오는 식이 된다.
 *
 * 🔴 **이 값을 올리기 «전»에 가상화가 먼저다.** 크롬은 한 화면에 살아 있는 영상 재생기를
 *   폰 40개·PC 75개까지만 허용한다. 넘으면 **조용히 검은 화면**이 된다.
 *   ⇒ 2026-09-17 에 가상화(`<video>` 항상 3개)와 무대 상한(`STAGE_MAX`)이 끝나
 *     **20 → 200 으로 올렸다.**
 *
 * ★ **왜 200 인가:** 주 1회 찍으시면 **약 4년치**다. 지금 가장 많은 사장님이 **17편**이다.
 *   ⚠ **「무제한」으로 두지 않는다** — 편집화면·DB 조회·첫 화면에 실어 보내는 목록이 함께 늘어난다.
 *     늘려야 할 날이 오면 **그때 재고** 올린다.
 */
export const SHORTS_MAX = 200;

/**
 * 🔴 **«가두는» 무대에 세우는 최대 편수.** (2026-09-17 지시 [39] · 조사 8-2 ④)
 *
 * ⚠⚠ **무대 높이는 `(편수 + 1) × 화면 하나`다**(`app/globals.css` 의 `.stage`).
 *   상한만 올리고 이 값이 없으면 **1000편에서 81만px** 가 되어 **스크롤바가 못 쓰게 된다.**
 *   ⇒ **가두는 것은 앞 12편까지**, 나머지는 **「숏폼피드 세상」(전체화면)**에서 이어서 본다.
 *     세상은 **한 편씩만** 그리므로 편수가 늘어도 높이가 안 늘어난다.
 *
 * ★ **왜 12인가:** 무대 높이가 **13화면**으로 «편수와 무관하게 고정»된다.
 *   폰에서 한 화면을 한 번 굴리는 데 1~2초이니 **끝까지 20초 안팎** — 참을 수 있는 선이다.
 *   더 늘리면 「건너뛰기」를 누르기 전에 지친다.
 */

/**
 * 🔴 **손가락이 이만큼은 움직여야 «넘긴 것»으로 본다.** 너무 작으면 살짝 흔들려도 넘어간다.
 *
 * ⚠ **무대와 몰입모드가 «같이» 쓴다.** (2026-09-17 지시 [42] §1 로 몰입모드를 파일로 뗐다)
 *   두 파일에 각각 적으면 한쪽만 고쳐져 **무대는 48px, 몰입모드는 60px** 같은 일이 난다 —
 *   `SHORTS_MAX` 가 실제로 그렇게 두 곳에 박혀 있었다(위 주석).
 */
export const SWIPE_PX = 48;

/**
 * 「탭하면 소리」·「↑↓ 로 넘길 수 있어요」를 띄워 두는 시간. 2~3초 — 읽히되 거슬리지 않는 선.
 * ⚠ 이것도 **무대와 몰입모드가 같이 쓴다**(권반장 지시 [31]①).
 */
export const HINT_MS = 2800;

/**
 * 🔴🔴 **두 모양 — 「숏폼형태」와 「카드형태」.** (2026-09-17 지시 [42] §3·§4)
 *
 * ★ **두 화면은 이미 있었다.** 새로 만든 것이 아니다 —
 *   숏폼형태 `components/sections/shorts-stage.tsx` · 카드형태 `components/sections/shorts-feed.tsx`.
 *   전에는 **「영상이 있으면 무조건 숏폼형태」**였고, 카드형태는 아무 데서도 안 그려졌다.
 *   이제 **사장님이 고른 모양**이 정한다.
 *
 * ⚠⚠ **값은 «문자열 하나»이고 목록은 여기 한 곳이다.** 모양이나 순서가 늘어날 때
 *   `if` 를 세 개 박지 말고 **이 배열에 한 줄만** 더한다. 화면은 이 배열을 돌려 그린다.
 * 🔴 **모르는 값이 오면 «조용히» 기본값으로 떨어뜨린다**(`shortsStyleOf`) —
 *   옛 사이트나 손으로 고친 값 때문에 **손님 화면이 깨지면 안 된다.**
 */
export const SHORTS_STYLES = [
  {
    key: "shorts",
    label: "숏폼형태",
    /** 🔴 **대표님이 쓰신 문장 그대로다. 다듬지 마라.** (기획서 §1-1) */
    headline: "숏폼 업데이트를 자주 하는 대표님을 위한 최적의 선택",
    body: [
      "숏폼 위주의 형태로써 유튜브 쇼츠와 인스타 릴스와 같은 형태로, 스크롤을 세로 방향으로 내리며 봅니다.",
      "홈페이지의 첫 페이지 아래로 내려가면, 숏폼 영상에 스크롤을 가두는 형태로써 많은 영상을 보여주는 것이 메인이 되는 형태입니다.",
    ],
  },
  {
    key: "cards",
    label: "카드형태",
    headline: "숏폼 영상이 존재하지만, 숏폼 영상은 서비스고, 홈페이지를 중심으로 보여주고 싶은 형태",
    body: [
      "동영상 카드형태로써 PC의 경우 홈페이지에 적합한 가로 나열 카드 형태로 가로 영상 넘김 버튼을 눌러 가면서 다음 영상을 볼 수 있습니다.",
      "모바일에서도 가로 방향으로 스크롤 하며 다음 영상을 넘길 수 있습니다.",
      "숏폼 영상에 스크롤을 가두는 형태가 아니라서 홈페이지의 내용을 더 인식시키는 형태입니다.",
    ],
  },
] as const;

export type ShortsStyle = (typeof SHORTS_STYLES)[number]["key"];

/** 🔴 **기본은 숏폼형태**다(대표님 확정). 아무것도 안 고른 사장님은 지금까지와 똑같이 보인다 */
export const SHORTS_STYLE_DEFAULT: ShortsStyle = "shorts";

/**
 * 🔴 **홈페이지에 «그리는» 편수 — 모양마다 다르다.** (지시 [42] §3 · 대표님 확정)
 *
 * ⚠⚠ **`SHORTS_MAX`(200)와 «전혀 다른 숫자»다. 헷갈리지 마라.**
 *   · `SHORTS_MAX`   = **DB 에서 몇 편을 가져오나** (몰입모드가 그 전부를 본다)
 *   · 여기          = **첫 화면에 몇 개를 그리나**
 *   ⇒ 대표님 말씀 「10·20편은 홈페이지만, **몰입모드는 전부**」가 이 구조와 그대로 맞는다.
 *
 * ⚠ 숏폼형태가 10인 이유는 **무대 높이가 `(편수+1) × 화면 하나`**라서다.
 *   [39] 에서 12였고, [42] 로 **10**이 되었다.
 */
export const SHORTS_SHAPE_N: Record<ShortsStyle, number> = {
  shorts: 10,
  cards: 20,
};

/**
 * 사장님이 고른 모양을 **안전하게** 꺼낸다. 저장 자리는 `sites.settings.shorts.style`.
 * ⚠ `settings` 는 **자유 형식(jsonb)**이라 무엇이든 들어 있을 수 있다 — 모르는 값은 기본값이다.
 */
export function shortsStyleOf(settings: unknown): ShortsStyle {
  const v = (settings as { shorts?: { style?: unknown } } | null | undefined)?.shorts?.style;
  return SHORTS_STYLES.some((s) => s.key === v) ? (v as ShortsStyle) : SHORTS_STYLE_DEFAULT;
}

export const STAGE_MAX = SHORTS_SHAPE_N.shorts;

/**
 * 🔴🔴 **재생 순서 — 사장님이 고른다.** (2026-09-17 지시 [42] §5 · 대표님 기획서 §1-2)
 *
 * ⚠⚠ **`if` 를 세 개 박지 마라.** 대표님이 **「옵션이 더 늘어난다」**고 하셨다 —
 *   늘어날 때 **이 배열에 한 줄만** 더하면 화면도 서버도 저절로 따라오게 둔다.
 * 🔴 **모르는 값은 조용히 기본값으로**(`shortsOrderOf`). 옛 사이트가 깨지면 안 된다.
 */
export const SHORTS_ORDERS = [
  { key: "newest", label: "최근에 등록한 순으로 재생", hint: "찍은 순서대로. 새 영상이 맨 앞에 옵니다" },
  { key: "first-fixed", label: "첫 영상만 최근, 2번째부터 랜덤", hint: "가장 보여 주고 싶은 한 편은 고정하고, 나머지는 올 때마다 다르게" },
  { key: "random", label: "전체 랜덤 재생", hint: "올 때마다 순서가 다릅니다" },
] as const;

export type ShortsOrder = (typeof SHORTS_ORDERS)[number]["key"];

/** 🔴 **기본은 최근 순**(대표님 확정). 아무것도 안 고른 사장님은 지금까지와 똑같다 */
export const SHORTS_ORDER_DEFAULT: ShortsOrder = "newest";

/** 저장 자리는 `sites.settings.shorts.order`. ⚠ 모르는 값은 기본값이다 */
export function shortsOrderOf(settings: unknown): ShortsOrder {
  const v = (settings as { shorts?: { order?: unknown } } | null | undefined)?.shorts?.order;
  return SHORTS_ORDERS.some((o) => o.key === v) ? (v as ShortsOrder) : SHORTS_ORDER_DEFAULT;
}

/**
 * 🔴🔴 **«같은 씨앗이면 같은 순서»가 나오는 섞기.** (지시 [42] §5)
 *
 * ⚠⚠ **왜 «아무 랜덤»을 쓰면 안 되나 — 권반장이 잡아 준 것:**
 *   그릴 때마다 새로 섞으면 **「1 / 2000」이 거짓말**이 된다. 손님이 3번째 편을 보다가
 *   새로고침하면 **전혀 다른 영상**이 3번째가 된다. 「몇 번째인지」가 아무 뜻이 없어진다.
 * ⇒ **손님 한 분의 «방문 한 번»에는 순서를 고정한다.** 들어올 때 씨앗 하나를 뽑아
 *   `sessionStorage` 에 두고, 그 방문 내내 그 씨앗으로만 섞는다.
 *   ⇒ **올 때마다 다르되, 그 손님에게는 끝까지 같다.**
 *
 * ⚠ **서버에서 섞으면 안 된다.** 손님 화면은 ISR(캐시)이라 **모든 손님이 같은 순서**를 받는다 —
 *   「올 때마다 다르게」가 아예 성립하지 않는다. 그래서 **브라우저에서** 섞는다.
 */
function 씨앗난수(seed: number) {
  /* mulberry32 — 짧고 씨앗 하나로 같은 수열이 나온다. 암호용이 아니다(그럴 필요도 없다) */
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 원본을 건드리지 않고 섞은 «새 배열»을 준다(Fisher–Yates) */
function 섞기<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 고른 순서대로 다시 늘어놓는다. **원본 배열은 안 건드린다.**
 * ⚠ `seed` 가 같으면 **언제 불러도 같은 결과**다 — 새로고침해도 안 흔들리는 이유다.
 */
export function orderShorts<T>(items: T[], order: ShortsOrder, seed: number): T[] {
  if (order === "newest" || items.length < 2) return items;
  const rnd = 씨앗난수(seed);
  if (order === "first-fixed") return [items[0], ...섞기(items.slice(1), rnd)];
  return 섞기(items, rnd);
}

/**
 * 이 «방문»의 씨앗. 같은 탭에서는 새로고침해도 그대로다.
 * ⚠ `sessionStorage` 를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 **그 화면 동안만** 쓴다 —
 *   막히더라도 **화면이 죽으면 안 된다.**
 */
export function visitSeed(slug: string): number {
  const key = `onstori:shortsSeed:${slug}`;
  try {
    const had = sessionStorage.getItem(key);
    if (had) return Number(had) || 1;
    const made = Math.floor(Math.random() * 2 ** 31) || 1;
    sessionStorage.setItem(key, String(made));
    return made;
  } catch {
    return 1;
  }
}

/**
 * 🔴🔴 **숏폼형태가 «가두는» 편수를 사장님이 고른다 — 5~10편.** (2026-09-17 대표님 지시)
 *
 * > 대표님: 「스크롤에 갇히는 거 몇 개로 할지 설정할 수 있게 … **최소 5개에서 최대 10개 중에 고를 수 있음.**
 * >   숏폼형태 10개면 **너무 많이 영상이 가려서 사장님들이 답답해 할 수 있으니까**」
 *
 * ⚠ **카드형태 20 은 그대로다**(대표님 지시) — 카드는 스크롤을 안 가두므로 답답할 일이 없다.
 * ⚠ 무대 높이는 **`(편수+1) × 화면 하나`**라, 이 숫자가 곧 **손님이 굴려야 하는 길이**다.
 *   10편이면 11화면 — 그래서 대표님이 「답답하다」고 하신 것이다.
 * 🔴 **범위 밖 값은 조용히 끌어당긴다**(`stageNOf`). 옛 사이트·손으로 고친 값이 화면을 깨면 안 된다.
 */
export const STAGE_N_MIN = 5;
export const STAGE_N_MAX = SHORTS_SHAPE_N.shorts;   // 10 — 「모양별 편수」와 어긋나지 않게 한 곳에서

/** 고를 수 있는 숫자들 — 화면이 이 배열을 돌려 그린다(늘 때 여기만 고친다) */
export const STAGE_N_CHOICES: number[] = Array.from(
  { length: STAGE_N_MAX - STAGE_N_MIN + 1 },
  (_, i) => STAGE_N_MIN + i,
);

/** 저장 자리는 `sites.settings.shorts.stageN`. ⚠ 없거나 이상하면 **기본(최대)**이다 */
export function stageNOf(settings: unknown): number {
  const v = (settings as { shorts?: { stageN?: unknown } } | null | undefined)?.shorts?.stageN;
  const n = typeof v === "number" ? Math.round(v) : Number.NaN;
  if (!Number.isFinite(n)) return STAGE_N_MAX;
  return Math.min(STAGE_N_MAX, Math.max(STAGE_N_MIN, n));
}
