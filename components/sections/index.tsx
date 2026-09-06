import Image from "next/image";
import type { SectionT, SiteDocT, StoryEntryT, ThemeT } from "@/lib/schema";
import { workCount } from "@/lib/stories";
import { telValue } from "@/lib/phone";
import QuoteForm from "./quote-form";

/**
 * 섹션 렌더러 v1 — JSON을 화면으로.
 * ⚠ 스키마 변경 시 4곳 동시 수정 (CLAUDE.md 불변 규칙 2)
 *
 * 색은 사장님 팔레트(--s-*)만 쓴다 — 색을 하드코딩하지 않는다.
 * 간격·모서리·글자 크기·모션은 app/globals.css 의 공용 토큰(--s-1…, --r-*, --t-*, --dur-*)을 쓴다.
 * ⚠ 팔레트 변수(--s-bg 등)와 간격 변수(--s-1 등)는 이름이 겹치지 않는다 — 앞쪽은 낱말, 뒤쪽은 숫자다.
 */

export const PALETTES: Record<ThemeT["palette"], Record<string, string>> = {
  clean:   { bg: "#FFFFFF", ink: "#17202B", muted: "#66707E", line: "#E6EAF0", accent: "#1E5BD7", soft: "#EFF4FE", onAccent: "#FFFFFF" },
  warm:    { bg: "#FBF7F1", ink: "#2A2117", muted: "#7A6E5F", line: "#EBE2D6", accent: "#B4643C", soft: "#F5E8DC", onAccent: "#FFFFFF" },
  premium: { bg: "#12151B", ink: "#F2EEE6", muted: "#9BA0AB", line: "#262B36", accent: "#C8A24E", soft: "#1D222D", onAccent: "#12151B" },
  lively:  { bg: "#FFFFFF", ink: "#1D2430", muted: "#6A7383", line: "#E8EBF1", accent: "#E1465A", soft: "#FBE9EC", onAccent: "#FFFFFF" },
};

type Ctx = { doc: SiteDocT; stories: StoryEntryT[]; slug: string };

/* ── 앵커 ── 햄버거 시트가 이 목록으로 차례를 만든다 (site-chrome.tsx) */

/** 섹션 종류 → 앵커 id. 같은 종류가 두 번 있어도 첫 번째만 차례에 올린다. */
export const ANCHOR_OF: Partial<Record<SectionT["type"], string>> = {
  about: "about", storyFeed: "stories", gallery: "gallery", portfolioGallery: "portfolio",
  processSteps: "process", reviews: "reviews", menuPrice: "menu", hoursCard: "hours",
  map: "map", quoteForm: "quote",
};

/** 시트에 올릴 차례. 제목이 비어 있으면 종류의 기본 이름을 쓴다. */
export function SECTION_ANCHORS(doc: SiteDocT): { href: string; label: string }[] {
  const fallback: Partial<Record<SectionT["type"], string>> = {
    about: "소개", storyFeed: "작업 기록", gallery: "사진", portfolioGallery: "시공 사례",
    processSteps: "진행 과정", reviews: "후기", menuPrice: "가격", hoursCard: "영업시간",
    map: "오시는 길", quoteForm: "견적 문의",
  };
  const seen = new Set<string>();
  const out: { href: string; label: string }[] = [];
  for (const s of doc.sections) {
    const id = ANCHOR_OF[s.type];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = "title" in s && typeof s.title === "string" ? s.title.trim() : "";
    out.push({ href: `#${id}`, label: title || fallback[s.type] || id });
  }
  return out;
}

/* ── 공통 부품 ── */

function SectionShell({ id, title, children }: { id?: string; title?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="reveal"
      style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-8)", scrollMarginTop: "var(--bar-h)" }}
    >
      <div className="mx-auto max-w-3xl">
        {title && (
          <h2 className="t-h2" style={{ marginBottom: "var(--s-5)", color: "var(--s-ink)", fontFamily: "inherit" }}>
            <span
              className="mr-2 inline-block"
              style={{ height: 3, width: 24, transform: "translateY(-4px)", background: "var(--s-accent)" }}
            />
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

/**
 * 연결 수단의 단일 출처 — 히어로 CTA·햄버거 시트·하단 고정 바가 같은 값을 본다.
 * 값을 사본으로 늘리지 않고 여기서 파생한다.
 * 전화번호가 안내 문구면 tel 이 "" 로 돌아온다 — 호출부가 죽은 링크를 만들지 않게 한다.
 * map.phone 은 쓰지 않는다: 생성 시 값이 굳고 에디터에 수정 UI가 없어 사장님이 고칠 수 없는 값이다.
 */
export function contactOf(doc: SiteDocT): { tel: string; kakaoUrl: string } {
  const q = doc.sections.find((s) => s.type === "quoteForm");
  return {
    tel: telValue(q && "phone" in q ? q.phone : ""),
    kakaoUrl: (q && "kakaoUrl" in q ? q.kakaoUrl : "") ?? "",
  };
}

function ctaHref(action: string, ctx: Ctx): string {
  if (action === "quote") return "#quote";
  const { tel } = contactOf(ctx.doc);
  return tel ? `tel:${tel}` : "#quote";
}

/** next/image 가 쓸 수 있는 호스트인지 — next.config.ts 의 remotePatterns 와 같이 간다.
 *  옛 사이트의 낯선 호스트에 next/image 를 물리면 그 페이지가 통째로 500 이 된다. */
const OPTIMIZABLE = /^https:\/\/(img\.onstori\.com|wpsrfjqfbhmeriscdacu\.supabase\.co)\//;

/**
 * 손님 사이트 사진 — 허용 호스트면 next/image(AVIF·WebP·표시 크기에 맞춰 축소),
 * 아니면 평범한 <img> 로 떨어진다.
 *
 * ⚠ sizes 를 반드시 준다. 없으면 1920px 원본이 390px 폰으로 그대로 내려간다 —
 *   2026-09-06 실측에서 갤러리 사진 한 장이 113~158KB 였다.
 * ⚠ 비율은 바깥에서 style 로 고정한다. 사진이 늦게 와도 아래가 밀리지 않게(CLS).
 */
function Photo({
  src, alt, sizes, className, style, priority,
}: {
  src: string; alt: string; sizes: string;
  className?: string; style?: React.CSSProperties; priority?: boolean;
}) {
  if (!OPTIMIZABLE.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={className} style={style} />;
  }
  return (
    <span className={className} style={{ ...style, position: "relative", display: "block", overflow: "hidden" }}>
      <Image src={src} alt={alt} fill sizes={sizes} quality={65} loading={priority ? "eager" : "lazy"} style={{ objectFit: "cover" }} />
    </span>
  );
}

/* ── 섹션들 ── */

function HeroSec({ s, ctx, first }: { s: Extract<SectionT, { type: "hero" }>; ctx: Ctx; first?: boolean }) {
  const works = workCount(ctx.stories);
  const optimizable = Boolean(s.image && OPTIMIZABLE.test(s.image));
  return (
    /* 폰에서 화면을 꽉 채운다(100svh) — svh 라 주소창이 접혔다 펴져도 높이가 안 튄다.
       PC 는 100 이면 과하다. .reveal 을 붙이지 않는다 — 히어로가 LCP 요소다. */
    <header
      id="top"
      className="relative flex flex-col justify-end overflow-hidden"
      style={{
        /* 첫 섹션일 때만 화면을 꽉 채운다(100svh).
           위에 띠가 있으면 100svh 는 화면을 넘어가 리드·CTA 가 아래로 밀려 안 보인다 —
           실제로 sample-interior 가 그랬다. 그때는 72svh 로 줄인다. */
        minHeight: first ? "100svh" : "72svh",
        /* main 이 고정 바만큼 위를 비워 뒀다. 히어로가 첫 섹션일 때만 그 자리를 되가져와
           사진이 바 뒤까지 꽉 찬다. 띠가 먼저 오는 사이트에서는 되가져오면 띠를 덮는다. */
        marginTop: first ? "calc(var(--bar-h) * -1)" : undefined,
        paddingInline: "var(--gutter)",
        paddingTop: "calc(var(--bar-h) + var(--s-7))",
        paddingBottom: "calc(var(--dock-h) + var(--s-6) + env(safe-area-inset-bottom))",
      }}
    >
      {s.image ? (
        <>
          {optimizable ? (
            <Image
              src={s.image}
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              quality={65}
              style={{ objectFit: "cover" }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={s.image} alt="" fetchPriority="high" decoding="async"
                 className="absolute inset-0 h-full w-full" style={{ objectFit: "cover" }} />
          )}
          {/* 아래 40% 에만 그라데이션 — 흰 글자가 얹히는 자리다. 위쪽 사진은 가리지 않는다. */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: "40%", background: "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--n-900) 60%, transparent) 100%)" }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, var(--s-accent) 0%, var(--s-ink) 100%)" }} />
      )}
      <div className="relative mx-auto w-full max-w-3xl" style={{ color: "var(--n-0)" }}>
        {s.eyebrow && (
          <p className="t-caption font-medium" style={{ marginBottom: "var(--s-3)", color: "inherit", letterSpacing: "var(--tracking-kicker)" }}>{s.eyebrow}</p>
        )}
        <h1 className="t-h1" style={{ color: "inherit", fontFamily: "inherit", textWrap: "balance" }}>{s.headline}</h1>
        {/* 리드는 한 줄 — 히어로에 문장을 쌓지 않는다 */}
        {s.sub && <p className="t-lead measure" style={{ marginTop: "var(--s-3)", color: "inherit" }}>{s.sub}</p>}
        <div className="flex flex-wrap items-center" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
          <a
            href={ctaHref(s.cta.action, ctx)}
            className="t-body inline-flex items-center justify-center font-semibold"
            style={{
              minHeight: "var(--control-h-sm)", paddingInline: "var(--s-5)",
              borderRadius: "var(--r-md)", background: "var(--s-accent)", color: "var(--s-on-accent)",
            }}
          >
            {s.cta.label}
          </a>
          {works > 0 && (
            <span className="t-small" style={{ color: "inherit" }}>
              기록으로 증명 — <b>작업 기록 {works}건</b>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function AboutSec({ s }: { s: Extract<SectionT, { type: "about" }> }) {
  return (
    <SectionShell id="about" title={s.title}>
      {/* 사진이 있으면 본문 옆에 붙인다(모바일은 위). 뱅크 about 이미지는 3:2 중간 샷이라 비율을 유지한다 */}
      <div className={s.image ? "flex flex-col sm:flex-row sm:items-start" : undefined} style={s.image ? { gap: "var(--s-5)" } : undefined}>
        {s.image && (
          <Photo src={s.image} alt="" className="w-full sm:w-56 sm:flex-shrink-0"
                 sizes="(min-width: 640px) 224px, 100vw"
                 style={{ aspectRatio: "3 / 2", borderRadius: "var(--r-lg)", background: "var(--s-soft)" }} />
        )}
        <p className="t-body whitespace-pre-line" style={{ color: "var(--s-ink)" }}>{s.body}</p>
      </div>
      {s.stats && s.stats.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4" style={{ marginTop: "var(--s-6)", gap: "var(--s-3)" }}>
          {s.stats.map((st) => (
            <div key={st.label} className="text-center"
                 style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", padding: "var(--s-4)", background: "var(--s-soft)" }}>
              <dd className="t-h3" style={{ color: "var(--s-accent)" }}>{st.value}</dd>
              <dt className="t-caption" style={{ marginTop: "var(--s-1)", color: "var(--s-muted)" }}>{st.label}</dt>
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
    <SectionShell id="stories" title={s.title}>
      <ol className="relative" style={{ borderLeft: "2px solid var(--s-line)", paddingLeft: "var(--s-5)" }}>
        {items.map((e) => (
          <li key={e.id} className="relative" style={{ marginBottom: "var(--s-6)" }}>
            <span
              className="absolute"
              style={{ left: "calc((var(--s-5) + 7px) * -1)", top: 6, width: 12, height: 12, borderRadius: "var(--r-full)", background: "var(--s-bg)", border: "2px solid var(--s-accent)" }}
            />
            <p className="t-caption font-medium" style={{ color: "var(--s-muted)" }}>{e.entryDate} · {label[e.entryType]}</p>
            <h3 className="t-h3" style={{ marginTop: "var(--s-1)", color: "var(--s-ink)", fontFamily: "inherit" }}>{e.title}</h3>
            <p className="t-body" style={{ marginTop: "var(--s-1)", color: "var(--s-muted)" }}>{e.body}</p>
            {e.photos.length > 0 && (
              <div className="flex overflow-x-auto" style={{ marginTop: "var(--s-3)", gap: "var(--s-2)" }}>
                {e.photos.map((p) => (
                  <Photo key={p} src={p} alt={e.title} sizes="128px" className="flex-shrink-0"
                         style={{ width: 128, height: 96, borderRadius: "var(--r-sm)", background: "var(--s-soft)" }} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="t-small" style={{ marginTop: "var(--s-5)", color: "var(--s-muted)" }}>
        이야기가 쌓일수록 이 페이지가 두꺼워집니다 — 온스토리의 방식입니다.
      </p>
    </SectionShell>
  );
}

/** 사진 격자 — 모바일 1열 / 태블릿 2 / PC 3 (지시서 2-4). 비율 고정이라 로딩 중 안 튄다. */
function GallerySec({ s }: { s: Extract<SectionT, { type: "gallery" }> }) {
  return (
    <SectionShell id="gallery" title={s.title}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "var(--s-3)" }}>
        {s.photos.map((p) => (
          <Photo key={p} src={p} alt="" className="photo"
                 sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                 style={{ background: "var(--s-soft)" }} />
        ))}
      </div>
    </SectionShell>
  );
}

function ReviewsSec({ s }: { s: Extract<SectionT, { type: "reviews" }> }) {
  return (
    <SectionShell id="reviews" title={s.title}>
      <div className="grid sm:grid-cols-2" style={{ gap: "var(--s-3)" }}>
        {s.items.map((r) => (
          <figure key={r.title} style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", padding: "var(--s-5)", background: "var(--s-soft)" }}>
            <blockquote className="t-body" style={{ color: "var(--s-ink)" }}>“{r.body}”</blockquote>
            <figcaption className="t-caption" style={{ marginTop: "var(--s-3)", color: "var(--s-muted)" }}>
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
    <SectionShell id="map" title={s.title}>
      <div style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", padding: "var(--s-5)" }}>
        <p className="t-body font-medium" style={{ color: "var(--s-ink)" }}>{s.address}</p>
        {s.note && <p className="t-small" style={{ marginTop: "var(--s-1)", color: "var(--s-muted)" }}>{s.note}</p>}
        <div className="flex flex-wrap" style={{ marginTop: "var(--s-4)", gap: "var(--s-3)" }}>
          {s.naverMapUrl && (
            <a href={s.naverMapUrl} target="_blank" rel="noreferrer"
               className="t-small inline-flex items-center justify-center font-medium"
               style={{ minHeight: "var(--tap)", paddingInline: "var(--s-5)", borderRadius: "var(--r-full)", border: "1px solid var(--s-accent)", color: "var(--s-accent)" }}>
              네이버 지도에서 보기 ↗
            </a>
          )}
          {s.phone && (
            <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`}
               className="t-small inline-flex items-center justify-center font-semibold"
               style={{ minHeight: "var(--tap)", paddingInline: "var(--s-5)", borderRadius: "var(--r-full)", background: "var(--s-accent)", color: "var(--s-on-accent)" }}>
              전화하기 {s.phone}
            </a>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/** 상단 띠 — 높이를 고정한다. 조건부로 나타나면 아래가 통째로 밀린다(CLS). */
function BannerSec({ s }: { s: Extract<SectionT, { type: "banner" }> }) {
  const inner = (
    <div
      className="t-small flex items-center justify-center text-center font-medium"
      style={{ minHeight: "var(--s-7)", paddingInline: "var(--gutter)", background: "var(--s-accent)", color: "var(--s-on-accent)" }}
    >
      {s.text}{s.link ? " →" : ""}
    </div>
  );
  return s.link ? <a href={s.link}>{inner}</a> : inner;
}

function PortfolioSec({ s }: { s: Extract<SectionT, { type: "portfolioGallery" }> }) {
  return (
    <SectionShell id="portfolio" title={s.title}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "var(--s-4)" }}>
        {s.items.map((it) => (
          <figure key={it.title} className="overflow-hidden" style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)" }}>
            <Photo src={it.image} alt={it.title} className="photo"
                   sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                   style={{ borderRadius: 0, background: "var(--s-soft)" }} />
            <figcaption className="flex items-baseline justify-between" style={{ gap: "var(--s-2)", padding: "var(--s-4)" }}>
              <div>
                <p className="t-body font-semibold" style={{ color: "var(--s-ink)" }}>{it.title}</p>
                {it.date && <p className="t-caption" style={{ color: "var(--s-muted)" }}>{it.date}</p>}
              </div>
              {it.tag && (
                <span className="t-caption font-medium"
                      style={{ borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-2)", background: "var(--s-soft)", color: "var(--s-accent)" }}>{it.tag}</span>
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
    <SectionShell id="process" title={s.title}>
      <ol className="grid sm:grid-cols-2" style={{ gap: "var(--s-3)" }}>
        {s.steps.map((st, i) => (
          <li key={st.name} className="flex items-start"
              style={{ gap: "var(--s-4)", border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", padding: "var(--s-4)" }}>
            <span className="t-small flex flex-shrink-0 items-center justify-center font-bold"
                  style={{ width: 32, height: 32, borderRadius: "var(--r-full)", background: "var(--s-accent)", color: "var(--s-on-accent)" }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="t-body font-semibold" style={{ color: "var(--s-ink)" }}>{st.name}</p>
              {st.desc && <p className="t-body" style={{ marginTop: "var(--s-1)", color: "var(--s-muted)" }}>{st.desc}</p>}
            </div>
            {/* 단계 사진 — 번호·글 다음 오른쪽 끝에 작게. 2단 그리드라 폭을 많이 못 준다 */}
            {st.image && (
              <Photo src={st.image} alt="" sizes="56px" className="flex-shrink-0"
                     style={{ width: 56, height: 56, borderRadius: "var(--r-sm)", background: "var(--s-soft)" }} />
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
    <section
      id="quote"
      className="reveal"
      style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-8)", background: "var(--s-soft)", scrollMarginTop: "var(--bar-h)" }}
    >
      <QuoteForm s={s} slug={ctx.slug} />
    </section>
  );
}

function HoursSec({ s }: { s: Extract<SectionT, { type: "hoursCard" }> }) {
  return (
    <SectionShell id="hours" title={s.title}>
      <div style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", padding: "var(--s-5)", background: "var(--s-soft)" }}>
        <p className="t-body whitespace-pre-line" style={{ color: "var(--s-ink)" }}>{s.hours}</p>
        {s.holidayNote && <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--s-muted)" }}>{s.holidayNote}</p>}
      </div>
    </SectionShell>
  );
}

function MenuSec({ s }: { s: Extract<SectionT, { type: "menuPrice" }> }) {
  return (
    <SectionShell id="menu" title={s.title}>
      <ul className="divide-y" style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-md)", borderColor: "var(--s-line)" }}>
        {s.items.map((m) => (
          <li key={m.name} className="flex items-baseline justify-between" style={{ gap: "var(--s-4)", padding: "var(--s-4)", borderColor: "var(--s-line)" }}>
            <div>
              <p className="t-body font-medium" style={{ color: "var(--s-ink)" }}>{m.name}</p>
              {m.desc && <p className="t-small" style={{ marginTop: "var(--s-1)", color: "var(--s-muted)" }}>{m.desc}</p>}
            </div>
            <p className="t-body whitespace-nowrap font-semibold" style={{ color: "var(--s-accent)" }}>{m.price}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* ── 레지스트리 ── */

export function RenderSection({ s, ctx, index }: { s: SectionT; ctx: Ctx; index?: number }) {
  switch (s.type) {
    case "hero": return <HeroSec s={s} ctx={ctx} first={index === 0} />;
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
