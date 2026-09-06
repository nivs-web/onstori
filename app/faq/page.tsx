import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";
import { FaqList } from "@/components/site/blocks";
import { FAQ } from "@/config/faq";

export const metadata: Metadata = { title: "자주묻는질문 — 온스토리", description: "온스토리란 · 요금 · 녹화 · 질문 · 발행 · 홈페이지 · 개인정보. 궁금한 것부터." };

/** 자주묻는질문 — 내용의 단일 출처는 config/faq.ts. 색·간격은 globals.css 토큰. */
export default function FaqPage() {
  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader current="/faq" />
      <PageHero
        kicker="자주묻는질문"
        title="궁금한 것부터"
        sub="여기 없는 질문은 카카오톡 채널(준비 중)로 보내 주세요. 답이 되는 질문은 이 페이지에 더합니다."
      >
        <nav className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }} aria-label="분류">
          {FAQ.map((g) => (
            <Link
              key={g.id}
              href={`#${g.id}`}
              className="t-small flex items-center font-semibold"
              style={{
                border: "1px solid var(--n-200)", background: "var(--n-0)",
                borderRadius: "var(--r-full)", padding: "0 var(--s-4)",
                minHeight: "var(--tap)", color: "var(--n-700)",
              }}
            >
              {g.title}
            </Link>
          ))}
        </nav>
      </PageHero>

      <section className="surface-0 reveal" style={{ paddingBottom: "var(--s-8)" }}>
        <div className="wrap grid" style={{ gap: "var(--s-7)" }}>
          {FAQ.map((g, i) => (
            <div key={g.id} className="grid md:grid-cols-[220px_1fr]" style={{ gap: "var(--s-4)" }}>
              <h2 className="t-h2">
                <span className="t-small font-bold" style={{ marginRight: "var(--s-2)", fontFamily: "var(--font-body)", color: "var(--green-700)" }}>{i + 1}</span>
                {g.title}
              </h2>
              <FaqList id={g.id} items={g.items} />
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
