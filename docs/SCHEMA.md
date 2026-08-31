# 섹션 JSON 스키마 문서 (SCHEMA.md)

> **규칙**: 이 문서 · `lib/schema.ts`(zod) · `components/sections/*`(렌더러) · 에디터 폼은 같은 약속의 네 표현이다.
> 섹션을 바꾸는 커밋은 반드시 4곳을 함께 바꾼다. (CLAUDE.md 불변 규칙 2)

## 상태

- schemaVersion: **1 (P1에서 확정 예정 — 현재 초안)**

## SiteDoc 최상위

| 필드 | 타입 | 설명 |
|---|---|---|
| schemaVersion | 1 | 스키마 버전. 변경 시 렌더러 입구에서 migrate 함수로 변환 |
| template | "visit" \| "book" \| "quote" \| "consult" \| "browse" | v1 활성: quote, visit |
| theme | { palette, accent, font } | 색·폰트 |
| sections | Section[] | 순서 있는 섹션 배열 |

## 섹션 목록 (v1 초안)

공통: `hero` `about` `storyFeed` `gallery` `reviews` `map` `banner`
QUOTE 전용: `portfolioGallery` `processSteps` `quoteForm`
VISIT 전용: `hoursCard` `menuPrice`

각 섹션의 필드 정의는 P1에서 zod와 함께 확정하며, 확정 즉시 이 표를 채운다.

## 예시 (인테리어 QUOTE)

```json
{
  "schemaVersion": 1,
  "template": "quote",
  "theme": { "palette": "clean", "accent": "#2B5BD7", "font": "pretendard" },
  "sections": [
    { "type": "hero", "headline": "10년의 현장이 말합니다", "cta": { "label": "견적 문의", "action": "quote" } },
    { "type": "portfolioGallery", "title": "시공 사례", "fromStory": true },
    { "type": "processSteps", "steps": ["상담", "실측", "시공", "AS"] },
    { "type": "quoteForm", "allowPhotos": true },
    { "type": "storyFeed", "showCount": 5 },
    { "type": "map", "address": "..." }
  ]
}
```
