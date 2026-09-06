# C — SNS 연결 위젯 확장 (전화·카톡 → 8개)

작성 2026-09-06 (기술참모) · **F 다음에 한다**(회장님 2026-09-06 순서 확정)
범위 확정: **주소 입력만.** 실제 계정 로그인(OAuth)과 자동 발행은 이 작업에 없다.

---

## 0. 회장님이 확정하신 범위 — 다시 한 번 못 박는다

> **"주소 입력 + 심사는 지금 신청"** (2026-09-06)

두 갈래를 **동시에 굴리지 않는다**:

| 갈래 | 내용 | 이 문서 |
|---|---|---|
| **C (여기)** | 에디터에 채널 주소를 넣으면 손님 사이트 위젯에 그 채널 버튼이 뜬다. **링크만.** | ✔ |
| autopost (기획2) | 온스토리가 사장님 계정에 **대신 게시**한다. Meta 앱 심사 6~8주 선행. | ✘ 별건 |

회장님이 보내주신 Blaze 캡처 5장(인스타·페이스북·링크드인·유튜브 연결 모달)은 **전부 뒤쪽 갈래**다.
그래서 **화면에 "연결됨"이라고 쓰지 않는다.** 실제로 연결된 게 아니라 주소를 적어 둔 것뿐이다.
→ 표시 문구는 **"주소 넣음 ✓"**. 나중에 autopost 가 붙으면 그때 "연결됨"을 따로 만든다.

⚠ 이 구분을 흐리면, 나중에 회장님이 "SNS 연결 다 됐는데 왜 글이 안 올라가지?" 라고 묻게 된다.

---

## 1. 시작 전 — F 가 먼저다

**F(모바일 UX)의 커밋 ①②가 main 에 있어야 한다.** 이유:

- 지금 위젯은 `components/sections/connect-widget.tsx:52~54` 에서 **화면 아래 가로 바**다
  (`fixed inset-x-0 bottom-0 flex gap-2`, 모바일에서 `flex-1` 로 버튼을 나눠 갖는다).
- 여기에 버튼을 8개 넣으면 **한 버튼 폭이 40px 남짓**이 되어 글자가 안 들어간다.
- F 가 이걸 **동그란 아이콘 하나 → 누르면 위로 펼침** 구조로 바꾼다. 그 위에 얹어야 8개가 들어간다.

→ F 전에 C 를 하면 `connect-widget.tsx` 를 두 번 새로 쓴다. 회장님이 순서를 바꾸신 이유가 이것이다.

---

## 2. 지금 위젯이 어떻게 생겼나 (사실 — B 스프린트 결과)

```ts
// lib/schema.ts:138~141
export const Widget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call"),  label: z.string().max(8).default("전화") }),
  z.object({ kind: z.literal("kakao"), label: z.string().max(8).default("카카오톡") }),
]);
// lib/schema.ts:160
widgets: z.array(Widget).max(2).optional(),
```

**설계 원칙(B):** "**위젯은 값을 갖지 않는다**" — 전화번호는 `quoteForm` 섹션에서 파생한다
(`components/sections/index.tsx:45` `contactOf`), 카톡 주소도 `quoteForm.kakaoUrl` 에 쓴다.
이유는 **전화번호 사본이 이미 3벌**(`settings.phone` · `quoteForm.phone` · `map.phone`)이라 더 늘리지 않으려던 것이다.

관련 파일:

| 파일 | 역할 |
|---|---|
| `lib/schema.ts:138` | `Widget` 스키마 |
| `components/sections/connect-widget.tsx` | 렌더러 (**`"use client"` 아님** — F 에서 붙는다) |
| `components/sections/index.tsx:45` | `contactOf(doc)` |
| `app/[slug]/edit/widgets-panel.tsx` | 에디터 폼 (163줄) |
| `config/tours.ts:65` | `panel-widgets` 앵커 (ACTIVE_ANCHORS) |
| `docs/SCHEMA.md` | 문서 |

---

## 3. ★ 이번엔 위젯이 값을 갖는다 — 원칙을 바꾸는 이유

SNS 주소는 **저장소 어디에도 살 곳이 없다.** `settings` 에도, 어떤 섹션에도 없다.
`settings` 에 넣으면 렌더러가 못 읽는다 — 렌더러는 `doc` 만 받고, `settings.logo` 는
`lib/sites.ts` 가 따로 뽑아 `page.tsx` 로 넘겨주는 **예외 배선**이다(그래서 미리보기 셸엔 로고가 없었다).

→ **SNS 주소는 위젯이 직접 갖는다.** 사본이 생기지 않는다(원본이 여기뿐이다).
   전화·카톡은 **지금 방식 그대로** 파생한다. 두 방식이 섞이는 것을 스키마가 드러내게 쓴다.

```ts
/** 플로팅 연결 위젯 (2026-09-06 확장).
 *  · call·kakao 는 값을 갖지 않는다 — quoteForm 에서 파생한다(contactOf). 전화번호 사본을 늘리지 않기 위해서다.
 *  · SNS 6종은 저장소에 살 곳이 없어 위젯이 url 을 직접 갖는다. 여기가 유일한 원본이다.
 *  ⚠ Section union 에 넣지 않는다 — sections 의 순서·max(20)·RenderSection switch 와 얽힌다.
 */
const label8 = z.string().max(8);
const snsUrl  = z.string().url().max(300);

export const Widget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call"),      label: label8.default("전화") }),
  z.object({ kind: z.literal("kakao"),     label: label8.default("카카오톡") }),
  z.object({ kind: z.literal("youtube"),   label: label8.default("유튜브"),   url: snsUrl }),
  z.object({ kind: z.literal("instagram"), label: label8.default("인스타"),   url: snsUrl }),
  z.object({ kind: z.literal("threads"),   label: label8.default("쓰레드"),   url: snsUrl }),
  z.object({ kind: z.literal("x"),         label: label8.default("X"),        url: snsUrl }),
  z.object({ kind: z.literal("naver"),     label: label8.default("블로그"),   url: snsUrl }),
  // "온스토리 사이트" = 이 사이트 자신의 이야기 섹션. 주소가 없다 — 같은 페이지 앵커로 간다.
  z.object({ kind: z.literal("story"),     label: label8.default("이야기") }),
]);

export const SiteDoc = z.object({
  …
  // ⚠ optional 유지 — 필수로 만들면 lib/sites.ts:47 의 SiteDoc.parse(safeParse 아님)에서 기존 발행본이 전부 죽는다
  // ⚠ .default([]) 도 금지 — update 라우트가 parsed.data 를 저장해 손 안 댄 사이트에 "widgets":[] 가 덧씌워진다
  widgets: z.array(Widget).max(8).optional(),
});
```

⚠ **`url` 을 `.optional()` 로 만들지 않는다.** SNS 위젯은 주소가 있어야 존재할 이유가 있다.
   주소를 지우면 **그 위젯 항목 자체를 배열에서 뺀다**(에디터가 그렇게 한다). 죽은 링크를 만들지 않는다.
⚠ `max(2)` → `max(8)`. 종류가 8개니 딱 맞는다.

---

## 4. **확정 (2026-09-06)** — 이름은 "온스토리 사이트", 뜻은 고객사 자기 사이트의 이야기 섹션

> **회장님 확정: "'온스토리 블로그'라는 표현을 전부 '온스토리 사이트'로 변경.
> 뜻은 '고객사 자기 사이트 안의 스토리/이야기 섹션'입니다 — 온스토리 회사 자체 블로그가 아닙니다.
> 이 이름이 쓰이는 모든 문서·화면 문구에 반영해주세요."**

따라서:

- 위젯 종류 `story` 는 **주소를 갖지 않는다.** 같은 페이지의 `storyFeed` 섹션으로 스크롤한다.
- 화면·문서에서 부르는 이름은 **"온스토리 사이트"**.
- 버튼 기본 이름(`label`)은 손님이 누를 말이라 **"이야기"** 로 둔다
  (손님 사이트 위에서 "온스토리 사이트"라고 쓰면 손님이 다른 데로 가는 줄 안다).
- `storyFeed` 섹션이 없는 사이트에서는 **토글이 비활성**이다.

⚠ **본사 화면 5곳의 같은 표현은 A 스프린트에서 함께 바꾼다**
   (`chrome.tsx:25` · `app/page.tsx:97` · `how-it-works:16` · `faq.ts:12`·`:36` · `blog/page.tsx:32`).
   A 스펙 §3 12번에 표로 적어 뒀다.

## 5. 아이콘 — ★ 여기가 제일 잘 터진다

본사 채널 아이콘 6개가 이미 있다: `components/site/blocks.tsx:38~53` `ChannelMark`.

**그걸 import 하면 안 된다.**

```
components/site/blocks.tsx  →  import { CHANNELS } from "./chrome"
components/site/chrome.tsx  →  import { getSessionUser } from "@/lib/supabase/server"
                            →  next/headers  →  서버 전용
```

`connect-widget.tsx` 는 **미리보기 셸(클라이언트)이 끌어가는 모듈**이다
(파일 주석 7~9줄이 이 이유를 이미 적어 뒀다). 여기서 `blocks.tsx` 를 import 하면
**Turbopack 빌드가 `next/headers` 로 깨진다.** 09-05 에 `Logo` 를 `chrome.tsx` 에서
`components/site/logo.tsx` 로 떼어낸 사고와 **같은 원인**이다.

→ **SVG 를 `connect-widget.tsx` 안에 직접 쓴다.** `blocks.tsx:38~53` 의 path 데이터를 **복사해 온다**(참조 아님).
   그 파일 위에 주석을 남긴다:

```tsx
/* 채널 아이콘 — components/site/blocks.tsx 의 ChannelMark 와 같은 path 를 복사했다.
   import 하지 않는 이유: blocks.tsx → chrome.tsx → lib/supabase/server → next/headers 라
   클라이언트 번들(미리보기 셸)이 깨진다. 한쪽을 고치면 다른 쪽도 손으로 맞춘다. */
```

⚠ 아이콘 **색**: 본사 띠는 브랜드 원색(유튜브 빨강 등)을 쓴다. 손님 사이트 위젯에서는
   **`fill="currentColor"`** 로 팔레트를 따르게 한다 — `premium` 팔레트(`bg`·`onAccent` 둘 다 `#12151B`)에서
   원색 아이콘이 배경에 묻히거나 사이트 톤을 깬다.

---

## 6. 렌더러 — `connect-widget.tsx`

F 가 만든 "동그란 아이콘 → 펼침" 구조 안에서:

```ts
// 값이 없는 종류는 그리지 않는다(죽은 링크 금지). 같은 kind 가 두 번 들어와도 첫 항목만. (B 에서 이미 이렇게 한다)
const href =
  w.kind === "call"  ? (tel ? `tel:${tel}` : "")
: w.kind === "kakao" ? kakaoUrl
: w.kind === "story" ? storyAnchor(doc)      // '#sec-{i}' — storyFeed 섹션의 인덱스. 없으면 ""
:                      w.url;                // SNS 6종
```

`storyAnchor(doc)`:

```ts
/** 이야기 섹션의 앵커. F 커밋 ① 에서 공개 셸에도 id={`sec-${i}`} 가 붙었다(전엔 미리보기에만 있었다). */
function storyAnchor(doc: SiteDocT): string {   // "온스토리 사이트" 위젯
  const i = doc.sections.findIndex((s) => s.type === "storyFeed");
  return i >= 0 ? `#sec-${i}` : "";
}
```

⚠ **`storyAnchor` 는 F 커밋 ①에 의존한다.** 공개 셸에 `id` 가 없으면 링크가 아무 데도 안 간다.
⚠ 외부 링크 6종은 `target="_blank" rel="noreferrer"`. `story`(같은 페이지)와 `call` 은 붙이지 않는다.
⚠ 펼침 순서를 **스키마 배열 순서가 아니라 고정 순서**로 그린다:
   `call → kakao → story → youtube → instagram → threads → x → naver`.
   사장님이 껐다 켜도 버튼 위치가 흔들리지 않는다(B 의 `commit()` 이 이미 이 방식이다).

---

## 7. 에디터 폼 — `widgets-panel.tsx`

지금 163줄에 전화·카톡 카드 2개가 손으로 쓰여 있다(`107~127`, `130~159`). 8개를 그렇게 쓰면 500줄이 된다.

→ **목록 데이터로 만든다:**

```tsx
const KINDS = [
  { kind: "call",      name: "전화",        needs: "tel" },
  { kind: "kakao",     name: "카카오톡",     needs: "kakao" },
  { kind: "story",     name: "온스토리 사이트", needs: "story" },   // 에디터엔 이 이름, 손님 버튼엔 "이야기"
  { kind: "youtube",   name: "유튜브",       needs: "url", ph: "예: youtube.com/@우리가게" },
  { kind: "instagram", name: "인스타그램",   needs: "url", ph: "예: instagram.com/우리가게" },
  { kind: "threads",   name: "쓰레드",       needs: "url", ph: "예: threads.net/@우리가게" },
  { kind: "x",         name: "X(트위터)",    needs: "url", ph: "예: x.com/우리가게" },
  { kind: "naver",     name: "네이버 블로그", needs: "url", ph: "예: blog.naver.com/우리가게" },
] as const;
```

각 줄의 모양(회장님이 Blaze 에서 보신 배치와 같은 흐름 — 아이콘·이름·상태·버튼):

```
[아이콘] 유튜브                       주소 넣음 ✓        [켜짐]
         [ youtube.com/@우리가게                    ]
         [ 버튼 이름: 유튜브 ]
```

- **상태 뱃지**: 주소가 있으면 `주소 넣음 ✓`(초록), 없으면 `주소 필요`(주황). **"연결됨"이라고 쓰지 않는다**(§0).
- 주소가 비면 **토글을 끄고 배열에서 항목을 뺀다.** 죽은 링크 금지.
- 주소 정규화는 **B 가 만든 `normalizeUrl`(`widgets-panel.tsx:30~35`)을 그대로 쓴다.**
  스킴이 없으면 `https://` 를 붙이고, 주소가 아니면 `null`.
- ⚠ 도메인 검사는 **경고만 한다.** `youtube.com` 이 아닌 주소를 넣으면
  "유튜브 주소가 맞나요?" 한 줄을 띄우되 **막지는 않는다**(단축 URL·커스텀 도메인이 있다).
- ⚠ `data-tour="panel-widgets"`(93줄)를 **그대로 유지한다**(규칙 3). 새 앵커를 만들지 않는다.
- 카드가 8개면 패널이 길다 → **접기**: 켜진 것만 펼치고 나머지는 이름 줄만 보인다.

---

## 8. 한 커밋에서 같이 바꾸는 곳 (규칙 2 준용)

`Widget` 은 `Section` union 이 아니라 규칙 2 의 문자 그대로는 아니지만, **B 가 세운 관행**을 따른다:

1. `lib/schema.ts` — `Widget` 8종 · `max(8)`
2. `components/sections/connect-widget.tsx` — 아이콘 8개 · `href` 분기 · 고정 순서
3. `app/[slug]/edit/widgets-panel.tsx` — 목록형 폼
4. `docs/SCHEMA.md` — 위젯 표 갱신

**하나라도 빠지면 커밋하지 않는다.**

---

## 9. 하지 않는 것

- **OAuth · 계정 로그인 · 자동 발행.** 기획2 `autopost` · `meta-review` 의 일이다.
- **"연결됨" 표시.** 실제로 연결된 게 아니다.
- 위젯에 **전화번호·카톡 주소 필드 추가** — 그 둘은 계속 `quoteForm` 에서 파생한다.
- `components/site/blocks.tsx` 의 `ChannelMark` 를 import — **빌드가 깨진다**(§5).
- `config/tours.ts` 앵커 추가·삭제.
- 마이그레이션 — **DB 변경이 없다.** `widgets` 는 `sites.draft/published` jsonb 안이다.
- 발행 카운트·클릭 추적 — `events` 표는 있지만 **쓰는 코드가 저장소에 0건**이다. 별건.

---

## 10. 완료 조건

1. `npm run build` 성공 · ESLint 경고 0. **특히 `next/headers` 오류가 없다**(§5).
2. 에디터 연결 버튼 패널에 **8종**이 보이고, 켜진 것만 펼쳐져 있다.
3. 유튜브에 `youtube.com/@가게` 를 넣으면 `주소 넣음 ✓` 가 뜨고, 손님 사이트 위젯에 유튜브 버튼이 생긴다.
4. 그 주소를 지우면 **버튼이 사라지고** `widgets` 배열에서 항목이 빠진다(개발자도구로 `draft` 확인).
5. 위젯 펼침 순서가 **항상** `전화 → 카톡 → 이야기 → 유튜브 → 인스타 → 쓰레드 → X → 네이버` 다.
6. `이야기` 버튼(= "온스토리 사이트")을 누르면 같은 페이지의 이야기 섹션으로 **스크롤**한다. `storyFeed` 가 없는 사이트에서는 **토글이 비활성**이다.
6-1. 스펙·화면·에디터 어디에도 **"온스토리 블로그"** 라는 말이 없다. `grep -rn "온스토리 블로그" app components docs` → **0건**.
7. 외부 채널 6개가 **새 탭**에서 열린다. 전화·이야기는 같은 탭이다.
8. **팔레트 4종 전부**에서 아이콘·글자가 읽힌다(`premium` 이 관건).
9. **기존 발행 사이트 3곳이 그대로 렌더된다** — `widgets` 없는 문서가 `lib/sites.ts:47` 의 `parse` 를 통과한다.
10. `widgets` 를 한 번도 안 건드린 사이트를 저장해도 `draft` 에 `"widgets"` 키가 **생기지 않는다**.
11. `/{slug}` 와 `/{slug}/preview` 의 위젯이 **같다.**
12. 화면 어디에도 **"연결됨"** 이라는 말이 없다.

---

## 11. 커밋

```
feat: 연결 위젯 8종 — SNS 5 + 이야기 (주소 입력 방식, 자동발행 아님)

- Widget 유니온 확장(youtube·instagram·threads·x·naver 는 url 을 갖고, story("온스토리 사이트")는 앵커로 파생)
- 아이콘 SVG 는 blocks.tsx 에서 복사 — import 하면 next/headers 로 클라이언트 번들이 깨진다
- 에디터 폼을 목록형으로. 주소가 비면 항목을 배열에서 뺀다(죽은 링크 금지)
- 화면에 '연결됨' 이라고 쓰지 않는다 — 실제 계정 연결(autopost)은 별건이다
- 스키마·렌더러·에디터 폼·SCHEMA.md 4곳 한 커밋

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
