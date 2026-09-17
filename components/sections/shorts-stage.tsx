"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortT, ShortLink } from "@/lib/shorts";

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

const LABEL: Record<ShortLink["provider"], string> = {
  instagram: "인스타에서 보기", tiktok: "틱톡에서 보기", youtube: "쇼츠에서 보기",
  facebook: "페이스북에서 보기", threads: "쓰레드에서 보기", x: "X에서 보기",
};
const DOT: Record<ShortLink["provider"], string> = {
  instagram: "#E1306C", tiktok: "#25F4EE", youtube: "#FF0000",
  facebook: "#1877F2", threads: "#FFFFFF", x: "#FFFFFF",
};

/** 손가락이 이만큼은 움직여야 «넘긴 것»으로 본다. 너무 작으면 살짝 흔들려도 넘어간다 */
const SWIPE_PX = 48;

export default function ShortsStage({ items, anchorId, title }: { items: ShortT[]; anchorId?: string; title: string }) {
  const [active, setActive] = useState(0);
  const [loud, setLoud] = useState(false);
  /** 멀미를 싫어하는 손님인가 — 레이아웃은 CSS 가 맡고, 여기서는 **자동재생만** 끈다 */
  const [calm, setCalm] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const vids = useRef(new Map<string, HTMLVideoElement>());
  const touchY = useRef<number | null>(null);

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
  }, [items.length]);

  /* 지금 편만 튼다. 나머지는 멈춘다 — 동시에 여러 개를 틀면 폰이 뜨겁고 데이터가 샌다 */
  useEffect(() => {
    items.forEach((it, i) => {
      const v = vids.current.get(it.id);
      if (!v) return;
      v.muted = !(loud && i === active);
      if (calm) { v.pause(); return; }        // 멀미를 싫어하는 손님에게는 자동재생을 안 한다
      if (i === active) void v.play().catch(() => {});
      else v.pause();
    });
  }, [active, loud, calm, items]);

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
    const io = new IntersectionObserver(
      ([e]) => document.documentElement.classList.toggle("stage-dark", e.intersectionRatio > 0.9),
      { threshold: [0, 0.9, 0.99] },
    );
    io.observe(el);
    return () => { io.disconnect(); document.documentElement.classList.remove("stage-dark"); };
  }, [calm]);

  /** 그 번째 눈금으로 부드럽게 내려간다 — 스와이프·화살표가 같이 쓴다 */
  const goTo = useCallback((i: number) => {
    const root = rootRef.current;
    if (!root) return;
    const n = Math.min(items.length - 1, Math.max(0, i));
    root.querySelector<HTMLElement>(`[data-step="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [items.length]);

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

  const cur = items[active];

  return (
    <section ref={rootRef} id={anchorId} className="stage" style={{ ["--stage-n" as string]: String(items.length) }}>
      {/* 눈금 — 보이지 않는다. «몇 번째인지»를 알려 주는 자 역할만 한다 */}
      <div className="stage-steps" aria-hidden>
        {items.map((it, i) => <div key={it.id} data-step={i} />)}
      </div>

      <div className="stage-sticky" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="stage-frame">
          {/* ⚠ 한 편씩 `<figure>` 로 싼다 — 「움직임 줄이기」를 켠 손님에게는 이 묶음이
                 그대로 **세로 목록 한 칸**이 되고, 캡션도 영상마다 따라붙는다.
                 보통 손님에게는 이 묶음이 겹쳐 쌓여 한 칸처럼 보인다(CSS 가 한다). */}
          {items.map((it, i) => (
            <figure key={it.id} className={`stage-item${i === active ? " on" : ""}`}>
              <video
                ref={(el) => setVid(it.id, el)}
                className="stage-video"
                src={it.src}
                poster={it.poster}
                muted
                loop
                playsInline
                /* ⚠ 지금 편과 그 다음 편만 미리 받는다. 열 편을 한꺼번에 받으면 데이터가 샌다 */
                preload={i === active || i === active + 1 ? "metadata" : "none"}
                controls={calm}
                onClick={() => !calm && setLoud((v) => !v)}
              />
              {/* 목록으로 보일 때만 뜬다 — 겹쳐 쌓였을 때는 아래 `.stage-meta` 가 맡는다 */}
              {it.caption && <figcaption className="stage-item-cap">{it.caption}</figcaption>}
            </figure>
          ))}

          {/* 위쪽 — 여기가 무엇인지 한 줄. 「이건 뭐지?」에 답해 준다 */}
          <div className="stage-top">
            <span className="stage-kicker">{title}</span>
            {items.length > 1 && <span className="stage-count">{active + 1} / {items.length}</span>}
          </div>

          {/* 소리 — 손님이 «지금 음소거구나»를 알아야 누를 생각을 한다 */}
          {!calm && (
            <button type="button" className="stage-sound" aria-label={loud ? "소리 끄기" : "소리 켜기"}
              onClick={() => setLoud((v) => !v)}>
              {loud ? "🔊" : "🔇"}
            </button>
          )}

          {/* 아래 — 캡션과 SNS 링크 */}
          <div className="stage-meta">
            {cur?.caption && <p className="stage-cap">{cur.caption}</p>}
            {cur?.links?.length ? (
              <div className="stage-links">
                {cur.links.map((l) => (
                  <a key={l.provider} href={l.url} target="_blank" rel="noopener noreferrer" className="stage-pill">
                    <span className="stage-dot" style={{ background: DOT[l.provider] }} />
                    {LABEL[l.provider]}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* 오른쪽 — 몇 번째인지. 폰에서도 손가락에 안 가리는 자리다 */}
          {items.length > 1 && (
            <div className="stage-dots" aria-hidden>
              {items.map((it, i) => <span key={it.id} className={i === active ? "on" : ""} />)}
            </div>
          )}

          {/* 🔴 **항상 보이는 탈출구.** 가두기만 하면 나간다 — 나갈 수 있다는 걸 알아야 머문다 */}
          <button type="button" className="stage-skip" onClick={skip}>건너뛰기 ↓</button>
        </div>
      </div>
    </section>
  );
}
