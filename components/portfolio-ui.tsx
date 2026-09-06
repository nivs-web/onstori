"use client";

import { useState } from "react";
import { PORTFOLIO_TABS } from "@/config/industries";
import { PhoneFrame } from "./phone-frame";
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
                : { border: "1px solid var(--n-200)", color: "var(--n-600)", background: "var(--n-0)" }),
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => (
          <figure key={it.slug} className="mx-auto w-full" style={{ maxWidth: 270 }}>
            <PhoneFrame slug={it.slug} title={it.name} />
            <figcaption className="flex items-center justify-between" style={{ marginTop: "var(--s-3)", gap: "var(--s-2)" }}>
              <div className="min-w-0">
                <p className="truncate t-small font-bold">
                  {it.featured && <span className="mr-1 text-accent">★</span>}{it.name}
                </p>
                <p className="t-caption" style={{ color: "var(--muted)" }}>{it.tag}</p>
              </div>
              <a href={`/${it.slug}`} target="_blank" rel="noreferrer"
                className="t-small inline-flex items-center whitespace-nowrap font-semibold"
                style={{
                  minHeight: "var(--tap)", paddingInline: "var(--s-4)", borderRadius: "var(--r-full)",
                  border: "1px solid var(--n-200)", color: "var(--n-900)",
                  transition: "border-color var(--dur-2) var(--ease)",
                }}>
                라이브 보기 ↗
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
