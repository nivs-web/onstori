# A/B — 온스토리 문구·메뉴·로고 정리 + 손님 사이트 숨겨진 에디터 진입로

작성 2026-09-06 (기술참모) · 대상 커밋 `main` (위젯 스프린트 반영본) · 범위 A(본사 화면) + B(고객 사이트 푸터)

---

## 0. 조사 방법과 신뢰도

- 모든 파일:줄 번호는 **2026-09-06 02:00 KST 시점의 회장님 PC 저장소 실파일**에서 직접 읽은 값이다(코워크 스테이징).
  위젯 스프린트(A·B) 병합 뒤 상태다 — `lib/schema.ts:160 widgets`, `components/sections/connect-widget.tsx`,
  `app/[slug]/edit/widgets-panel.tsx`, `config/tours.ts:65 panel-widgets` 전부 확인했다.
- 문구는 **전체 grep 으로 같은 문장의 사본을 모두 찾았다.** 회장님이 지목한 한 곳만 고치면
  나머지 사본이 남아 화면마다 말이 달라진다 — 아래 표는 사본까지 포함한 전량이다.
- 폰트·자간 기준값은 **nivs.com 의 실제 CSS**(`https://www.nivs.com/css/style.css?v=2026081002`)에서 읽었다. 추정 아님.
- 아이콘 파일은 회장님이 주신 `온아이콘_투명.PNG`(775×720, 알파 있음)를 여백 트림 → 정사각 패딩 →
  Lanczos 축소해 **이 번들에 넣어 뒀다.** 클코팀장은 만들지 말고 복사만 한다.

---

## 1. 결정 3건 — 1번은 답변 완료, 2·3번은 권장안으로 진행

### 결정 1 — **회장님 답변 완료 (2026-09-06): "문구는 그대로 둔다"**

**이 항목은 이번 작업에서 손대지 않는다.** 아래는 나중에 다시 볼 때를 위한 기록이다.

화면·코드 **7곳**이 손님에게 "14일 이후 자동으로 삭제됩니다"라고 약속하고 있다.

| # | 파일:줄 | 현재 문구 |
|---|---|---|
| 1 | `lib/trial.ts:28` | `TRIAL_NOTICE` = "…14일 이후에는 자동으로 삭제됩니다." |
| 2 | `components/site/pay-modal.tsx:101` | 같은 문장 |
| 3 | `app/new/wizard.tsx:233` | "…이후 자동 삭제 · 언제든 해지" |
| 4 | `app/page.tsx:198` | "14일 이후 자동 삭제 · 결제 뒤 언제든 해지" |
| 5 | `app/page.tsx:327` | "결제하지 않으면 자동 삭제. 삭제 전 문자 두 번." |
| 6 | `app/[slug]/edit/ui.tsx:338` | "…전환하지 않으시면 30일 뒤 삭제됩니다." |
| 7 | `app/api/cron/expire/route.ts:8` (주석) | "삭제는 30일 뒤 사람이 어드민에서." |

실제 코드는 **아무것도 삭제하지 않는다.** 크론은 `status='expired'` 로만 바꾸고(`route.ts:51`),
RLS(`core.sql:113` `status in ('trial','active')`)가 공개를 끊는다.
회장님 판단: **결제 전환 압박으로 이 문구가 필요하다.** 기술참모 의견은 표시광고 관점의 위험을 남겨 둔다는 것뿐이고,
E-4(어드민에서 수동 재공개)를 만들 때 다시 검토한다.

### 결정 2 · `/compare` 경로를 없앨까, 남길까

회장님 지시: "'홈페이지 제작업체 vs 온스토리' **메뉴를 삭제**하고 그 내용 전체를 온스토리 아래에 붙여주세요."

- **권장 = 경로는 남기고 메뉴만 지운다.** `/compare` 는 이미 `app/sitemap.ts:17` 에 올라가 있어
  검색엔진이 수집했을 수 있다. 페이지를 지우면 404 가 난다.
  → `app/compare/page.tsx` 를 `redirect("/our-story#compare")` 한 줄짜리로 바꾸고, 표 내용은 온스토리 페이지로 옮긴다.
- 완전 삭제를 원하시면 sitemap 에서도 빼고 404 를 감수한다. **어느 쪽인지 한 마디만 주시면 된다.**

### 결정 3 · "사업이야기" 메뉴 이름을 "온스토리"로 바꿀 때 **주소도 바꿀까**

- **권장 = 주소(`/our-story`)는 그대로, 보이는 이름만 "온스토리".**
  손님에게 보이는 건 메뉴 이름뿐이고, 주소를 바꾸면 sitemap·푸터 링크·검색 색인이 전부 따라 움직인다.
  얻는 게 없다.
- `/onstori` 로 바꾸길 원하시면 그때 301 리다이렉트를 함께 넣는다.

---

## 2. A-1 · 로고와 아이콘

### 1) 상단 ONSTORI 로고 20% 축소

`components/site/chrome.tsx:45` — `<Logo height={24} />` → **`<Logo height={19} />`** (24 × 0.8 = 19.2)

- 푸터 로고(`chrome.tsx:84` `height={22}`)는 **건드리지 않는다.** 회장님 지시는 "상단"이다.
- `components/site/logo.tsx` 는 그대로. 로고는 `<img>` 에 `height` 만 주고 `width:auto` 라 비율이 유지된다.

### 2) 파비콘 · iOS/안드로이드 홈화면 아이콘 — **파일은 이 번들에 있다**

지금 `app/favicon.ico`(25,931 B)는 **create-next-app 이 넣어 준 Next.js 기본 아이콘**이다. 온스토리 것이 아니다.

이 번들에서 그대로 복사할 파일:

| 번들 안 경로 | 저장소 경로 | 크기 | 쓰임 |
|---|---|---|---|
| `app/favicon.ico` | `app/favicon.ico` | 16·32·48 멀티 | 브라우저 탭 (기존 파일 **덮어쓰기**) |
| `app/icon.png` | `app/icon.png` | 512×512 (투명) | 최신 브라우저 · 검색 결과 |
| `app/apple-icon.png` | `app/apple-icon.png` | 180×180 (흰 배경) | iOS "홈 화면에 추가" |
| `public/brand/icon-192.png` | 같음 | 192×192 | manifest |
| `public/brand/icon-512.png` | 같음 | 512×512 | manifest |
| `public/brand/icon-maskable-192.png` | 같음 | 192×192 (초록 #005B2A 바탕) | 안드로이드 적응형 아이콘 |
| `public/brand/icon-maskable-512.png` | 같음 | 512×512 (초록 바탕) | 안드로이드 적응형 아이콘 |
| `public/brand/on-mark-64.png` | 같음 | 64×64 (투명) | 채널 띠 온스토리 마크 (아래 3번) |

`app/icon.png` · `app/apple-icon.png` · `app/favicon.ico` 는 **Next.js App Router 파일 규약**이라
코드에 `<link>` 를 쓸 필요가 없다. 파일만 그 자리에 두면 붙는다.

iOS 아이콘만 흰 배경인 이유: iOS 는 투명 아이콘을 검게 칠한다.

### 3) 안드로이드 홈 화면 바로가기 — `app/manifest.ts` **신규 파일 1개**

```ts
import type { MetadataRoute } from "next";

/** 홈 화면 바로가기(안드로이드 PWA) — 아이콘의 단일 출처는 public/brand/*. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "온스토리 ONSTORI",
    short_name: "온스토리",
    description: "사장님의 60초가 영상·글·블로그로 바뀌는 자동화 엔진",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#005B2A",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

⚠ `theme_color` 는 `--green #005B2A` 와 같은 값이어야 한다(규칙 9 ②, 색의 단일 출처는 `app/globals.css`).
manifest 는 CSS 변수를 못 읽으므로 값을 적되, **주석으로 출처를 남긴다.**

### 4) 채널 띠 — "온스토리 홈페이지" 앞 초록 동그라미를 로고로

`components/site/blocks.tsx:52` 현재:

```tsx
default: return <span className="inline-block h-5 w-5 rounded-full" style={{ background: "var(--green)" }} aria-hidden />;
```

→ 바꾼다:

```tsx
// eslint-disable-next-line @next/next/no-img-element
default: return <img src="/brand/on-mark-64.png" alt="" width={18} height={18} className="inline-block" aria-hidden />;
```

### 5) 나머지 채널 아이콘 축소

`components/site/blocks.tsx:39` — `const s = { width: 20, height: 20 } as const;` → **`{ width: 18, height: 18 }`**

유튜브·인스타·쓰레드·X·네이버 5개가 전부 이 상수 하나를 쓴다. 한 줄이면 끝난다.
온스토리 마크도 위에서 18 로 맞췄으니 6개가 같은 크기가 된다.

---

## 3. A-2 · 문구 (전 → 후)

**표에 없는 문장은 건드리지 않는다.**

| # | 파일:줄 | 전 | 후 |
|---|---|---|---|
| 1 | `app/page.tsx:28` | 홈페이지는 **텅 빈 상가**입니다.<br>스토리에는 진짜 사람이 있습니다. | 홈페이지는 **빈 집**입니다.<br>스토리에는 진짜 사람이 있습니다. |
| 1' | `app/layout.tsx:7` | (같은 문장, `metadata.title.default`) | 같이 바꾼다 |
| 1'' | `components/site/chrome.tsx:86` | (같은 문장, 푸터) | 같이 바꾼다 |
| 1''' | `app/our-story/page.tsx:36` | (같은 문장, 편지 끝줄) | 같이 바꾼다 |
| 2 | `app/page.tsx:31` | 사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다. **온스토리.** | 사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다. (끝의 "온스토리." 삭제) |
| 2' | `components/site/chrome.tsx:86` 둘째 줄 | (같은 문장) | 같이 확인 — 여긴 이미 "온스토리."가 없다. 변경 없음 |
| 3 | `app/page.tsx:34` | "문자 링크만 누르세요 (카톡 로그인)" | **"링크만 클릭"** |
| 4 | `app/page.tsx:44` | `["100개", "질문 은행"]` | **`["3분", "제작 시간"]`** |
| 5 | `components/site/blocks.tsx:23` | `title = "한 번 말하면 여섯 곳으로"` | **`title = "한 번 말하면 6곳에 퍼지는 자동화 엔진"`** |
| 6 | `app/page.tsx:91` | 사장님의 60초를<br>홈페이지·영상·글로 바꾸는<br>이야기 엔진입니다. | **사장님의 60초가<br>영상·글·블로그로 바뀌는<br>자동화 엔진** |
| 7 | `app/page.tsx:76` | `["3년 뒤에도 검색되는 영상,", "오늘 60초."]` | `["3년 뒤에도 검색되는 영상,", **"오늘 60초만 말하세요."**]` |
| 8 | `app/page.tsx:96` | 매주 질문 하나에 60초. 무음 컷·한글 자막·세로/가로 두 판. 얼굴이 싫으면 목소리만. | **매주(혹은 매일) 질문 하나에 60초. 아직도 타이핑하고 계신가요? 목소리가 있어야 고객이 신뢰합니다.** |

### 12) ★ "온스토리 블로그" → **"온스토리 사이트"** (회장님 2026-09-06 확정)

> 뜻은 **"고객사 자기 사이트 안의 스토리·이야기 섹션"** 이다. 온스토리 회사의 블로그가 아니다.
> 이 이름이 쓰이는 **모든 문서·화면 문구**에 반영한다.

| 파일:줄 | 전 | 후 |
|---|---|---|
| `components/site/chrome.tsx:25` | `{ id: "onstori", name: "온스토리 홈페이지", short: "onstori" }` | `name: "온스토리 사이트"` (**`id`·`short` 는 그대로** — `blocks.tsx:38` 의 switch 키다) |
| `app/page.tsx:97` | "…네이버 블로그(복사 30초)·**온스토리 블로그**. 하루 최대 3건." | "…네이버 블로그(복사 30초)·**온스토리 사이트**. 하루 최대 3건." |
| `app/how-it-works/page.tsx:16` | "…네이버 블로그(복사 30초) · **온스토리 홈페이지 블로그**." | "…네이버 블로그(복사 30초) · **온스토리 사이트**." |
| `config/faq.ts:12` | "…여섯 곳(…·**온스토리 홈페이지**)에 퍼뜨리는 서비스입니다." | "…여섯 곳(…·**온스토리 사이트**)에 퍼뜨리는…" |
| `config/faq.ts:36` | "…네이버 블로그(복사 30초), **온스토리 홈페이지 블로그**입니다." | "…네이버 블로그(복사 30초), **온스토리 사이트**입니다." |
| `app/blog/page.tsx:32` | "**온스토리 블로그는 두 층입니다.** 여기(본사)와, 사장님 각자의 홈페이지 블로그. 사장님 60초는 사장님 페이지에 쌓입니다." | "**블로그는 두 층입니다.** 여기(온스토리 본사)와, 사장님의 **온스토리 사이트**. 사장님 60초는 사장님 사이트에 쌓입니다." |

⚠ `content/mainplan/data.js`(기획1 문서)에도 같은 표현이 **6곳** 있다
(`:14` · `:116` · `:307` · `:330` · `:390` · `:421`). 운영자만 보는 문서라 급하지 않지만,
**같은 커밋에서 함께 바꾸면** 나중에 말이 갈라지지 않는다.

⚠ 완료 확인: `grep -rn "온스토리 블로그\|온스토리 홈페이지 블로그" app components config` → **0건**

### 9) `onstori.com/사장님가게` → `onstori.com/name` — **예시 글자만**

4곳: `app/page.tsx:95` · `app/page.tsx:192` · `app/page.tsx:205` · `app/how-it-works/page.tsx:12`

⚠ **`app/[slug]/` 라우팅은 절대 건드리지 않는다.** 이건 화면에 보이는 예시 텍스트일 뿐이다.

### 10) `X` → `X(트위터)` — 문서 전체

4곳:

- `components/site/chrome.tsx:23` — `{ id: "x", name: "X", short: "X" }` → `name: "X(트위터)"` (**`id` 와 `short` 는 그대로**. `id` 는 `blocks.tsx:47` 의 `switch` 분기 키다)
- `app/page.tsx:97` — "…쓰레드·**X**·네이버 블로그(복사 30초)…" → "…쓰레드·**X(트위터)**·…"
- `app/page.tsx:118` — "쇼츠·릴스·쓰레드·**X**·네이버·홈페이지" → "…·**X(트위터)**·…"
- `app/compare/page.tsx:15` — "쇼츠·릴스·쓰레드·**X**·네이버(복붙)·홈페이지 6곳" → "…·**X(트위터)**·…"
  (결정 2 에서 `/compare` 내용을 온스토리 페이지로 옮기므로, **옮긴 뒤의 파일에서** 고친다)

### 11) "가로 영상 / 세로 영상" 표현 제거

회장님 판단: 쇼츠도 릴스도 세로다 — 구분이 의미 없다.

| 파일:줄 | 전 | 후 |
|---|---|---|
| `app/page.tsx:165` | `["가로 영상", "1440 × 810", "홈페이지 · 유튜브. 한글 어절 자막.", "aspect-video"]` | `["유튜브 쇼츠", "1080 × 1920", "유튜브 쇼츠 규격. 한글 어절 자막.", "aspect-[9/16]"]` |
| `app/page.tsx:166` | `["세로 영상", "1080 × 1920", "쇼츠 · 릴스. 60초 규격.", "aspect-[9/16]"]` | `["인스타 릴스", "1080 × 1920", "인스타 릴스 규격. 60초.", "aspect-[9/16]"]` |
| `app/page.tsx:96` | (위 8번에서 이미 교체됨) | — |
| `app/page.tsx:192` | "자막 영상 **세로·가로 두 판**" | "**자막 영상 (쇼츠·릴스 규격)**" |
| `app/page.tsx:206` | "자막 영상 **원본·가로·세로** 전부 사장님 파일입니다." | "**자막 영상과 원본 전부** 사장님 파일입니다." |
| `app/how-it-works/page.tsx:15` | "무음 컷 · 한글 자막 · **세로/가로 두 판** · 원문/…" | "무음 컷 · 한글 자막 · **쇼츠·릴스 규격** · 원문/…" |
| `components/site/pay-modal.tsx:68` | "자막 영상 **세로·가로 두 판**" | "**자막 영상 (쇼츠·릴스 규격)**" |

⚠ 165·166 은 `aspect-video` 카드가 사라지므로 **네 칸이 전부 세로/정사각이 된다.**
`md:grid-cols-4` 안에서 높이가 들쭉날쭉해지지 않는지 눈으로 확인할 것.
(단, 이 섹션은 **A-4 에서 어차피 숨긴다** — 나중에 다시 켤 때를 위해 문구는 지금 고쳐 둔다.)

---

## 4. A-3 · 메뉴

### 1) "사업이야기" → "온스토리"

`components/site/chrome.tsx:14` — `{ href: "/our-story", label: "사업이야기" }` → `label: "온스토리"`

같은 이름이 쓰인 다른 곳도 함께(결정 3 대로 **주소는 유지**):

- `chrome.tsx:93` 푸터 회사 열 — `["/our-story", "사업이야기"]` → `["/our-story", "온스토리"]`
- `app/page.tsx:152` — "사업이야기 전문 →" → "**온스토리 이야기 →**"
- `app/our-story/page.tsx:4` `metadata.title` — "사업이야기 — 온스토리" → "**온스토리**"
- `app/our-story/page.tsx:27` `PageHero kicker="사업이야기"` → `kicker="온스토리"`
- `app/our-story/page.tsx:6` 파일 주석 · `components/site/chrome.tsx:8` 파일 주석 — 설명문의 "사업이야기"도 같이(주석이라 화면엔 안 보이지만 다음 사람이 헷갈린다)
- `app/blog/page.tsx:24` "사업이야기 확장판." → "온스토리 이야기 확장판." (블로그 카드 문구)

### 2) "홈페이지 제작업체 vs 온스토리" 메뉴 삭제 + 내용을 온스토리 아래로

**지울 링크 3곳:**

- `components/site/chrome.tsx:69` (모바일 메뉴의 `제작업체 vs 온스토리` 줄) — 줄 삭제
- `components/site/chrome.tsx:94` (푸터 "비교" 열) — 열 전체 삭제하고 `md:grid-cols-[1.4fr_1fr_1fr_1fr]` → `md:grid-cols-[1.4fr_1fr_1fr]` (칸 수가 안 맞으면 레이아웃이 깨진다)
- `components/site/blocks.tsx:131` (`CompareCallout` 안의 버튼) — 링크 목적지를 `/our-story#compare` 로

**옮길 내용:** `app/compare/page.tsx:8~22` 의 `ROWS` 배열(11행)과 그 아래 표 마크업(`24~60` 근처)을 통째로
`app/our-story/page.tsx` 의 **이정표 섹션 아래**에 `<section id="compare">` 로 넣는다.

**남길 것(결정 2 권장안):** `app/compare/page.tsx` 를 아래로 축약한다.

```tsx
import { redirect } from "next/navigation";
/** 메뉴에서 내렸다 — 내용은 /our-story#compare 로 옮겼다 (2026-09-06). 색인된 주소라 404 대신 넘긴다. */
export default function Compare() { redirect("/our-story#compare"); }
```

`app/sitemap.ts:17` 의 `"/compare"` 는 **뺀다**(리다이렉트 주소를 사이트맵에 올리지 않는다).

### 3) 이정표 교체

`app/our-story/page.tsx:8~15` `milestones` 배열을 **통째로** 아래로 바꾼다.

```tsx
const milestones = [
  ["2000.04", "닙스닷컴(nivs.com)으로 사업 시작 — 웹 에이전시 스타트업 · 인터넷 사업 컨설팅 전문"],
  ["2003.02", "일본 진출 — 다수의 웹 컨설팅 사업 진행"],
  ["2004.07", "한중일 문화 교류 '새누리' 온라인 컨설팅 및 팀장 근무 (1986년 시작한 문화 교류 매거진 · saenulee.com)"],
  ["2009.05", "한국 웹 컨설팅 100건 이상 · 일본 기업 웹사이트 개발 100건 이상 진행"],
  ["2021.09", "onstori 초기 모델 구상 — jmake 사업 구상 및 자동화 템플릿 홈페이지 제작 시작"],
  ["2026.08", "브랜드 마케팅 AI 플랫폼 온스토리 오픈 (onstori.com)"],
];
```

⚠ **규칙 7(없는 사실 금지)** 과 `our-story/page.tsx:18` "연차·건수를 지어내지 않는다"는 원칙 때문에,
"100건 이상"은 **회장님이 직접 주신 사실**이라는 점을 커밋 메시지에 남긴다.

⚠ 표시 형식: 지금 `["2026.08.31", …]` 처럼 날짜 길이가 제각각인데 새 목록은 전부 `YYYY.MM` 이라
`grid md:grid-cols-3` 안에서 더 깔끔해진다. 레이아웃 코드는 그대로 두면 된다.

---

## 5. A-4 · "스토리 페이지 들여다보기" 섹션 지금은 가리기

`app/page.tsx:157~183` 의 `<section id="inside">` 전체.

**지우지 않는다.** E-4-부속(온스토리 홈페이지 섹션 보이기/가리기 관리)이 이걸 DB 로 옮길 예정이라,
지금은 **한 줄 스위치**만 넣는다.

```tsx
// app/page.tsx 파일 맨 위, 컴포넌트 밖
/** 첫 페이지 섹션 노출 스위치 — E-4-부속(어드민 섹션 관리)이 들어오면 DB 로 옮긴다. 2026-09-06 회장님 지시로 off. */
const SHOW_INSIDE = false;
```

그리고 157번 줄의 섹션을 `{SHOW_INSIDE && ( … )}` 로 감싼다.

⚠ `SHOW_INSIDE` 가 `false` 상수라 **ESLint/TS 가 "항상 거짓" 경고를 낼 수 있다.**
`const SHOW_INSIDE: boolean = false;` 로 타입을 명시하면 조건이 `boolean` 으로 넓어져 경고가 사라진다.

⚠ 이 섹션에 걸린 앵커가 있는지 확인 — `id="inside"` 를 가리키는 링크는 grep 결과 **없다.** 안전하다.

---

## 6. A-5 · 폰트·자간을 nivs.com 에 맞추기

### nivs.com 이 실제로 쓰는 값 (사실)

```css
@font-face{ font-family:'PretendardLocal';
  src:url('/fonts/PretendardVariable.subset.w400-800.woff2') format('woff2-variations');
  font-weight:400 800; font-style:normal; font-display:swap;
  size-adjust:100%; ascent-override:92%; descent-override:24%; }

--sans:'PretendardLocal','Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,
       "Apple SD Gothic Neo","Segoe UI","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;

body{ font-family:var(--sans); font-size:1.03125rem; line-height:1.75;
      letter-spacing:-.05em; -webkit-font-smoothing:antialiased; word-break:keep-all }
h1,h2,h3,h4{ margin:0; text-wrap:balance }
.hero h1{ font-size:clamp(2.125rem,5.4vw,3.75rem); line-height:1.4; font-weight:700; letter-spacing:-.03em }
.wrap{ max-width:1200px; margin:0 auto; padding:0 24px }
```

nivs.com 의 CSS 주석이 밝힌 결론이 그대로 우리에게도 답이다:
> "폰트 자체가 아니라 **굵기/자간/행간 값이 달랐던 것**이므로 폰트 교체는 되돌림"

### 온스토리 현재값과 차이

| 항목 | nivs.com | 온스토리 (`app/globals.css`) | 조치 |
|---|---|---|---|
| 본문 자간 | `-.05em` | `-0.01em` (53줄) | **`-0.035em` 로** (아래 이유) |
| 제목 자간 | `-.03em` | `-0.03em` (55줄) | 이미 같다 — 변경 없음 |
| 본문 행간 | `1.75` | 미지정(Tailwind 기본 1.5) | `line-height: 1.7` 추가 |
| `word-break` | `keep-all` | `keep-all` (51줄) | 같다 |
| 폰트 스택 | 자체 호스팅 + 폴백 6단 | jsdelivr CDN `@import` + 폴백 4단 | **폴백만 nivs 와 동일하게** (아래) |
| 렌더링 | `-webkit-font-smoothing:antialiased` | `html className="antialiased"` (layout.tsx:21) | 같다 |
| 폭 | `1200px` | `1120px` (82줄) | **바꾸지 않는다** — 레멘토 구조 기준 폭이다(규칙 9 ①) |

**본문 자간을 `-.05em` 이 아니라 `-0.035em` 으로 하는 이유:**
nivs.com 본문은 `1.03125rem`(16.5px)인데 온스토리 본문은 13~15px 구간이 많다.
작은 글자에 `-.05em` 을 걸면 한글 자모가 붙어 읽기 어려워진다. 같은 인상을 주는 값이 `-0.035em` 이다.
**회장님이 "완전히 같게"를 원하시면 `-0.05em` 으로 올린다 — 한 글자만 알려주시면 된다.**

### `app/globals.css` 실제 변경

```css
/* 45~53줄 body 블록 */
body {
  background: var(--paper);
  color: var(--ink);
  /* 폰트 스택·자간은 nivs.com(회장님 자사) 기준에 맞춘다 — 2026-09-06 */
  font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
    "Apple SD Gothic Neo", "Segoe UI", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  letter-spacing: -0.035em;
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

⚠ **폰트 자체 호스팅(woff2 다운로드)은 이번 범위 밖이다.** 지금은 `@import` 로 jsdelivr 에서 받는데,
`@import` 는 CSS 파싱을 멈추고 다른 도메인을 먼저 받게 만들어 첫 화면이 늦다.
nivs.com 은 그래서 자체 호스팅 + `<link rel=preload crossorigin>` 을 쓴다.
**이건 F(모바일 UX) 스프린트에서 성능 항목으로 같이 처리하는 편이 낫다** — 여기서 하면 A 가 커진다.

⚠ 자간을 건드리면 **모든 화면의 줄바꿈 위치가 바뀐다.** 히어로·버튼·표에서 글자가 두 줄로 넘어가지 않는지
첫 페이지 / 온스토리 / 작동방식 / FAQ / 리뷰 / 블로그 6개 화면을 데스크톱·모바일 폭에서 각각 확인한다.

---

## 7. B · 손님 사이트 푸터의 숨겨진 에디터 진입로

### 현재 코드 (사실)

`app/[slug]/page.tsx:67~70`

```tsx
<footer className="px-5 py-10 text-center text-[12.5px]" style={{ color: "var(--s-muted)" }}>
  © {new Date().getFullYear()} {site.doc.businessName} ·{" "}
  <a href="https://onstori.com" className="underline underline-offset-2">Made with 온스토리</a>
</footer>
```

`{site.doc.businessName}` = "하얀세상 도배나라". 여기를 진입로로 만든다.

### 회장님 요구 3가지와 그 답

| 요구 | 답 |
|---|---|
| 상호명을 누르면 그 사이트의 `/edit` 로 | `<Link href={`/${slug}/edit`}>` |
| **커서가 손가락(pointer)으로 바뀌면 안 된다** | `style={{ cursor: "inherit" }}` — `<a>` 는 UA 스타일시트가 `cursor:pointer` 를 주므로 **반드시 덮어써야 한다.** `default` 가 아니라 `inherit` 인 이유: 푸터 위에서 커서가 텍스트 커서(`text`)로 있는 게 주변과 자연스럽다 |
| 로그인 안 했거나 주인이 아니면 "권한 없음" | **이미 있다.** `app/[slug]/edit/ui.tsx:266` — `denied.notFound ? "홈페이지를 찾지 못했어요" : "수정 권한이 없어요"`. 추가 작업 없음 |

### 변경

```tsx
<footer className="px-5 py-10 text-center text-[12.5px]" style={{ color: "var(--s-muted)" }}>
  © {new Date().getFullYear()}{" "}
  {/* 숨은 에디터 진입로 — 손님에겐 그냥 글자로 보여야 하므로 커서·밑줄·색을 바꾸지 않는다.
      /edit 은 robots noindex(app/[slug]/edit/page.tsx:4)라 색인되지 않지만 nofollow 도 붙인다.
      권한 확인은 에디터가 한다(ui.tsx:266 "수정 권한이 없어요"). 여기선 열어만 준다. */}
  <Link href={`/${slug}/edit`} rel="nofollow" tabIndex={-1}
        className="no-underline" style={{ color: "inherit", cursor: "inherit" }}>
    {site.doc.businessName}
  </Link>{" "}
  ·{" "}
  <a href="https://onstori.com" className="underline underline-offset-2">Made with 온스토리</a>
</footer>
```

`import Link from "next/link";` 를 파일 맨 위에 추가한다(현재 `next/navigation` 의 `notFound` 만 있다).

**전례:** nivs.com 푸터에도 같은 성격의 숨은 링크가 있다 —
`<a href="/checkout/" class="f-secret" tabindex="-1" aria-hidden="true"></a>` (`.f-secret{display:block;height:26px}`).
회장님 방식과 어긋나지 않는다.

⚠ `tabIndex={-1}` 을 넣는 이유: 키보드 Tab 으로 순회할 때 상호명에서 멈추면 "여기 링크가 있다"가 드러난다.
⚠ `aria-hidden` 은 **넣지 않는다.** 상호명은 저작권 표시의 일부라 스크린리더가 읽어야 한다.
   (nivs.com 의 `.f-secret` 은 **글자가 없는 빈 블록**이라 `aria-hidden` 이 맞았던 것이고, 우리는 다르다.)

### 미리보기 셸도 같이 볼 것

`app/[slug]/preview/preview-client.tsx:68~71` 에 **같은 푸터가 복제돼 있다.**
여기엔 **넣지 않는다** — 미리보기는 이미 에디터 안이라 진입로가 필요 없다.
다만 위 커밋에서 두 파일의 푸터 문구가 갈라지지 않도록 **눈으로 대조**한다(로고 오버레이가 한쪽에만 있는 전례가 있다).

### `/edit` 상단 로그아웃 버튼

회장님 요구: "`/edit` 진입 시 상단에 로그아웃 버튼."

**이미 만들어 둔 컴포넌트가 있다** — `app/my/ui.tsx` 의 `LogoutButton`
(주석: "세션 쿠키는 @supabase/ssr 가 httpOnly 없이 심으므로 브라우저 클라이언트로 지울 수 있다 — 별도 API 불필요").

새로 만들지 말고 그대로 가져다 쓴다:

- `app/[slug]/edit/ui.tsx` 상단 바(`ui.tsx:356~366`, `data-tour="score-bar"` 와 `data-tour="btn-publish"` 가 있는 줄)에
  `btn-publish` **오른쪽**에 붙인다.
- ⚠ **`data-tour` 앵커를 새로 만들지 않는다**(규칙 3). 로그아웃 버튼에는 `data-tour` 를 달지 않는다.
- ⚠ **`btn-publish` 를 감싸거나 옮기지 않는다.** 투어가 그 앵커를 가리킨다.
- 만료 차단 화면(`ui.tsx:300` 이후)에도 로그아웃이 보여야 하는지는 회장님 결정 사항이 아니라 판단 사항 —
  **보이게 한다**(다른 계정으로 잘못 로그인한 사장님의 유일한 탈출구다).

---

## 8. 배선 점검 — 이 커밋에서 함께 봐야 하는 곳

| # | 확인 | 이유 |
|---|---|---|
| 1 | `app/sitemap.ts` | `/compare` 제거 |
| 2 | `components/site/chrome.tsx` `NAV` 배열 | 라벨 변경이 5개 페이지 헤더에 동시에 반영된다 |
| 3 | 각 페이지의 `<SiteHeader current="…" />` | `current` 는 **href 로 비교**한다(`chrome.tsx:50`). 라벨만 바꿨으므로 손댈 필요 없다 |
| 4 | `app/globals.css` | 색 토큰은 **건드리지 않는다**(규칙 9 ②) |
| 5 | `config/tours.ts` | 이번 작업에서 **앵커 추가·삭제 없음**. 파일을 열 일이 없다 |
| 6 | `lib/schema.ts` | 이번 작업에서 **스키마 변경 없음**(규칙 2 해당 없음) |
| 7 | `npm run build` | 자간 변경 후 레이아웃 경고가 아니라 **타입·린트**만 본다. 레이아웃은 눈으로 |

---

## 9. 완료 조건 (전부 통과해야 커밋)

1. `npm run build` 성공, ESLint 경고 0.
2. 첫 페이지에서 히어로가 **"홈페이지는 빈 집입니다."** 로 보인다.
3. 브라우저 탭 아이콘이 **초록 ON 마크**다(Next.js 기본 아이콘이 아니다).
4. 아이폰 사파리 → 공유 → "홈 화면에 추가" 에서 **흰 바탕 ON 아이콘**이 뜬다.
5. 안드로이드 크롬 → "홈 화면에 추가" 에서 **초록 바탕 ON 아이콘**이 뜬다.
6. 채널 띠 6개 아이콘이 **전부 같은 크기(18px)** 이고, "온스토리 홈페이지" 앞이 **동그라미가 아니라 로고**다.
7. 상단 메뉴가 **작동방식 · 온스토리 · 자주묻는질문 · 리뷰 · 블로그** 5개다("사업이야기" 없음).
8. 상단·모바일 메뉴·푸터 어디에도 **"홈페이지 제작업체 vs 온스토리"** 가 없다.
9. `/compare` 로 가면 `/our-story#compare` 로 넘어가고, 그 자리에 11행 비교표가 있다.
10. 온스토리 페이지 이정표가 **2000.04 로 시작해 2026.08 로 끝난다**(6줄).
11. 첫 페이지에 **"스토리 페이지 들여다보기"** 섹션이 안 보인다.
12. 문서 전체에서 `가로 영상`·`세로 영상`·`세로/가로 두 판`·`사장님가게` 가 **grep 으로 0건**이다.
13. `grep -rn "쓰레드·X·" app components` 가 **0건**이다(전부 `X(트위터)`).
13-1. `grep -rn "온스토리 블로그\|온스토리 홈페이지 블로그" app components config` 가 **0건**이다(전부 `온스토리 사이트`).
14. 손님 사이트 푸터에서 **상호명 위에 마우스를 올려도 커서가 손가락으로 바뀌지 않는다.**
15. 그 상호명을 클릭하면 `/{slug}/edit` 로 가고, 로그인 안 한 상태면 **"수정 권한이 없어요"** 가 뜬다.
16. `/{slug}/edit` 상단에 **로그아웃** 버튼이 있고, 누르면 로그인 화면으로 돌아간다.
17. 발행된 기존 손님 사이트 3곳이 그대로 렌더된다(**푸터 변경이 `lib/sites.ts:47` 의 `SiteDoc.parse` 와 무관함을 확인**).

---

## 10. 이번 범위 밖 (하지 않는다)

- 색 토큰 변경 — 규칙 9 ② 는 이미 반영됐다.
- `app/[slug]` 라우팅·슬러그 규칙 변경.
- 폰트 자체 호스팅(woff2 저장소 반입) — **F 스프린트로 미룬다.**
- `.wrap` 폭 1120 → 1200 — 레멘토 구조 기준이라 유지.
- 모바일 햄버거 개편·플로팅 위젯 재설계·푸터 고급화 — **전부 F 스프린트.**
- 어드민 화면 — **E 스프린트.**
- "14일 이후 자동 삭제" 문구 7곳 — **회장님이 그대로 두라고 하셨다(결정 1).**
- **개인정보처리방침·이용약관 페이지** — 급한 건이라 별도 번들 `handoff/2026-09-06-legal-pages/` 로 분리했다. A 를 기다리지 않고 먼저 배포할 수 있다.

---

## 11. 커밋

한 커밋으로 묶는다(문구·메뉴·아이콘은 서로 얽혀 있어 나누면 중간 상태가 어색해진다).

```
feat: 문구·메뉴 정리 + 브랜드 아이콘 + 손님 사이트 숨은 에디터 진입로

- 히어로 "빈 집" 확정, 가로/세로 영상 표현 제거, X → X(트위터), onstori.com/name
- "온스토리 블로그/홈페이지 블로그" → "온스토리 사이트" (고객사 자기 사이트의 이야기 섹션)
- 메뉴: 사업이야기 → 온스토리, 제작업체 비교 메뉴 내림(/compare → /our-story#compare)
- 이정표를 2000년 닙스닷컴부터의 실제 연혁으로 교체
- 파비콘·iOS·안드로이드 아이콘 + manifest (Next.js 파일 규약)
- 채널 띠: 온스토리 초록 원 → 로고, 아이콘 20→18px
- 본문 자간 -0.01em → -0.035em (nivs.com 기준)
- 손님 사이트 푸터 상호명 = 숨은 /edit 진입로 (커서 변화 없음), /edit 상단 로그아웃

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
