"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortT } from "@/lib/shorts";
import dynamic from "next/dynamic";
import { SNS_LABEL, SNS_DOT, pillLinks } from "./sns-brand";
import { orderShorts, visitSeed, SHORTS_ORDER_DEFAULT, type ShortsOrder } from "@/config/shorts";
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
            if (i >= 0) setActive(i);
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

  /* 켜 두면 **지금 보이는 편**에서 소리가 난다. 안 보이는 편은 어차피 멈춰 있다 */
  useEffect(() => {
    vids.current.forEach((v) => { v.muted = !loud; });
  }, [loud, active]);

  const go = (dir: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const next = Math.min(view.length - 1, Math.max(0, active + dir));
    const card = rail.querySelector<HTMLElement>(`[data-sid="${view[next]?.id}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="shorts">
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
                onClick={() => {
                  if (calm) { setLoud((v) => !v); return; }
                  const i = world.findIndex((x) => x.id === it.id);
                  setLoud(true);              // 눌렀으니 브라우저가 소리를 허락한다
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
          {/* PC 전용 좌우 화살표 — 폰에서는 손가락으로 넘긴다 */}
          <button type="button" className="shorts-arrow left" onClick={() => go(-1)} aria-label="이전 영상"><IconChevronLeft /></button>
          <button type="button" className="shorts-arrow right" onClick={() => go(1)} aria-label="다음 영상"><IconChevronRight /></button>
          <div className="shorts-dots" style={{ color: onInk }}>
            {view.map((it, i) => (
              <span key={it.id} className={i === active ? "on" : ""} />
            ))}
          </div>
        </>
      )}

      {/* 🔴 **몰입모드 — 무대와 «같은 파일»을 쓴다**(지시 [42] §1 에서 떼어낸 그것) */}
      {worldAt !== null && (
        <ShortsWorld items={world} at={worldAt} onAt={setWorldAt} onClose={() => setWorldAt(null)} calm={calm} />
      )}
    </div>
  );
}
