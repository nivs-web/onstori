/**
 * 심볼 — 「쌓인 기록이 사장님 대신 영업합니다」 세 항목용 (2026-09-07 회장님 확정).
 *
 * 규칙: **선 굵기 1.6 통일 · 단색(currentColor) · 배경 투명 · 24×24 격자.**
 * ⚠ 색을 여기서 정하지 않는다. 부모의 `color` 를 따라간다 — 그래야 어두운 면에서도 쓴다.
 * ⚠ fill 은 none 이다. 면을 채우면 선 굵기가 달라 보인다.
 */

const base = {
  width: 28, height: 28, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** ① 기록이 신뢰가 됩니다 — 층층이 쌓인 카드 + 체크 */
export function MarkStack() {
  return (
    <svg {...base}>
      <rect x="3" y="13.5" width="18" height="7" rx="1.8" />
      <path d="M5.5 11h13" />
      <path d="M7.5 8.5h9" />
      <path d="M8.5 17l2.2 2.2L15.5 15" />
    </svg>
  );
}

/** ② 이야기마다 새 페이지 — 돋보기 + 겹친 페이지 */
export function MarkSearch() {
  return (
    <svg {...base}>
      <path d="M7.5 3.5h5.5L16 6.5v6.2" />
      <path d="M4.5 6.5h5.5L13 9.5v9a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="16.8" cy="16.3" r="3.2" />
      <path d="M19.2 18.7L21.5 21" />
    </svg>
  );
}

/** ③ 사장님 목소리 그대로 — 음파 + 사람 */
export function MarkVoice() {
  return (
    <svg {...base}>
      <circle cx="8.5" cy="7.5" r="3" />
      <path d="M3 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M17 8.5v7" />
      <path d="M20 6.5v11" />
    </svg>
  );
}
