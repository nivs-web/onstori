"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortT, ShortLink } from "@/lib/shorts";

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

const LABEL: Record<ShortLink["provider"], string> = {
  instagram: "인스타에서 보기",
  tiktok: "틱톡에서 보기",
  youtube: "쇼츠에서 보기",
  facebook: "페이스북에서 보기",
  threads: "쓰레드에서 보기",
  x: "X에서 보기",
};

/** 각 SNS 의 상징색 — 알약 버튼 왼쪽 점 하나로만 쓴다(로고를 쓰면 상표 문제가 생긴다) */
const DOT: Record<ShortLink["provider"], string> = {
  instagram: "#E1306C", tiktok: "#25F4EE", youtube: "#FF0000",
  facebook: "#1877F2", threads: "#FFFFFF", x: "#FFFFFF",
};

export default function ShortsFeed({ items, onInk }: { items: ShortT[]; onInk: string }) {
  const [active, setActive] = useState(0);
  /** 소리를 켠 영상 — 한 번에 하나만. 릴스와 같다 */
  const [loud, setLoud] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const vids = useRef(new Map<string, HTMLVideoElement>());

  const setVid = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) vids.current.set(id, el); else vids.current.delete(id);
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
            const i = items.findIndex((it) => it.id === id);
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
  }, [items]);

  /* 소리는 한 번에 한 편만 — 다른 것을 켜면 앞엣것은 음소거로 돌아간다 */
  useEffect(() => {
    for (const [id, v] of vids.current) v.muted = id !== loud;
  }, [loud]);

  const go = (dir: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const next = Math.min(items.length - 1, Math.max(0, active + dir));
    const card = rail.querySelector<HTMLElement>(`[data-sid="${items[next]?.id}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="shorts">
      <div className="shorts-rail" ref={railRef}>
        {items.map((it) => (
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
                   대신 카드를 누르면 소리가 켜진다. 그것이 이 화면의 유일한 조작이다. */
                onClick={() => setLoud((cur) => (cur === it.id ? null : it.id))}
              />
              {/* 소리 상태 — 손님이 «지금 음소거구나»를 알아야 누를 생각을 한다 */}
              <button
                type="button"
                className="shorts-sound"
                aria-label={loud === it.id ? "소리 끄기" : "소리 켜기"}
                onClick={() => setLoud((cur) => (cur === it.id ? null : it.id))}
              >
                {loud === it.id ? "🔊" : "🔇"}
              </button>
              {/* 아래 그림자 위에 글 — 릴스와 같은 자리 */}
              <div className="shorts-meta">
                {it.caption && <p className="shorts-cap">{it.caption}</p>}
                {it.links.length > 0 && (
                  <div className="shorts-links">
                    {it.links.map((l) => (
                      <a
                        key={l.provider}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shorts-pill"
                      >
                        <span className="shorts-dot" style={{ background: DOT[l.provider] }} />
                        {LABEL[l.provider]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {items.length > 1 && (
        <>
          {/* PC 전용 좌우 화살표 — 폰에서는 손가락으로 넘긴다 */}
          <button type="button" className="shorts-arrow left" onClick={() => go(-1)} aria-label="이전 영상">‹</button>
          <button type="button" className="shorts-arrow right" onClick={() => go(1)} aria-label="다음 영상">›</button>
          <div className="shorts-dots" style={{ color: onInk }}>
            {items.map((it, i) => (
              <span key={it.id} className={i === active ? "on" : ""} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
