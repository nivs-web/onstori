/**
 * 운영자 콘솔의 **임시** 밝기 — 「디자인 설정」이 기본, 토글은 그 브라우저에서만 뒤집기.
 * (2026-09-09 회장님 확정)
 *
 * ★ 규칙 세 줄
 *   · 기본값 = 「디자인 설정」(`/admin/settings/brand`)에서 정한 값. **서버가 심는다.**
 *   · 토글을 누르면 **그 브라우저에서만** 임시로 뒤집힌다.
 *   · 설정을 새로 [적용하기] 하면 임시값이 **버려지고** 새 설정으로 돌아간다.
 *
 * ★ 「다른 브라우저의 임시값은 어떻게 지우나」 — 지울 수 없다. 남의 localStorage 는
 *   서버가 만지지 못한다. 그래서 **지우는 대신 무효로 만든다**: 저장할 때 그때의
 *   설정 지문(`rev`)을 같이 적어 두고, 화면을 열 때 서버가 준 지문과 다르면 버린다.
 *   설정이 바뀌면 지문이 달라지므로 **어느 브라우저든 다음에 열 때 저절로** 새 설정을 따른다.
 *
 * ⚠ 전에는 반대였다 — localStorage 가 서버값을 **항상** 이겨서, 예전에 한 번 눌러 둔
 *   값이 남아 「디자인 설정」을 만든 의미가 없었다(2026-09-09 이전 동작).
 */

export const ADMIN_THEME_KEY = "onstori-admin-theme";

/**
 * 「적용하기」를 누른 **그 브라우저** 안에서만 쓰는 신호.
 * 토글 버튼은 화면에 계속 떠 있으므로, 임시값을 지웠다고 알려 줘야 글자(라이트/다크)가
 * 옛 상태로 남지 않는다. 다른 브라우저와는 무관하다 — 그쪽은 지문 대조로 풀린다.
 */
export const DESIGN_APPLIED = "onstori:design-applied";

export type Mode = "light" | "dark";

/** 설정 지문 — 이 값이 달라지면 임시값을 버린다. 서버가 `data-design-rev` 로 내려준다 */
export const designRev = (s: { style: string; mode: string; color: string }): string =>
  `${s.style}:${s.mode}:${s.color.toUpperCase()}`;

/**
 * 이 브라우저의 임시값을 읽는다. **지문이 안 맞으면 지우고 null.**
 * 사생활 보호 모드처럼 localStorage 가 막힌 곳에서도 던지지 않는다.
 */
export function readOverride(rev: string): Mode | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(ADMIN_THEME_KEY); } catch { return null; }
  if (!raw) return null;
  const [savedRev, savedMode] = raw.split("|");
  if (savedRev === rev && (savedMode === "light" || savedMode === "dark")) return savedMode;
  clearOverride();
  return null;
}

/** 사람이 토글을 누른 그 순간에만 부른다 */
export function writeOverride(rev: string, mode: Mode): void {
  try { localStorage.setItem(ADMIN_THEME_KEY, `${rev}|${mode}`); } catch { /* 무시 */ }
}

/** [적용하기] 를 누른 브라우저에서는 **즉시** 지운다 — 지문을 기다리지 않는다 */
export function clearOverride(): void {
  try { localStorage.removeItem(ADMIN_THEME_KEY); } catch { /* 무시 */ }
}
