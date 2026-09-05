/**
 * 전화번호 판정의 단일 출처 (2026-09-05).
 * 기준은 "숫자 9자리 이상" 하나 — 하이픈·국가번호 같은 형식은 강제하지 않는다.
 * 온보딩(app/new/wizard.tsx) · 생성 서버(api/generate) · 렌더러(components/sections)
 * · 완성도(lib/score.ts) 네 곳이 모두 이 함수를 쓴다. 기준을 바꾸려면 여기만 고친다.
 */

/** 값에서 숫자만 남긴다. */
export function phoneDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** 전화번호로 쓸 수 있는 값인가 — 숫자 9자리 이상이면 참. */
export function isValidPhone(v: string | null | undefined): boolean {
  return phoneDigits(v).length >= 9;
}

/**
 * `tel:` 링크에 넣을 값. 쓸 수 없는 값이면 빈 문자열을 준다 —
 * 호출부가 그것으로 링크를 만들지 말지 정한다(죽은 tel: 링크 방지).
 * 국가번호(+)는 살리고 나머지 문자는 턴다.
 */
export function telValue(v: string | null | undefined): string {
  if (!isValidPhone(v)) return "";
  return (v ?? "").replace(/[^0-9+]/g, "");
}
