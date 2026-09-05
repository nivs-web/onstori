# 에디터 라이브 미리보기 — 실행 스펙 (2026-09-05)

> 작성: 기술참모. 스프린트 **5번** 작업. P5(결제) 진입 조건 2번.
> 클코팀장은 이 문서만 읽고 작업한다. 세션 A 를 완전히 끝내(빌드·확인·커밋·병합) 뒤 세션 B 를 시작한다.
> 원칙: 한 세션 = 한 작업, 브랜치는 한 번에 하나, `lib/schema.ts` **무변경**, 마이그레이션 **없음**.

## 0. 무엇을 만드나

사장님이 에디터에서 글자를 고치면 **저장 버튼을 누르지 않아도** 옆(폰에서는 아래) 화면에 즉시 반영된다.
지금은 "저장 → 사이트 반영 → 새 탭에서 확인"의 3단계라 사장님이 자기가 뭘 바꿨는지 모른 채 편집한다.

## 1. 지금 막고 있는 것 — 딱 한 줄 (2026-09-05 실측)

```
components/sections/index.tsx : 2행
  import { workCount } from "@/lib/sites";
```

`components/sections/index.tsx` 는 화면을 그리는 부품인데, 이 한 줄 때문에 `lib/sites.ts`(= `fs` + `@supabase/supabase-js`) 전체를 끌고 온다.
그래서 이 부품은 **서버에서만** 돌 수 있고, 브라우저에서 다시 그릴 수 없다.

정작 쓰는 건 `workCount(ctx.stories)` 한 곳(49행)뿐이고, 그 함수는 배열을 세는 순수 계산이다.

```ts
export function workCount(stories: StoryEntryT[]): number {
  return stories.filter((s) => s.entryType === "work").length;
}
```

→ **이 함수를 DB 파일 밖으로 옮기면 끝난다.** 세션 A 의 핵심이 이것이다.

## 2. 왜 iframe 인가 (직접 그리기와 비교)

미리보기를 에디터 안에 `<div>` 로 직접 그리는 방법이 더 단순해 보이지만 쓰지 않는다.
렌더러가 `sm:` `md:` 같은 **화면 폭 기준 스타일**을 쓰기 때문이다. `<div>` 안에 그리면 그 기준이 *브라우저 창 폭*이 되어, 폭 390px 칸에 PC 레이아웃이 찌그러져 들어간다. 사장님이 보는 것이 손님이 볼 화면과 달라지면 미리보기의 존재 이유가 없다.
iframe 은 그 안이 독립된 창이라 폭 390px 이면 **진짜 폰 화면 그대로** 나온다. 실제 `/{slug}` 페이지와 같은 부품을 쓰므로 "미리보기와 실제가 다른" 문제도 구조적으로 생기지 않는다.

## 3. 세션 A — 부품 분리 + 미리보기 전용 주소

**성공 기준: 눈에 보이는 변화가 0.** 발행된 고객 사이트가 지금과 똑같아야 한다.

### A-1. `lib/stories.ts` 신설 (순수 계산만)
- `workCount` 를 `lib/sites.ts` → `lib/stories.ts` 로 **이동**한다(복사 아님).
- `lib/sites.ts` 는 필요하면 `export { workCount } from "./stories";` 로 재수출해도 되지만, **`components/sections/index.tsx` 의 import 경로는 반드시 `@/lib/stories` 로 바꾼다.** 재수출만 하고 경로를 그대로 두면 서버 의존이 그대로 남아 이 작업 전체가 무의미해진다.
- 다른 곳에서 `workCount` 를 쓰고 있으면(`grep -rn "workCount"`) 그 import 도 함께 바꾼다.
- 검증: `grep -n "@/lib/sites" components/sections/index.tsx` → **0건**이어야 한다.

### A-2. `lib/editor/preview-protocol.ts` 신설 (메시지 규약 한 곳)
에디터와 미리보기가 주고받는 메시지의 형식을 한 파일에 모아 둔다. 양쪽이 각자 문자열을 쓰면 오타 하나로 조용히 안 움직인다.

```ts
export const PREVIEW_MSG = "onstori:preview" as const;

/** 미리보기 → 에디터 : 준비됨 */
export type PreviewReady = { ch: typeof PREVIEW_MSG; type: "ready" };
/** 에디터 → 미리보기 : 문서 갱신 */
export type PreviewDoc  = { ch: typeof PREVIEW_MSG; type: "doc"; doc: SiteDocT };
/** 에디터 → 미리보기 : 이 섹션으로 스크롤 */
export type PreviewFocus = { ch: typeof PREVIEW_MSG; type: "focus"; index: number };

export type PreviewMessage = PreviewReady | PreviewDoc | PreviewFocus;
```
- 받는 쪽은 **반드시** `event.origin === location.origin` 과 `data.ch === PREVIEW_MSG` 를 둘 다 확인한다. 아니면 무시한다.

### A-3. `/[slug]/preview` 신설
- `app/[slug]/preview/page.tsx` (서버) — `getSiteBySlug(slug)` 로 **발행본**을 읽어 첫 화면을 그린다. 발행 전 사이트(published 없음)면 `null` 을 넘겨 빈 상태로 둔다.
  - `export const metadata = { robots: { index: false, follow: false } }`
  - 렌더 구조는 `app/[slug]/page.tsx` 와 동일하게: `PALETTES` 로 `--s-*` 변수 설정 + Pretendard 링크 + `RenderSection` 반복. **푸터는 그대로 둔다**(손님이 보는 것과 같아야 하므로).
- `app/[slug]/preview/preview-client.tsx` ("use client") — 초기 doc 을 props 로 받고, `PREVIEW_MSG` 로 새 doc 이 오면 그걸로 교체해 다시 그린다. `focus` 가 오면 해당 섹션으로 `scrollIntoView({behavior:"smooth"})`.
  - 마운트 직후 `window.parent.postMessage({ch, type:"ready"}, location.origin)` 를 보낸다(에디터가 이걸 받고 첫 doc 을 쏜다 — 순서 경합 방지).
  - 빈 상태 문구: `미리보기를 준비하고 있어요` (에디터 밖에서 직접 열었고 발행 전이면 이 화면이 남는다)
- **권한 게이트를 두지 않는다.** 이 페이지가 서버에서 읽는 건 이미 공개된 발행본뿐이고, 작성 중인 내용(draft)은 DB에서 읽지 않고 에디터가 창 안으로 넘겨주기만 한다. 그래서 주소를 알아도 남의 미완성 내용은 볼 수 없다.
- 스토리(`storyFeed` 섹션)는 발행본 기준 그대로 쓴다. 스토리는 에디터에서 실시간 편집 대상이 아니다.

### A-4. 안 건드리는 것
`lib/schema.ts` · `app/[slug]/page.tsx` · 에디터 파일 전부 · 마이그레이션. 이번 세션은 **새 파일 3개 + import 경로 1줄**이 전부다.

### A-5. 완료 조건
1. `npm run build` 통과, `tsc` 오류 0
2. `grep -n "@/lib/sites" components/sections/index.tsx` → 0건
3. **발행 사이트 5곳**(goodmoksu · whitedobae · barun-electric · mong-filates · testtesttest)을 브라우저에서 열어 지금과 동일한지 눈으로 확인 — 히어로·갤러리·실적 카운터 숫자까지
4. `/{slug}/preview` 단독 접속 시 발행본이 그대로 보이고, 검색 노출 차단(noindex) 이 붙어 있음
5. `git diff --stat` 에 `lib/schema.ts` · `supabase/migrations` 없음
6. 커밋 메시지 초안을 보여주고 멈춤 → 사람이 main 병합·push

## 4. 세션 B — 에디터에 붙이기

### B-1. `app/[slug]/edit/preview-pane.tsx` 신설
- props `{ slug, doc, focusIndex }`. 안에 `<iframe src={`/${slug}/preview`} title="미리보기">`.
- `ready` 를 받으면 현재 doc 을 즉시 1회 전송. 이후 `doc` 이 바뀔 때마다 **150ms 디바운스**로 전송(글자 하나마다 보내지 않는다).
- `focusIndex` 가 바뀌면 `focus` 메시지 전송.
- iframe 은 same-origin 이므로 `sandbox` 속성을 붙이지 않는다(붙이면 폰트·스타일 로딩이 막힌다).

### B-2. `ui.tsx` 레이아웃 — 두 갈래
- **PC(≥1024px)**: 2단. 왼쪽은 지금의 편집 폼(`max-w-xl` 유지), 오른쪽은 `sticky top-4` 로 고정된 폰 프레임(폭 390px, 높이 `calc(100vh - 6rem)`). 페이지 전체 컨테이너를 `max-w-xl` → `max-w-6xl` 로 넓히되, **왼쪽 칼럼 자체는 지금 폭 그대로** 둔다(폼이 넓어지면 읽기 어려워진다).
- **폰(<1024px)**: 미리보기를 기본으로 열지 않는다(무거움). 화면 하단 고정 바에 **[미리보기]** 버튼 → 전체 화면 시트로 열림, 닫기 버튼. 편집 중이던 섹션으로 자동 스크롤된 상태로 열린다.
- `data-tour="panel-preview"` 를 미리보기 영역(폰에서는 그 버튼)에 붙이고 `config/tours.ts` 의 `ACTIVE_ANCHORS` 와 `editorIntro` 에 등록한다. 투어 문구 제안: **"고친 내용이 여기 바로 보여요. 저장 안 해도 돼요"**

### B-3. 자동저장
- `doc` 또는 `notify` 가 바뀌면 **2초 디바운스** 후 기존 `save()` 를 호출한다(새 API 를 만들지 않는다 — `/api/site/update` 그대로).
- 추가로 저장하는 시점: 탭 전환 시, 창을 벗어날 때(`visibilitychange` → hidden), 발행 직전(이미 `publish()` 가 `dirty` 면 `save()` 를 부른다).
- 저장 상태 표시를 헤더에 한 줄로 둔다. 기존 [저장] 버튼은 **남긴다**(사장님이 직접 누르고 싶어 한다). 문구:
  - `저장 중…` / `저장됨 · 사장님만 보여요` / `저장 실패 — 다시 시도`
  - 실패 시 1회 자동 재시도, 그래도 실패하면 위 문구 + [지금 저장] 버튼.
- **"저장"과 "사이트 반영"의 차이를 문구로 못 박는다.** 자동저장은 손님에게 보이지 않는다는 것을 사장님이 오해하면 안 된다. 미리보기 상단에 작은 띠: `미리보기 — 손님에게는 [사이트 반영]을 눌러야 보여요`

### B-4. 이미 되어 있는 것 (확인만)
견적 폼은 iframe 안에서 제출이 막혀 있다(`components/sections/quote-form.tsx` 의 `window.parent !== window` 판정 + "미리보기에서는 보내지지 않아요"). G2 때 미리 넣어 둔 것이라 추가 작업이 없다. 동작만 확인한다.

### B-5. 완료 조건
1. `npm run build` 통과 · `lib/schema.ts` 무변경
2. PC: 히어로 문구를 고치면 **1초 안에** 오른쪽 미리보기에 반영
3. PC: 사진을 새로 올리면 미리보기에 그 사진이 나타남
4. 폰(실기기 또는 크롬 폰 모드): [미리보기] 시트가 열리고 편집 중이던 섹션이 보임
5. 자동저장: 글자를 고치고 **아무 버튼도 누르지 않고** 새로고침 → 고친 내용이 남아 있음
6. [사이트 반영] 후 실제 `/{slug}` 에 반영됨(기존 동작 불변)
7. 미리보기 안에서 [견적 요청 보내기] 가 눌리지 않음
8. `grep -rn "panel-preview"` 가 `config/tours.ts` 와 에디터 파일에서 잡힘
9. 커밋 메시지 초안 → 멈춤

## 5. 위험과 대비

| 위험 | 대비 |
|---|---|
| `workCount` 이동 중 다른 import 를 놓쳐 빌드가 깨짐 | `grep -rn "workCount"` 로 전수 확인 후 이동. 세션 A 가 빌드 통과 못 하면 거기서 멈춘다 |
| 발행 사이트 렌더가 미묘하게 달라짐 | A-5 의 5곳 육안 확인. 다르면 즉시 되돌린다(A 는 되돌리기 쉬운 크기다) |
| 폰에서 iframe 때문에 느려짐 | 폰은 기본 접힘. 열었을 때만 로드 |
| 자동저장이 서버를 두드림 | 2초 디바운스 + 내용이 실제로 바뀐 경우만. 사장님 1명이 분당 최대 30회 수준 |
| 미리보기 주소가 새어 나감 | 서버가 읽는 건 발행본뿐이라 유출 없음. noindex 로 검색 노출도 차단 |
| 다음 작업(플로팅 위젯)과 충돌 | 위젯은 이 작업이 **완전히 병합된 뒤** 시작한다. 두 작업 모두 렌더러를 만진다 |

## 6. 세션 카드 (붙여넣기용은 회장님 승인 후 별도 제공)

| 세션 | 모델 | 성격 |
|---|---|---|
| A | Sonnet 5 · effort 최대 | 새 파일 3개 + import 1줄. 기존 화면 무변화가 목표 |
| B | Sonnet 5 · effort 최대 | 새 파일 1개 + `ui.tsx` 레이아웃·자동저장. 눈에 보이는 변화 |

`lib/schema.ts` 를 건드리지 않으므로 두 세션 모두 Opus·ultracode 가 필요 없다. 스키마를 만지는 다음 작업(플로팅 위젯)에서만 올린다.
