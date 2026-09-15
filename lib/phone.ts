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
 * ★★ **치는 대로 하이픈을 넣어 준다.** (2026-09-15 대표님 요청)
 *   `01024392818` → `010-2439-2818`
 *
 * ★ 왜 필요한가: 사장님은 숫자만 치시는 일이 훨씬 많다. 하이픈을 손으로 넣게 하면
 *   자리를 틀리거나 빠뜨리시고, 그러면 화면에 이상한 번호가 박힌다.
 * ⚠ **모르는 모양은 건드리지 않는다.** 대표번호(1588)·서울(02)·지역(031)이 전부 다르다.
 *   규칙에 안 맞으면 **숫자 그대로** 돌려준다 — 엉뚱한 자리에 하이픈을 넣느니 아무것도 안 하는 편이 낫다.
 * ⚠ 검사는 `isValidPhone` 이 따로 한다. 이 함수는 **보기 좋게만** 만든다 —
 *   치는 중간(`010-24`)에도 불리므로 **막으면 안 된다.**
 */
export function formatPhone(v: string | null | undefined): string {
  const d = phoneDigits(v);
  if (!d) return "";
  const three = (s: string) =>
    s.length <= 3 ? s
    : s.length <= 7 ? `${s.slice(0, 3)}-${s.slice(3)}`
    : `${s.slice(0, 3)}-${s.slice(3, s.length - 4)}-${s.slice(-4)}`;

  /* 휴대폰·인터넷전화 — 010/011/016/017/018/019/070 */
  if (/^(01[016789]|070)/.test(d)) return three(d);
  /* 서울 02 — 국번이 세 자리일 때도 네 자리일 때도 뒤 네 자리는 고정이다 */
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  }
  /* 그 밖의 지역번호 세 자리 — 031·051·064 … */
  if (/^0[3-6]\d/.test(d)) return three(d);
  /* 대표번호 1588·1644 — 넷+넷 */
  if (/^1\d{3}/.test(d) && d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  /* 모르는 모양 — 손대지 않는다 */
  return d;
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
