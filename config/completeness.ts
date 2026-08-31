/**
 * 홈페이지 완성도 100점 규칙표 — 게이미피케이션의 단일 출처.
 * - 판정은 서버에서(사이트 draft/published JSON 검사) → site_progress.score 캐시 (P1~P3)
 * - anchor는 에디터/admin의 data-tour 식별자와 일치해야 한다 (CLAUDE.md 불변 규칙 3)
 * - "+N점" 클릭 시 anchor 요소로 스크롤·하이라이트 → 투어의 최소 동작형 (P3)
 */

export interface CompletenessRule {
  id: string;
  label: string;
  pts: number;
  anchor: string; // data-tour 식별자
  hint: string; // 사용자에게 보여줄 한 줄 안내
}

/** 합계 100점. 스토리 작성이 최고 배점 — 게이미피케이션이 컨셉(스토리 축적)을 강화한다. */
export const RULES: CompletenessRule[] = [
  { id: "hero_text", label: "대표 문구 다듬기", pts: 10, anchor: "sec-hero", hint: "첫 화면 문구를 우리 가게 말로 바꿔보세요" },
  { id: "photo_real", label: "내 사진으로 교체 (3장 이상)", pts: 15, anchor: "panel-photos", hint: "기본 이미지를 실제 시공·매장 사진으로 바꾸면 신뢰도가 크게 올라요" },
  { id: "hours", label: "영업시간 입력", pts: 10, anchor: "set-hours", hint: "방문 전 확인이 쉬워져요" },
  { id: "contact", label: "전화·주소 확인", pts: 10, anchor: "set-contact", hint: "연락처와 주소가 정확한지 확인하세요" },
  { id: "story_1", label: "첫 스토리 작성", pts: 15, anchor: "story-new", hint: "사진 한 장과 두 줄이면 충분해요 — 이야기가 쌓일수록 홈페이지가 강해져요" },
  { id: "cta_form", label: "견적/예약 폼 켜기", pts: 10, anchor: "sec-form", hint: "고객이 바로 문의할 수 있게 해요" },
  { id: "logo", label: "로고 정하기", pts: 5, anchor: "panel-brand", hint: "로고가 있으면 명함·도장까지 이어져요" },
  { id: "published", label: "사이트 반영 (발행)", pts: 15, anchor: "btn-publish", hint: "저장과 발행은 달라요 — 발행해야 손님에게 보여요" },
  { id: "widget_1", label: "연결 버튼 1개 켜기", pts: 10, anchor: "panel-widgets", hint: "전화·카톡 버튼을 켜면 문의가 늘어요" },
];

export const TOTAL_PTS = RULES.reduce((s, r) => s + r.pts, 0); // = 100 유지할 것

export function scoreLabel(score: number): string {
  if (score >= 90) return "완성";
  if (score >= 60) return "거의 완성";
  if (score >= 30) return "다듬는 중";
  return "시작 단계";
}
