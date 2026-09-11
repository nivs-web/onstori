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
  /* ⚠ 2026-09-10 — 안내를 **채점에 맞췄다.** 전에는 「첫 화면 사진 교체」라고 안내하고
     앵커도 거기로 데려갔는데, 실제 채점은 `story_entries.photos` 합계 3장이었다.
     시키는 대로 해도 점수가 안 올랐다. 채점은 그대로 두고(이미 점수를 받은 사장님이
     내려가면 안 된다) **말과 데려가는 곳을 바꿨다** — 2026-09-10 회장님 확정. */
  { id: "photo_real", label: "이야기에 사진 3장 올리기", pts: 15, anchor: "story-new", hint: "현장 사진을 이야기로 올려 주세요 — 3장이 쌓이면 홈페이지가 확 달라져요" },
  /* ★★ 2026-09-12 신설 — 「첫 영상」(회장님 지시 7). 배점 10점.
     ★ 10점을 **아무도 아직 못 받은 두 규칙**에서 가져왔다(hours 10→5, story_1 15→10).
       실측(2026-09-12): 점수가 있는 사이트 13곳 중 hours·story_1 을 받은 곳이 **0곳**이다.
       그래서 **한 사람도 점수가 내려가지 않는다** — 규칙 12 의 「이미 받은 점수를 깎지 마라」를 지켰다.
     ★ 규칙 12 의 셋이 같다: 판정 = 찍은 영상이 한 편이라도 있나(story_entries.video_key) ·
       화면 = 「영상」 메뉴에 녹화 링크 버튼이 있다 · 힌트 = `panel-video` 로 그 메뉴를 연다. */
  { id: "first_video", label: "첫 영상 찍기", pts: 10, anchor: "panel-video", hint: "60초만 찍어 보세요 — 얼굴이 안 나와도 됩니다. 「영상」 메뉴에서 녹화 링크를 받으세요" },
  /* ⚠ 10→5. 이 규칙은 **VISIT 템플릿에만 자리가 있다**(set-hours 는 CONDITIONAL_ANCHORS).
     우리 런칭 집중은 시공·출장(QUOTE)이라 대부분의 사장님은 **구조적으로 못 받는 점수**였다.
     낮추는 편이 100점을 더 닿을 수 있게 만든다. 받은 사장님은 0명이라 아무도 안 깎인다. */
  { id: "hours", label: "영업시간 입력", pts: 5, anchor: "set-hours", hint: "방문 전 확인이 쉬워져요" },
  { id: "contact", label: "전화·주소 확인", pts: 10, anchor: "set-contact", hint: "연락처와 주소가 정확한지 확인하세요" },
  /* ⚠ 15→10. 「첫 영상」도 이야기다 — 이야기 배점을 글과 영상이 나눠 가진다. 받은 사장님 0명. */
  { id: "story_1", label: "첫 스토리 작성", pts: 10, anchor: "story-new", hint: "사진 한 장과 두 줄이면 충분해요 — 이야기가 쌓일수록 홈페이지가 강해져요" },
  { id: "cta_form", label: "견적/예약 폼 켜기", pts: 10, anchor: "sec-form", hint: "고객이 바로 문의할 수 있게 해요" },
  /* ★ 2026-09-10 — 판정을 켰다(lib/score.ts). 앵커 `panel-brand` 는 이제 「디자인」 메뉴에 **실재한다.** */
  { id: "logo", label: "로고 정하기", pts: 5, anchor: "panel-brand", hint: "「디자인」 메뉴에서 로고를 올리면 명함·도장까지 이어져요" },
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
