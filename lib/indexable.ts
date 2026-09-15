/* 기간 출처: lib/trial.ts — 아래 주석의 「무료 30일」은 설명을 위한 것이고, 실제 값은 그 파일이 정한다 */
import { isValidPhone } from "@/lib/phone";

/**
 * 「이 홈페이지를 검색엔진에 **먼저 알릴** 것인가」의 단일 출처. (2026-09-12 회장님 지시 10 · 상무님 권고)
 *
 * ★★ **왜 문턱을 두나:** 모든 사장님이 `onstori.com` 이라는 **하나의 도메인 평판**을 나눠 쓴다.
 *   속이 빈 홈페이지가 여러 개 색인되면 그 손해가 **다른 사장님들에게도** 간다.
 *
 * ★★ ⚠ **상무님 보고의 전제 하나는 코드와 달랐다** (2026-09-12 실측).
 *   「완성도 60점이면 색인된다」는 규칙은 **저장소 어디에도 없다.** 지금 실제 규칙은
 *   **「결제한(active) 사이트만 사이트맵에 넣고, 무료(trial)는 noindex」** 이고, 이건 60점 규칙보다
 *   이미 더 엄하다. 그래서 «60점을 75점으로 올리는» 고침은 고칠 대상 자체가 없었다.
 *   대신 **권고의 «뜻»을 살려**, 결제한 사이트 중에서도 «속이 빈 곳»은 우리가 먼저 알리지 않는다.
 *
 * ★★ ⚠ 그리고 **noindex 를 걸지 않는다. 사이트맵에서 빼기만 한다.** 둘은 다르다 —
 *   · 사이트맵에서 빼기 = 「우리가 먼저 알리지 않는다」 (채우면 다음 갱신에 저절로 들어간다)
 *   · noindex        = 「검색에서 지워라」
 *   **돈을 낸 사장님의 홈페이지를 우리가 검색에서 지우는 일은 하지 않는다.** 그건 판 물건을
 *   우리 손으로 망가뜨리는 것이다. 문턱은 «미는 힘»에만 걸고 «지우는 힘»에는 걸지 않는다.
 */

/** 사이트맵에 실을 최소 완성도. 상무님 권고값 */
export const SITEMAP_MIN_SCORE = 75;

export type IndexInput = {
  status: string | null;
  publishedAt: string | null;
  /** site_progress.score (캐시된 값) */
  score: number | null;
  /** sites.settings.phone */
  phone: unknown;
  /** site_progress.funnel.first_edit_at — 한 번이라도 손을 댔나 */
  firstEditAt: string | null;
};

/** 왜 뺐는지 한 낱말로 — 로그에 남겨 사람이 이유를 알 수 있게 */
export type IndexVerdict = { ok: true } | { ok: false; why: "not-active" | "not-published" | "low-score" | "bad-phone" | "never-edited" };

/**
 * ★★★ **2026-09-15 대표님 결정 — 무료 체험 사장님도 검색에 올린다.**
 *
 * 대표님 말씀: 「무료체험 사장님도 검색에 **당연히** 올려야지. 검색 SEO 부분 완벽하게 처리해야 해.」
 *
 * ★★ **왜 바꿨나 — 돈을 내기 «전»에는 제품 가치를 보여 주지 못하는 구조였다.**
 *   전에는 `status === "active"`(= 유료 결제)를 요구했다. 사장님은 30일 무료로 시작하는데
 *   그 30일 내내 검색에 **아예** 안 잡혔다. 「만들었는데 검색에 안 뜨네」 → 해지.
 *   경쟁사 홈ON 은 고객 사이트를 **어제·오늘 것까지** 사이트맵에 넣는다(2026-09-15 실측).
 *
 * ★ **대신 나머지 관문 셋은 그대로 둔다.** 그 셋이 진짜 문지기다:
 *   · 완성도 점수 75점 — 속이 빈 홈페이지를 막는다
 *   · 올바른 전화번호 — 검색으로 데려와도 연락이 안 되면 의미가 없다
 *   · **한 번이라도 직접 고쳤다** — AI 가 지어 준 그대로면 「그 가게」가 아니다. 가짜를 막는 핵심
 *
 * ⚠ **모든 사장님이 `onstori.com` 이라는 하나의 도메인 평판을 나눠 쓴다.** 그래서 문턱 자체는
 *   없애지 않았다. 없앤 것은 「돈을 냈는가」 하나뿐이다.
 * ⚠ **`trial` 의 `noindex` 도 함께 풀어야 한다** — `app/[slug]/page.tsx` 의 `generateMetadata`.
 *   **둘은 한 쌍이다.** 사이트맵에 넣고 noindex 를 두면 검색엔진이 그냥 무시한다.
 */
export function sitemapVerdict(s: IndexInput): IndexVerdict {
  /* 정지·만료된 곳은 안 싣는다 — 「쉬고 있어요」 안내만 나오는 주소를 검색에 올릴 이유가 없다 */
  if (s.status !== "active" && s.status !== "trial") return { ok: false, why: "not-active" };
  if (!s.publishedAt) return { ok: false, why: "not-published" };
  if ((s.score ?? 0) < SITEMAP_MIN_SCORE) return { ok: false, why: "low-score" };
  /* 전화가 틀리면 손님이 전화를 걸 수 없다. 검색으로 데려와도 문의로 이어지지 않는다 */
  if (typeof s.phone !== "string" || !isValidPhone(s.phone)) return { ok: false, why: "bad-phone" };
  /* 한 번도 손대지 않은 = AI 가 지어 준 그대로인 홈페이지. 그건 아직 «그 가게»가 아니다 */
  if (!s.firstEditAt) return { ok: false, why: "never-edited" };
  return { ok: true };
}

export const isSitemapReady = (s: IndexInput): boolean => sitemapVerdict(s).ok;
