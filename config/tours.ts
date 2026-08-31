/**
 * 가이드 투어 스텝의 단일 출처.
 * - anchor는 화면의 data-tour 식별자와 일치 (CLAUDE.md 불변 규칙 3)
 * - 진행 상태는 site_progress.tours_seen(jsonb)에 저장 — 중간에 닫아도 이어보기
 * - 투어 UI(스포트라이트·애니메이션)는 P9 폴리시 단계에 장착. 그때까지 앵커만 유지하면 된다.
 * - prefers-reduced-motion 사용자에겐 애니메이션 없이 표시.
 */

export interface TourStep {
  anchor: string;
  title: string;
  body: string;
}

export interface Tour {
  id: string;
  trigger: "editor_first_open" | "story_zero_after_publish" | "trial_ending";
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: "editorIntro",
    trigger: "editor_first_open",
    steps: [
      { anchor: "panel-sections", title: "내용 추가", body: "섹션을 더하고 순서를 바꿀 수 있어요" },
      { anchor: "preview", title: "미리보기", body: "수정한 내용이 바로 보여요 (모바일/PC 전환 가능)" },
      { anchor: "panel-settings", title: "기본 정보", body: "전화·주소·영업시간은 여기서 고쳐요" },
      { anchor: "score-bar", title: "완성도 점수", body: "100점까지 하나씩 안내해 드려요" },
      { anchor: "btn-publish", title: "사이트 반영", body: "저장과 발행은 달라요 — 발행해야 손님에게 보여요" },
    ],
  },
  {
    id: "storyIntro",
    trigger: "story_zero_after_publish",
    steps: [
      { anchor: "story-new", title: "첫 이야기를 남겨보세요", body: "오늘 작업 사진 한 장과 두 줄이면 충분해요" },
      { anchor: "sec-story-feed", title: "이야기가 쌓이는 곳", body: "기록이 쌓일수록 홈페이지가 두꺼워지고 신뢰가 자라요" },
    ],
  },
  {
    id: "activateNudge",
    trigger: "trial_ending",
    steps: [
      { anchor: "btn-activate", title: "체험이 곧 끝나요", body: "활성화하면 홈페이지가 정식 공개되고 브랜드키트 다운로드가 열려요" },
    ],
  },
];

/** 화면에 존재해야 하는 전체 앵커 목록 — 레이아웃 변경 시 이 목록으로 존재 검사(P3 테스트). */
export const ALL_ANCHORS = [
  ...new Set([
    ...TOURS.flatMap((t) => t.steps.map((s) => s.anchor)),
    // completeness.ts의 anchor도 화면에 존재해야 함
    "sec-hero", "panel-photos", "set-hours", "set-contact", "story-new",
    "sec-form", "panel-brand", "btn-publish", "panel-widgets",
  ]),
];
