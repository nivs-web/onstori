# F — 손님 사이트 모바일 UX 대개편

작성 2026-09-06 (기술참모) · 대상 = **손님 사이트**(`app/[slug]`, `components/sections`) — 본사 페이지가 아니다
회장님 지시 순서 변경 확정(2026-09-06): **F 를 먼저, C(SNS 위젯 6채널)를 뒤에.** 같은 컴포넌트라 두 번 고치지 않기 위해서다.

---

## 0. 조사 방법과 신뢰도

- 코드 사실은 전부 회장님 PC 저장소 실파일(2026-09-06 02:00 KST)에서 직접 읽었다.
- 네이버 지도 API 규격은 **네이버 클라우드 플랫폼 공식 문서**에서 확인했다(§4).
- 챗봇 요금은 **각 사의 공식 요금 페이지**에서 확인했다(§5). 추정 아님.
- 애니메이션·플로팅 버튼·햄버거 구현은 **nivs.com(회장님 자사) 의 실제 CSS·JS**를 기준으로 삼았다.
  회장님 자기 사이트라 규칙 8(홈ON 복제 금지)과 무관하고, 두 사이트의 손맛이 같아지는 이점도 있다.

⚠ **규칙 8:** homon.co.kr 은 "**기능 개념 참고까지만**"이다. 화면·문구·디자인·템플릿을 베끼지 않는다.
   아래 설계는 전부 nivs.com 패턴 + 온스토리 토큰이다.

---

## 1. 지금 손님 사이트가 어떻게 생겼나 (사실)

`app/[slug]/page.tsx` 가 그리는 것은 **네 덩어리뿐**이다:

```
① 로고 오버레이 (57~63줄, settings.logo 가 있을 때만, pointer-events-none)
② sections.map → RenderSection      (64~66줄)
③ 푸터 한 줄 "© 2026 {상호명} · Made with 온스토리"  (67~70줄)
④ ConnectWidget                      (73줄)
```

**헤더가 없다. 메뉴가 없다. 햄버거가 없다.** 손님은 스크롤 말고는 이동 수단이 없다.

| 회장님 지적 | 지금 코드 | 원인 |
|---|---|---|
| 히어로가 화면에 안 찬다(아래가 잘림) | `components/sections/index.tsx:64` `min-h-[72svh]` | **72svh 로 만든 것이다.** 100 이 아니다 |
| 히어로 문구에 애니메이션이 없다 | 없음 | 애니메이션 코드 자체가 저장소에 없다 |
| 위젯이 늘 보이고 투박하다 | `connect-widget.tsx:52~54` `fixed inset-x-0 bottom-0` **가로 바** | 스크롤 상태를 모른다(서버 컴포넌트, `"use client"` 없음) |
| 햄버거 메뉴가 없다 | 없음 | 헤더 자체가 없다 |
| 푸터가 초라하다 | `page.tsx:67~70` **한 줄** | 그게 전부다 |
| 지도가 없다 | `index.tsx:184~206` `MapSecC` = **주소 글자 + 링크 버튼**뿐 | 지도 이미지를 부르지 않는다 |

⚠ **미리보기 셸이 따로 있다.** `app/[slug]/preview/preview-client.tsx` 가 같은 구조를 복제하고 있고,
   **로고 오버레이는 공개 셸에만 있다**(이미 갈라져 있다). 이번에 만드는 헤더·푸터·위젯은
   **두 셸에 같이 넣거나, 둘 다 쓰는 컴포넌트 하나로 뽑아야 한다.** 한쪽만 하면 또 갈라진다.

---

## 2. F-1 · 히어로를 화면에 꽉 차게

### 2-1. 높이

`components/sections/index.tsx:64`

```tsx
// 전
<header className="relative flex min-h-[72svh] flex-col justify-end overflow-hidden px-5 pb-12 pt-24">
// 후
<header className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-24 sm:min-h-[86svh]">
```

- `svh`(small viewport height)를 쓴 것은 **이미 맞다** — 모바일 주소창이 접혔다 펴져도 높이가 튀지 않는다. 값만 100 으로.
- 데스크톱은 100 이면 과하다 → `sm:min-h-[86svh]`.
- 아래 여백에 `env(safe-area-inset-bottom)` 을 넣는다(아이폰 홈 인디케이터).

⚠ **100svh 로 키우면 첫 화면에 CTA 버튼이 안 보일 수 있다.** 지금 콘텐츠는 `justify-end` 로 아래에 붙어 있어
   괜찮지만, 문구가 길면 밀린다. `h1` 을 모바일에서 한 단계 줄인다: `text-3xl` → `text-[28px] sm:text-4xl`.

### 2-2. ★ 이미지 비율 — 회장님 확정: **638장 폐기 · 전량 재생성 (세로 · 고품질)**

**왜 잘렸는지 원인은 확인됐다.** `scripts/bank-generate.ts:88~90` 이 Gemini 에 보내는 설정은 이것뿐이다:

```ts
generationConfig: { responseModalities: ["IMAGE"] }
```

**가로/세로 비율을 지정하지 않는다.** 모델이 주는 대로 받고 `:161` 에서 가로폭만 맞춰(`hero 1920w`) 저장하며,
`:168` 에서 `orientation` 을 결과에서 **읽어 기록할 뿐**이다. 가로 이미지를 세로 폰(9:19.5)에
`object-cover` 로 깔면 좌우가 통째로 잘린다. 회장님이 보신 게 그것이다.

**실행 방법은 `docs/admin.md` §7 단계 3 에 명령어까지 적어 뒀다.** 여기서는 코드 변경만 적는다.

```ts
// scripts/bank-generate.ts — generationConfig 에 비율 추가
generationConfig: {
  responseModalities: ["IMAGE"],
  // 화면을 꽉 채워야 하는 건 히어로뿐이다. about 은 3:2 카드(index.tsx:101), gallery 는 격자, process 는 작은 이미지다.
  imageConfig: { aspectRatio: j.role === "hero" ? "9:16" : "4:3" },
}
```

⚠ **필드 이름을 문서만 보고 믿지 말 것.** `--limit 1 --count 1` 로 **한 장만** 먼저 뽑아
   `/admin/bank` 에서 실제 가로·세로를 눈으로 확인한 뒤 대량 생성을 돌린다.
   638장을 잘못된 설정으로 다시 뽑으면 크레딧이 그냥 날아간다.

⚠ **"폐기"는 DB 행만 내린다(`deleted = true`). 저장소 파일은 지우지 않는다.**
   이미 만들어진 손님 사이트는 생성 시점에 **이미지 URL 을 문서 안에 복사**해 갖고 있다.
   파일을 지우면 **기존 사이트의 사진이 전부 깨진다.** 옛 기획도 같은 원칙을 적어 뒀다.

⚠ **순서**: 새 이미지를 **승인한 뒤에** 옛 재고를 내린다. 반대로 하면 그 사이에 만들어지는 사이트가 고를 이미지가 없다.

**예상 비용** (`bank-generate.ts:52~55` 의 단가표 기준):
`gemini-3-pro-image` $0.134/장 · `gemini-3.1-flash-image` $0.039/장.
히어로 400회 + 나머지 700회를 전부 pro 로 하면 약 **$148 ≈ 21만원** — 크레딧 40만원 안이다.

**렌더러 쪽 임시 보정** (재생성이 끝나기 전까지):

```tsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover [object-position:center_35%] sm:[object-position:center]" />
```

사람·간판이 보통 위쪽 1/3 에 있어 `center 35%` 가 덜 잘린다. 세로 이미지가 들어오면 이 줄은 그대로 둬도 무해하다.

### 2-3. 히어로 문구 등장 애니메이션

nivs.com 이 쓰는 것과 같은 방식(`.rv` → IntersectionObserver → `.rv.on`):

```css
/* app/globals.css 맨 아래 — 손님 사이트도 이 파일을 읽는다 */
.rv { opacity: 0; transform: translate3d(0, 20px, 0);
      transition: opacity .55s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
      transition-delay: var(--d, 0ms); }
.rv.on { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .rv { opacity: 1; transform: none; transition: none; } }
```

관찰자는 **새 클라이언트 컴포넌트 하나**(`components/sections/reveal.tsx`)로 만든다:

```tsx
"use client";
import { useEffect } from "react";
/** 스크롤 등장 — 요소에 class="rv" 를 붙이면 화면에 들어올 때 .on 이 붙는다.
    ⚠ 3초 뒤 전부 강제로 켠다 — 관찰자가 못 뜨는 브라우저에서 본문이 영영 안 보이는 사고를 막는다. */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (!els.length) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("on")); return; }
    const io = new IntersectionObserver((en) => {
      en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("on"); io.unobserve(x.target); } });
    }, { threshold: 0, rootMargin: "0px 0px -6% 0px" });
    els.forEach((e) => (e.getBoundingClientRect().top < innerHeight * 0.95 ? e.classList.add("on") : io.observe(e)));
    const t = setTimeout(() => els.forEach((e) => e.classList.add("on")), 3000);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return null;
}
```

히어로에 붙이는 곳(`index.tsx` `HeroSec`):

```tsx
{s.eyebrow && <p className="rv mb-3 …">{s.eyebrow}</p>}
<h1 className="rv text-[28px] … sm:text-4xl" style={{ "--d": "80ms" } as React.CSSProperties}>{s.headline}</h1>
{s.sub && <p className="rv mt-3 …" style={{ "--d": "160ms" } as React.CSSProperties}>{s.sub}</p>}
<div className="rv mt-7 …" style={{ "--d": "240ms" } as React.CSSProperties}> … CTA … </div>
```

⚠ **`.rv` 를 히어로 밖에 남발하지 않는다.** 이번엔 히어로 4줄만. 페이지 전체를 페이드인시키면
   느린 폰에서 "안 뜨는 사이트"로 보인다.
⚠ `<Reveal />` 은 **두 셸(공개·미리보기)에 모두** 넣는다.

---

## 3. F-2 · 헤더(햄버거) · 푸터 · 위젯 — 한 덩어리로 만든다

세 개가 전부 "섹션 배열 밖"에 붙는 것이고, **두 셸에 똑같이 들어가야 한다.**
그래서 파일 하나로 묶는다: **`components/sections/shell.tsx` (신규)**

```tsx
export function SiteChrome({ doc, slug, logo }: { doc: SiteDocT; slug: string; logo?: string | null }) {
  // 헤더(햄버거) + 푸터 + 위젯을 한 번에 그린다. 공개 셸·미리보기 셸이 이것만 부른다.
}
```

⚠ 이렇게 하면 `app/[slug]/page.tsx` 와 `preview-client.tsx` 가 **각각 한 줄**만 갖게 되어 다시는 갈라지지 않는다.
   지금 공개 셸에만 있는 **로고 오버레이도 여기로 옮긴다.**

### 3-1. 헤더 + 햄버거

```
[로고 또는 상호명]                                    [☰]
```

- 처음엔 **투명**(히어로 사진 위에 얹힌다), 스크롤 40px 이상이면 **흰 반투명 + 블러**로 바뀐다
  (nivs.com `header.glass` 와 같은 방식, `scrollY>40`).
- 햄버거를 누르면 전체 화면 메뉴. 항목은 **`doc.sections` 에서 자동으로 만든다** — 새 데이터가 필요 없다:

| 섹션 타입 | 메뉴 이름 |
|---|---|
| `about` · `storyFeed` · `gallery` · `portfolioGallery` · `reviews` · `processSteps` · `hoursCard` · `menuPrice` · `map` | 그 섹션의 `title` (스키마에 전부 있다) |
| `hero` · `banner` · `quoteForm` | 메뉴에 넣지 않는다 |

목적지는 **이미 있는 앵커**를 쓴다 — 미리보기 셸이 `id={`sec-${i}`}` 를 붙이고 있다(`preview-client.tsx:63`).
**공개 셸에는 그 id 가 없다**(`page.tsx:64~66`) → 이번에 공개 셸에도 붙인다. 그러면 `#sec-3` 로 이동한다.

⚠ 데스크톱에서는 햄버거 대신 가로 메뉴로 편다(`hidden md:flex`).
⚠ 메뉴가 **2개 이하면 헤더를 아예 그리지 않는다.** 섹션 3개짜리 사이트에 햄버거는 과하다.
⚠ 색은 팔레트 변수만(`--s-bg`·`--s-ink`·`--s-accent`). ⚠ `premium` 팔레트는 `bg`·`onAccent` 가 **둘 다 `#12151B`** 다
   (`index.tsx:11~16`) — 흰색을 하드코딩하면 글자가 사라진다.

### 3-2. 푸터 — 한 줄에서 제대로 된 푸터로

지금(`page.tsx:67~70`): `© 2026 {상호명} · Made with 온스토리` 한 줄.

바꿀 모양(3단, 모바일은 세로):

```
[로고 / 상호명]           [바로가기]              [연락]
{한 줄 소개}              소개                   전화 010-0000-0000
                          작업 기록               카카오톡 문의
                          오시는 길               {주소}
──────────────────────────────────────────────────────────
© 2026 {상호명}                       Made with 온스토리
```

값의 출처(**새 데이터 없음**):

| 칸 | 출처 |
|---|---|
| 상호명 | `doc.businessName` |
| 한 줄 소개 | `hero.sub` (`index.tsx` 의 `s.sub`) |
| 바로가기 | 헤더 메뉴와 같은 목록 |
| 전화 · 카톡 | `contactOf(doc)` — **B 스프린트에서 이미 만든 함수**(`index.tsx:45`) |
| 주소 | `map` 섹션의 `address` |

⚠ **상호명 자리는 A/B 스프린트의 숨은 에디터 진입로다.** `cursor:inherit` 링크를 그대로 유지한다.
   푸터를 다시 그리면서 그 링크를 잃어버리지 않도록 A/B 커밋을 먼저 확인한다.
⚠ 배경은 `--s-ink` 에 8% 정도 어둡게가 아니라, **팔레트 변수 조합**으로 만든다:
   `background: var(--s-soft)` + `color: var(--s-muted)` + 위쪽 `1px solid var(--s-line)`. 네 팔레트 모두에서 성립한다.

### 3-3. ★ 위젯 재설계 — 회장님이 그리신 그대로

**지금:** `connect-widget.tsx:52~54` — 화면 아래 **가로 바**가 **항상** 떠 있다.
**바꿀 것:** 히어로를 벗어나면 **우측 하단 동그란 아이콘 하나**가 나타나고, 누르면 위로 펼쳐진다.

```
스크롤 0 ~ 히어로 안         → 아무것도 안 보임
히어로를 지나면               → 우측 하단에 ● 하나 (56px, 페이드+살짝 올라오며 등장)
● 를 누르면                  → 위로 [전화] [카카오톡] 이 차례로 펼쳐짐 (C 에서 여기에 6개가 더 붙는다)
```

크기·위치는 nivs.com 실측값을 따른다:
`position:fixed; right:22px; bottom:26px; width:54px; height:54px; border-radius:50%`
(우리는 손가락 최소 크기를 지켜 **56px**, 아래 여백에 `env(safe-area-inset-bottom)` 을 더한다)

**구현상 반드시 알아야 할 것:**

- `connect-widget.tsx` 는 지금 **`"use client"` 가 아니다.** 파일 주석(7~9줄)이 그 이유를 적어 뒤 뒀다 —
  미리보기 셸이 이 모듈을 끌어가므로 `fs`·`supabase`·`process.env` 를 import 하면 안 된다는 뜻이다.
  **스크롤을 알려면 클라이언트여야 한다** → `"use client"` 를 붙인다. **그 주석의 나머지 조건(서버 전용 import 금지)은 그대로 지킨다.**
- 등장 판정은 `IntersectionObserver` 로 **히어로 요소를 관찰**한다. `scrollY` 숫자를 쓰지 않는다
  (히어로 높이가 사이트마다 다르다). 히어로에 `id="site-hero"` 를 붙이고 그것이 화면에서 나가면 표시.
  히어로가 없는 사이트(스키마상 가능)면 **처음부터 보인다.**
- 지금 있는 **모바일 스페이서(`connect-widget.tsx:51` `h-20 sm:hidden`)는 지운다.** 동그란 아이콘은 콘텐츠를 가리지 않는다.
- 펼침 상태는 `useState` + 바깥 클릭·ESC 로 닫기. `aria-expanded`·`aria-controls` 를 붙인다.
- 접근성: 아이콘 하나짜리 버튼에 `aria-label="연락 방법 열기"`.

---

## 4. F-3 · 지도 넣기 (네이버)

### 회장님 조건

> "주소를 입력한 사이트에 한해 에디터에서 '지도 넣기' 선택 가능하게. 네이버 지도.
> `NAVER_MAPS_CLIENT_ID`/`SECRET` 은 이미 `.env.local` 에 등록됨."

### ★ 기존 `NAVER_CLIENT_ID` 와 다른 키다 — 헷갈리면 안 된다

| 키 | 어디 것 | 지금 쓰는 곳 |
|---|---|---|
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 **개발자센터** — 지역검색(`openapi.naver.com/v1/search/local`) | `app/api/place-search/route.ts:27~31` |
| `NAVER_MAPS_CLIENT_ID` / `NAVER_MAPS_CLIENT_SECRET` | 네이버 **클라우드 플랫폼(NCP)** — Maps | **아직 코드에서 안 쓴다** |

### 어떻게 그릴까 — **회장님 확정: 정적 지도 이미지 (homon.co.kr 방식)**

| 방법 | 장점 | 단점 |
|---|---|---|
| **(확정) Static Map** — 서버가 이미지를 받아 `<img>` 로 | JS 0KB · 키가 브라우저에 안 나감(규칙 6) · 모바일에서 빠름 · 캐시 가능 | 확대/이동 안 됨 |
| 동적 지도(JS SDK) | 확대·이동 가능 | 스크립트 URL 에 **Client ID 가 노출**되어 `NEXT_PUBLIC_` 으로 바꿔야 하고, 모바일에서 무겁다 |

손님은 대개 **"어디쯤인지"만 보고 [네이버 지도로 열기]를 누른다.** 정적 이미지로 충분하다.
회장님이 확인하신 homon.co.kr 도 같은 방식이다 — **지도 그림 + 그 아래 [길찾기] 링크.**
우리도 지도 이미지 아래에 이미 있는 `naverMapUrl` 버튼(`index.tsx:191~197`)을 그대로 둔다.

### 공식 규격 (네이버 클라우드 플랫폼 문서 확인, 2026-09-06)

```
Static Map : https://maps.apigw.ntruss.com/map-static/v2/raster
Geocoding  : https://maps.apigw.ntruss.com/map-geocode/v2/geocode
요청 헤더  : x-ncp-apigw-api-key-id: <Client ID>
             x-ncp-apigw-api-key   : <Client Secret>
```

**둘 다 헤더 인증이다** → 키가 서버에만 있으면 된다. 규칙 6 을 지킬 수 있다.

### 새 라우트 — `app/api/map/route.ts`

```
GET /api/map?slug=goodmoksu&w=720&h=360
  1) sites 에서 slug 로 published.sections 의 map.address 를 읽는다   ← 주소를 쿼리로 받지 않는다
  2) Geocoding 으로 좌표를 얻는다 (결과를 캐시)
  3) Static Map 이미지를 받아 그대로 흘려보낸다 (Cache-Control: public, max-age=86400)
```

⚠ **주소를 쿼리 파라미터로 받지 않는다.** 받으면 아무나 우리 키로 지도를 뽑아 쓸 수 있다(키 도용).
   `slug` 만 받고 주소는 **서버가 DB 에서 읽는다.** 규칙 4 와 같은 원칙이다.
⚠ 키가 없으면 **404 가 아니라 조용히 실패**시키고, 렌더러는 지도 자리를 그리지 않는다(지금과 같은 화면).
⚠ 좌표 캐시는 `sites.settings.geo = { lat, lng, at }` 에 둔다. 지오코딩을 매 요청마다 부르지 않는다.
   (`settings` 는 사장님에게 내려가지만 **자기 가게 좌표**라 문제없다.)

### 스키마 — ★ 규칙 2 (섹션 스키마 변경 = 한 커밋에서 4곳)

```ts
// lib/schema.ts
export const MapSec = z.object({
  type: z.literal("map"),
  title: z.string().max(40).default("오시는 길"),
  address: z.string().min(1).max(120),
  phone: z.string().max(20).optional(),
  naverMapUrl: z.string().url().optional(),
  note: z.string().max(120).optional(),
  // 지도 이미지 표시. optional — 이 필드가 생기기 전 발행본 호환
  // ⚠ 필수로 만들면 lib/sites.ts:47 의 SiteDoc.parse(safeParse 아님)에서 기존 발행 사이트가 전부 죽는다
  // ⚠ .default(false) 도 쓰지 않는다 — update 라우트가 parsed.data 를 저장해 손 안 댄 사이트에 "showMap":false 가 덧씌워진다
  showMap: z.boolean().optional(),
});
```

**한 커밋에서 같이 바꾸는 4곳** (규칙 2):

1. `lib/schema.ts` — 위 `showMap`
2. `components/sections/index.tsx` `MapSecC`(184줄) — `s.showMap && s.address` 일 때 `<img src={`/api/map?slug=…`}>`
3. 에디터 폼 — `app/[slug]/edit/ui.tsx` 의 map 섹션 편집부에 **[지도 넣기] 토글**.
   ⚠ **주소가 비어 있으면 토글을 비활성**으로(회장님 조건: "주소를 입력한 사이트에 한해")
4. `docs/SCHEMA.md`

⚠ `MapSecC` 는 `ctx` 를 안 받는다(184줄 `{ s }`) — `slug` 가 필요하면 **`ctx` 를 받도록 시그니처를 바꿔야 한다.**
   `RenderSection` 의 switch 에서 넘기는 인자도 같이 고친다.

---

## 5. F-4 · 모바일 챗봇 — **회장님 확정: 새로 만들지 않는다**

> **회장님 확인 (2026-09-06): "실제 실시간 챗봇 아님. homon 의 💬 아이콘은 진료시간·연락처를 보여주는
> **정보 버튼**일 뿐이다. 새로 만들지 말고, 이미 만든 연결 위젯(전화·카톡)을 같은 위치·스타일로 재활용하라."**

회장님 확인이 맞다. 그리고 조사 결과도 같은 결론이었다.

### 조사 결과 (2026-09-06, 각 사 공식 요금 페이지 확인)

| 서비스 | 무료 | 유료 시작 | 과금 단위 |
|---|---|---|---|
| 채널톡 | 있음 (고객 메신저·카카오 상담톡 연동 포함) | 약 3만원/월~ | **워크스페이스(=회사)당** |
| Crisp | 있음 (상담원 2명, 고객 프로필 100명) | $45/월~ | **워크스페이스당** |

상담을 받는 사람은 온스토리가 아니라 **사장님 본인**이다. 받은편지함이 사장님마다 있어야 하므로
**워크스페이스도 사장님마다 하나**여야 한다. 100 사이트면 워크스페이스 100개 —
유료 기준 **월 300만원**이라 정회원 49,000원과 맞지 않는다.

### → 확정: §3-3 의 동그란 위젯이 곧 그 자리다

**추가 비용 0원 · 새 의존성 0개 · 새 컴포넌트 0개.**

- 위치·크기·모양을 **homon 의 💬 자리와 같게** 한다: `우측 하단 · 동그라미 · 히어로를 지나면 등장`.
- 누르면 위로 펼쳐진다: **[전화] [카카오톡]** (C 에서 여기에 채널 6개가 더 붙는다).
- 아이콘은 💬(말풍선) 하나 — "연락 방법"이라는 뜻이다. `aria-label="연락 방법 열기"`.
- ⚠ **실시간 채팅처럼 보이게 하지 않는다.** "상담원 연결", "메시지를 남겨주세요" 같은 문구를 쓰지 않는다.
  누르면 즉시 전화·카톡 버튼이 보이므로, 손님이 답을 기다리는 오해가 생기지 않는다.

### 나중에 (이번 범위 밖 — 기획2에 항목으로 올린다)

- **사장님이 자기 채널톡 무료 계정을 붙이는 옵션** — 에디터에 플러그인 키 한 칸. 계정·요금은 사장님 것.
  ⚠ 3rd-party 스크립트가 모바일 속도·개인정보 동의에 영향.
- **AI 가 답하는 챗봇** — 기술적으로는 가능(Vertex 이미 씀). ⚠ **규칙 7 위반 위험** —
  AI 가 없는 사실(가격·영업시간·시공 가능 여부)을 지어내면 **사장님이 책임진다.** 별도 기획 필요.

## 6. 파일 목록

| 파일 | 신규/수정 | 내용 |
|---|---|---|
| `components/sections/shell.tsx` | 신규 | `SiteChrome` — 헤더(햄버거)+푸터+위젯+로고 오버레이 한 덩어리 |
| `components/sections/reveal.tsx` | 신규 | `Reveal` — `.rv` 스크롤 등장 |
| `components/sections/connect-widget.tsx` | 수정 | `"use client"` + 동그란 아이콘 + 펼침 |
| `components/sections/index.tsx` | 수정 | `HeroSec` 높이·비율·`.rv`·`id="site-hero"` / `MapSecC` 지도 이미지 + `ctx` 인자 |
| `app/[slug]/page.tsx` | 수정 | 네 덩어리를 `<SiteChrome>` 한 줄로. 섹션에 `id={`sec-${i}`}` 추가 |
| `app/[slug]/preview/preview-client.tsx` | 수정 | 같은 한 줄로 (갈라짐 해소) |
| `app/globals.css` | 수정 | `.rv` 규칙 3줄 (색 토큰은 **건드리지 않는다**) |
| `lib/schema.ts` | 수정 | `MapSec.showMap` (규칙 2 — 4곳 한 커밋) |
| `app/[slug]/edit/ui.tsx` | 수정 | map 섹션에 [지도 넣기] 토글 |
| `docs/SCHEMA.md` | 수정 | 규칙 2 |
| `app/api/map/route.ts` | 신규 | 지오코딩 + Static Map 프록시 |
| `scripts/bank-generate.ts` | (조건부) | 세로 히어로 생성 — §2-2 ③ 을 하기로 한 경우에만 |

---

## 7. 커밋 — 3개로 나눈다

한 커밋에 넣으면 되돌릴 수가 없다. 검증 단위로 자른다.

```
① feat: 손님 사이트 셸 통합 — 헤더(햄버거)·푸터·위젯을 SiteChrome 하나로
   ⚠ 공개 셸과 미리보기 셸의 갈라짐(로고 오버레이)을 여기서 해소한다

② feat: 모바일 히어로 꽉 차게 + 스크롤 등장 애니메이션 + 위젯 동그란 아이콘

③ feat: 오시는 길 지도 (네이버 Static Map · 규칙 2 로 4곳 한 커밋)
```

**②는 ①에 의존한다. ③은 독립이다** — ③만 먼저 해도 된다.

---

## 8. 완료 조건

1. `npm run build` 성공 · ESLint 경고 0.
2. 아이폰·안드로이드 실기기에서 히어로가 **화면을 꽉 채운다**(아래가 잘리지 않는다).
3. 히어로 문구 4줄이 **차례로 나타난다.** 설정에서 "동작 줄이기"를 켜면 **즉시 다 보인다.**
4. 스크롤 0 에서는 위젯이 **안 보이고**, 히어로를 지나면 우측 하단에 **동그란 아이콘 하나**가 나타난다.
5. 그 아이콘을 누르면 [전화][카카오톡]이 펼쳐지고, 바깥을 누르거나 ESC 로 닫힌다.
6. 상단에 **햄버거**가 있고, 누르면 섹션 목록이 나오고, 항목을 누르면 그 섹션으로 이동한다.
7. 섹션이 2개 이하인 사이트에는 **헤더가 아예 없다.**
8. 푸터가 3단이고, **상호명을 누르면 `/edit` 으로 간다**(A/B 의 숨은 진입로 — 커서가 안 바뀐다).
9. **팔레트 4종(clean·warm·premium·lively) 전부**에서 헤더·푸터·위젯 글자가 읽힌다.
   ⚠ `premium` 은 `bg` 와 `onAccent` 가 둘 다 `#12151B` 다. 여기서 제일 잘 깨진다.
10. `/{slug}` 와 `/{slug}/preview` 가 **같은 화면**이다(로고·헤더·푸터·위젯 전부).
11. 주소가 있는 사이트에서 [지도 넣기]를 켜면 **오시는 길에 지도 이미지가 뜬다.**
12. 주소가 비어 있으면 [지도 넣기] 토글이 **비활성**이다.
13. `NAVER_MAPS_*` 키를 지우고 새로고침해도 **화면이 깨지지 않는다**(지도 자리만 없어진다).
14. 브라우저 개발자도구 → 네트워크에서 **`NAVER_MAPS_CLIENT_SECRET` 이 어디에도 안 보인다.**
15. **기존 발행 사이트 3곳이 그대로 렌더된다** — `showMap` 이 없는 문서가 `lib/sites.ts:47` 의 `SiteDoc.parse` 를 통과한다.

---

## 9. 이번 범위 밖

- **C — SNS 6채널 위젯.** F 가 끝난 위젯 위에 얹는다(회장님 확정 순서).
- **외부 챗봇 서비스 도입** — §5 결론.
- **AI 응답 챗봇** — 규칙 7 위험. 별도 기획.
- **본사 페이지(onstori.com) 모바일** — F 는 손님 사이트다. 본사 햄버거는 이미 있다(`chrome.tsx:63~72`).
- **동적 지도(확대·이동)** — 정적 이미지로 시작한다.
- **폰트 자체 호스팅** — A 스펙에서 F 로 미뤄 둔 항목. ③ 커밋 뒤 별도로.
- **이미지뱅크 재생성 실행** — 코드 변경(§2-2)은 여기, **실행 명령·순서는 `docs/admin.md` §7 단계 3.** 크레딧이 드는 별건이다.

---

## 10. 회장님 결정 3건 — **전부 확정 (2026-09-06)**

| # | 물었던 것 | **확정** |
|---|---|---|
| 1 | 세로 히어로 이미지 | **기존 638장 폐기하고 전량 재생성.** 세로 비율, 최대한 고품질. 실행 방법은 `docs/admin.md` §7 단계 3 |
| 2 | 지도 방식 | **정적 지도.** homon.co.kr 방식 그대로 — 지도 그림 + 아래 길찾기 링크 |
| 3 | 챗봇 | **새로 만들지 않는다.** 이미 만든 연결 위젯(전화·카톡)을 같은 위치·스타일로 재활용 |

**막힌 것 없음 — 커밋 ①②③ 전부 바로 시작할 수 있다.**

### 덤 — 회장님이 물으신 "이미지뱅크에 별점 기능이 있는지"

**있습니다.** 별 5개가 아니라 **0~100점**입니다.

- `image_bank.quality_score int not null default 50 check (0~100)` — `20260831190000_bank_quality.sql`
- 어드민에 **점수를 고르는 드롭다운이 이미 있습니다** — `app/admin/bank/ui.tsx:119`
- 사이트를 만들 때 **점수 높은 것부터, 덜 쓴 것부터** 고릅니다 —
  `image_bank_pick_idx (industry, mood, role, quality_score desc, used_count asc) where quality_ok and not deleted`
- **자동 채점은 아직 없습니다.** 생성 스크립트는 중복(dHash 해밍 ≤6)만 거르고 점수는 전부 기본 50 으로 들어갑니다.
  기획1 작업표 12번에 "별점 자동"이 계획으로 적혀 있습니다.
- 현재 재고 638장은 **전량 수동 승인** 상태입니다(`docs/PLAN.md` P2).
- ⚠ **재생성하면 새 이미지는 전부 `quality_ok=null`(대기) · `quality_score=50`** 으로 들어옵니다.
  `/admin/bank?q=pending` 에서 눈으로 승인하며 점수를 조정해야 합니다. 그 검수가 이번 재생성의 실제 일감입니다.
