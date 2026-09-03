import type { SectionT, SiteDocT, StoryEntryT, ThemeT } from "@/lib/schema";
import { workCount } from "@/lib/sites";
import QuoteForm from "./quote-form";

/**
 * 섹션 렌더러 v1 — JSON을 화면으로.
 * ⚠ 스키마 변경 시 4곳 동시 수정 (CLAUDE.md 불변 규칙 2)
 * 스타일은 테마 CSS 변수(--s-*)만 사용 — 색을 하드코딩하지 않는다.
 */

export const PALETTES: Record<ThemeT["palette"], Record<string, string>> = {
  clean:   { bg: "#FFFFFF", ink: "#17202B", muted: "#66707E", line: "#E6EAF0", accent: "#1E5BD7", soft: "#EFF4FE", onAccent: "#FFFFFF" },
  warm:    { bg: "#FBF7F1", ink: "#2A2117", muted: "#7A6E5F", line: "#EBE2D6", accent: "#B4643C", soft: "#F5E8DC", onAccent: "#FFFFFF" },
  premium: { bg: "#12151B", ink: "#F2EEE6", muted: "#9BA0AB", line: "#262B36", accent: "#C8A24E", soft: "#1D222D", onAccent: "#12151B" },
  lively:  { bg: "#FFFFFF", ink: "#1D2430", muted: "#6A7383", line: "#E8EBF1", accent: "#E1465A", soft: "#FBE9EC", onAccent: "#FFFFFF" },
};

type Ctx = { doc: SiteDocT; stories: StoryEntryT[]; slug: string };

/* ── 공통 부품 ── */

function SectionShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {title && (
          <h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--s-ink)" }}>
            <span className="mr-2 inline-block h-[3px] w-6 translate-y-[-4px]" style={{ background: "var(--s-accent)" }} />
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

function ctaHref(action: string, ctx: Ctx): string {
  const quote = ctx.doc.sections.find((s) => s.type === "quoteForm");
  const map = ctx.doc.sections.find((s) => s.type === "map");
  const phone = (quote && "phone" in quote && quote.phone) || (map && "phone" in map && map.phone) || "";
  if (action === "quote") return "#quote";
  return phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : "#quote";
}

/* ── 섹션들 ── */

function HeroSec({ s, ctx }: { s: Extract<SectionT, { type: "hero" }>; ctx: Ctx }) {
  const works = workCount(ctx.stories);
  return (
    <header className="relative flex min-h-[72svh] flex-col justify-end overflow-hidden px-5 pb-12 pt-24">
      {s.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,12,16,0.25) 0%, rgba(10,12,16,0.72) 100%)" }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, var(--s-accent) 0%, var(--s-ink) 100%)" }} />
      )}
      <div className="relative mx-auto w-full max-w-3xl text-white">
        {s.eyebrow && <p className="mb-3 text-[13px] font-medium tracking-[0.18em]">{s.eyebrow}</p>}
        <h1 className="text-3xl font-bold leading-snug sm:text-4xl" style={{ textWrap: "balance" }}>{s.headline}</h1>
        {s.sub && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85">{s.sub}</p>}
        <div className="mt-7 flex items-center gap-4">
          <a href={ctaHref(s.cta.action, ctx)}
             className="rounded-full px-6 py-3 text-[15px] font-semibold shadow-lg"
             style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}>
            {s.cta.label}
          </a>
          {works > 0 && (
            <span className="text-[13.5px] text-white/80">
              기록으로 증명 — <b className="text-white">작업 기록 {works}건</b>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function AboutSec({ s }: { s: Extract<SectionT, { type: "about" }> }) {
  return (
    <SectionShell title={s.title}>
      {/* 사진이 있으면 본문 옆에 붙인다(모바일은 위). 뱅크 about 이미지는 3:2 중간 샷이라 비율을 유지한다 */}
      <div className={s.image ? "flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6" : undefined}>
        {s.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={s.image} alt="" className="aspect-[3/2] w-full rounded-2xl object-cover sm:w-56 sm:flex-shrink-0" />
        )}
        <p className="whitespace-pre-line text-[15.5px] leading-8" style={{ color: "var(--s-ink)" }}>{s.body}</p>
      </div>
      {s.stats && s.stats.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {s.stats.map((st) => (
            <div key={st.label} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--s-line)", background: "var(--s-soft)" }}>
              <dd className="text-xl font-bold" style={{ color: "var(--s-accent)" }}>{st.value}</dd>
              <dt className="mt-1 text-[12.5px]" style={{ color: "var(--s-muted)" }}>{st.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </SectionShell>
  );
}

function StoryFeedSec({ s, ctx }: { s: Extract<SectionT, { type: "storyFeed" }>; ctx: Ctx }) {
  const items = [...ctx.stories].sort((a, b) => b.entryDate.localeCompare(a.entryDate)).slice(0, s.showCount);
  if (items.length === 0) return null;
  const label: Record<StoryEntryT["entryType"], string> = { work: "작업 기록", news: "소식", milestone: "이정표", guest: "손님 이야기" };
  return (
    <SectionShell title={s.title}>
      <ol className="relative space-y-8 border-l-2 pl-6" style={{ borderColor: "var(--s-line)" }}>
        {items.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2"
                  style={{ background: "var(--s-bg)", borderColor: "var(--s-accent)" }} />
            <p className="text-[12px] font-medium tracking-wide" style={{ color: "var(--s-muted)" }}>
              {e.entryDate} · {label[e.entryType]}
            </p>
            <h3 className="mt-1 text-[16px] font-semibold" style={{ color: "var(--s-ink)" }}>{e.title}</h3>
            <p className="mt-1 text-[14.5px] leading-7" style={{ color: "var(--s-muted)" }}>{e.body}</p>
            {e.photos.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {e.photos.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={p} src={p} alt={e.title} className="h-24 w-32 flex-shrink-0 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px]" style={{ color: "var(--s-muted)" }}>
        이야기가 쌓일수록 이 페이지가 두꺼워집니다 — 온스토리의 방식입니다.
      </p>
    </SectionShell>
  );
}

function GallerySec({ s }: { s: Extract<SectionT, { type: "gallery" }> }) {
  return (
    <SectionShell title={s.title}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {s.photos.map((p) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={p} src={p} alt="" className="aspect-square w-full rounded-xl object-cover" />
        ))}
      </div>
    </SectionShell>
  );
}

function ReviewsSec({ s }: { s: Extract<SectionT, { type: "reviews" }> }) {
  return (
    <SectionShell title={s.title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {s.items.map((r) => (
          <figure key={r.title} className="rounded-xl border p-5" style={{ borderColor: "var(--s-line)", background: "var(--s-soft)" }}>
            <blockquote className="text-[14.5px] leading-7" style={{ color: "var(--s-ink)" }}>“{r.body}”</blockquote>
            <figcaption className="mt-3 text-[12.5px]" style={{ color: "var(--s-muted)" }}>
              {r.title}{r.source ? ` · ${r.source}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

function MapSecC({ s }: { s: Extract<SectionT, { type: "map" }> }) {
  return (
    <SectionShell title={s.title}>
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--s-line)" }}>
        <p className="text-[15.5px] font-medium" style={{ color: "var(--s-ink)" }}>{s.address}</p>
        {s.note && <p className="mt-1 text-[13.5px]" style={{ color: "var(--s-muted)" }}>{s.note}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {s.naverMapUrl && (
            <a href={s.naverMapUrl} target="_blank" rel="noreferrer"
               className="rounded-full border px-5 py-2 text-[13.5px] font-medium"
               style={{ borderColor: "var(--s-accent)", color: "var(--s-accent)" }}>
              네이버 지도에서 보기 ↗
            </a>
          )}
          {s.phone && (
            <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`}
               className="rounded-full px-5 py-2 text-[13.5px] font-semibold"
               style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}>
              전화하기 {s.phone}
            </a>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function BannerSec({ s }: { s: Extract<SectionT, { type: "banner" }> }) {
  const inner = (
    <div className="px-5 py-3 text-center text-[13.5px] font-medium" style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}>
      {s.text}{s.link ? " →" : ""}
    </div>
  );
  return s.link ? <a href={s.link}>{inner}</a> : inner;
}

function PortfolioSec({ s }: { s: Extract<SectionT, { type: "portfolioGallery" }> }) {
  return (
    <SectionShell title={s.title}>
      <div className="grid gap-4 sm:grid-cols-2">
        {s.items.map((it) => (
          <figure key={it.title} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--s-line)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.image} alt={it.title} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="flex items-baseline justify-between gap-2 p-4">
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--s-ink)" }}>{it.title}</p>
                {it.date && <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--s-muted)" }}>{it.date}</p>}
              </div>
              {it.tag && (
                <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                      style={{ background: "var(--s-soft)", color: "var(--s-accent)" }}>{it.tag}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

function ProcessSec({ s }: { s: Extract<SectionT, { type: "processSteps" }> }) {
  return (
    <SectionShell title={s.title}>
      <ol className="grid gap-3 sm:grid-cols-2">
        {s.steps.map((st, i) => (
          <li key={st.name} className="flex items-start gap-4 rounded-xl border p-4" style={{ borderColor: "var(--s-line)" }}>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: "var(--s-accent)", color: "var(--s-on-accent)" }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: "var(--s-ink)" }}>{st.name}</p>
              {st.desc && <p className="mt-0.5 text-[13.5px] leading-6" style={{ color: "var(--s-muted)" }}>{st.desc}</p>}
            </div>
            {/* 단계 사진 — 번호·글 다음 오른쪽 끝에 작게. 2단 그리드라 폭을 많이 못 준다 */}
            {st.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={st.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
            )}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function QuoteFormSec({ s, ctx }: { s: Extract<SectionT, { type: "quoteForm" }>; ctx: Ctx }) {
  // 실제 접수 폼은 클라이언트 컴포넌트로 분리 — docs/specs/inquiry.md 5장
  return (
    <section id="quote" className="px-5 py-14" style={{ background: "var(--s-soft)" }}>
      <QuoteForm s={s} slug={ctx.slug} />
    </section>
  );
}

function HoursSec({ s }: { s: Extract<SectionT, { type: "hoursCard" }> }) {
  return (
    <SectionShell title={s.title}>
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--s-line)", background: "var(--s-soft)" }}>
        <p className="whitespace-pre-line text-[15px] leading-8" style={{ color: "var(--s-ink)" }}>{s.hours}</p>
        {s.holidayNote && <p className="mt-2 text-[13px]" style={{ color: "var(--s-muted)" }}>{s.holidayNote}</p>}
      </div>
    </SectionShell>
  );
}

function MenuSec({ s }: { s: Extract<SectionT, { type: "menuPrice" }> }) {
  return (
    <SectionShell title={s.title}>
      <ul className="divide-y rounded-xl border" style={{ borderColor: "var(--s-line)" }}>
        {s.items.map((m) => (
          <li key={m.name} className="flex items-baseline justify-between gap-4 p-4" style={{ borderColor: "var(--s-line)" }}>
            <div>
              <p className="text-[15px] font-medium" style={{ color: "var(--s-ink)" }}>{m.name}</p>
              {m.desc && <p className="mt-0.5 text-[13px]" style={{ color: "var(--s-muted)" }}>{m.desc}</p>}
            </div>
            <p className="whitespace-nowrap text-[15px] font-semibold" style={{ color: "var(--s-accent)" }}>{m.price}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* ── 레지스트리 ── */

export function RenderSection({ s, ctx }: { s: SectionT; ctx: Ctx }) {
  switch (s.type) {
    case "hero": return <HeroSec s={s} ctx={ctx} />;
    case "about": return <AboutSec s={s} />;
    case "storyFeed": return <StoryFeedSec s={s} ctx={ctx} />;
    case "gallery": return <GallerySec s={s} />;
    case "reviews": return <ReviewsSec s={s} />;
    case "map": return <MapSecC s={s} />;
    case "banner": return <BannerSec s={s} />;
    case "portfolioGallery": return <PortfolioSec s={s} />;
    case "processSteps": return <ProcessSec s={s} />;
    case "quoteForm": return <QuoteFormSec s={s} ctx={ctx} />;
    case "hoursCard": return <HoursSec s={s} />;
    case "menuPrice": return <MenuSec s={s} />;
  }
}
