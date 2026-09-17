"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShortT } from "@/lib/shorts";
import { SNS_LABEL, SNS_DOT, pillLinks } from "./sns-brand";
import { STAGE_MAX } from "@/config/shorts";

/**
 * 🔴 **숏폼 무대** — 히어로 바로 아래에서 화면이 «까맣게» 덮이는 자리. (2026-09-17 지시 [19]①)
 *
 * > **대표님:** 「여긴 그냥 평범한 회사 홈페이지인데, 히어로 섹션 아래 바로 숏폼 재생창이 있네?
 * >   이건 뭐야? **이렇게 놀라게 하자.**」
 * >   「히어로 섹션 아래로 내려가면 **화면이 다 까맣게 변하면서**, 스크롤을 히어로의 **2배 이상**
 * >   내리지 않으면 그 섹션에 머물게 못할까? … **모바일에선 틱톡·쇼츠·릴스처럼 보이게.**」
 *
 * ★★ **「가두는」 느낌의 정체는 CSS 두 줄이다 — JS 가 스크롤을 «훔치지» 않는다.**
 *   · 바깥 상자의 높이를 **`(편수+1) × 100svh`** 로 준다 → 그만큼 굴려야 이 구역을 벗어난다
 *   · 안쪽을 **`position: sticky`** 로 붙인다 → 굴리는 동안 화면에 머문다
 *   ⚠ **스크롤 잭킹(JS 로 스크롤을 가로채기)은 하지 않는다.** `docs/MOTION.md` 금지 목록이고,
 *     무엇보다 **뒤로 가기·검색·스크롤바가 전부 망가진다.** 브라우저의 스크롤은 손님 것이다.
 *
 * ★★ **그래서 `prefers-reduced-motion` 을 «CSS 한 줄»로 끌 수 있다.**
 *   가두기가 CSS 라서, 그 설정을 켠 손님에게는 높이를 `auto` 로 되돌리기만 하면
 *   **평범한 세로 목록**이 된다(`app/globals.css` 의 `.stage` 규칙). 화면이 깜빡이지 않는다.
 *
 * 🔴 **반드시 지킨 것 여섯** (지시 ②)
 *   ① **［건너뛰기 ↓］를 «항상» 띄운다** — 가두기만 하면 나간다. 탈출구가 보여야 안심하고 본다
 *   ② **음소거로 시작** — 갑자기 사장님 목소리가 나면 그 자리에서 나간다(2026-09-10 회장님).
 *      ⚠ `muted` 를 빼면 브라우저가 재생 자체를 막는다 — 기능이 조용히 죽는다
 *   ③ **`prefers-reduced-motion` 존중** — 가두지 않고, **자동재생도 안 한다**(직접 누르는 재생바를 준다)
 *   ④ **영상이 0편이면 이 컴포넌트를 아예 안 그린다**(부르는 쪽에서 막는다)
 *   ⑤ **영상 없는 사이트에는 이 JS 가 한 바이트도 안 간다** — `"use client"` 를 이 파일에만 둔다
 *   ⑥ **PC 에서도 9:16** — 좌우는 검게 두고 가운데만 세로로. **가로로 늘리지 않는다**
 */


/** 손가락이 이만큼은 움직여야 «넘긴 것»으로 본다. 너무 작으면 살짝 흔들려도 넘어간다 */
const SWIPE_PX = 48;
/** 「탭하면 소리」를 띄워 두는 시간. 2~3초 — 읽히되 거슬리지 않는 선(권반장 지시 [31]①) */
const HINT_MS = 2800;

export default function ShortsStage({ items, anchorId, title }: { items: ShortT[]; anchorId?: string; title: string }) {
  /**
   * 🔴🔴 **«가두는» 무대는 앞 12편까지.** (2026-09-17 지시 [39] · 조사 8-2 ④)
   *
   * ⚠ 무대 높이는 **`(편수 + 1) × 화면 하나`**다. 편수만큼 늘리면
   *   **1000편에서 81만px** 가 되어 **스크롤바가 못 쓰게 된다.**
   * ⇒ 무대는 **13화면으로 고정**하고, 나머지는 **「숏폼피드 세상」(전체화면)**에서 이어 본다.
   *   세상은 **한 편씩만** 그리므로 편수가 늘어도 높이가 안 늘어난다.
   * ★ 🔴 **「세상」에는 «전부» 넘긴다.** 무대에서 잘린 것은 **못 보는 게 아니라 거기 있다.**
   */
  const staged = items.length > STAGE_MAX ? items.slice(0, STAGE_MAX) : items;
  const [active, setActive] = useState(0);
  const [loud, setLoud] = useState(false);
  /**
   * 🔴 **「탭하면 소리」 힌트** — 첫 편에서 잠깐만. (2026-09-17 대표님 지시 [31]①)
   *   대표님: 「소리 부분이 좀 걱정이야.」
   *   ⚠ 지금은 작은 아이콘뿐이라 **누를 생각이 안 납니다**(권반장). 그래서 **말로** 한 번 알려 준다.
   *   ⚠ 무대에 **들어왔을 때부터** 세고, 소리를 켜면 그 자리에서 사라진다.
   */
  const [hint, setHint] = useState(false);
  /**
   * 🔴 **PC — 마우스를 «올리면» 소리 안내가 다시 뜬다.** (2026-09-17 대표님 지시 [31]③)
   *
   * > 대표님: 「pc에선 마우스가 있으니깐 **마우스를 올리기만 해도 소리** 나오면 안 됨?」
   *
   * ⚠⚠ **«소리를 저절로 켜는 것»은 안 했습니다. 이유 둘 — 보고서에 적었습니다:**
   *   ① **2026-09-10 회장님 결정과 정면으로 부딪칩니다** — 「손님이 들어왔는데 **갑자기
   *      사장님 목소리가 나면 그 자리에서 나간다**」. 마우스가 «지나가기만» 해도 소리가 나면
   *      그건 손님이 **원한 적 없는 소리**입니다. 우리가 막으려던 바로 그 일입니다.
   *   ② **브라우저가 막을 수 있습니다.** 「손님이 한 번도 안 눌렀으면 소리를 못 켠다」가
   *      정책인데, 그 판정은 브라우저마다 다릅니다(사파리가 특히 엄격합니다).
   *      제가 잰 것은 **헤드리스 크롬**이라 **진짜 손님 브라우저의 답이 아닙니다.**
   *
   * ⇒ 대신 **「🔇 탭하면 소리가 나요」를 다시 띄웁니다.** 마우스를 올리면 «권하고»,
   *   켜는 것은 **손님이 한 번 누르는 것**으로 둡니다. 놀라게 하지 않으면서 길은 보입니다.
   */
  const [hover, setHover] = useState(false);
  /**
   * 🔴🔴 **「숏폼피드 세상」** — PC 에서 «클릭»하면 전체화면으로 확 열린다. (2026-09-17 지시 [33])
   *
   * > **대표님:** 「pc에서도 **클릭 한번 하면, 틱톡이나 인스타 온 것처럼 전체화면으로 확 바뀌면서
   * >   숏폼 피드 속으로 들어간 것처럼** … 이 재생 창 자체를 **통으로 하나의 세상**으로 만든다면?
   * >   그러면 **7편이면 7편 전부** 소리가 나오게 할 수 있지 않을까?」
   *
   * ★ **왜 «호버»가 아니라 «클릭»인가**(권반장 판단 · 대표님 승인):
   *   스크롤하다 마우스가 **지나가기만** 해도 나는 소리는 **손님이 원한 적 없는 소리**이고
   *   2026-09-10 회장님 결정과 정면으로 부딪칩니다. **클릭은 「보고 싶다」는 뜻이 분명**하고,
   *   브라우저도 **그때부터** 소리를 허용합니다.
   *
   * ⚠ **폰은 지금 그대로**입니다(대표님: 「폰은 이대로 좋아」). 여기는 **마우스가 있는 기기만** 엽니다.
   */
  const [world, setWorld] = useState<number | null>(null);
  /** 멀미를 싫어하는 손님인가 — 레이아웃은 CSS 가 맡고, 여기서는 **자동재생만** 끈다 */
  const [calm, setCalm] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const vids = useRef(new Map<string, HTMLVideoElement>());
  const touchY = useRef<number | null>(null);

  /**
   * 🔴🔴 **창 밖으로 나가는 영상은 «재생기를 반납»시킨다.** (2026-09-17 지시 [38] · 조사 8-2 [3])
   *
   *   크롬은 한 화면에 살아 있는 영상 재생기를 **폰 40개 · PC 75개**까지만 허용한다.
   *   넘으면 「Blocked attempt to create a WebMediaPlayer」와 함께 **조용히 검은 화면**이 된다.
   *   ⚠ `pause()` 만으로는 **반납되지 않는다.** 아래 세 줄이 있어야 크롬이 놓는다 —
   *     `app/rec/[slug]/rec-client.tsx` 가 이미 같은 일을 하고 있다.
   */
  const setVid = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) vids.current.set(id, el); else vids.current.delete(id);
  }, []);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setCalm(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  /* ★ 지금 «몇 번째»인지 — **화면 한가운데를 품고 있는 눈금**이 그 편이다.
     ⚠ 스크롤 위치를 손으로 계산하지 않는다 — 주소창이 접히는 폰에서 그 계산은 늘 어긋난다.
     ⚠⚠ **2026-09-17 실측으로 고친 것:** 처음에는 `rootMargin: "-50% 0px -50% 0px"` 로
       한가운데 «선»을 만들고 거기 걸리는 눈금을 썼다. 그런데 그 띠는 **높이가 0** 이라
       겹치는 넓이가 0 이고, 브라우저는 그것을 **「안 겹쳤다」로 본다** — 그래서 편이
       **영원히 1/7** 이었다(실측). 띠에 두께를 주고, 걸린 뒤에는 **직접 재서** 고른다. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const steps = [...root.querySelectorAll<HTMLElement>("[data-step]")];
    if (!steps.length) return;
    const pick = () => {
      const mid = window.innerHeight / 2;
      let best = 0;
      steps.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) best = i;
      });
      setActive(best);
    };
    /* 관찰기는 «무언가 지나갔다»는 신호로만 쓴다. 고르는 것은 위의 `pick` 이 잰다 */
    const io = new IntersectionObserver(pick, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    for (const el of steps) io.observe(el);
    pick();
    return () => io.disconnect();
  }, [staged.length]);

  /* 지금 편만 튼다. 나머지는 멈춘다 — 동시에 여러 개를 틀면 폰이 뜨겁고 데이터가 샌다 */
  useEffect(() => {
    staged.forEach((it, i) => {
      const v = vids.current.get(it.id);
      if (!v) return;
      v.muted = !(loud && i === active);
      if (calm) { v.pause(); return; }        // 멀미를 싫어하는 손님에게는 자동재생을 안 한다
      if (i === active) void v.play().catch(() => {});
      else v.pause();
    });
  }, [active, loud, calm, staged]);

  /**
   * ★★ **무대가 화면을 덮는 «동안»에는 위 상단 바도 까맣게.** (2026-09-17 지시 [19]①·③)
   *
   *   대표님: 「히어로 섹션 아래로 내려가면 **화면이 다 까맣게 변하면서**」
   *   ⚠ 상단 바(상호·햄버거)는 `position: fixed` 라 무대 «위»에 뜬다. 그대로 두면
   *     **검은 화면 위에 흰 띠 한 줄**이 남아 「다 까맣게」가 깨진다(실측 화면에서 그랬다).
   *   ⇒ 무대가 화면을 덮는 동안만 `html` 에 표를 하나 붙인다. 색은 CSS 가 바꾼다
   *     (`app/globals.css` 의 `html.stage-dark` 규칙) — **`site-chrome.tsx` 는 한 줄도 안 건드린다.**
   *   ⚠ 「움직임 줄이기」에서는 무대가 평범한 목록이라 **바를 건드리지 않는다.**
   */
  useEffect(() => {
    const el = rootRef.current?.querySelector(".stage-sticky");
    if (!el || calm) { document.documentElement.classList.remove("stage-dark"); return; }
    let shown = false;
    const io = new IntersectionObserver(
      ([e]) => {
        const covering = e.intersectionRatio > 0.9;
        document.documentElement.classList.toggle("stage-dark", covering);
        /* 힌트는 **딱 한 번**만. 오르내릴 때마다 뜨면 그게 더 성가시다 */
        if (covering && !shown) { shown = true; setHint(true); window.setTimeout(() => setHint(false), HINT_MS); }
      },
      { threshold: [0, 0.9, 0.99] },
    );
    io.observe(el);
    return () => { io.disconnect(); document.documentElement.classList.remove("stage-dark"); };
  }, [calm]);

  /** 그 번째 눈금으로 부드럽게 내려간다 — 스와이프·화살표가 같이 쓴다 */
  const goTo = useCallback((i: number) => {
    const root = rootRef.current;
    if (!root) return;
    const n = Math.min(staged.length - 1, Math.max(0, i));
    root.querySelector<HTMLElement>(`[data-step="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [staged.length]);

  /**
   * 🔴 **바깥 페이지를 멈춘다.** 뒤에서 페이지가 움직이면 멀미가 납니다(지시 1번).
   *   ⚠ 닫을 때 **원래 보던 자리로** 정확히 돌아가야 합니다(지시 3번) — `position: fixed` 로
   *     막으면 스크롤이 0 으로 튀므로, 그 값을 기억했다가 되돌립니다.
   */
  useEffect(() => {
    if (world === null) return;
    const y = window.scrollY;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; window.scrollTo(0, y); };
  }, [world]);

  /** 「건너뛰기 ↓」 — 무대 «바로 아래»로 내려간다 */
  const skip = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const bottom = root.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: bottom, behavior: "smooth" });
  }, []);

  /* ★ 폰에서는 **세로 스와이프**로도 넘어간다 — 틱톡·릴스·쇼츠를 써 본 손가락이 먼저 안다.
     ⚠ `preventDefault` 를 하지 않는다. 막으면 **평범한 스크롤이 죽는다** — 넘기려던 게 아니라
       그냥 페이지를 내리려던 손님이 갇힌다. 우리는 «거들기»만 한다. */
  const onTouchStart = (e: React.TouchEvent) => { touchY.current = e.touches[0]?.clientY ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touchY.current;
    touchY.current = null;
    if (from === null || calm) return;
    const dy = (e.changedTouches[0]?.clientY ?? from) - from;
    if (Math.abs(dy) < SWIPE_PX) return;
    goTo(active + (dy < 0 ? 1 : -1));
  };

  /* 소리를 켜면 힌트는 할 일을 다 했다 */
  const showHint = (hint || hover) && !loud && !calm;
  const cur = staged[active];

  return (
    <section ref={rootRef} id={anchorId} className="stage" style={{ ["--stage-n" as string]: String(staged.length) }}>
      {/* 눈금 — 보이지 않는다. «몇 번째인지»를 알려 주는 자 역할만 한다 */}
      <div className="stage-steps" aria-hidden>
        {staged.map((it, i) => <div key={it.id} data-step={i} />)}
      </div>

      <div className="stage-sticky" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="stage-frame"
          /* ⚠ **마우스가 있는 기기에서만.** 폰에서는 탭이 hover 처럼 들어와 힌트가 붙어 버린다 */
          onMouseEnter={() => { if (window.matchMedia?.("(hover: hover)").matches) setHover(true); }}
          onMouseLeave={() => setHover(false)}
        >
          {/* ⚠ 한 편씩 `<figure>` 로 싼다 — 「움직임 줄이기」를 켠 손님에게는 이 묶음이
                 그대로 **세로 목록 한 칸**이 되고, 캡션도 영상마다 따라붙는다.
                 보통 손님에게는 이 묶음이 겹쳐 쌓여 한 칸처럼 보인다(CSS 가 한다). */}
          {staged.map((it, i) => {
            /**
             * 🔴🔴 **화면에 살아 있는 <video> 는 «항상 세 칸»뿐이다.** (2026-09-17 조사 8-2 [3])
             *
             * ⚠ 전에는 **편수만큼 전부** 만들었다. 100편을 걸면 재생기가 100개가 되어
             *   크롬 상한(폰 40 · PC 75)을 넘고 **조용히 검은 화면**이 된다.
             * ★ 칸(`<figure>`)은 **N개 그대로** 둔다 — 무대 높이·눈금은 CSS 가 그 수로 계산한다
             *   (`.stage { height: calc((N+1) × 100svh) }`). **그 계산을 건드리지 마라.**
             * ⚠ 「움직임 줄이기」에서는 **평범한 목록**이라 전부 그린다 —
             *   자동재생이 없고 `preload="none"` 이라 **바이트가 안 샌다.**
             */
            const near = calm || Math.abs(i - active) <= 1;
            if (!near) return <figure key={it.id} className="stage-item" aria-hidden />;
            return (
            <figure key={it.id} className={`stage-item${i === active ? " on" : ""}`}>
              <StageVideo
                it={it}
                onEl={setVid}
                /* ⚠ 지금 편과 그 다음 편만 미리 받는다. 열 편을 한꺼번에 받으면 데이터가 샌다 */
                preload={i === active || i === active + 1 ? "metadata" : "none"}
                controls={calm}
                /**
                 * 🔴 **PC 는 «세상»을 열고, 폰은 지금처럼 소리만** (2026-09-17 지시 [33]·6번).
                 *   대표님: 「폰은 이대로 좋아」 — 폰의 동작을 바꾸지 않습니다.
                 */
                onPick={() => {
                  if (calm) return;
                  if (typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
                    setLoud(true);          // 눌렀으니 브라우저가 소리를 허락한다
                    /* ⚠⚠ **`i` 가 아니라 `active` 다** — 2026-09-17 실측으로 잡았다.
                       일곱 편이 **겹쳐 쌓여** 있어서 클릭은 «DOM 의 마지막 편»이 받는다.
                       `i` 를 쓰면 **어느 편을 눌러도 항상 마지막 편**이 열렸다(실측 7/7).
                       손님이 «보고 있던» 편은 언제나 `active` 다. */
                    setWorld(active);
                    return;
                  }
                  setLoud((v) => !v);
                }}
              />
              {/* 목록으로 보일 때만 뜬다 — 겹쳐 쌓였을 때는 아래 `.stage-meta` 가 맡는다 */}
              {it.caption && <figcaption className="stage-item-cap">{it.caption}</figcaption>}
            </figure>
            );
          })}

          {/* 위쪽 — 여기가 무엇인지 한 줄. 「이건 뭐지?」에 답해 준다 */}
          <div className="stage-top">
            <span className="stage-kicker">{title}</span>
            {staged.length > 1 && <span className="stage-count">{active + 1} / {staged.length}{items.length > staged.length ? <span className="stage-more-n"> · 전체 {items.length}</span> : null}</span>}
          </div>

          {/* 소리 — 손님이 «지금 음소거구나»를 알아야 누를 생각을 한다 */}
          {!calm && (
            <button type="button" className="stage-sound" aria-label={loud ? "소리 끄기" : "소리 켜기"}
              onClick={() => setLoud((v) => !v)}>
              {loud ? "🔊" : "🔇"}
            </button>
          )}

          {/* 🔴 「탭하면 소리」 — 첫 편에서 잠깐. 켜면 사라진다 */}
          {showHint && (
            /* 🔴🔴 **스피커는 «하나»뿐이어야 한다.** (2026-09-17 대표님 폰 실측 · 지시 [35]①)
               대표님: 「폰으로 테스트 했는데 **스피커 2개 나오네????** 아무튼 **스피커 1개**」
               ⚠ 옛 레일이 겹친 게 아니었다(실측: 레일 0개). **이 힌트 알약이 🔇 를 하나 더**
                 달고 큰 스피커 «바로 아래»에 떠서 둘로 보였다. 글자만 남긴다. */
            <button type="button" className="stage-hint" onClick={() => setLoud(true)}>
              탭하면 소리가 나요
            </button>
          )}

          {/* 아래 — 캡션과 SNS 링크 */}
          <div className="stage-meta">
            {cur?.caption && <p className="stage-cap">{cur.caption}</p>}
            {pillLinks(cur?.links ?? []).length ? (
              <div className="stage-links">
                {pillLinks(cur.links).map((l) => (
                  <a key={l.provider} href={l.url} target="_blank" rel="noopener noreferrer" className="stage-pill">
                    <span className="stage-dot" style={{ background: SNS_DOT[l.provider] }} />
                    {SNS_LABEL[l.provider]}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* 오른쪽 — 몇 번째인지. 폰에서도 손가락에 안 가리는 자리다 */}
          {staged.length > 1 && (
            <div className="stage-dots" aria-hidden>
              {staged.map((it, i) => <span key={it.id} className={i === active ? "on" : ""} />)}
            </div>
          )}

          {/**
            * 🔴 **「전부 보기」 — 무대에서 잘린 편들이 «여기» 있다.** (2026-09-17 지시 [39])
            *   무대는 13화면으로 고정이라 13편째부터는 무대에 안 섭니다.
            *   🔴 **못 보는 게 아닙니다** — 누르면 전체화면에서 **처음부터 끝까지** 이어 봅니다.
            * ⚠ 편수가 무대 상한을 넘을 때만 뜹니다. 안 넘으면 있을 이유가 없습니다.
            */}
          {items.length > staged.length && !calm && (
            <button type="button" className="stage-all" onClick={() => { setLoud(true); setWorld(active); }}>
              전부 보기 ({items.length}편) →
            </button>
          )}

          {/* 🔴 **항상 보이는 탈출구.** 가두기만 하면 나간다 — 나갈 수 있다는 걸 알아야 머문다.
              ⚠ 2026-09-17 대표님 지시 [33]6 — **「빠져나가기 버튼만 더 눈에 띄게」.** 키우고 또렷하게 했다. */}
          <button type="button" className="stage-skip" onClick={skip}>건너뛰기 ↓</button>
        </div>
      </div>

      {/* 🔴🔴 **숏폼피드 세상** — 클릭하면 통째로 열리는 전체화면 (2026-09-17 지시 [33]) */}
      {world !== null && <ShortsWorld items={items} at={world} onAt={setWorld} onClose={() => setWorld(null)} calm={calm} />}
    </section>
  );
}

/**
 * 한 편의 `<video>`. **작은 컴포넌트로 뺀 이유가 하나뿐이다** — (2026-09-17 지시 [38])
 *
 * 🔴🔴 **창 밖으로 나갈 때 «재생기를 반납»시켜야 한다.**
 *   크롬은 살아 있는 영상 재생기를 **폰 40개·PC 75개**까지만 허용한다. 넘으면
 *   「Blocked attempt to create a WebMediaPlayer」와 함께 **조용히 검은 화면**이 된다.
 *   `pause()` 만으로는 안 놓는다 — **`removeAttribute('src')` + `load()`** 까지 해야 한다.
 *
 * ⚠⚠ **처음에 `ref` 콜백에서 그 정리를 했다가 «살아 있는 영상의 src 를 지웠다».**
 *   React 는 화면을 다시 그릴 때마다 **인라인 ref 를 «뗐다 붙인다»** — 떼는 순간을
 *   「사라진다」로 착각한 것이다. 실측: 모든 영상이 `src있나: false` · 재생 안 됨.
 *   ⇒ 정리는 **효과(useEffect)의 뒷정리**에서 한다. 그것은 **진짜 사라질 때만** 돈다.
 * ⚠ 그래도 개발 중에는 React 가 효과를 두 번 돌린다(StrictMode). 그래서
 *   **화면에서 실제로 떨어졌는지(`isConnected`)** 를 한 번 더 본다.
 */
function StageVideo({ it, onEl, preload, controls, onPick }: {
  it: ShortT; onEl: (id: string, el: HTMLVideoElement | null) => void;
  preload: "metadata" | "none"; controls: boolean; onPick: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    onEl(it.id, v);
    return () => {
      /* 🔴 **진짜로 화면에서 떨어졌을 때만** 반납한다 */
      if (v && !v.isConnected) {
        try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* 이미 떠났으면 그만이다 */ }
      }
      onEl(it.id, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <video
      ref={ref}
      className="stage-video"
      src={it.src}
      /* 🔴 표지도 이 세 칸에만 붙는다 — 전에는 **편수만큼 전부** 내려받았다(실측 7장/7편) */
      poster={it.poster}
      muted
      loop
      playsInline
      preload={preload}
      controls={controls}
      onClick={onPick}
    />
  );
}

/**
 * 🔴🔴 **숏폼피드 세상** — 「통으로 하나의 세상」. (2026-09-17 대표님 지시 [33])
 *
 * ★ **우리 숏폼의 공식 이름은 「숏폼피드」다**(2026-09-17 대표님 확정).
 *   「**숏폼피드가 있는 홈페이지**」를 광고 카피로 쓰신다. **코드·주석·화면 어디서든 이 이름으로 부른다.**
 *
 * ⚠ **`createPortal` 로 `body` 에 직접 붙인다.** 무대 안에 두면 `overflow:hidden` 인 상자에 갇혀
 *   전체화면이 안 된다. 「전체화면」은 **아무 상자에도 안 들어가야** 참이 된다.
 *
 * 🔴 **나가는 길을 셋 둔다 — ESC · [✕] · 바깥 클릭**(지시 2번).
 *   하나뿐이면 갇힌 느낌이 난다. 그리고 **닫으면 원래 보던 자리로** 돌아간다(지시 3번).
 * 🔴 **키보드로만 쓰는 손님**(지시 5번) — 열리면 **[✕] 에 초점이 가고**, `Tab` 으로 단추들을 돈다.
 */
function ShortsWorld({ items, at, onAt, onClose, calm }: {
  items: ShortT[]; at: number; onAt: (i: number) => void; onClose: () => void; calm: boolean;
}) {
  const vid = useRef<HTMLVideoElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [help, setHelp] = useState(!calm);
  /**
   * 🔴🔴 **소리 끄는 단추 — 없었습니다.** (2026-09-17 권반장 조사 · [36]①)
   *
   * > 「대표님이 지적하신 「스피커 2개」는 코드상 이미 1개로 고쳐져 있었고,
   * >   **진짜 문제는 전체화면에 소리 «끄는» 단추가 «0개»인데 소리가 켜진 채 열린다**는 점입니다」
   *
   * ⚠ **제가 [33] 에서 만든 것의 실수입니다.** 「클릭했으니 소리를 켜 준다」까지는 맞았는데,
   *   **끄는 길을 안 만들었습니다.** 조용한 사무실에서 연 손님은 **허둥대다 그냥 나갑니다.**
   * ★ 자리는 **영상 왼쪽 위**(유튜브 쇼츠와 같은 자리) — 조사 결과 그대로.
   * 🔴 **화면에 스피커 그림은 언제나 «1개»를 넘지 않는다**(릴스·쇼츠 둘 다 그렇다).
   *   무대의 스피커는 이 검은 화면 «아래»에 깔려 안 보인다.
   */
  const [loud, setLoud] = useState(true);
  const touchY = useRef<number | null>(null);
  const cur = items[at];

  /* 열리면 닫기 단추에 초점을 준다 — 키보드만 쓰는 손님이 곧바로 나갈 수 있어야 한다 */
  useEffect(() => { closeRef.current?.focus(); }, []);

  /**
   * 🔴 **폰 「뒤로가기」로 닫힌다.** (권반장 조사 · [36]②)
   *
   * ⚠ 지금은 뒤로가기를 누르면 **홈페이지를 통째로 떠납니다.**
   *   **한국 안드로이드 손님이 제일 먼저 누르는 단추**입니다.
   * ★ 열릴 때 기록을 하나 밀어 넣고, 뒤로가기가 그 기록을 먹으면 닫습니다.
   * ⚠ ✕·ESC·바깥클릭으로 닫을 때는 **밀어 넣은 기록을 되돌립니다** —
   *   안 그러면 손님의 뒤로가기 한 번이 «아무 일도 안 하는» 데 낭비됩니다.
   */
  const pushed = useRef(false);
  useEffect(() => {
    /* ⚠⚠ **React 는 개발 중에 이 효과를 «두 번» 돌린다**(StrictMode).
         처음에 정리(cleanup)에서 `history.back()` 을 불렀더니 **열자마자 닫혔다**(실측).
         ⇒ 기록은 **딱 한 번만** 밀어 넣고, 되돌리는 것은 **닫는 자리**에서 한다. */
    if (!pushed.current) { window.history.pushState({ onstoriWorld: true }, ""); pushed.current = true; }
    const onPop = () => { pushed.current = false; onClose(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  /**
   * 닫는 «단 하나의» 길. ✕·ESC·바깥클릭·쓸어내리기가 전부 여기로 온다.
   * ⚠ 내가 밀어 넣은 기록을 **내가 치운다** — 안 그러면 손님의 뒤로가기 한 번이 낭비된다.
   */
  const close = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back(); }
    onClose();
  }, [onClose]);

  /* ↑ ↓ (그리고 ← →) 로 넘기고, ESC 로 나간다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); onAt(Math.min(items.length - 1, at + 1)); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onAt(Math.max(0, at - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, items.length, onAt, close]);

  /**
   * 🔴 **마우스 휠로 위아래.** (2026-09-17 대표님 지시 [35]③)
   * ⚠ 휠은 **한 번에 여러 번** 들어온다(관성). 그대로 두면 한 번 굴려 대여섯 편이 지나간다.
   *   그래서 **한 번 넘기면 잠깐 잠근다.**
   */
  useEffect(() => {
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now < lock || Math.abs(e.deltaY) < 8) return;
      lock = now + 420;
      onAt(Math.min(items.length - 1, Math.max(0, at + (e.deltaY > 0 ? 1 : -1))));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [at, items.length, onAt]);

  /* 도움말은 2.8초. 「움직임 줄이기」에서는 아예 안 띄운다 */
  useEffect(() => {
    if (!help) return;
    const t = window.setTimeout(() => setHelp(false), HINT_MS);
    return () => window.clearTimeout(t);
  }, [help]);

  /**
   * ★ **소리를 켠 채로 시작한다.** 손님이 **클릭해서** 들어왔으니 브라우저가 허락한다.
   * ⚠ 그래도 `play()` 는 거절될 수 있다(전원 절약 등). 잡아서 조용히 넘긴다 —
   *   콘솔에 빨간 줄이 남아도 손님 잘못이 아니다.
   */
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    v.muted = !loud;
    void v.play().catch(() => {});
  }, [at, loud]);

  /**
   * 🔴🔴 **위아래로 쓸면 «영상 넘기기»다. 쓸어서 나가지지 않는다.** (2026-09-17 대표님 확정)
   *
   * > 대표님: 「나가는길, X 버튼 우측상단, 좌측 하단, ESC, 폰 뒤로가기,
   * >   **아래로 쓸어내리는건 못나가게해, 위아래 스크롤은 영상 넘기기야**」
   *
   * ⚠⚠ **[36]⑤ 에서 넣었던 「아래로 크게 쓸면 닫힘」을 걷어냈다.**
   *   인스타·틱톡·유튜브에 있는 몸짓이라 넣었는데, **우리 화면에서는 사고가 된다** —
   *   **다음 편을 보려고 손가락을 움직이다 «크게» 쓸면 그대로 나가진다.**
   *   나가는 길이 이미 넷이라 그 몸짓이 벌어 주는 것도 없다.
   * 🔴 **그냥 «막기»만 하면 안 된다.** 아래로 쓸면 **이전 편**으로 가야 한다 —
   *   아무 일도 안 일어나면 손님은 「멈췄나?」 한다.
   *
   * ⚠ 나가는 길은 그대로 **넷**이다 — **✕(우상) · ESC · 폰 뒤로가기 · 바깥 클릭.**
   * ⚠ `preventDefault` 를 **하지 않는다.** 막으면 평범한 스크롤이 죽는다.
   */
  const onTouchStart = (e: React.TouchEvent) => { touchY.current = e.touches[0]?.clientY ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touchY.current;
    touchY.current = null;
    if (from === null || calm) return;
    const dy = (e.changedTouches[0]?.clientY ?? from) - from;
    if (dy < -SWIPE_PX) { onAt(Math.min(items.length - 1, at + 1)); return; }   // 위로 → 다음 편
    if (dy > SWIPE_PX) { onAt(Math.max(0, at - 1)); }                           // 아래로 → 이전 편
  };

  return createPortal(
    <div className={`world${calm ? " calm" : ""}`} role="dialog" aria-modal="true" aria-label="숏폼피드"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="world-frame" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <video ref={vid} className="world-video" src={cur?.src} poster={cur?.poster}
          autoPlay loop playsInline controls={calm} />

        {/* 🔴 **소리 단추 하나** — 영상 왼쪽 위(유튜브 쇼츠와 같은 자리). 없어서 못 끄던 것을 고쳤다 */}
        {!calm && (
          <button type="button" className="world-sound" aria-label={loud ? "소리 끄기" : "소리 켜기"}
            onClick={() => setLoud((v) => !v)}>
            {loud ? "🔊" : "🔇"}
          </button>
        )}
        <div className="world-meta">
          {cur?.caption && <p className="world-cap">{cur.caption}</p>}
          {pillLinks(cur?.links ?? []).length ? (
            <div className="world-links">
              {pillLinks(cur.links).map((l) => (
                <a key={l.provider} href={l.url} target="_blank" rel="noopener noreferrer" className="stage-pill">
                  <span className="stage-dot" style={{ background: SNS_DOT[l.provider] }} />
                  {SNS_LABEL[l.provider]}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 🔴 2026-09-17 대표님 지시 [35]② — **나가기를 크게.**
          ⚠ 대표님은 「화면 «가운데»에 ［나가기 ✕］」를 원하셨는데, **권반장이 릴스·쇼츠의 실제 배치를
            조사 중**이라 **위치는 그대로 두고 크기만** 키웠습니다 — 두 번 옮기면 낭비입니다. */}
      <button ref={closeRef} type="button" className="world-x" onClick={close} aria-label="숏폼피드에서 나가기">
        <span aria-hidden>✕</span><span className="world-x-say">나가기</span>
      </button>
      <span className="world-count" aria-hidden>{at + 1} / {items.length}</span>

      {items.length > 1 && (
        <>
          {/* 🔴 **위아래**다(지시 [35]③). 릴스·쇼츠·틱톡 전부 위아래이고, 대표님 말씀도 그렇다.
              ⚠ ← → 키도 «함께» 산다 — 익숙한 사람의 손을 막을 이유는 없다. */}
          <button type="button" className="world-arrow up" aria-label="이전 영상"
            disabled={at === 0} onClick={() => onAt(Math.max(0, at - 1))}>⌃</button>
          <button type="button" className="world-arrow down" aria-label="다음 영상"
            disabled={at === items.length - 1} onClick={() => onAt(Math.min(items.length - 1, at + 1))}>⌄</button>
        </>
      )}

      {/**
        * 🔴 **대표님 확정 문구다 — 마음대로 바꾸지 마라.** (2026-09-17 밤 · 권반장 전달)
        *
        * > 대표님: 「"↑ ↓ 또는 마우스 휠로 넘길 수 잇어요" 으로 **확정**하고 **esc 쓰지마**,
        * >   어차피 X 버튼 우측상단, X 몰입모드나가기 버튼 좌측 하단에 넣을거잖아?」
        *
        * ⚠ **나가는 법을 이 문장에 쓰지 않는다** — ✕ 단추가 눈에 두 개나 보이기 때문이다.
        * ⚠⚠ **「아래로 쓸어내리면 나가요」를 «절대» 넣지 마라.** 대표님이 그 동작 자체를
        *   **없애라고** 하셨다 — 「위아래 스크롤은 **영상 넘기기**」다. 다음 편을 보려고
        *   쓸어내리다 **실수로 나가지는** 것이 이유다. (동작을 걷어내는 일은 [42] 에서 한다)
        * ⚠ 2026-09-17 에 내가 「폰에는 휠이 없으니 손가락 말로 바꾸자」고 기기별로 갈랐다가
        *   **대표님 확정과 어긋나** 되돌렸다. 이 화면은 [42] 「숏폼시네마」에서 통째로 다시 짠다.
        */}
      {help && <p className="world-help">↑ ↓ 또는 마우스 휠로 넘길 수 있어요</p>}
    </div>,
    document.body,
  );
}
