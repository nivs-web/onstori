import type { ErrorKind } from "./types";

/**
 * SNS API 호출 공통 — 오류를 **네 값**으로 번역하는 바탕. (2026-09-11)
 *
 * ★ 규칙 하나만 지키면 된다: **모르면 TRANSIENT.** 다섯 번째 값을 만들지 않는다.
 *   「모르는 것을 REJECTED 로 단정」하면 다시 하면 될 일을 영영 포기하게 만든다.
 *   반대로 TRANSIENT 로 두면 최악이 «한 번 더 해 보는 것»이라 손해가 작다.
 */

export class SnsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly where: string,
  ) {
    super(`${where} ${status}`);
  }
}

/** 응답 본문을 짧게 — 로그·화면에 원문을 통째로 흘리지 않는다 */
export const brief = (s: string, n = 200) => s.replace(/\s+/g, " ").slice(0, n);

/**
 * HTTP 상태만으로 가르는 기본 판정. 어댑터가 본문을 보고 더 정확히 덮어쓸 수 있다.
 *
 * · 401        — 토큰이 죽었다 → AUTH_EXPIRED
 * · 429        — 너무 많이 불렀다 → QUOTA_EXCEEDED
 * · 400·422    — 그쪽이 «이건 못 받는다»고 한 것 → REJECTED
 * · 그 밖(403·5xx·네트워크·모름) — TRANSIENT
 *   ⚠ 403 을 AUTH_EXPIRED 로 단정하지 않는다. 권한 부족일 수도, 잠깐 막힌 것일 수도 있다.
 *     어댑터가 본문에서 확실한 단서를 찾았을 때만 AUTH_EXPIRED 로 올린다.
 */
export function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return "AUTH_EXPIRED";
  if (status === 429) return "QUOTA_EXCEEDED";
  if (status === 400 || status === 422) return "REJECTED";
  return "TRANSIENT";
}

/** JSON 호출 — 실패하면 SnsHttpError 를 던진다 */
export async function callJson(
  url: string,
  init: RequestInit,
  where: string,
  timeoutMs = 20000,
): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
    const text = await r.text();
    if (!r.ok) throw new SnsHttpError(r.status, brief(text), where);
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  } finally {
    clearTimeout(t);
  }
}
