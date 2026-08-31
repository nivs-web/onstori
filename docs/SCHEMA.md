# 섹션 JSON 스키마 문서 (SCHEMA.md)

> **규칙**: 이 문서 · `lib/schema.ts`(zod) · `components/sections/*`(렌더러) · 에디터 폼은 같은 약속의 네 표현이다.
> 섹션을 바꾸는 커밋은 반드시 4곳을 함께 바꾼다. (CLAUDE.md 불변 규칙 2)

## 상태

- schemaVersion: **1 (확정)** — 아래 표는 `lib/schema.ts`의 zod 정의와 1:1 대응 (2026-09-01 동기화)

표 읽는 법: **필수** ✅=생략 불가, ⬜=선택. 기본값이 있는 필드는 생략 시 zod parse가 기본값을 채운다.

## SiteDoc 최상위

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| schemaVersion | `1` (literal) | ✅ | 변경 시 렌더러 입구에서 migrate 함수로 변환 |
| template | `"visit" \| "book" \| "quote" \| "consult" \| "browse"` | ✅ | v1 활성: quote, visit |
| businessName | string | ✅ | 1~40자 |
| theme | Theme | ✅ | 아래 Theme 표 |
| sections | Section[] | ✅ | 1~20개, 순서 있는 배열 |

### Theme

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| palette | `"clean" \| "warm" \| "premium" \| "lively"` | ⬜ | 기본값 `"clean"` |
| accent | string | ⬜ | `#RRGGBB` 형식. 미지정 시 palette 기본색 |
| font | `"pretendard"` | ⬜ | 기본값 `"pretendard"` |

### Cta (공통 객체 — hero에서 사용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| label | string | ✅ | 1~20자 |
| action | `"call" \| "quote" \| "reserve" \| "consult"` | ✅ | |

## 섹션 목록 (v1 확정)

공통: `hero` `about` `storyFeed` `gallery` `reviews` `map` `banner`
QUOTE 전용: `portfolioGallery` `processSteps` `quoteForm`
VISIT 전용: `hoursCard` `menuPrice`

모든 섹션은 `type` literal 필드로 판별한다(discriminatedUnion). 아래 표에서 `type`은 생략.

### hero

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| eyebrow | string | ⬜ | ≤40자 |
| headline | string | ✅ | 1~60자 |
| sub | string | ⬜ | ≤160자 |
| image | string | ⬜ | 이미지 URL |
| cta | Cta | ✅ | 위 Cta 표 |

### about

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"소개"` |
| body | string | ✅ | 1~600자 |
| stats | `{ label, value }[]` | ⬜ | ≤4개. label ≤20자, value ≤20자 |

### storyFeed

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"우리 가게 이야기"` |
| showCount | number (int) | ⬜ | 3~10, 기본값 5 |

### gallery

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"갤러리"` |
| photos | string[] | ✅ | 1~30개 (이미지 URL) |

### reviews

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"고객 이야기"` |
| items | `{ title, body, source? }[]` | ✅ | 1~20개. title ≤60자, body ≤300자, source ≤30자(선택) |

⚠ 별점·평점 필드는 의도적으로 없다 — 표시광고법 방침 (CLAUDE.md 불변 규칙 7).

### map

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"오시는 길"` |
| address | string | ✅ | 1~120자 |
| phone | string | ⬜ | ≤20자 |
| naverMapUrl | string | ⬜ | URL 형식 |
| note | string | ⬜ | ≤120자 |

### banner

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| text | string | ✅ | 1~80자 |
| link | string | ⬜ | URL 형식 |

### portfolioGallery (QUOTE 전용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"시공 사례"` |
| items | `{ title, image, date?, tag? }[]` | ✅ | 1~30개. title ≤60자, image URL(필수), date ≤20자(선택), tag ≤20자(선택) |

### processSteps (QUOTE 전용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"진행 과정"` |
| steps | `{ name, desc? }[]` | ✅ | 2~6개. name ≤20자, desc ≤80자(선택) |

### quoteForm (QUOTE 전용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"견적 문의"` |
| sub | string | ⬜ | ≤120자 |
| phone | string | ✅ | 1~20자 |
| kakaoUrl | string | ⬜ | URL 형식 |
| allowPhotos | boolean | ⬜ | 기본값 `true`. 실제 폼 접수는 P8 — 현재는 연락 CTA 카드로 렌더 |

### hoursCard (VISIT 전용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"영업시간"` |
| hours | string | ✅ | 1~200자, 줄바꿈 허용 |
| holidayNote | string | ⬜ | ≤60자 |

### menuPrice (VISIT 전용)

| 필드 | 타입 | 필수 | 제약·기본값 |
|---|---|---|---|
| title | string | ⬜ | ≤40자, 기본값 `"메뉴"` |
| items | `{ name, price, desc? }[]` | ✅ | 1~40개. name ≤40자, price ≤20자 문자열(자유 표기, 예: `"12,000원"`), desc ≤80자(선택) |

## 예시 (인테리어 QUOTE)

```json
{
  "schemaVersion": 1,
  "template": "quote",
  "businessName": "한빛 인테리어",
  "theme": { "palette": "clean", "accent": "#2B5BD7", "font": "pretendard" },
  "sections": [
    { "type": "hero", "headline": "10년의 현장이 말합니다", "cta": { "label": "견적 문의", "action": "quote" } },
    { "type": "portfolioGallery", "items": [
      { "title": "행복아파트 32평 리모델링", "image": "https://example.com/p1.webp", "tag": "아파트" }
    ] },
    { "type": "processSteps", "steps": [
      { "name": "상담" }, { "name": "실측" }, { "name": "시공" }, { "name": "AS" }
    ] },
    { "type": "quoteForm", "phone": "010-0000-0000" },
    { "type": "storyFeed", "showCount": 5 },
    { "type": "map", "address": "서울시 ○○구 ○○로 12" }
  ]
}
```
