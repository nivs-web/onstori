"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortT } from "@/lib/shorts";
import dynamic from "next/dynamic";
import { SNS_LABEL, SNS_DOT, pillLinks } from "./sns-brand";
import { orderShorts, visitSeed, SHORTS_ORDER_DEFAULT, HINT_MS, type ShortsOrder } from "@/config/shorts";
import { IconSoundOn, IconSoundOff, IconChevronLeft, IconChevronRight } from "./shorts-icons";

/**
 * 🔴🔴 **카드형태에도 «몰입모드»가 붙는다.** (2026-09-17 지시 [42] §3 · 대표님 확정)
 *
 * > 대표님: 카드형태는 「소리 꺼진 채 1편만 재생 · 좌우로 넘김 · **스크롤 안 가둠** ·
 * >   **클릭하면 몰입모드에 갇힘**」
 *
 * ★ **[42] §1 에서 몰입모드를 파일로 떼어낸 것이 바로 이걸 위해서였다.**
 *   전에는 몰입모드가 무대(`shorts-stage.tsx`) 안에만 살아서 카드형태는 쓸 수가 없었다.
 * ⚠ 무대와 **같은 방식으로** 미루고 미리 받는다 — 첫 화면을 무겁게 하지 않는다.
 */
const ShortsWorld = dynamic(() => import("./shorts-world"), { ssr: false });

let warmed = false;
function warmWorld() {
  if (warmed) return;
  warmed = true;
  void import("./shorts-world");
}
/** 한가한 틈에 한 번 — 누르는 순간 기다리지 않게(무대와 같은 이유. `shorts-stage.tsx` 주석 참조) */
function warmWhenIdle() {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => warmWorld(), { timeout: 3000 });
  else window.setTimeout(warmWorld, 1200);
}

/**
 * 홈페이지 안의 «숏폼 피드» — 릴스·쇼츠·틱톡에서 보던 그 느낌. (2026-09-16 대표님 지시)
 *
 * ★★ **왜 이게 우리 사업의 핵심 화면인가**
 *   대표님 말씀: 「요즘은 개인 소상공인 홈페이지 안에도 숏폼을 넣을 수 있어? 이렇게 놀라게 만들고 싶어.」
 *   손님이 히어로를 지나 스크롤하는 순간 **영상이 살아 움직여야** 한다. 멈춘 썸네일은 죽은 집이다.
 *
 * ★★ **자동재생은 «소리 없이»만 한다 — 두 결정을 모두 지키는 유일한 길**
 *   · 2026-09-10 회장님: 「손님이 들어왔는데 갑자기 사장님 목소리가 나면 그 자리에서 나간다」
 *   · 2026-09-16 대표님: 「스크롤이 내려가면 자동 재생하게 못하니?」
 *   ⇒ **음소거 자동재생 + 탭하면 소리.** 릴스·틱톡·쇼츠가 전부 이렇게 한다.
 *   ⚠ `muted` 를 빼면 브라우저가 재생 자체를 막는다(자동재생 정책). 기능이 조용히 죽는다.
 *
 * ★★ **화면에 보일 때만 튼다.** IntersectionObserver 로 보이는 것 하나만 재생하고 나머지는 멈춘다.
 *   ⚠ 여러 개를 동시에 틀면 폰이 뜨겁고 데이터가 샌다. 실제로 이게 이 화면의 가장 큰 비용이다.
 *   ⚠ 안 보이면 `pause()` 만 하고 **되감지 않는다** — 다시 보면 이어서 본다(릴스와 같다).
 *
 * ★★ **데이터를 아낀다 — `preload="none"`, 표지만 먼저.**
 *   영상 바이트는 «보이기 직전»에 흐르기 시작한다. 손님이 위쪽만 보고 나가면 한 편도 안 받는다.
 *
 * ⚠ **이 파일에만 `"use client"` 가 있다.** `components/sections/index.tsx` 는 서버 컴포넌트를
 *   유지한다 — 영상이 없는 사장님 사이트에는 이 JS 가 **한 바이트도 안 간다**(docs/PERFORMANCE.md §5-2).
 *   그 성질을 지키려고 이 컴포넌트를 따로 뺐다. **index.tsx 안으로 되돌리지 마라.**
 */


export default function ShortsFeed({ items, all, onInk, slug, order = SHORTS_ORDER_DEFAULT }: {
  items: ShortT[]; all?: ShortT[]; onInk: string; slug: string; order?: ShortsOrder;
}) {
  /* 🔴 재생 순서 — 무대와 «같은 방식»이다(`shorts-stage.tsx` 의 주석 참조).
       서버에서 섞으면 캐시 때문에 모든 손님이 같은 순서를 받는다. */
  const [view, setView] = useState<ShortT[]>(items);
  const [viewAll, setViewAll] = useState<ShortT[]>(all ?? items);
  useEffect(() => {
    const seed = visitSeed(slug);
    setView(orderShorts(items, order, seed));
    setViewAll(orderShorts(all ?? items, order, seed));
  }, [items, all, order, slug]);
  const [active, setActive] = useState(0);
  /**
   * 🔴 **몰입모드에 넘기는 것은 «가져온 전부»다.** (지시 [42] §3)
   *   화면에 그리는 카드는 20장까지지만, 열고 들어가면 **전부** 볼 수 있어야 한다
   *   (대표님: 「10·20편은 홈페이지만, 몰입모드는 전부」).
   */
  const world = viewAll.length ? viewAll : view;
  const [worldAt, setWorldAt] = useState<number | null>(null);
  /** 멀미를 싫어하는 손님에게는 몰입모드를 열지 않는다 — 무대와 같은 규칙이다 */
  const [calm, setCalm] = useState(false);
  /**
   * 🔴 **소리는 «한 번 켜면 끝까지».** (2026-09-17 대표님 지시 [31]①)
   *
   * > 대표님: 「소리 부분이 좀 걱정이야.」 — 지금은 넘길 때마다 **다시 탭**해야 했다.
   *   일곱 편을 보려면 **일곱 번** 눌러야 한다. 틱톡·릴스·쇼츠는 **한 번 켜면 계속** 난다.
   *
   * ⚠ 옛 방식은 `loud` 가 «영상 id» 였다(한 편만). 이제는 **켬/끔 하나**다.
   * ★ 2026-09-10 회장님 결정(「들어오자마자 목소리 나면 나간다」)은 그대로다 —
   *   **처음은 음소거**이고, **페이지를 새로 열면 다시 음소거**다(상태가 초기화된다).
   */
  const [loud, setLoud] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const vids = useRef(new Map<string, HTMLVideoElement>());
  /**
   * 🔴🔴 **「가려는 칸」을 따로 들고 있는다.** (2026-09-18 대표님 C-1·C-3)
   *
   * > 대표님: 「오른쪽·왼쪽 이동이 **안 됨**」 「다음영상·이전영상 버튼으로 **휙휙 이동이 안 됨**」
   *
   * ⚠⚠ **원인:** 옛 `go()` 는 `active` 에서 한 칸을 셌다. 그런데 `active` 는
   *   **관찰기(IntersectionObserver)가 «부드러운 스크롤이 끝난 뒤»에** 올려 준다.
   *   ⇒ 단추를 **두 번 빨리 누르면 둘 다 «같은 칸»에서 세어** 두 번째가 아무 일도 안 한다.
   *     **연달아 누를수록 안 움직이는** 것으로 보인다 — 대표님이 겪으신 그것이다.
   * ⇒ 누른 «뜻»을 여기 적어 두고, 다음 누름은 **그 뜻에서** 센다. 화면이 따라오는 것과 무관하다.
   * ⚠ 손가락으로 밀었을 때는 관찰기가 알려 주므로 **거기서도 이 값을 맞춰** 둔다(아래 `setActive` 옆).
   */
  const aim = useRef(0);

  const setVid = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) vids.current.set(id, el); else vids.current.delete(id);
  }, []);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setCalm(m.matches);
    on();
    m.addEventListener("change", on);
    warmWhenIdle();
    return () => m.removeEventListener("change", on);
  }, []);

  /* ★★ 보이는 카드 하나만 재생한다.
     ⚠ threshold 를 0.6 으로 둔다 — 반쯤 걸친 카드가 번갈아 재생되면 화면이 시끄럽다. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.sid ?? "";
          const v = vids.current.get(id);
          if (!v) continue;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const i = view.findIndex((it) => it.id === id);
            if (i >= 0) { setActive(i); aim.current = i; }   /* 🔴 손가락으로 밀었을 때도 «뜻»을 맞춘다 */
            /* ⚠ play() 는 약속(Promise)을 돌려주고 실패할 수 있다(전원 절약 모드 등).
               잡지 않으면 콘솔에 빨간 줄이 남고, 손님은 아무 잘못이 없다. 조용히 넘긴다. */
            void v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { root: rail, threshold: [0, 0.6, 1] },
    );
    for (const el of rail.querySelectorAll<HTMLElement>("[data-sid]")) io.observe(el);
    return () => io.disconnect();
  }, [view]);

  /**
   * 🔴 **「← → 좌우로 밀어서 영상을 변경하세요」 — 떴다가 사라진다.** (2026-09-18 지시 [49]④ · 대표님 원문)
   *
   * ⚠⚠ **위의 재생용 관찰기를 재활용할 수 없다.** 그것은 `root: rail` 이라
   *   **가로 레일 «안»에서** 카드가 보이는지를 본다 — 레일이 **화면 아래 저 멀리 있어도 켜진다.**
   *   그러면 손님이 **보지도 못한 안내가 혼자 떴다 사라진다.**
   * ⇒ 여기서는 `root` 를 안 준다(= 화면 기준). **레일이 진짜로 눈에 들어올 때** 켠다.
   *
   * ⚠ **한 번만 띄운다**(`shown`). 스크롤을 오르내릴 때마다 다시 뜨면 성가시다.
   *   그래서 켜자마자 `disconnect()` 한다.
   * ⚠ **한 편뿐이면 안 띄운다** — 넘길 것이 없는데 「밀어서 바꾸세요」는 거짓말이다.
   * ★ 시간은 `HINT_MS` 를 **그대로 쓴다**(2800ms). 대표님은 「3초」라 하셨고 권반장은 재량을 주셨는데,
   *   **눈에 안 띄는 차이**라 «값이 적힌 자리를 하나로» 두는 쪽을 골랐다 — 무대·몰입모드와 같은 값이다.
   */
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || view.length < 2) return;
    let shown = false;
    let t = 0;
    /* 🔴 **「얼마나 보이나(비율)」로 재지 않는다 — «화면 한가운데에 닿았나»로 잰다.**
       ⚠ 처음엔 `intersectionRatio >= 0.5` 로 썼다가 실측 중에 구멍을 찾았다:
         레일이 **화면보다 두 배 넘게 크면 비율이 «영영» 0.5 에 못 닿는다**
         (가로로 누운 창·작은 창에서 그렇다). 그러면 **안내가 평생 안 뜬다.**
       ⇒ `rootMargin` 으로 화면의 **가운데 절반**만 남기고, 거기에 **닿기만 하면** 켠다.
         레일이 크든 작든 똑같이 동작한다. */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (shown || !e.isIntersecting) continue;
          shown = true;
          setHint(true);
          t = window.setTimeout(() => setHint(false), HINT_MS);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "-25% 0px -25% 0px" },
    );
    io.observe(rail);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, [view.length]);

  /**
   * 🔴🔴 **소리는 «한 편»에서만 난다. 두 번 나면 안 된다.** (2026-09-18 대표님 C-5·C-6)
   *
   * > 대표님: 「**어떤 경우에도 소리가 두 번 나면 절대 안 됨**. 한 번만 재생」
   *
   * ⚠⚠ **옛 코드는 «전부»를 켰다** — `vids.forEach(v => v.muted = !loud)`.
   *   보이지 않는 편은 멈춰 있어서 «대개» 조용했지만, **멈추지 않은 편이 하나라도 있으면
   *   그대로 두 겹으로 났다**(몰입모드를 열었을 때가 바로 그 경우다 — 아래 ④).
   * ⇒ **지금 보이는 한 편만** 소리를 허락한다. 나머지는 «언제나» 음소거다.
   */
  useEffect(() => {
    const id = view[active]?.id;
    vids.current.forEach((v, key) => { v.muted = !(loud && key === id); });
  }, [loud, active, view]);

  /**
   * 🔴🔴 **끝에서 멈추지 않는다 — «무한 회전»이다.** (2026-09-18 대표님 C-4)
   *
   * > 대표님: 「20개든 7개든 **«끝»에서 멈추면 안 됨 — «무한 회전»이어야 함**
   * >   (숏폼형태는 5~10편 보면 탈출 가능, 카드형태는 **«무한 반복 고리»**)」
   *
   * ⚠⚠ **옛 코드는 `Math.min`·`Math.max` 로 «가뒀다»** — 마지막 편에서 [다음]을 누르면
   *   **아무 일도 안 일어났다.** 손님은 단추가 고장 났다고 느낀다.
   * ⇒ 나머지(`%`)로 **한 바퀴 돌린다.** 마지막 → 첫 편, 첫 편 → 마지막.
   *
   * ⚠ **한 바퀴 넘어갈 때는 «부드럽게» 하지 않는다.** 20편을 부드럽게 되감으면
   *   레일이 **몇 초 동안 휙 지나가** 멀미가 난다. 그때만 «즉시» 옮긴다.
   */
  const go = (dir: -1 | 1) => {
    const rail = railRef.current;
    const n = view.length;
    if (!rail || n === 0) return;
    const from = aim.current;
    const next = (from + dir + n) % n;
    aim.current = next;
    const wrapped = Math.abs(next - from) > 1;               /* 끝 ↔ 처음으로 건너뛰었나 */
    const card = rail.querySelector<HTMLElement>(`[data-sid="${view[next]?.id}"]`);
    if (!card) return;
    /**
     * 🔴🔴 **`scrollIntoView()` 를 «쓰지 않는다». 그것이 대표님이 겪으신 「이동이 안 됨」이다.**
     *   (2026-09-18 실측 · 대표님 C-1)
     *
     * ⚠⚠ **실측:** 카드형태 화면에서 `card.scrollIntoView({inline:"center"})` 를 불러도
     *   **레일도 페이지도 «1px 도» 안 움직였다**(레일 scrollLeft 0 → 0). 같은 화면에서
     *   `rail.scrollTo({left:900})` 는 **1028 로 (스냅까지 맞춰) 제대로 움직였다.**
     *   ⇒ 움직이지 못하는 것이 아니라 **`scrollIntoView` 가 이 자리에서 아무 일도 안 한다.**
     * ⇒ **가야 할 자리를 «우리가 셈해서» 레일에게 직접 말한다.** 셈은 화면 좌표로 한다 —
     *   `offsetLeft` 는 «자리 잡힌 조상» 기준이라 레일이 아닐 수 있어 틀린다.
     * ★ 스냅(`scroll-snap-type: x mandatory`)이 마지막 몇 px 을 알아서 맞춰 준다.
     */
    const rr = rail.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const left = rail.scrollLeft + (cr.left - rr.left) - (rr.width - cr.width) / 2;
    rail.scrollTo({ left, behavior: wrapped || calm ? "auto" : "smooth" });
    /* 🔴 **점 표시기를 «그 자리에서» 옮긴다.** 관찰기는 스크롤이 끝난 뒤에나 알려 준다 —
       그때까지 점이 안 움직이면 손님은 「안 눌렸나?」 하고 또 누른다(대표님 C-3). */
    setActive(next);
  };

  return (
    <div className="shorts" data-hint={hint ? "on" : undefined}>
      <div className="shorts-rail" ref={railRef}>
        {view.map((it) => (
          <article key={it.id} data-sid={it.id} className="shorts-card">
            <div className="shorts-frame">
              <video
                ref={(el) => setVid(it.id, el)}
                src={it.src}
                poster={it.poster}
                muted
                loop
                playsInline
                preload="none"
                /* ⚠ `controls` 를 달지 않는다 — 릴스·틱톡에는 재생바가 없다.
                   🔴 **누르면 «몰입모드»가 열린다**(2026-09-17 지시 [42] §3 · 대표님 확정).
                     전에는 누르면 소리가 켜졌다 — 그 몫은 이제 **스피커 단추**가 맡는다.
                   ⚠ 「움직임 줄이기」를 켠 손님에게는 열지 않고 **전처럼 소리만** 켠다. */
                /**
                 * 🔴🔴 **영상을 누르면 «뒤에서 돌던 소리를 끊고» 몰입모드로 간다.**
                 *   (2026-09-18 대표님 C-5·C-6·C-7)
                 *
                 * > 「소리 켜고 보다가 몰입모드 들어가면 **뒤에서 돌던 소리가 안 꺼짐**」
                 * > 「«영상»을 클릭 → **배경 소리 전부 정지** + 몰입모드로 전환」
                 *
                 * ⚠⚠ **옛 코드는 여기서 `setLoud(true)` 를 했다** — 그것이 범인이다.
                 *   레일의 영상은 **멈추지 않은 채** 음소거만 풀렸고, 그 위로 몰입모드가
                 *   **자기 소리를 켜고** 열렸다. ⇒ **소리가 두 겹.**
                 * 🔴 **`setLoud(false)` «만»으로는 늦다.** 상태는 다음 그림에 반영되므로
                 *   그 사이 한두 칸은 소리가 난다. ⇒ **여기서 손으로 먼저 끊는다.**
                 * ⚠ 몰입모드는 **자기 소리를 켠 채** 열린다(`shorts-world.tsx` 의 `loud` 첫값) —
                 *   손님이 «눌러서» 들어왔으니 브라우저가 허락한다. 그래서 여기서 끄는 것이
                 *   「소리가 아예 안 난다」가 되지 않는다.
                 */
                onClick={() => {
                  if (calm) { setLoud((v) => !v); return; }
                  const i = world.findIndex((x) => x.id === it.id);
                  setLoud(false);
                  vids.current.forEach((v) => { v.muted = true; v.pause(); });
                  setWorldAt(i >= 0 ? i : 0);
                }}
              />
              {/* 소리 상태 — 손님이 «지금 음소거구나»를 알아야 누를 생각을 한다 */}
              <button
                type="button"
                className="shorts-sound"
                aria-label={loud ? "소리 끄기" : "소리 켜기"}
                onClick={() => setLoud((v) => !v)}
              >
                {loud ? <IconSoundOn /> : <IconSoundOff />}
              </button>
              {/* 아래 그림자 위에 글 — 릴스와 같은 자리 */}
              <div className="shorts-meta">
                {it.caption && <p className="shorts-cap">{it.caption}</p>}
                {pillLinks(it.links).length > 0 && (
                  <div className="shorts-links">
                    {pillLinks(it.links).map((l) => (
                      <a
                        key={l.provider}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shorts-pill"
                      >
                        <span className="shorts-dot" style={{ background: SNS_DOT[l.provider] }} />
                        {SNS_LABEL[l.provider]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {view.length > 1 && (
        <>
          {/**
            * 🔴 **좌우 단추 — «PC 와 폰 둘 다»다.** (2026-09-18 지시 [49]④ · 대표님)
            *
            * > 대표님: 「**폰 버전에서도 좌우 플로팅 동그란 버튼이 있고,
            * >   손으로 좌우 밀어서 스크롤도 가능한 거야**」
            *
            * ⚠ **옛 주석은 「PC 전용 — 폰에서는 손가락으로 넘긴다」였다.** 대표님 말씀은 **둘 다**다.
            * ★ **손가락으로 밀기는 이미 된다** — `.shorts-rail` 이 `scroll-snap-type: x mandatory` +
            *   터치 스크롤이라 **코드를 더할 것이 없었다**(실측으로 확인). 단추만 폰에서 켜면 된다.
            */}
          <button type="button" className="shorts-arrow left" onClick={() => go(-1)} aria-label="이전 영상"><IconChevronLeft /></button>
          <button type="button" className="shorts-arrow right" onClick={() => go(1)} aria-label="다음 영상"><IconChevronRight /></button>
          {/* 🔴 **대표님이 정하신 글자다.** 고치지 마라 (2026-09-18 [49]④) */}
          {hint && <p className="shorts-help">← → 좌우로 밀어서 영상을 변경하세요</p>}
          <div className="shorts-dots" style={{ color: onInk }}>
            {view.map((it, i) => (
              <span key={it.id} className={i === active ? "on" : ""} />
            ))}
          </div>
        </>
      )}

      {/* 🔴 **몰입모드 — 무대와 «같은 파일»을 쓴다**(지시 [42] §1 에서 떼어낸 그것) */}
      {worldAt !== null && (
        <ShortsWorld
          items={world}
          at={worldAt}
          onAt={setWorldAt}
          /**
           * 🔴 **닫으면 «음소거로» 되살린다.** (2026-09-18 C-6)
           * ⚠ 위 ⑤ 에서 레일의 영상을 **멈춰** 두었다. 관찰기는 «보이는 것이 바뀔 때»만
           *   깨어나므로, 몰입모드가 닫혀도 **그대로 멈춰 있어 「고장난 화면」**처럼 보인다.
           *   ⇒ 여기서 한 편만 손으로 다시 돌린다. **소리는 끈 채로** — 「두 번 나면 안 됨」.
           */
          onClose={() => {
            setWorldAt(null);
            const v = vids.current.get(view[active]?.id ?? "");
            if (v) { v.muted = true; void v.play().catch(() => {}); }
          }}
          calm={calm}
          /* 🔴 「⋯」(영상 관리로 가는 길)이 이 주소를 쓴다 — 2026-09-18 B-20 */
          slug={slug}
        />
      )}
    </div>
  );
}
