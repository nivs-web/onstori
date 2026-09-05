# 플로팅 연결 위젯 + 전화번호 신뢰성 — 실행 스펙

> 스프린트 6번 작업. **P5(결제) 진입 조건 3개 중 마지막** — "전화·카톡 버튼이 스크롤 어디서나 눌린다"
> (`docs/PLAN.md` 26-33, `docs/specs/2026-09-03-sprint-plan.md` 13·27).
> 세션 1개 · **Opus + ultracode**(CLAUDE.md 49행 게이트, 스프린트 플랜 27행 지정) · 마이그레이션 없음.
>
> 작성: 2026-09-05 저녁, 기술참모. **배포 완료 시점(main `b578653`, 태그 `backup-2026-09-05`)의 실제 파일을 읽고 쓴 스펙이다.**
> 모든 줄번호는 그 상태 기준이다.
>
> **2026-09-05 밤 회장님 결정으로 범위가 늘었다** — 위젯만이 아니라 **전화번호가 신뢰할 수 있는 값이 되게 만드는 작업**이다.
> 온보딩 입력 → 서버 저장 → 화면 렌더 → 점수 판정, 네 지점이 지금 서로 다른 기준을 쓰고 있고
> 그것이 죽은 `tel:` 링크의 진짜 원인이다. 이번에 **한 규칙으로 통일한다.**

---

## 0. 조사 방법과 신뢰도 (먼저 읽을 것)

7개 축(스키마·렌더러·에디터·연락처·완성도·만료·배관)을 각각 조사한 뒤 **각 주장을 다른 에이전트가 파일로 되짚어 반증 시도**했다.
총 248개 주장 중 221개 CONFIRMED, 27개가 줄번호 오차·과장으로 정정됐다. 아래 본문은 정정본만 실었다.
회장님 추가 지시(온보딩 전화번호)에 관한 사실은 그 뒤 기술참모가 배포본 파일을 직접 다시 읽어 확인했다.

**스키마 하위호환은 추론이 아니라 실행 검증이다.** zod 4.5.4 를 실제로 설치해 현재 `lib/schema.ts` 로
`seeds/niv.json`·`cafecroft.json`·`cleanhaus.json` 의 `doc` 을 파싱했다.

| 선언 | 결과 |
|---|---|
| `widgets: z.array(Widget).max(2)` (필수) | ❌ FAIL — `Invalid input: expected array, received undefined @["widgets"]` |
| `.optional()` | ✅ PASS — `out.widgets === undefined` |
| `.default([])` | ✅ PASS — `out.widgets === []` |
| 미선언 키를 넣고 parse | ✅ PASS하되 **결과에서 조용히 사라짐**(zod v4 `z.object` 기본 strip) |

### ⚠ 이 스펙에서 정정한 조사 오류 3건 (기술참모 책임)

조사 에이전트가 컨테이너에 복사된 사본을 읽었는데, 제가 **이야기 엔진 배포 전에 복사한 낡은 파일 3개**가 섞여 있었습니다.
아래 3건은 에이전트가 "문제 있음"으로 보고했으나 **실제 저장소를 다시 확인해 전부 사실이 아님을 확인**했습니다. 스펙에는 정정본만 반영했습니다.

| 에이전트 보고 | 실제 저장소 | 확인 방법 |
|---|---|---|
| "마이그레이션 `20260905090000` 이 없다" | **있다.** `supabase/migrations/20260905090000_mainplan_membership.sql` (1,435 bytes) | 폴더 직접 목록 |
| "`sites.status` 를 `expired` 로 바꾸는 코드가 한 줄도 없다" | **있다.** `app/api/cron/expire/route.ts:46` `.update({ status: "expired" })`, `vercel.json` 매일 18:00 UTC | 파일·grep |
| "생성 시 `trial_ends_at` 이 30일로 박힌다" | **14일이다.** `app/api/generate/route.ts:61` `TRIAL_DAYS * 24 * 3600 * 1000` | 파일 |

---

## 1. 회장님 결정 (2026-09-05 밤 · 확정)

| # | 결정 | 스펙 반영 |
|---|---|---|
| 1 | 히어로 CTA 의 죽은 `tel:` 링크를 **같이 고친다** | 5장 — `ctaHref` 교체 (`map.phone` 폴백 제거 포함) |
| 2 | 카카오톡 주소 입력칸은 **위젯 패널 안**에 둔다 | 7장 — 값은 `quoteForm.kakaoUrl` 하나에 쓴다 |
| 3 | **온보딩 STEP 3 에서 전화번호를 필수·형식 검사**로 막는다 | 3장 |
| 4 | 입력칸 옆 문구: "고객 문의가 오면 사장님 연락처로 문자가 옵니다. 반드시 사장님의 정확한 전화번호를 입력해주세요." | 3장 |

결정 3·4 는 결정 1 과 **같은 원인의 앞단 처방**이다 — 온보딩에서 막으면 나쁜 번호가 애초에 안 들어오고,
5장의 렌더 방어는 이미 들어와 버린 값과 사장님이 나중에 지운 경우를 막는다. 둘 다 필요하다.

---

## 2. 결정 요약 (한 화면)

| # | 결정 | 근거 (파일:줄) |
|---|---|---|
| 1 | 전화번호 판정을 **`lib/phone.ts` 한 파일**로 모으고 네 지점이 전부 그것을 쓴다 | 지금 온보딩(숫자 9자리)·서버(글자 9자)·렌더러(정규화만)·점수(글자 9자)가 **서로 다른 기준**이다 — 3장 표 |
| 2 | `SiteDoc.widgets` 를 **최상위 optional 배열**로 추가. `.default([])` 아님 | `lib/sites.ts:47` 이 발행본을 `SiteDoc.parse`(safeParse 아님)로 읽어 필수면 기존 사이트 전멸 / `app/api/site/update/route.ts:28` 이 `parsed.data` 를 저장하므로 default 면 손 안 댄 사이트에도 `"widgets":[]` 가 덧씌워짐 |
| 3 | 위젯은 **전화번호·카톡 주소를 자기 필드로 갖지 않는다.** 값은 `quoteForm` 섹션에서 파생 | 이미 사본 3벌(`settings.phone`·`quoteForm.phone`·`map.phone`) — 4벌째를 만들면 최신 판정 근거가 코드에 없다 |
| 4 | 파생 출처는 **`quoteForm.phone` 하나**. `map.phone` 폴백은 쓰지 않는다 | `map.phone` 은 생성 시 값이 굳고 에디터에 수정 UI가 없다(`ui.tsx:677-683`). `phoneOf()`(`ui.tsx:490-493`)와도 일관 |
| 5 | 위젯을 `Section` 유니온에 넣지 않는다 | 넣으면 `sections` 의 순서·`max(20)`·`RenderSection` switch 에 얽힌다. 스프린트 플랜 27행이 `SiteDoc.widgets[]` 최상위로 못박음 |
| 6 | 렌더러는 **새 파일 1개**, 마운트는 **셸 2곳** | `RenderSection`(`components/sections/index.tsx:296-311`)은 `sections[]` 전용 switch. 배열 밖 오버레이는 자동 반영이 안 된다 |
| 7 | 에디터 패널은 **새 파일 1개**, `ContentTab` 안 '분위기' 카드 바로 뒤 | `ui.tsx` 949줄 — 스프린트 플랜 54행 "새 탭·패널은 별도 파일" |
| 8 | **마이그레이션 없음** | `sites.draft`/`published` 가 jsonb (`core.sql:30-34`) |
| 9 | 만료·정회원 **게이팅 코드 불필요** | RLS 가 공개를 끊고(`core.sql:113-114`), 에디터는 `ui.tsx:300` 차단 화면이 `ContentTab` 앞에서 return |
| 10 | 클릭 로깅(`events` 테이블) **이번 범위 밖** | 테이블은 있으나(`core.sql:92` `call_click` 포함) **저장소에 events 쓰기 코드가 0줄**이다 |

---

## 3. 전화번호 한 규칙 (회장님 결정 3·4 — 이번 작업의 앞단)

### 3-1. 지금 네 지점이 서로 다르다 (전부 실측)

| 지점 | 파일:줄 | 지금 기준 | 통과하는 나쁜 값 |
|---|---|---|---|
| 온보딩 [다음] 버튼 | `app/new/wizard.tsx:143` | `phone.replace(/\D/g,"").length >= 9` — **숫자 9자리** ✅ | (없음 — 여기만 제대로 돼 있다) |
| 생성 서버 | `app/api/generate/route.ts:14` | `z.string().min(9).max(20)` — **글자 수** ❌ | `"아홉글자입니다요"` 통과 |
| 화면 렌더 | `components/sections/index.tsx:43` | `replace(/[^0-9+]/g,"")` — **정규화만, 검사 없음** ❌ | `"전화번호를 입력해 주세요"` → `href="tel:"` 죽은 링크 |
| 완성도 점수 | `lib/score.ts:25` | `settings.phone.length >= 9` — **글자 수** ❌ | 안내 문구로도 10점 획득 |

**핵심**: 온보딩만 제대로 막고 있고, 그 뒤 세 지점은 전부 뚫려 있다.
브라우저를 안 쓰는 요청이나 나중에 `can3` 를 건드리는 변경 하나면 나쁜 값이 `quoteForm.phone` 에 그대로 들어간다
(`lib/generate.ts:145·151` 이 `input.phone` 을 quoteForm 에, `156` 이 map 에 그대로 꽂는다).

### 3-2. 신규 파일 `lib/phone.ts` (아주 작다)

```ts
/**
 * 전화번호 판정의 단일 출처 (2026-09-05).
 * 온보딩 입력·생성 서버·화면 렌더·완성도 점수 네 곳이 전부 이 파일을 쓴다.
 * 기준은 "숫자 9자리 이상" 하나뿐이다 — 지역번호 2자리 + 국번·번호 7자리가 국내 최소.
 * 형식(하이픈·국가번호)은 강제하지 않는다. 사장님이 적는 방식이 제각각이고, 링크는 정규화해서 만든다.
 */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 실제로 전화를 걸 수 있는 값인가 */
export function isValidPhone(raw: string | null | undefined): boolean {
  return phoneDigits(raw ?? "").length >= 9;
}

/** tel: 링크에 넣을 값. 유효하지 않으면 빈 문자열 — 죽은 링크를 만들지 않는다. */
export function telValue(raw: string | null | undefined): string {
  const v = raw ?? "";
  return isValidPhone(v) ? v.replace(/[^0-9+]/g, "") : "";
}
```

**왜 `components/sections/index.tsx` 안이 아니라 별도 파일인가**: 온보딩(`app/new/wizard.tsx`)은 클라이언트 컴포넌트다.
렌더러에서 import 하면 섹션 렌더러 전체가 온보딩 번들로 끌려온다. 규칙만 든 파일이면 그 비용이 없다.

### 3-3. 온보딩 STEP 3 — `app/new/wizard.tsx`

**(a) 라벨·문구** — 375-377행의 전화번호 `Field` 를 아래로 교체:

```tsx
<Field
  label="전화번호 (필수)"
  hint={phoneErr}
  hintColor={phoneErr ? "text-red-600" : undefined}
>
  <input
    className="inp" value={phone} maxLength={20} inputMode="tel"
    onChange={(e) => setPhone(e.target.value)}
    placeholder="010-0000-0000"
    aria-invalid={!!phoneErr} aria-describedby="phone-why"
  />
  <p id="phone-why" className="mt-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed"
     style={{ background: "var(--accent-soft)", color: "var(--forest)" }}>
    고객 문의가 오면 사장님 연락처로 문자가 옵니다. 반드시 사장님의 정확한 전화번호를 입력해주세요.
  </p>
</Field>
```

- 문구는 **회색 힌트가 아니라 연초록 박스**다. `--accent-soft`(#E8F1EC)·`--forest`(#273D3D)는 `app/globals.css:41·22` 에 이미 있다.
- `Field` 컴포넌트(434-442)는 `children` 이 ReactNode 라 `<input>` 과 `<p>` 를 함께 넣어도 수정이 필요 없다.
- 다른 선택 항목은 `label="주소 (선택)"` 형식이므로 **`(필수)` 표기가 기존 관례와 짝이 맞는다.**

**(b) 오류 메시지** — `can3`(143행) 근처에 추가:

```ts
// 값이 있는데 형식이 틀렸을 때만 빨간 글씨. 비어 있으면(아직 안 침) 조용히 둔다.
const phoneErr = phone.trim() && !isValidPhone(phone)
  ? "숫자 9자리 이상, 실제로 전화를 받으실 수 있는 번호를 넣어주세요"
  : "";
const can3 = oneLiner.trim().length >= 2 && isValidPhone(phone) && !!slug && !!slugMsg?.ok;
```

`can3` 의 판정 자체는 지금과 같은 기준이다(`isValidPhone` 이 같은 식이다) — **바뀌는 것은 근거가 한 곳으로 모이고, 왜 막혔는지 화면에 뜬다는 점이다.**

**(c) 서버도 같이 막는다** — `app/api/generate/route.ts:14`:

```ts
phone: z.string().min(9).max(20).refine((v) => isValidPhone(v), "전화번호를 정확히 입력해 주세요"),
```

`.max(20)` 은 `QuoteForm.phone` 의 `max(20)` 과 맞물리므로 남긴다.
**클라이언트 게이트만으로는 부족하다** — 지금 서버가 글자 수만 세고 있고, 그 값이 곧장 `quoteForm.phone` 이 된다.

**(d) 점수 규칙도 같은 기준으로** — `lib/score.ts:25`:

```ts
contact: (c) => isValidPhone(typeof c.settings.phone === "string" ? c.settings.phone : ""),
```

지금은 안내 문구로도 `contact` 10점이 붙는다. 같은 규칙을 쓰면 점수가 정직해진다.

**(e) 에디터 입력칸도 같은 안내** *(권고 — 빼도 위젯은 안전하다)*
`app/[slug]/edit/ui.tsx:672` 의 `전화번호 (문의 버튼 연결)` 입력칸에 같은 오류 문구를 붙인다.
온보딩에서 막아도 사장님이 나중에 이 칸을 지우거나 문구로 바꿀 수 있고, 그때 위젯이 조용히 사라지면 이유를 모른다.

### 3-4. 이 변경이 기존 사장님에게 미치는 영향

- **새로 만드는 사이트**: 나쁜 번호가 원천 차단된다.
- **이미 만들어진 사이트**: 아무것도 안 바뀐다. 저장된 값을 고치지 않는다.
  다만 번호가 안내 문구인 사이트는 **위젯·히어로 CTA 가 안 나오고**(죽은 링크 대신), 완성도 `contact` 10점이 빠진다.
  → 그 사장님에게는 에디터 점수 힌트 `＋10점 · 전화·주소 확인` 이 뜨므로 스스로 고칠 동선이 생긴다. **의도된 동작이다.**

## 4. 지금 코드가 어떤 상태인가 (전부 실측)

### 4-1. 이미 준비돼 있는 것 — 새로 만들 필요 없음

| 항목 | 위치 | 상태 |
|---|---|---|
| 완성도 규칙 `widget_1` | `config/completeness.ts:26` | **정의 완료** — `연결 버튼 1개 켜기` / 10점 / anchor `panel-widgets` |
| 투어 앵커 이름 | `config/tours.ts:85` | **예약 완료** — `FUTURE_ANCHORS` 에 `{ anchor: "panel-widgets", phase: "P8" }` |
| 점수 판정 자리 | `lib/score.ts:30` | **스텁 존재** — `widget_1: () => false, // P8 연결 위젯에서 활성` |
| 예약 슬러그 | `20260831180000_reserved_200.sql:21` | `'widget'`,`'widgets'` 등록됨 |
| 카톡 링크 렌더 관례 | `components/sections/quote-form.tsx:252-262` | 값 있을 때만 노출 · `target="_blank" rel="noreferrer"` |
| 견적 앵커 | `components/sections/index.tsx:259` | `<section id="quote">` — 공개·미리보기 셸 양쪽에 존재 |

**규칙 3 준수의 핵심**: 앵커 이름을 새로 짓지 마라. `panel-widgets` 는 이미 정해져 있다.

### 4-2. 반드시 알아야 할 함정 4개 (①은 3장에서 처방)

**① 전화번호가 전화번호가 아닐 수 있다 → 3장에서 통째로 다룬다**
`lib/section-defaults.ts:37` 이 quoteForm 기본값을 `phone: "전화번호를 입력해 주세요"` 로 만들고,
스키마는 `z.string().min(1)`(`schema.ts:106`)이라 그대로 통과한다. **3장의 한 규칙이 이 함정의 처방이다.**

**② 카카오톡 주소를 입력받는 화면이 지금 한 곳도 없다**
`QuoteForm.kakaoUrl` 은 스키마(`schema.ts:107`)와 렌더러(`quote-form.tsx:252`)에만 있고,
생성기·에디터·시드 어디에도 값을 넣는 곳이 없다. **카톡 위젯을 만들려면 입력칸을 여는 것이 선행 작업이다.**

**③ 셸이 2개이고, 이미 한 번 갈라졌다**
`app/[slug]/page.tsx:57-62` 에 로고 오버레이가 있는데 `app/[slug]/preview/preview-client.tsx` 에는 없다(2026-09-05 추가분 누락).
**배열 밖 요소는 자동으로 따라가지 않는다** — 위젯도 두 곳에 각각 붙여야 한다.
반대로, 위젯 데이터가 `doc` 안(`SiteDoc.widgets`)에 있으면 `settings.logo` 와 달리 미리보기에도 값이 자동으로 전달된다(postMessage 가 doc 통째를 보낸다).

**④ `premium` 팔레트는 배경이 어둡다**
`PALETTES.premium` = `bg #12151B` / `onAccent #12151B`(`index.tsx:14`).
위젯 배경을 `#fff` 로 하드코딩하면 premium 사이트에서만 튄다.
4개 팔레트 전부에서 성립하는 조합은 `background: var(--s-accent)` + `color: var(--s-on-accent)` 뿐이다.

### 4-3. 위젯을 켜면 완성도 점수가 어떻게 되나

현재 **도달 가능한 최대 점수는 85점이 아니라 75점**이다.
`logo`(5점, `score.ts:28`)와 `widget_1`(10점, `score.ts:30`)이 `() => false` 인 데다,
**`hours`(10점)도 획득 불가능**하다 — `score.ts:24` 가 `settings.hours` 를 읽는데 저장소 어디에서도 그 키를 쓰지 않는다
(생성 `generate/route.ts:78` 은 `phone·address·oneLiner·industryLabel`, 에디터 저장 `ui.tsx:166` 은 `phone·address·notify` 만 보낸다.
에디터의 `set-hours` 폼(`ui.tsx:685`)은 `hoursCard` **섹션**을 고칠 뿐 settings 와 무관하다).

→ 이번 작업으로 **75 → 85점**이 된다. `hours` 버그는 **이번 범위 밖**이며, 별도 항목으로 기획2 보드에 올린다.

---

## 5. 스키마 (규칙 2 의 1/4 — zod)

`lib/schema.ts` — `QuoteForm`(102-109) 아래, `Section` 유니온(132-136) 위에 신설:

```ts
/* ── 플로팅 연결 위젯 ── */

/**
 * 화면 하단에 고정돼 스크롤 어디서나 눌리는 연결 버튼 (P5 진입 조건 3).
 * 값(전화번호·카톡 주소)을 담지 않는다 — quoteForm 섹션에서 파생한다(components/sections/index.tsx contactOf).
 * 사본을 하나 더 만들면 어느 것이 최신인지 판정할 근거가 없어진다.
 * 판별자를 Section 과 다른 `kind` 로 둔 이유: 두 유니온이 문자열만으로 헷갈리지 않게 한다.
 */
export const Widget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call"),  label: z.string().max(8).default("전화") }),
  z.object({ kind: z.literal("kakao"), label: z.string().max(8).default("카카오톡") }),
]);
```

`SiteDoc`(138-144) 의 `sections` 다음 줄:

```ts
  sections: z.array(Section).min(1).max(20),
  // 플로팅 연결 위젯. optional — 이 필드가 생기기 전 발행본 호환
  widgets: z.array(Widget).max(2).optional(),
});

export type WidgetT = z.infer<typeof Widget>;
```

**주석 형식은 임의 작문이 아니다** — `About.image`(35-36)·`ProcessSteps.steps[].image`(97-98)가 쓰는
"optional — 이 필드가 생기기 전 발행본 호환" 관용구를 그대로 따른 것이다.

- `.max(2)`: 이 파일의 모든 배열이 예외 없이 `.max()` 를 갖는다(`Gallery.photos` 30 · `Reviews.items` 20 · `ProcessSteps.steps` 6 · `sections` 20).
- 같은 kind 중복은 zod 로 막지 않는다(이 파일에 `refine` 전례가 없다). **렌더러가 kind 별로 첫 항목만 그린다.**
- `schemaVersion` 은 `1` 그대로. optional 이라 migrate 가 필요 없고, 저장소에 migrate 함수 자체가 없다.

**되돌릴 수 있는 선택 2개** — 클코팀장이 다르게 판단하면 바꿔도 스펙의 나머지는 그대로다:
`kind` → `type`(코드베이스 관용구와 통일, 렌더러 switch 한 줄만 다름) / `.optional()` → `.default([])`(소비처의 `?.` 가 사라지는 대신 모든 문서에 `"widgets":[]` 가 기록됨).

---

## 6. 연락처 파생 함수 (규칙 2 의 2/4 — 렌더러)

`components/sections/index.tsx` 의 `ctaHref`(38-44)를 아래로 교체한다.

```ts
import { telValue } from "@/lib/phone";

/**
 * 손님에게 보여줄 연락처의 단일 출처 — quoteForm 섹션.
 * map.phone 은 생성 시 값이 굳고 에디터에 수정 UI가 없어(ui.tsx:677-683) 쓰지 않는다.
 * 유효성 판정은 lib/phone.ts 한 곳에만 있다 — 온보딩·서버·점수와 같은 기준(숫자 9자리).
 */
export function contactOf(doc: SiteDocT): { tel: string; kakaoUrl: string } {
  const q = doc.sections.find((s) => s.type === "quoteForm");
  return {
    tel: telValue(q && "phone" in q ? q.phone : ""),          // 안내 문구면 "" 가 돌아온다
    kakaoUrl: (q && "kakaoUrl" in q && q.kakaoUrl) || "",
  };
}

function ctaHref(action: string, ctx: Ctx): string {
  if (action === "quote") return "#quote";
  const { tel } = contactOf(ctx.doc);
  return tel ? `tel:${tel}` : "#quote";
}
```

**이 교체는 기존 동작을 2가지 바꾼다 — 의도된 것이며 별도 확인 항목이다:**
1. `map.phone` 폴백이 사라진다. `quoteForm` 은 생성 시 항상 붙고(`lib/generate.ts` quote·visit 양 분기) 지우면 문의 자체가 불가능하므로 실사용 영향은 없다고 본다.
2. 안내 문구가 남아 있는 사이트의 히어로 CTA 가 `href="tel:"`(죽은 링크) → `#quote`(문의 폼으로 스크롤)로 **고쳐진다.**

> 이 두 줄이 부담스러우면 `contactOf` 만 새로 만들고 `ctaHref` 는 그대로 두어도 위젯은 정상 동작한다.
> 다만 그 경우 죽은 `tel:` 버그는 남는다.

---

## 7. 렌더러 — 새 파일 + 셸 2곳

### 7-1. 새 파일 `components/sections/connect-widget.tsx`

```
"use client" 를 붙이지 않는다 — 순수 <a> 태그뿐이라 자바스크립트가 필요 없다.
(components/sections/index.tsx 도 "use client" 가 없고, 상호작용이 있는 quote-form.tsx 만 클라이언트다.
 단 preview-client.tsx 가 이 모듈을 끌어가므로 fs·path·supabase·process.env 를 절대 import 하지 말 것.)
```

요구 사항:

| 항목 | 규격 | 근거 |
|---|---|---|
| props | `{ doc: SiteDocT }` — `contactOf(doc)` 로 값 해결 | Ctx 확장 불필요 |
| 렌더 안 함 | `doc.widgets` 가 비었거나, 해당 kind 의 값이 빈 문자열일 때 | 죽은 링크 금지 |
| 중복 처리 | 같은 kind 는 첫 항목만 | 스키마에 refine 없음 |
| 전화 버튼 | `href={`tel:${tel}`}` · `background: var(--s-accent)` · `color: var(--s-on-accent)` | 4팔레트 안전 조합 |
| 카톡 버튼 | `href={kakaoUrl}` `target="_blank" rel="noreferrer"` · `background: var(--s-bg)` · `border: 1px solid var(--s-accent)` · `color: var(--s-accent)` | `quote-form.tsx:252-262` 관례. **흰색 하드코딩 금지**(premium bg #12151B) |
| 위치 (모바일 <640) | `fixed inset-x-0 bottom-0` 가로 바, 버튼 2개 균등 분할, 하단 safe-area 여백 | 엄지 도달 |
| 위치 (sm 이상) | `fixed bottom-5 right-5` 세로 스택 알약 | |
| z-index | `z-20` | 로고 오버레이가 `z-10`(`page.tsx:58`)이고 고객 셸의 유일한 명시값 |
| pointer-events | 살려둘 것 | 로고 오버레이의 `pointer-events-none` 을 복사하지 말 것 |
| 가림 방지 | 컴포넌트가 `<div aria-hidden className="h-20 sm:hidden" />` 스페이서를 먼저 렌더 | 모바일 고정 바가 footer·`#quote` 하단을 가린다 |
| 접근성 | 각 `<a>` 에 `aria-label`(예: `전화 걸기`), 최소 44px 터치 영역 | |

### 7-2. 마운트 — **두 곳 모두** (한 곳만 넣으면 갈라진다)

| 파일 | 위치 | 주의 |
|---|---|---|
| `app/[slug]/page.tsx` | 섹션 map(63-65)과 `<footer>`(66-69) 사이 | 반드시 `<div style={vars}>`(47) 안쪽 — `--s-*` 변수가 body/html 에는 없다 |
| `app/[slug]/preview/preview-client.tsx` | 섹션 map(63-67)과 `<footer>`(68-71) 사이 | `doc === null` 분기(39-45)에는 넣지 않는다 — 미발행 미리보기엔 위젯이 안 보이는 것이 정상 |

미리보기 iframe 안에서 `position: fixed` 는 **iframe 자체 뷰포트 기준**이라 폰 프레임 안쪽 우하단에 붙는다.
조상에 `transform`/`filter`/`perspective` 가 없음을 확인했다. 다만 iframe 상자가 `rounded-[2rem] overflow-hidden`(`ui.tsx:446`)이라
**둥근 모서리에 버튼이 겹쳐 잘려 보이는지는 실제 렌더로 확인해야 한다** — 완료 조건 5번.

---

## 8. 에디터 폼 (규칙 2 의 3/4) — 새 파일 + ui.tsx 두 줄

### 8-1. 새 파일 `app/[slug]/edit/widgets-panel.tsx`

`export function WidgetsPanel({ doc, setDoc }: { doc: SiteDocT; setDoc: (d: SiteDocT) => void })`

- 최상위 래퍼에 **`data-tour="panel-widgets"`**. **위젯이 0개여도 패널은 항상 렌더**한다(규칙 3: 조건부 렌더링으로 앵커가 사라지면 안 됨).
- 행 2개 — 전화 / 카카오톡. 각각 켜기·끄기 + 버튼 이름(최대 8자) 입력.
- **전화 행**: `contactOf(doc).tel` 이 비면 토글을 끄고 비활성화 + 안내
  "문의 받기 섹션에 전화번호를 넣어주세요" (누르면 `sec-form` 으로 이동).
- **카톡 행**: 카카오톡 채널·오픈채팅 주소 입력칸을 **여기에 둔다.** 값은 위젯이 아니라
  `quoteForm.kakaoUrl` 에 쓴다(`setDoc` 으로 해당 섹션을 갱신). 입력하면 문의 섹션의 카톡 버튼도 함께 켜지는 것이 정상이다.
  quoteForm 섹션이 없으면 두 행 모두 비활성화 + 안내.
- 저장 배선은 별도로 만들 것이 없다 — `setDoc` 은 `ui.tsx:433` 에서 `setDirty(true)` 로 감싸져 있고,
  그 뒤 2초 디바운스(`192-197`)·탭 전환(`211`)·`visibilitychange`(`200-207`) 세 경로가 모두 `doSave` 로 draft 통째를 보낸다.

### 8-2. `ui.tsx` 삽입 — 2줄

1. import 블록 끝(13행 `StoryLinkButton` 아래)에 `import { WidgetsPanel } from "./widgets-panel";`
2. `ContentTab` 안, **'분위기' 카드가 닫히는 606행과 `doc.sections.map` 이 시작하는 608행 사이**에
   `<WidgetsPanel doc={doc} setDoc={setDoc} />`

**왜 여기인가** (세 가지 다 실측):
- 위젯은 `doc` 최상위 값이라 608-852행의 `sections.map`/`switch(s.type)` 안에는 구조적으로 들어갈 수 없다.
- 같은 성격의 doc 최상위 편집(분위기 = `doc.theme.palette`, 596-606)이 이미 `ContentTab` 첫 카드로 있다.
- '＋10점 연결 버튼' 힌트를 누르면 `goToAnchor`(83-101)가 스크롤하는데, 855-876행 '섹션 추가' 아래에 두면 사장님이 화면 맨 끝까지 끌려간다.

**추가 1줄(권고)** — 같은 파일 672행 `전화번호 (문의 버튼 연결)` 입력칸에 3장 (e) 의 오류 문구를 붙인다.

**앵커 중첩은 문제없다** — `panel-widgets` 가 `panel-sections`(594) 안에 들어가지만,
`panel-photos ⊂ sec-hero ⊂ panel-sections`(617·612·594), `set-contact ⊂ sec-form`(671·668) 이라는 동일 패턴이 이미 있다.

**4번째 탭을 만들지 않는 이유**: 탭은 `"content" | "story" | "inbox"` 세 값의 유니온(`ui.tsx:58`)이고
`switchTab`·배지·`?tab=` 파라미터가 얽혀 있다. 토글 2개를 위해 그 배선을 늘릴 값이 없다.

---

## 9. 문서 (규칙 2 의 4/4)

`docs/SCHEMA.md`:
1. **SiteDoc 최상위 표**(16-22)에 6번째 행 추가 —
   `| widgets | Widget[] | ⬜ | 0~2개. 없으면 위젯 없음 |`
2. `### Cta` 표(33-37) 뒤에 **`### Widget`** 소제목 + 같은 4열 표(`| 필드 | 타입 | 필수 | 제약·기본값 |`).
   `### Theme`·`### Cta` 가 이미 쓰는 형식이다.
3. 표 안에 **"전화번호·카톡 주소는 위젯이 갖지 않는다 — quoteForm 섹션에서 파생"** 을 한 줄 명시.

**`lib/image-usage.ts` 는 손대지 않는다.** SCHEMA.md 6행의 경고("이미지를 담는 필드를 추가하면 함께 고칠 것")는
위젯에 이미지 필드가 없으므로 해당 없음. 아이콘을 이미지 URL 로 받는 설계로 바꾸면 그때는
`UsageRole`(11)·`refsInSection`(23-44)·`loadImageUsage`(56)를 함께 고쳐야 한다 — **그래서 아이콘은 URL 이 아니라 인라인 SVG 로 그린다.**

---

## 10. 규칙 2 밖의 배선 4곳 (빠뜨리기 쉬움)

| 파일 | 지금 | 바꿀 것 |
|---|---|---|
| `lib/score.ts:30` | `widget_1: () => false,` | `widget_1: (c) => (c.doc?.widgets?.length ?? 0) > 0,` |
| `lib/score.ts:25` | `contact: ... (c.settings.phone as string).length >= 9` (글자 수) | `contact: (c) => isValidPhone(...)` — 3장 (d) |
| `app/[slug]/edit/ui.tsx:408` | `!["logo", "widget_1"].includes(r.id)` | `!["logo"].includes(r.id)` |
| `config/tours.ts` | 85행 `{ anchor: "panel-widgets", phase: "P8" },` | **삭제**하고, `ACTIVE_ANCHORS` 하드코딩 목록(65행) 끝에 `"panel-widgets"` **추가** |

- `score.ts` 의 `c.doc` 은 `(site.draft as SiteDocT)`(42행) — **zod 검증 없는 캐스팅**이라 `?.` 가 반드시 필요하다.
  판정 대상이 draft 이므로 **저장 즉시 10점이 오른다**(발행 전).
- `ui.tsx:408` 을 안 고치면 점수만 오르고 '＋10점 · 연결 버튼 1개 켜기' 유도 문구가 영원히 안 뜬다.
- `tours.ts` 는 **삭제 후 추가**여야 한다. 지우지 않고 추가만 하면 `ALL_ANCHORS`(89행, 중복 제거 없는 단순 연결)에 `panel-widgets` 가 두 번 들어간다.
  참고: `ACTIVE_ANCHORS`·`FUTURE_ANCHORS`·`ALL_ANCHORS` 를 import 하는 코드가 저장소에 **한 곳도 없고 테스트도 없다**(package.json 에 test 스크립트 없음) — 앵커 존재 검사는 전적으로 수동이다.
- `widget_1` 의 배점 10점은 **바꾸지 말 것** (`completeness.ts:29` 주석 `// = 100 유지할 것`, 현재 합계 정확히 100).
- `TOURS` 에 위젯 스텝을 추가할지는 선택 — 추가하면 `editorIntro` 가 7 → 8스텝이 된다. **이번엔 추가하지 않는다**(투어 UI 자체가 P9 미착수).

---

## 11. 만료·정회원 게이팅 — 코드 불필요 (검증 결과)

**"만료 사이트는 공개 렌더가 안 되므로 위젯에 별도 게이팅이 필요 없다" → 참이다.** 경로 전체를 확인했다:

```
매일 18:00 UTC(=03:00 KST) vercel.json cron
  → app/api/cron/expire/route.ts:46  .update({status:"expired"}).eq("status","trial").lt("trial_ends_at", now)
  → core.sql:113-114  create policy "sites_public_read" ... using (status in ('trial','active'))
  → lib/sites.ts getFromDb 가 anon 클라이언트라 행 자체를 못 읽음 → null
  → getSiteBySlug 의 시드 폴백(89) → 실고객은 seeds 파일이 없음 → notFound()
```

에디터 쪽도 자동이다 — `ui.tsx:300` `if (data.trial?.expired && !data.isAdmin)` 차단 화면이
`ContentTab`(따라서 위젯 패널)보다 먼저 return 한다.

**단, 스펙에 남겨둘 사실 3가지:**
1. 공개 차단을 집행하는 것은 **DB RLS 한 줄뿐**이고 앱 코드에는 status 필터가 없다(`lib/sites.ts:40-45`). RLS 를 지우면 만료 사이트가 그대로 공개된다.
2. `lib/sites.ts:68` 이 `status === "active" ? "active" : "trial"` 로 `expired` 를 `trial` 로 뭉갠다. 지금은 무해하지만(RLS 가 먼저 막음) 나중에 앱 계층 분기가 필요해지면 여기부터 고쳐야 한다.
3. 쇼케이스 시드(`niv`·`cafecroft`·`cleanhaus`)는 만료와 무관하게 항상 렌더된다. 시드에 위젯을 넣으려면 JSON 3개를 각각 고쳐야 한다 — **이번엔 넣지 않는다.**
4. 위젯이 나중에 자체 서버 엔드포인트를 갖게 되면 `sbAdmin`(서비스키)은 RLS 를 우회하므로
   `app/api/inquiry/route.ts:88` 처럼 라우트 안에서 `.in("status", ["trial","active"])` 를 직접 걸어야 한다.

---

## 12. 마이그레이션 — 없음

`sites.draft`·`published`·`settings`·`theme`, `site_versions.snapshot`, `site_progress.rules_done` 이 전부 jsonb(`core.sql:30-34, 46, 69`)다.
문서 JSON 에 키를 더하는 일이라 DDL 이 필요한 지점이 코드 어디에도 없다.
스프린트 플랜 27행도 "스키마 변경 **있음** / 마이그레이션 **없음**" 으로 같은 결론이다.
`SCHEMA.md` 마지막 줄에 "컬럼이 이미 있어 마이그레이션이 필요 없었다"는 같은 선례가 기록돼 있다.

> 다만 **`20260905090000_mainplan_membership.sql` 이 아직 `db push` 전**이다(CLAUDE.md 7행).
> 위젯 작업과는 무관하지만, 위젯 커밋 전에 이 push 를 끝내 두면 이력이 깔끔하다.

---

---

## 13. 작업 순서 (한 세션 · Opus + ultracode)

**순서가 강제된다** — `app/api/site/update/route.ts:28` 이 클라이언트 원본이 아니라 `parsed.data` 를 저장하고
`schema.ts` 에 `passthrough`/`catchall` 이 없으므로, **zod 를 먼저 안 고치면 에디터에서 켠 위젯이 조용히 사라진다.**

**A. 전화번호 한 규칙 (앞단 — 위젯과 독립적으로 먼저 끝난다)**
1. `lib/phone.ts` 신설 (3-2)
2. `app/new/wizard.tsx` — `phoneErr` 추가 · `can3` 를 `isValidPhone` 로 · 전화번호 `Field` 교체(라벨 `(필수)` + 연초록 안내 박스) (3-3 a·b)
3. `app/api/generate/route.ts:14` — `.refine(isValidPhone)` (3-3 c)
4. `lib/score.ts:25` — `contact` 규칙을 `isValidPhone` 로 (3-3 d)
5. *(권고)* `app/[slug]/edit/ui.tsx:672` — 전화 입력칸 오류 문구 (3-3 e)

**B. 위젯**

6. **zod** — `lib/schema.ts` Widget 신설 + `SiteDoc.widgets` optional 추가 (5장)
7. **파생 함수** — `components/sections/index.tsx` 에 `contactOf` export, `ctaHref` 재작성 (6장)
8. **렌더러** — `components/sections/connect-widget.tsx` 신설 (7-1)
9. **셸 2곳** — `app/[slug]/page.tsx`, `app/[slug]/preview/preview-client.tsx` (7-2)
10. **에디터** — `app/[slug]/edit/widgets-panel.tsx` 신설 + `ui.tsx` import 1줄·삽입 1줄 (8장)
11. **배선 3곳** — `lib/score.ts:30`, `ui.tsx:408`, `config/tours.ts`(85 삭제 / 65 추가) (10장)
12. **문서** — `docs/SCHEMA.md` 표 2곳 (9장)
13. `npm run build` → 14장 완료 조건

**실제로 편집하는 파일 12개** (신규 3 · 수정 9):

```
신규  lib/phone.ts
신규  components/sections/connect-widget.tsx
신규  app/[slug]/edit/widgets-panel.tsx
수정  lib/schema.ts                              (zod — 규칙 2 의 1/4)
수정  components/sections/index.tsx              (렌더러 — 규칙 2 의 2/4)
수정  app/[slug]/edit/ui.tsx                     (에디터 폼 — 규칙 2 의 3/4) · 408행 · 672행
수정  docs/SCHEMA.md                             (문서 — 규칙 2 의 4/4)
수정  app/[slug]/page.tsx                        (공개 셸 마운트)
수정  app/[slug]/preview/preview-client.tsx      (미리보기 셸 마운트)
수정  app/new/wizard.tsx                         (온보딩 STEP 3)
수정  app/api/generate/route.ts                  (서버 검증)
수정  lib/score.ts                               (widget_1 · contact)
수정  config/tours.ts                            (panel-widgets 앵커 이동)
```

→ 규칙 2 가 말하는 "4곳"은 이 중 4개 축이고, **한 커밋**이어야 한다.
A 를 별도 커밋으로 나누는 것도 가능하다(위젯과 독립적이다) — 그 경우 **A 를 먼저 커밋**한다.

---

## 14. 완료 조건 (하나라도 실패하면 커밋하지 않는다)

**전화번호 (A)**

1. 온보딩 STEP 3 에서 전화번호를 **비우면 [다음] 이 안 눌리고**, 라벨에 `(필수)` 가 보인다.
2. `010` 만 치면 빨간 글씨 `숫자 9자리 이상…` 이 뜨고 [다음] 이 막힌다. `010-1234-5678` 을 치면 사라지고 열린다.
3. 입력칸 아래 연초록 박스에 **"고객 문의가 오면 사장님 연락처로 문자가 옵니다. 반드시 사장님의 정확한 전화번호를 입력해주세요."** 가 보인다.
4. `curl` 로 `/api/generate` 에 `phone: "아홉글자입니다요"` 를 보내면 **400** 이 떨어진다(지금은 통과한다).
5. 전화번호가 안내 문구인 기존 사이트에서 완성도 `contact` 10점이 빠진다(=규칙이 정직해졌다).

**위젯 (B)**

6. `npm run build` 오류 0.
7. 위젯을 켜지 않은 **기존 발행 사이트가 그대로 렌더**된다. 회귀 없음.
8. 에디터에서 전화 위젯을 켜고 **저장만 해도** 완성도가 **+10점** 오른다(발행 전).
9. `＋10점 · 연결 버튼 1개 켜기` 힌트가 뜨고, 누르면 위젯 패널로 스크롤된다(`goToAnchor` 실패 토스트가 아니라).
10. **PC 에디터 폰 미리보기 안**에서 위젯이 폰 프레임 하단에 보이고, 둥근 모서리에 잘리지 않는다.
11. 발행 후 **실제 폰**에서 페이지 맨 위·중간·맨 아래 어디서나 버튼이 보이고 눌린다. 전화 버튼이 실제로 전화 앱을 연다.
12. 위젯 바가 `#quote` 문의 폼과 footer 를 가리지 않는다(스페이서 확인).
13. `premium` 팔레트 사이트에서 버튼 글자가 읽힌다.
14. 전화번호가 `"전화번호를 입력해 주세요"` 인 사이트에서 **전화 위젯이 아예 안 나온다**(죽은 `tel:` 링크 없음).
15. 위젯 패널에 카톡 주소를 넣으면 **위젯 버튼과 문의 섹션 카톡 버튼이 함께** 켜진다.

---

## 15. 이번 범위에서 뺀 것 (하지 말 것)

| 항목 | 이유 |
|---|---|
| 클릭 로깅(`events` 테이블) | 테이블은 있으나 저장소에 events 쓰기 코드가 **0줄**이다. 트래킹은 별도 작업(P7 통계) |
| 스크롤 후 등장·닫기 버튼 등 상호작용 | `"use client"` 가 필요해져 번들·복잡도가 늘어난다. v1 은 항상 표시 |
| 위젯 색·모양 커스터마이즈 | 테마 변수로 충분. 색 하드코딩은 규칙 위반 |
| 세 번째 위젯(문의로 스크롤·맨 위로) | 스프린트 플랜은 "전화·카톡" 두 개. 추측성 확장 금지 |
| 시드 3종에 위젯 넣기 | 쇼케이스 데모 변경은 별도 판단 |
| 기존 사이트의 나쁜 전화번호를 일괄 수정 | 사장님 데이터를 임의로 고치지 않는다. 점수 힌트로 유도한다 |
| 전화번호 형식 강제(하이픈·국가번호) | 사장님마다 적는 방식이 다르다. 링크는 정규화해서 만든다 |
| `hours` 규칙 버그(10점 획득 불가) | 위젯과 무관한 별도 버그. 기획2 보드 항목으로 올린다 |
| `map.phone` 에디터 입력칸 | 위젯이 `map.phone` 을 안 쓰기로 해서 급하지 않다 |
| 온보딩 [다음] 이 막힌 **다른** 이유 안내(한 줄 소개·주소) | 이번엔 전화번호만. 나머지는 별도 UX 작업 |

---

## 16. 클코팀장 세션 프롬프트 초안

```
읽을 파일 (그 외는 읽지 마라):
  docs/specs/widgets.md            ← 이 스펙. 줄번호는 main b578653 기준이며 먼저 실제 파일로 재확인할 것
  lib/schema.ts
  components/sections/index.tsx    (ctaHref 38-44, PALETTES 11-16, RenderSection 296-311)
  app/[slug]/page.tsx
  app/[slug]/preview/preview-client.tsx
  app/[slug]/edit/ui.tsx           ← 949줄. grep 으로만: ContentTab 541, 분위기 카드 596-606, 408, 672
  app/new/wizard.tsx               (can3 143, 전화번호 Field 375-377, Field 정의 434)
  app/api/generate/route.ts        (Input 11-24)
  lib/score.ts / config/tours.ts / config/completeness.ts / docs/SCHEMA.md

할 일: docs/specs/widgets.md 13장 순서대로 A(1~5) → B(6~13).
       A 를 먼저 커밋하고 B 를 두 번째 커밋으로 나눠도 된다. 합치면 한 커밋.
금지: events 로깅 추가, "use client" 위젯, 색 하드코딩, 새 앵커 작명, 마이그레이션 생성,
      기존 사이트의 저장된 전화번호 일괄 수정, lib/schema.ts 의 다른 섹션 수정.
완료 조건: 스펙 14장 15개 전부. 실패하면 커밋하지 말고 무엇이 막혔는지 보고할 것.
모델: Opus + ultracode (CLAUDE.md 49행 게이트 · 스프린트 플랜 27행 지정).
```

---

## 17. 회장님 결정 대기 — 없음

2026-09-05 밤 결정 4건(1장)으로 스펙의 모든 선택지가 닫혔다.
클코팀장이 다르게 판단할 수 있는 되돌릴 수 있는 선택 2개는 5장 끝에 적어 두었다(`kind` vs `type`, `.optional()` vs `.default([])`).
