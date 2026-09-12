/**
 * **미리 만들어 둔 홈페이지** — 문자를 절대 보내면 안 되는 곳. (2026-09-13 상무님 지적)
 *
 * ★★★ **왜 이 파일이 따로 있나 — 남의 가게로 문자가 나갈 뻔했다.**
 *
 *   위저드가 네이버·카카오에서 **그 가게의 «진짜» 전화번호**를 불러와
 *   `settings.phone` 에 넣는다(`app/api/place-search`). 그리고 주 1회 알림은
 *   가입 때 **켜진 채로** 심긴다. 그런데 주간 크론은 **「주인이 있는가」를 보지 않았다.**
 *
 *   ⇒ 목요일에 만들어 둔 견본이 **다음 날 아침 9시 크론에서 곧바로 대상**이 된다.
 *     계약도 안 한 가게 사장님께 우리 이름으로 문자가 간다. 만료 문자도 같은 길이다.
 *
 * ★★ **자물쇠를 셋으로 둔다.** 하나만으로는 안 막힌다:
 *   ① `settings.premade === true` — **운영자가 만든 것**이라는 표시. 가장 확실하다
 *   ② 주인이 아무도 없다(`owner_id` 도 `anon_id` 도 없다) — 씨앗 스크립트가 만든 시연용
 *   ③ 주 1회 설정이 꺼져 있다 — 만들 때부터 꺼 둔다(`app/api/generate`)
 *
 *   ⚠ ②만으로는 **못 막는다.** 회장님이 브라우저로 만들면 `anon_id` 가 붙기 때문이다.
 *     실제로 지금 켜져 있는 6곳은 전부 `anon_id` 가 있어 ②에 안 걸린다.
 *     그래서 ①이 진짜 자물쇠다.
 *
 * ★ 사장님이 «가져가면»(claim) `owner_id` 가 붙고 `premade` 표시를 뗀다 —
 *   그때부터 정상적으로 문자가 나간다.
 */

export type OwnerBits = {
  owner_id?: string | null;
  anon_id?: string | null;
  settings?: unknown;
};

/**
 * **문자를 보내면 안 되는 곳인가.**
 *
 * ⚠ 애매하면 «보내지 않는 쪽»으로 기운다 — 잘못 보낸 문자는 되돌릴 수 없다.
 */
export function isPremade(site: OwnerBits): boolean {
  const s = (site.settings as Record<string, unknown> | null) ?? {};
  /* ① 운영자가 만들었다는 표시 — 가장 확실한 자물쇠 */
  if (s.premade === true) return true;
  /* ② 주인이 아무도 없다 — 씨앗 스크립트가 만든 시연용(scripts/seed-sample-site.ts 주석 참고) */
  if (!site.owner_id && !site.anon_id) return true;
  return false;
}

/** 왜 건너뛰었는지 — 로그에 남길 한 마디. 조용히 건너뛰지 않는다 */
export function premadeReason(site: OwnerBits): string {
  const s = (site.settings as Record<string, unknown> | null) ?? {};
  if (s.premade === true) return "운영자가 미리 만든 곳(premade)";
  if (!site.owner_id && !site.anon_id) return "주인이 아무도 없는 곳";
  return "";
}
