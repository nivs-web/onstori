/**
 * 🔴 **숏폼 화면의 아이콘 아홉 개.** (2026-09-17 지시 [49]① · 권반장 규격서 `15-인스타릴스-UI정밀해부.md` §3)
 *
 * ## 왜 이모지를 떼는가
 *
 * 전에는 `🔊 🔇 ✕ ⌃ ⌄ ‹ ›` 를 **글자로** 찍었다. 글자라서 **기기가 제 마음대로 그린다** —
 * 아이폰·안드로이드·윈도우가 **서로 다른 그림**을 보여 주고, 🔊 는 기기에 따라 **색깔 이모지**로
 * 나와 검은 배지 위에서 혼자 튄다. `⌃⌄` 는 이모지가 아니라 **기호 글자**라 글꼴이 없는 기기에서
 * **네모(□)로 깨진다.**
 * ⇒ **우리가 그린 그림으로 바꾸면** 어느 기기에서나 **같은 모양·같은 색**이 나온다.
 *
 * ## ⚠ 크기를 여기에 적지 않는다 — `1em` 이다
 *
 * 각 단추의 크기는 **이미 `app/globals.css` 에 `font-size` 로 적혀 있다**
 * (`.world-sound`/`.world-x` 22px · `.stage-sound` 26px · `.world-arrow` 20px …).
 * 그래서 그림을 **`1em`** 으로 그린다 — **그 `font-size` 가 그대로 그림 크기가 된다.**
 * 🔴 여기에 `width="22"` 같은 숫자를 박으면 **크기가 적힌 자리가 두 곳**이 되고,
 *   CSS 만 고친 다음 사람이 「왜 안 바뀌지」 하게 된다. **한 곳에만 둔다.**
 *
 * ## ⚠ 저작권 — 베낀 것이 아니다
 *
 * 권반장 규격서 §2 의 판단을 그대로 따른다. 인스타·유튜브의 **소스코드를 가져온 것이 아니라**
 * 원·직선·곡선으로 **새로 그린 것**이다. 🔴 **로고(인스타·유튜브 마크)는 그리지 않는다** —
 * 그건 상표라 따라 그리면 안 된다(권반장 지시).
 *
 * ## ⚠ 이 규격의 숫자는 «공식»이 아니다
 *
 * 권반장이 못을 박아 두셨다 — **인스타의 공식 수치는 찾지 못했고, 위 값들은 «추정»이다.**
 * 그러니 이 값이 「인스타와 같다」고 말하지 않는다. **우리 화면에서 보기 좋은 값**일 뿐이다.
 *
 * ## ⚠ ⑤하트·⑥말풍선은 «아직 화면에 안 붙는다»
 *
 * 대표님이 **「아홉 개를 각각 그리라」**고 하셔서 아홉 개를 다 그렸다. 다만 ⑤⑥ 이 들어갈
 * 리액션 막대는 **[49]③** 이고, 숫자를 가져오는 일은 **[46]** 뒤다. 그때 이 둘을 쓴다.
 * 🔴 그때도 **0 이면 숫자를 아예 안 그린다** — 「♡ 0」은 「아무도 안 좋아했다」로 읽힌다(권반장).
 *
 * ★ ③④(⌃⌄)와 ⑧⑨(‹›)는 **같은 도형을 90도 돌린 것**이라 하나로 합칠 수도 있었다.
 *   합치지 않은 이유는 **대표님이 「아홉 개를 각각 그리라」**고 명시하셨기 때문이다.
 *   (합치면 파일은 줄지만, 나중에 한쪽 모양만 손볼 때 둘 다 흔들린다.)
 */

type P = { className?: string };

/** 모든 아이콘이 함께 쓰는 값 — `1em`(위 주석) · 색은 부모 글자색을 따른다 */
const base = {
  viewBox: "0 0 24 24",
  width: "1em",
  height: "1em",
  fill: "none",
  "aria-hidden": true,
  /* ⚠ `focusable="false"` — 옛 IE/엣지가 SVG 를 **탭 순서에 끼워 넣는다.**
     그러면 손님이 Tab 을 눌렀을 때 «단추» 가 아니라 «그림» 에 초점이 가서 한 번 헛돈다. */
  focusable: "false",
} as const;

/** ① 소리 켜짐 */
export function IconSoundOn({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.5v5h3.2L12 18V6L7.2 9.5H4z" fill="currentColor" />
      <path d="M16 8.5c1.3 1 1.3 6 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.6 6.4c2.7 2.3 2.7 8.9 0 11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** ② 소리 꺼짐 — 사선(✕)으로 막는다. 대표님 캡처①과 같은 모양 */
export function IconSoundOff({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.5v5h3.2L12 18V6L7.2 9.5H4z" fill="currentColor" />
      <path d="M16.3 9.3l5.4 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21.7 9.3l-5.4 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** ③ 위 화살표 (옛 `⌃`) */
export function IconChevronUp({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ④ 아래 화살표 (옛 `⌄`) */
export function IconChevronDown({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * ⑤ 하트(빈 것) — **[49]③ 에서 쓴다. 아직 화면에 없다**(위 주석).
 * ⚠ 우리 화면의 하트는 **누르는 단추가 아니라 «숫자를 보여주는 표시»** 라 **항상 빈 하트**다.
 *   채운 하트(`fill`)는 「내가 좋아요를 눌렀다」는 뜻인데, 손님은 여기서 누를 수 없다.
 */
export function IconHeart({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 20.1c-.3 0-.6-.1-.8-.3-1.6-1.3-3.1-2.5-4.4-3.7-2-1.8-3.6-3.5-4.5-5.3C1.5 8.7 2 6.2 4 4.9c1.8-1.2 4.1-.9 5.6.7l2.4 2.5 2.4-2.5c1.5-1.6 3.8-1.9 5.6-.7 2 1.3 2.5 3.8 1.7 5.9-.9 1.8-2.5 3.5-4.5 5.3-1.3 1.2-2.8 2.4-4.4 3.7-.2.2-.5.3-.8.3z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
    </svg>
  );
}

/** ⑥ 말풍선(댓글) — **[49]③ 에서 쓴다. 아직 화면에 없다**(위 주석) */
export function IconComment({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path
        d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v9A1.5 1.5 0 0 1 20 17.5H9.4L5 21v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
    </svg>
  );
}

/** ⑦ 닫기 (옛 `✕`) */
export function IconClose({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** ⑧ 왼쪽 화살표 (옛 `‹`) */
export function IconChevronLeft({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ⑨ 오른쪽 화살표 (옛 `›`) */
export function IconChevronRight({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
