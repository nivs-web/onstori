# MOTION.md — 허용된 움직임 8가지

확정 2026-09-06 (회장님 지시서). **여기 없는 애니메이션은 만들지 않는다.**
시간·곡선의 단일 출처는 `app/globals.css` 의 `--dur-*` · `--ease*` 다.

---

## 허용 8가지

| # | 무엇 | 어떻게 | 구현 |
|---|---|---|---|
| ① | 섹션 등장 | fade-up (opacity 0→1 + translateY 12px→0) **200ms** | `.reveal` |
| ② | hover | 색·테두리·그림자 **200ms** | `.btn` `.card` 의 transition |
| ③ | 버튼 눌림 | `translateY(1px)` **120ms** | `.btn:active` |
| ④ | 시트 열림 | **320ms** `--ease-spring` | `.sheet-open` |
| ⑤ | 시트 안 목록 | **24ms 씩 순차** (최대 6개까지, 그 뒤는 같은 지연) | `.sheet-item` |
| ⑥ | 상단 바 | 투명→불투명 **200ms** | 헤더의 transition |
| ⑦ | 사진 | blur-up **300ms** | `.blur-up` |
| ⑧ | 상태 토스트 | fade-in 120ms → 2초 유지 → fade-out 200ms | `.toast` |

## 금지 (하나도 예외 없다)

패럴랙스 · 스크롤 잭킹 · 글자 타이핑 · 숫자 카운트업 · **자동 슬라이드(히어로 포함)** ·
무한 루프 · 마우스 따라다니는 커서 · 3D 기울기 카드 · 로딩 스플래시

---

## 섹션 등장은 CSS 만으로

```css
.reveal { opacity: 1 }
@supports (animation-timeline: view()) {
  .reveal {
    animation: fade-up var(--dur-2) var(--ease) both;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px) }
  to   { opacity: 1; transform: none }
}
```

⚠ **`@supports` 로 감싸지 않으면 미지원 브라우저에서 전 섹션이 로드 즉시 깜빡인다.**
`animation-timeline` 을 모르는 브라우저는 애니메이션을 그냥 재생해 버리기 때문이다.
바깥의 `.reveal{opacity:1}` 이 그 브라우저의 최종 상태다 — 움직임 없이 그냥 보인다.

⚠ **IntersectionObserver 폴리필을 넣지 않는다.** 스크롤마다 JS 가 도는 비용이
움직임의 값어치보다 크다. 미지원 브라우저는 움직임 없이 보면 된다.

⚠ **히어로에는 `.reveal` 을 붙이지 않는다.** LCP 요소를 투명하게 시작시키면
Largest Contentful Paint 가 그만큼 늦게 찍힌다.

---

## 두 가지 전역 원칙

**1. 움직이는 건 `transform` 과 `opacity` 만.**
`width` · `height` · `top` · `left` 애니메이션 금지 — 매 프레임 레이아웃을 다시 계산해 끊긴다.

**2. `prefers-reduced-motion: reduce` 면 전부 멈춘다.**
`globals.css` 에서 전역으로 `animation-duration`·`transition-duration` 을 `.01ms` 로 막았다.
개별 컴포넌트에서 다시 처리할 필요 없다.
