# PERFORMANCE.md — 속도 규칙

확정 2026-09-06 (회장님 지시서).

## 목표 (모바일 기준)

| 지표 | 목표 | 뜻 |
|---|---|---|
| **LCP** | **1.8초** | 가장 큰 것(대개 히어로 사진)이 보이기까지 |
| **INP** | **150ms** | 눌렀을 때 화면이 반응하기까지 |
| **CLS** | **0.02** | 로딩 중 화면이 튀는 정도 (0에 가까울수록 좋다) |

첫 페이지 First Load JS **170KB 이하**.

---

## 1. 사진

- **히어로만** `next/image` + `priority` + `fetchPriority="high"`. **lazy 금지.**
  히어로는 LCP 요소다 — 늦게 부르면 그만큼 점수가 그대로 늦어진다.
- 히어로에 `.reveal`(fade-up)을 붙이지 않는다 — 투명하게 시작하면 LCP 가 늦게 찍힌다 (MOTION.md).
- **나머지 사진은 전부 lazy** + `width`/`height` 또는 `aspect-ratio` 고정.
  비율이 없으면 사진이 들어오는 순간 아래 내용이 밀린다(CLS).
- AVIF 우선, WebP 대체. `sizes` 로 폰에는 폰 크기만 내려보낸다 —
  `sizes` 를 안 주면 1920px 원본이 390px 화면으로 내려간다.
- 사진 카드는 4:3 고정(`.photo`).

## 2. 자바스크립트

- **지도 · 챗봇 · PayModal · 토스 SDK 는 `next/dynamic`** 으로 첫 화면 번들에서 분리한다.
  넷 다 "손님이 특정 행동을 해야" 쓰이는 것들이라 첫 화면에 있을 이유가 없다.
- 외부 스크립트는 `next/script` 의 `afterInteractive` 또는 `lazyOnload`.

## 3. 캐시

- **`[slug]` 는 ISR `revalidate 60`.** 손님 사이트는 매 요청마다 DB 를 볼 필요가 없다.
  발행 시 `revalidatePath` 로 즉시 갱신한다 — 이 둘은 **한 쌍이다.**
  revalidatePath 가 없으면 사장님이 발행하고도 최대 60초 동안 옛 화면을 본다.
- **R2 이미지 `Cache-Control: public, max-age=31536000, immutable`** (`lib/storage.ts`).
  키가 UUID 라 같은 주소의 내용이 바뀌지 않는다 — 다시 물어볼 이유가 없다.
  ⚠ 서명 PUT URL 에는 넣지 않는다. 서명에 포함돼 브라우저가 같은 헤더를 보내야만 성공한다.

## 4. 글꼴

- **Pretendard Variable 자체 호스팅** (`app/fonts.css`, `public/fonts/pretendard/`).
  `unicode-range` 로 92조각이라 브라우저는 실제 쓰는 3~6조각(100KB 안팎)만 받는다.
  `ascent-override: 92%` — 라틴 메트릭 그대로면 한글 행간이 뜬다.
- **Noto Serif KR 은 `next/font/google`** (app/layout.tsx). 빌드 때 내려받아 자체 호스팅한다.
  ⚠ 전에는 `globals.css` 의 `@import` 였다 — CSS → 구글 CSS → 폰트 파일로 이어지는
  **렌더 차단 사슬**이라 LCP 를 그대로 늦춘다. 폰트를 `@import` 로 부르지 않는다.
- 세리프는 `preload: false`. 한글 글리프가 커서 미리 받으면 히어로 사진과 대역폭을 다툰다.
  제목은 폴백 명조로 먼저 그려지고 곧 바뀐다.

## 5. CLS (화면이 튀지 않게)

- 상단 프로모 띠 · D-day 띠는 **높이를 CSS 로 고정**한다. 조건부로 나타나면 아래가 통째로 밀린다.
- 모든 사진에 비율 고정.
- 폰트는 `display: swap` — 글자가 안 보이는 구간을 만들지 않는다.

## 6. 확인 방법

```bash
npm run build      # First Load JS 확인
```

Lighthouse 는 모바일 프리셋으로 **첫 페이지**와 **손님 샘플 사이트(`/sample-interior`)** 두 곳을 잰다.
