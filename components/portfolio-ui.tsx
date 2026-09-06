"use client";

import { useState } from "react";
import { PORTFOLIO_TABS } from "@/config/industries";
import { ThemeCard } from "./theme-card";
import type { ShowcaseItem } from "./portfolio";

/** 포트폴리오 탭 + 폰 프레임 라이브 카드 — 활성 탭만 마운트, iframe lazy */
export function PortfolioTabs({ items }: { items: ShowcaseItem[] }) {
  const [tab, setTab] = useState<(typeof PORTFOLIO_TABS)[number]>("전체");
  const tabs = PORTFOLIO_TABS.filter((t) => t === "전체" || items.some((i) => i.tag === t));
  const shown = items.filter((i) => tab === "전체" || i.tag === tab);

  return (
    <div>
      <div className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="t-small inline-flex items-center font-semibold"
            style={{
              minHeight: "var(--tap)", paddingInline: "var(--s-4)", borderRadius: "var(--r-full)",
              transition: "background var(--dur-2) var(--ease), border-color var(--dur-2) var(--ease)",
              ...(tab === t
                ? { background: "var(--n-900)", color: "var(--n-0)", border: "1px solid var(--n-900)" }
                : { border: "1px solid var(--n-200)", color: "var(--text)", background: "var(--n-0)" }),
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* 살아 있는 사이트를 iframe 으로 띄우지 않는다 — 미리 찍은 스크린샷이다.
          폰에서는 가로로 밀어 넘기고 다음 카드가 살짝 보인다(.tcard-rail). */}
      <div className="tcard-rail" style={{ marginTop: "var(--s-6)" }}>
        {shown.map((it) => (
          <figure key={it.slug} style={{ margin: 0 }}>
            {it.pc && it.phone ? (
              <ThemeCard href={`/${it.slug}`} name={it.name} tag={it.tag} pc={it.pc} phone={it.phone} />
            ) : (
              /* 아직 안 찍힌 사이트 — 카드 자리는 지키되 비워 둔다 */
              <a href={`/${it.slug}`} target="_blank" rel="noreferrer" className="tcard" aria-label={`${it.name} 홈페이지 보기`}>
                <span className="tcard-bar" aria-hidden><i /><i /><i /></span>
              </a>
            )}
            <figcaption className="flex items-center justify-between" style={{ marginTop: "var(--s-3)", gap: "var(--s-2)" }}>
              <div className="min-w-0">
                <p className="t-body truncate font-bold" style={{ color: "var(--text-strong)" }}>
                  {it.featured && <span className="mr-1" style={{ color: "var(--accent)" }}>★</span>}{it.name}
                </p>
                <p className="t-caption">{it.tag}</p>
              </div>
              <span className="t-small whitespace-nowrap font-semibold" style={{ color: "var(--green-700)" }}>보기 ↗</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
