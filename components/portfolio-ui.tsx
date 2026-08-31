"use client";

import { useState } from "react";
import { PORTFOLIO_TABS } from "@/config/industries";
import type { ShowcaseItem } from "./portfolio";

/**
 * 포트폴리오 탭 + 폰 프레임 라이브 프리뷰.
 * - iframe에 실제 사이트(onstori.com/{slug})를 375px 모바일 폭으로 렌더 후 축소
 * - 프레임 안에서 휠/터치 스크롤이 그대로 작동 (진짜 사이트니까)
 * - 활성 탭의 카드만 마운트 + loading="lazy" 로 성능 보호
 */
export function PortfolioTabs({ items }: { items: ShowcaseItem[] }) {
  const [tab, setTab] = useState<(typeof PORTFOLIO_TABS)[number]>("전체");
  const tabs = PORTFOLIO_TABS.filter((t) => t === "전체" || items.some((i) => i.tag === t));
  const shown = items.filter((i) => tab === "전체" || i.tag === tab);

  return (
    <div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
              tab === t ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => <PhoneCard key={it.slug} item={it} />)}
      </div>
    </div>
  );
}

function PhoneCard({ item }: { item: ShowcaseItem }) {
  // iframe 375×812 를 0.62 축소 → 화면 232×503
  const SCALE = 0.62;
  return (
    <figure className="mx-auto w-full max-w-[270px]">
      <div className="rounded-[2.4rem] border border-neutral-200 bg-neutral-900 p-[9px] shadow-[0_18px_50px_-18px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-1.5">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-white">
          {/* 노치 */}
          <div className="absolute left-1/2 top-1.5 z-10 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-neutral-900" />
          <div style={{ width: 375 * SCALE, height: 812 * SCALE }}>
            <iframe
              src={`/${item.slug}`}
              title={item.name}
              loading="lazy"
              style={{ width: 375, height: 812, transform: `scale(${SCALE})`, transformOrigin: "top left", border: 0 }}
            />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold">
            {item.featured && <span className="mr-1 text-amber-500">★</span>}{item.name}
          </p>
          <p className="text-[11.5px] text-neutral-400">{item.tag}</p>
        </div>
        <a href={`/${item.slug}`} target="_blank" rel="noreferrer"
          className="whitespace-nowrap rounded-full border border-neutral-300 px-3 py-1.5 text-[12px] font-semibold text-neutral-600 hover:border-blue-600 hover:text-blue-700">
          라이브 보기 ↗
        </a>
      </figcaption>
    </figure>
  );
}
