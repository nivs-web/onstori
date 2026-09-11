/**
 * X 잔액·단가 조회. (2026-09-11 조사 확정)
 *
 * ★★ 잔액 조회 API 는 **실제로 있다.** `GET https://api.x.com/2/usage/credits`
 *   공식 문서·OpenAPI 규격 세 곳에서 확인됐다. 돌려주는 값이 **진짜 달러**다:
 *   · total_balance   = 쓸 수 있는 돈 (0 미만으로는 안 내려감)
 *   · prepaid_balance = 우리가 충전한 돈 (초과 사용 시 음수가 될 수 있다)
 *   · free_balance    = 공짜로 받은 돈 중 아직 안 만료된 것
 *   · free_grants[]   = 공짜 돈 한 건씩 — **만료일(expires_at)이 붙어 있다**
 *
 * ★★★ 「100건도 안 썼는데 $10 이 사라졌다」의 답이 여기 있다. 두 갈래다:
 *   ① **링크가 든 글을 올렸다** — 링크 글은 건당 $0.200 이라 $10 ÷ 0.2 = **딱 50건**이면 사라진다.
 *      (링크 없는 글은 $0.015 이라 667건을 올려야 $10 이다)
 *   ② **공짜 돈이 만료됐다** — free_grants 는 만료일이 있고, 한 건도 안 올려도 조용히 사라진다.
 *   그래서 이 화면은 **free_grants 의 만료일을 반드시 같이 보여 준다.** 둘을 가려야 하기 때문이다.
 *
 * ⚠ 이 조회가 **일부 계정에서 404** 로 막혀 있다(2026-09-09 X 개발자 포럼, X 직원이
 *   「URL·토큰 문제가 아니라 계정 등록 쪽 문제」라고 답변, 미해결). 그래서 404 를
 *   «고장»이 아니라 «아직 안 열림»으로 구분해 말한다 — 조용히 0 으로 보여주지 않는다.
 */

const CREDITS = "https://api.x.com/2/usage/credits";
/** X 가 실제로 쓰는 단가표. 문서 페이지가 실행 중에 이 주소를 불러 값을 채운다 */
const PRICING = "https://console.x.com/api/credits/pricing";

export type XBalance = {
  ok: true;
  totalUsd: number;
  prepaidUsd: number;
  freeUsd: number;
  grants: { amountUsd: number; expiresAt: string }[];
} | {
  ok: false;
  /** not-enrolled = X 쪽이 아직 이 계정에 안 열어 줌 · no-key = 우리 열쇠 없음 · error = 그 밖 */
  why: "no-key" | "not-enrolled" | "error";
  detail: string;
};

export async function readXBalance(): Promise<XBalance> {
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) {
    return { ok: false, why: "no-key", detail: "X 열쇠(X_BEARER_TOKEN)가 아직 등록되지 않았어요." };
  }
  try {
    const r = await fetch(CREDITS, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.status === 404) {
      /* ★ X 직원이 「계정 등록 쪽 문제」라고 확인한 알려진 상태다. 고장으로 말하지 않는다. */
      return { ok: false, why: "not-enrolled", detail: "X 쪽에서 이 계정에 잔액 조회를 아직 열어 주지 않았어요 (X도 아는 문제입니다)." };
    }
    if (!r.ok) {
      return { ok: false, why: "error", detail: `잔액을 읽지 못했어요 (${r.status})` };
    }
    const d = (await r.json()) as {
      data?: {
        total_balance?: number | string; prepaid_balance?: number | string; free_balance?: number | string;
        free_grants?: { amount?: number | string; expires_at?: string }[];
      };
    };
    const n = (v: unknown) => Number(v ?? 0) || 0;
    const g = d.data ?? {};
    return {
      ok: true,
      totalUsd: n(g.total_balance),
      prepaidUsd: n(g.prepaid_balance),
      freeUsd: n(g.free_balance),
      grants: (g.free_grants ?? []).map((x) => ({ amountUsd: n(x.amount), expiresAt: String(x.expires_at ?? "") })),
    };
  } catch (e) {
    return { ok: false, why: "error", detail: String(e).slice(0, 160) };
  }
}

/** 단가 — X 가 쓰는 값을 그대로 가져온다. 못 가져오면 문서에서 확인된 값으로 떨어진다 */
export async function readXPricing(): Promise<{ plain: number; withUrl: number; live: boolean }> {
  /* 문서로 확인된 값(2026-09-11): Post: Create $0.015 / Post: Create (with URL) $0.200 */
  const fallback = { plain: 0.015, withUrl: 0.2, live: false };
  try {
    const r = await fetch(PRICING, { cache: "no-store" });
    if (!r.ok) return fallback;
    const d = (await r.json()) as Record<string, unknown>;
    const plain = Number(d.PostCreate);
    const withUrl = Number(d.ContentCreateWithUrl);
    if (!Number.isFinite(plain) || !Number.isFinite(withUrl)) return fallback;
    return { plain, withUrl, live: true };
  } catch { return fallback; }
}
