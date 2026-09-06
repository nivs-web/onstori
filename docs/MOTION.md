# MOTION.md — 움직임 규칙 v5

확정 2026-09-07 (회장님 v5 지시서). **여기 없는 애니메이션은 만들지 않는다.**
시간·곡선의 단일 출처는 `app/globals.css` 의 `--dur-*` · `--ease*` · `--hv-*` · `--enter-*` 다.

---

## 0. 제일 중요한 것 — 등장과 조작의 시간을 반대로 쓰지 마라

이걸 뒤집으면 화면이 통째로 싸구려가 된다.

| | 시간 | 곡선 | 움직이는 양 |
|---|---|---|---|
| **등장** (섹션·카드가 처음 나타날 때) | **700ms** | `cubic-bezier(.25,.46,.45,.94)` (`--ease`) | 28px 아래에서 위로 |
| **조작** (버튼·입력·토글을 누를 때) | **120~200ms** | `cubic-bezier(.2,.8,.2,1)` (`--ease-ui`) | 1~2px 또는 색만 |

- 등장이 200ms 면 툭툭 튀어나와 급해 보인다.
- 조작이 700ms 면 눌러도 반응이 없는 것처럼 느껴진다.
- **카드 사이 순차 등장은 90ms 씩, 최대 6개까지.** 그 뒤는 같은 지연 —
  일곱 번째 카드부터 계속 기다리게 만들지 않는다. (`.reveal-stagger`)
- **등장은 한 번만.** 스크롤을 되돌려도 다시 재생하지 않는다.

---

## 1. 호버 — 사진이 있는 곳에만

| 대상 | 무엇 | 시간 |
|---|---|---|
| 카드 | 8px 떠오름 + `--hv-shadow` + 테두리 사라짐 | **300ms** (`--hv-d-card`) |
| 카드 안 사진 | `scale(1.08)` | **400ms** (`--hv-d-img`) |
| 전폭 사진 | `scale(1.04)` — 약하게 | 400ms |

곡선은 `--ease-hover` = `cubic-bezier(.25,.8,.25,1)`.

- **사진만 커진다.** 카드를 키우면 옆 카드를 밀어 레이아웃이 흔들린다.
- 부모에 `overflow: hidden` 이 없으면 사진이 카드 밖으로 삐져나온다.
- **카드 300 / 사진 400 으로 시간을 다르게** — 같으면 움직임이 납작하다.
- **미적용**: 히어로 · 로고 · 아이콘.
- **폰에서는 호버를 흉내 내지 않는다.** `@media (hover: hover) and (pointer: fine)` 로
  감쌌고, 손가락 화면은 `:active` 에 `scale(0.98)` 120ms 만 준다.

---

## 2. 그 밖에 허용되는 것

| 무엇 | 어떻게 | 구현 |
|---|---|---|
| 버튼 눌림 | `translateY(1px)` 120ms | `.btn:active` |
| 상단 바 | 투명 → 불투명 200ms | 헤더의 transition |
| 시트 열림 | 320ms `--ease-spring` | `.sheet-open` |
| 시트 안 목록 | 24ms 씩 순차(최대 6개) | `.sheet-item` |
| 사진 blur-up | 300ms | `.blur-up` |
| 상태 토스트 | fade-in 120ms → 2초 → fade-out 200ms | `.toast` |
| FAQ +/− | 세로 막대가 사라져 − 가 된다 200ms | `.plusminus` |
| 진행 바 | `scaleX` 320~480ms | (위저드) |

## 3. 금지 (하나도 예외 없다)

패럴랙스 · 스크롤 잭킹 · 글자 타이핑 · 숫자 카운트업 · **자동 슬라이드(히어로 포함)** ·
무한 루프(`animate-pulse` 등) · 마우스 따라다니는 커서 · 3D 기울기 카드 · 로딩 스플래시

---

## 4. 등장은 CSS 만으로

```css
.reveal { opacity: 1 }
@supports (animation-timeline: view()) {
  .reveal {
    animation: enter-up var(--enter-d) var(--ease) both;
    animation-timeline: view();
    animation-range: entry 0% entry 45%;
  }
}
@keyframes enter-up {
  from { opacity: 0; transform: translateY(var(--enter-y)) }
  to   { opacity: 1; transform: none }
}
```

⚠ **`@supports` 로 감싸지 않으면 미지원 브라우저에서 전 섹션이 로드 즉시 깜빡인다.**
`animation-timeline` 을 모르는 브라우저는 애니메이션을 그냥 재생해 버리기 때문이다.
바깥의 `.reveal{opacity:1}` 이 그 브라우저의 최종 상태다 — 움직임 없이 그냥 보인다.

⚠ **IntersectionObserver 폴리필을 넣지 않는다.** 스크롤마다 JS 가 도는 비용이
움직임의 값어치보다 크다.
(예외: `components/phone-frame.tsx` 의 IntersectionObserver 는 **애니메이션이 아니라
늦게 불러오기**다 — 손님 사이트 iframe 을 화면에 들어올 때만 붙인다.)

⚠ **히어로에는 `.reveal` 을 붙이지 않는다.** LCP 요소를 투명하게 시작시키면
Largest Contentful Paint 가 그만큼 늦게 찍힌다.

---

## 5. 두 가지 전역 원칙

**1. 움직이는 건 `transform` 과 `opacity` 만.**
`width` · `height` · `top` · `left` 애니메이션 금지 — 매 프레임 레이아웃을 다시 계산해 끊긴다.
진행 바도 `width` 가 아니라 `scaleX` 로 움직인다.

**2. `prefers-reduced-motion: reduce` 면 전부 멈춘다.**
`globals.css` 에서 전역으로 `animation-duration`·`transition-duration` 을 `.01ms` 로 막았다.
개별 컴포넌트에서 다시 처리할 필요 없다.
