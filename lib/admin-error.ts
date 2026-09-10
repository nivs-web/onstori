/**
 * 어드민 화면의 «실패를 말하는 법» — **조용히 삼키지 않는다** (2026-09-10 회장님).
 *
 * ★ 왜 필요한가: 어드민 여섯 곳이 `if (r.ok) { … }` 만 쓰고 실패를 버리고 있었다.
 *   제일 위험한 건 «포트폴리오에서 빼기»다 — 조용히 실패하면 **지운 줄 알았는데
 *   손님 화면에 그대로 남는다.**
 *
 * ★ 401 을 따로 잡는 이유: 운영자 쿠키가 만료되면 모든 요청이 401 이 된다. 이때
 *   「저장 실패 — unauthorized」라고 하면 원인을 모른다. 「다시 로그인해 주세요」가 맞다.
 *
 * ⚠ 이 함수는 **응답 본문을 한 번 읽는다.** 부른 뒤에 다시 `r.json()` 하지 마라.
 */
export async function adminError(r: Response, what: string): Promise<string> {
  if (r.status === 401) return "로그인이 풀렸어요 — 다시 로그인해 주세요";
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  return `${what} 실패 — ${d.error ?? `서버가 ${r.status} 로 답했어요`}`;
}
