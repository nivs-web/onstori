/**
 * 가이드 투어 스텝의 단일 출처.
 * - anchor는 화면의 data-tour 식별자와 일치 (CLAUDE.md 불변 규칙 3)
 * - 진행 상태는 site_progress.tours_seen(jsonb)에 저장 — 중간에 닫아도 이어보기
 * - 투어 UI(스포트라이트·애니메이션)는 P9 폴리시 단계에 장착. 그때까지 앵커만 유지하면 된다.
 * - prefers-reduced-motion 사용자에겐 애니메이션 없이 표시.
 *
 * 2026-09-02 재정의: 스텝 3개(preview·panel-settings·sec-story-feed)가 현 에디터에 없는
 * 앵커를 가리키고 있었다. 투어 UI를 붙이는 순간 그 스텝에서 멈춘다. 지금 있는 화면 기준으로
 * 고쳤고, 아직 안 만든 Phase의 앵커는 FUTURE_ANCHORS로 분리해 존재 검사가 헛돌지 않게 했다.
 */

export interface TourStep {
  anchor: string;
  title: string;
  body: string;
}

export interface Tour {
  id: string;
  trigger: "editor_first_open" | "story_zero_after_publish" | "trial_ending";
  /** 이 투어가 기다리는 Phase — 설정되면 그 Phase 전까지는 앵커가 없어도 정상 */
  pendingPhase?: "P5" | "P6" | "P8";
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: "editorIntro",
    trigger: "editor_first_open",
    steps: [
      { anchor: "panel-sections", title: "내용 고치기", body: "섹션을 더하고 순서를 바꿀 수 있어요" },
      { anchor: "sec-hero", title: "첫 화면", body: "손님이 가장 먼저 보는 곳이에요. 우리 가게 말로 바꿔보세요" },
      { anchor: "panel-photos", title: "내 사진으로", body: "기본 이미지를 실제 사진으로 바꾸면 신뢰도가 크게 올라요" },
      { anchor: "score-bar", title: "완성도 점수", body: "100점까지 하나씩 안내해 드려요. 점수를 누르면 그 자리로 데려가요" },
      { anchor: "btn-publish", title: "사이트 반영", body: "저장과 발행은 달라요 — 발행해야 손님에게 보여요" },
    ],
  },
  {
    id: "storyIntro",
    trigger: "story_zero_after_publish",
    steps: [
      { anchor: "story-new", title: "첫 이야기를 남겨보세요", body: "오늘 작업 사진 한 장과 두 줄이면 충분해요. 기록이 쌓일수록 홈페이지가 두꺼워져요" },
    ],
  },
  {
    id: "activateNudge",
    trigger: "trial_ending",
    pendingPhase: "P5", // btn-activate 는 결제(P5)에서 생긴다
    steps: [
      { anchor: "btn-activate", title: "체험이 곧 끝나요", body: "활성화하면 홈페이지가 정식 공개되고 브랜드키트 다운로드가 열려요" },
    ],
  },
];

/**
 * 지금 화면에 **반드시 존재해야 하는** 앵커. 레이아웃을 바꿀 때 이 목록으로 존재 검사한다.
 * (config/completeness.ts 의 anchor 중 현재 Phase에 해당하는 것도 포함)
 */
export const ACTIVE_ANCHORS = [
  ...new Set([
    ...TOURS.filter((t) => !t.pendingPhase).flatMap((t) => t.steps.map((s) => s.anchor)),
    "sec-hero", "panel-photos", "set-contact", "story-new", "sec-form", "btn-publish",
  ]),
];

/**
 * 템플릿에 따라 있을 수도 없을 수도 있는 앵커 — 존재 검사에서 빼야 한다.
 * set-hours(영업시간)는 VISIT 템플릿에만 붙는다. 완성도 규칙 hours 는 모든 템플릿에 적용되므로
 * QUOTE 사이트에서 "＋10점 영업시간" 힌트를 눌러도 갈 곳이 없다 — 에디터가 안내로 처리한다.
 */
export const CONDITIONAL_ANCHORS: { anchor: string; onlyOn: string[] }[] = [
  { anchor: "set-hours", onlyOn: ["visit"] },
];

/**
 * 아직 만들지 않은 Phase에서 생길 앵커 — 지금 없는 게 정상이다.
 * 해당 Phase를 만들 때 화면에 붙이고 ACTIVE_ANCHORS 로 옮긴다.
 */
export const FUTURE_ANCHORS: { anchor: string; phase: "P5" | "P6" | "P8" }[] = [
  { anchor: "btn-activate", phase: "P5" },  // 체험 활성화 버튼
  { anchor: "panel-brand", phase: "P6" },   // 브랜드키트(로고) 패널
  { anchor: "panel-widgets", phase: "P8" }, // 연결 위젯 패널
];

/** 하위 호환 — 기존 호출부가 있으면 계속 동작하게 (현재+미래 전체) */
export const ALL_ANCHORS = [...ACTIVE_ANCHORS, ...FUTURE_ANCHORS.map((f) => f.anchor)];
