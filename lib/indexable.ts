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

export function sitemapVerdict(s: IndexInput): IndexVerdict {
  if (s.status !== "active") return { ok: false, why: "not-active" };
  if (!s.publishedAt) return { ok: false, why: "not-published" };
  if ((s.score ?? 0) < SITEMAP_MIN_SCORE) return { ok: false, why: "low-score" };
  /* 전화가 틀리면 손님이 전화를 걸 수 없다. 검색으로 데려와도 문의로 이어지지 않는다 */
  if (typeof s.phone !== "string" || !isValidPhone(s.phone)) return { ok: false, why: "bad-phone" };
  /* 한 번도 손대지 않은 = AI 가 지어 준 그대로인 홈페이지. 그건 아직 «그 가게»가 아니다 */
  if (!s.firstEditAt) return { ok: false, why: "never-edited" };
  return { ok: true };
}

export const isSitemapReady = (s: IndexInput): boolean => sitemapVerdict(s).ok;
