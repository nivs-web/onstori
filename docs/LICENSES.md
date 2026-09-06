
## Pretendard Variable v1.3.9 (2026-09-06 자체 호스팅으로 전환)

- 출처: https://github.com/orioncactus/pretendard
- 라이선스: **SIL Open Font License 1.1** — 웹 자체 호스팅·상업적 사용 허용, 폰트 자체 판매만 금지.
- 파일: `public/fonts/pretendard/PretendardVariable.subset.{0..91}.woff2` (dynamic subset 92개, 합계 약 2.9MB).
  브라우저는 `unicode-range` 에 따라 실제 쓰는 조각(보통 3~6개, 100KB 안팎)만 받는다.
- @font-face 정의: `app/fonts.css` (`ascent-override: 92%`).
- 전에는 jsDelivr CDN 을 `globals.css` 에서 `@import` 했다 — 렌더 차단 사슬이라 LCP 를 늦춘다(docs/PERFORMANCE.md).

## Noto Serif KR (제목용)

- 출처: Google Fonts. 라이선스: **SIL Open Font License 1.1**.
- `next/font/google` 이 빌드 시점에 내려받아 자체 호스팅한다 (`app/layout.tsx`).
