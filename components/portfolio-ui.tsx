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
      <div className="mt-6 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition"
            style={tab === t
              ? { background: "var(--ink)", color: "#fff" }
              : { border: "1px solid var(--line)", color: "var(--muted)", background: "#fff" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => (
          <figure key={it.slug} className="mx-auto w-full max-w-[270px] transition-transform duration-300 hover:-translate-y-1.5">
            <PhoneFrame slug={it.slug} title={it.name} />
            <figcaption className="mt-3.5 flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-bold">
                  {it.featured && <span className="mr-1 text-amber-500">★</span>}{it.name}
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>{it.tag}</p>
              </div>
              <a href={`/${it.slug}`} target="_blank" rel="noreferrer"
                className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
                style={{ border: "1px solid var(--line)", color: "var(--ink)" }}>
                라이브 보기 ↗
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
