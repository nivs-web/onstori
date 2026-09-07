"use client";

import { ThemeCard } from "./theme-card";
import type { ShowcaseItem } from "./portfolio";

/**
 * 포트폴리오 — 미리 찍은 스크린샷 카드 8장.
 *
 * ⚠ 업종 탭(전체·인테리어·시공·건설·카페·식당)을 없앴다(2026-09-07 회장님).
 *   보여주는 게 8개뿐이라 걸러 낼 것이 없었고, 탭이 있으면 손님이 "더 있나?" 하고
 *   눌러 보게 만든 뒤 빈 화면을 보여 준다. 상호명과 [보기] 만 남긴다.
 */
export function PortfolioTabs({ items }: { items: ShowcaseItem[] }) {
  /* 한 줄 3개 × 2줄 = **6개**까지만(2026-09-07 회장님: 4×2 는 조잡했다).
     ⚠ 나중에 [전체] 6개 → 업종 탭을 누르면 더 나오는 구조로 바꾼다. 그때 이 숫자만 늘리면 된다. */
  const shown = items.slice(0, 6);

  return (
    <div>
      {/* 살아 있는 사이트를 iframe 으로 띄우지 않는다 — 미리 찍은 스크린샷이다.
          폰에서는 가로로 밀어 넘기고 다음 카드가 살짝 보인다(.tcard-rail). */}
      <div className="tcard-rail" style={{ marginTop: "var(--s-6)" }}>
        {shown.map((it) => (
          <figure key={it.slug} style={{ margin: 0 }}>
            {it.pc && it.phone ? (
              <ThemeCard href={`/${it.slug}`} name={it.name} tag={it.tag} pc={it.pc} phone={it.phone} />
            ) : (
              /* 아직 안 찍힌 사이트 — 카드 자리는 지킨다.
                 ⚠ 전에는 브라우저 틀(.tcard-bar)만 덩그러니 놨는데, 그 틀을 뺀 뒤로는
                 (2026-09-07 회장님) 아무것도 없는 회색 상자가 된다. `/my` 와 같은 문구를 쓴다. */
              <a href={`/${it.slug}`} target="_blank" rel="noreferrer" className="tcard flex items-center justify-center" aria-label={`${it.name} 홈페이지 보기`}>
                <span className="t-caption" style={{ color: "var(--text-soft)" }}>미리보기 준비 중</span>
              </a>
            )}
            <figcaption className="flex items-center justify-between" style={{ marginTop: "var(--s-3)", gap: "var(--s-2)" }}>
              <div className="min-w-0">
                {/* ⚠ 전에는 여기 ★ 가 붙었다. 그건 어드민의 "첫 화면 추천" 표시로,
                    손님에게는 아무 뜻이 없었다 — 없앴다(2026-09-07 회장님).
                    it.featured 는 히어로에 쓸 사이트를 고를 때만 쓴다(app/page.tsx). */}
                <p className="t-body truncate font-bold" style={{ color: "var(--text-strong)" }}>
                  {it.name}
                </p>
              </div>
              <span className="t-small whitespace-nowrap font-semibold" style={{ color: "var(--green-700)" }}>보기 ↗</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
