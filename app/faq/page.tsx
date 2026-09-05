import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";
import { FaqList } from "@/components/site/blocks";
import { FAQ } from "@/config/faq";

export const metadata: Metadata = { title: "자주묻는질문 — 온스토리", description: "온스토리란 · 요금 · 녹화 · 질문 · 발행 · 홈페이지 · 개인정보. 궁금한 것부터." };

/** 자주묻는질문 — 레멘토 FAQ 7분류 (기획1 /mainplan #faq). 내용은 config/faq.ts 가 단일 출처 */
export default function FaqPage() {
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader current="/faq" />
      <PageHero kicker="자주묻는질문" title="궁금한 것부터" sub="여기 없는 질문은 카카오톡 채널(준비 중)로 보내 주세요. 답이 되는 질문은 이 페이지에 더합니다.">
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="분류">
          {FAQ.map((g) => <Link key={g.id} href={`#${g.id}`} className="rounded-full border bg-white px-3.5 py-1.5 text-[13px] font-semibold" style={{ borderColor: "var(--line)" }}>{g.title}</Link>)}
        </nav>
      </PageHero>
      <section className="wrap grid gap-12 pb-20">
        {FAQ.map((g, i) => (
          <div key={g.id} className="grid gap-4 md:grid-cols-[220px_1fr]">
            <h2 className="font-display text-[22px]" style={{ color: "var(--forest)" }}><span className="mr-2 text-[13px] font-sans font-bold" style={{ color: "var(--teal)" }}>{i + 1}</span>{g.title}</h2>
            <FaqList id={g.id} items={g.items} />
          </div>
        ))}
      </section>
      <CtaBand />
      <SiteFooter />
    </main>
  );
}
