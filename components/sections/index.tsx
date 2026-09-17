import Image from "next/image";
import type { SectionT, SiteDocT, StoryEntryT, ThemeT } from "@/lib/schema";
import { INQUIRY_CTA_LABEL } from "@/config/industries";
import { workCount } from "@/lib/stories";
import { ANCHOR_OF, contactOf } from "./nav";
import QuoteForm from "./quote-form";
import type { ShortT } from "@/lib/shorts";
import ShortsFeed from "./shorts-feed";

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

/**
 * ★ `shorts` 는 2026-09-16 에 더했다 — 홈페이지에 걸린 영상 «전부».
 *   없으면 `undefined` 다(옛 호출부가 안 깨지게). 그때는 영상 섹션이 지금까지처럼 한 편만 그린다.
 */
type Ctx = {
  doc: SiteDocT; stories: StoryEntryT[]; slug: string; shorts?: ShortT[];
  /** 🔴 히어로 아래 «숏폼 무대»가 이미 섰는가 (2026-09-17 지시 [19]①) — 아래 영상 섹션이 이걸 보고 비킨다 */
  stageOn?: boolean;
};

/**
 * 강조색 위에 올릴 글자색을 **강조색에서 계산한다.**
 *
 * ⚠ 전에는 팔레트의 onAccent 를 그대로 썼다. 그런데 사장님이 강조색을 직접 고를 수 있어서
 *   (theme.accent), 어두운 팔레트에 어두운 강조색을 고르면 버튼 글자가 배경에 묻는다 —
 *   2026-09-07 barun 사이트에서 실제로 그랬다(강조 #3A3F47 위에 글자 #12151B).
 *   밝기를 재서 흰 글자와 검은 글자 중 대비가 큰 쪽을 고른다. 어떤 색을 골라도 읽힌다.
 */
export function onColor(bgHex: string): string {
  const h = bgHex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (!Number.isFinite(n) || v.length !== 6) return "#FFFFFF";
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  // 흰 글자 대비 vs 검은 글자 대비 — 큰 쪽
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? "#FFFFFF" : "#111111";
}

/* ★ 2026-09-10 — ANCHOR_OF · SECTION_ANCHORS · contactOf 는 `./nav` 로 옮겼다.
   그 셋을 "use client" 파일이 여기서 가져가는 바람에 **섹션 렌더러 13종이 통째로**
   손님 브라우저 번들에 실리고 있었다(2026-09-10 실측 — 번들에서 영상 렌더러의 `70svh` 가 나왔다).
   ⚠ 서버 쪽 기존 호출부가 깨지지 않게 여기서 다시 내보낸다. **새 코드는 `./nav` 에서 직접 가져와라.**
   ⚠ 특히 "use client" 파일은 절대 이 파일에서 가져오지 마라(docs/PERFORMANCE.md §5-2). */
export { ANCHOR_OF, SECTION_ANCHORS, contactOf } from "./nav";

/* ── 공통 부품 ── */

function SectionShell({ id, title, children }: { id?: string; title?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="reveal"
      style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--section-y)", scrollMarginTop: "var(--bar-h)" }}
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

function ctaHref(action: string, ctx: Ctx): string {
  if (action === "quote") return "#quote";
  const { tel } = contactOf(ctx.doc);
  return tel ? `tel:${tel}` : "#quote";
}

/**
 * ★★★ 문의 버튼 글자는 업종·템플릿·전화번호 유무와 상관없이 항상 «문의하기» 다.
 *   (대표 결정 R-0001, 2026-09-13 — 단일 출처는 config/industries.ts 의 `INQUIRY_CTA_LABEL`)
 *
 * ⚠ 예전엔 템플릿마다 「견적 문의」·「수업 문의」·「전화 문의」·「예약 문의」로 갈렸고,
 *   전화번호가 **기본 비공개**가 되면서(대표님 결정 3) 「전화 문의」 단추가 번호 없이 남는
 *   문제(불변 규칙 12)까지 있었다. 대표가 「전부 다 문의하기 버튼으로 통일해」로 확정해
 *   그 갈래를 전부 없앴다(needs-ceo/R-0001.md).
 * ★ 사이트 문서에 저장된 `s.cta.label`(옛 사이트에 남은 「견적 문의」 등)은 여기서
 *   무시한다 — 그래야 이미 만들어진 손님 사이트도 다시 발행하지 않고 전부 바뀐다.
 * ★ 데려가는 곳(`ctaHref`)은 그대로다 — 전화가 실제로 걸리는 사이트는 여전히 전화가 걸린다.
 */
function ctaLabel(): string {
  return INQUIRY_CTA_LABEL;
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
          {/* ⚠ 사진 **전체**를 덮는다. 아래 40% 에만 깔았더니 밝은 사진에서는 위쪽 제목이
              흰 배경에 흰 글자가 돼 안 읽혔다(2026-09-07). 위는 옅게, 아래로 갈수록 진하게. */}
          <div className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, var(--s-accent) 0%, var(--s-ink) 100%)" }} />
      )}
      <div className="on-photo relative mx-auto w-full max-w-3xl">
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
            {ctaLabel()}
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
          <span key={p} className="card-photo block" style={{ borderRadius: "var(--r-lg)" }}>
            <Photo src={p} alt="" className="photo"
                   sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                   style={{ background: "var(--s-soft)" }} />
          </span>
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
          <figure key={it.title} className="card-photo" style={{ border: "1px solid var(--s-line)", borderRadius: "var(--r-lg)" }}>
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
      style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--section-y)", background: "var(--s-soft)", scrollMarginTop: "var(--bar-h)" }}
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

/**
 * 60초 영상 한 편 (2026-09-10, V-1).
 *
 * ★★ **서버 컴포넌트를 유지한다.** 이 파일에는 `"use client"` 가 없고, 그래서 손님 브라우저로
 *   JS 가 한 바이트도 안 간다. 영상이 없는 사이트는 HTML 도 안 늘어난다.
 *   ⚠ 자동재생·음소거 자동재생·직접 만든 재생 버튼을 넣는 순간 이 성질이 깨지고,
 *     **영상을 안 쓰는 사장님 사이트까지** 무거워진다(docs/PERFORMANCE.md §5-2).
 *
 * ★ **자동재생 금지** (2026-09-10 회장님). 손님이 사이트에 들어왔는데 갑자기 사장님 목소리가
 *   나면 그 자리에서 나간다. 손님이 눌러야 재생된다 — `<video controls>` 는 브라우저가 공짜로 준다.
 *
 * ★ **어두운 띠**는 손님 팔레트의 `--s-ink` 로 낸다(규칙 11: 배경을 번갈아 쓴다).
 *   글자색은 그 색에서 **계산한다**(`onColor`) — 사장님이 어떤 분위기를 골라도 읽힌다.
 *   ⚠ 하드코딩 색도, 어드민 토큰(`--surface` 등)도 쓰지 않는다.
 *
 * ★ **높이를 고정한 띠** 안에 영상을 담는다. 영상 크기를 미리 모르는데 자리를 안 잡아 두면
 *   재생기가 뜨는 순간 아래 내용이 밀린다(CLS). 띠 높이가 고정이면 그 일이 없다.
 *   화면의 **70%** 를 넘지 않는다(회장님 지시).
 */
function VideoSecR({ s, ctx }: { s: Extract<SectionT, { type: "video" }>; ctx: Ctx }) {
  /* ★★ 2026-09-16 — **한 편에서 «피드»로 바꿨다.**
     `ctx.shorts` 는 홈페이지에 걸린 영상 «전부»다(`lib/shorts.ts`). 그것이 있으면 피드를 그리고,
     없으면(옛 호출부·미리보기 등) 지금까지처럼 섹션이 들고 있던 한 편만 그린다.
     ⚠ 섹션 스키마(`url` 한 칸)는 **건드리지 않았다.** 스키마를 고치면 네 곳이 함께 움직여야 한다
       (불변 규칙 2). 영상 목록은 DB 가 이미 진실을 갖고 있어(`video_out_key`) 스키마를 늘릴 이유가 없다. */
  const feed = ctx.shorts ?? [];
  const single = s.url?.trim() ?? "";

  /**
   * 🔴 **2026-09-17 지시 [19]① — 무대가 섰으면 여기서는 «비킨다».**
   *   히어로 아래에 화면을 꽉 채우는 숏폼 무대가 이미 같은 영상을 다 보여 줬다.
   *   여기서 또 그리면 **손님이 같은 영상을 두 번** 본다 — 「많다」가 아니라 「고장」으로 읽힌다.
   * ⚠ 차림표의 「사장님 이야기」가 가리키던 표(`ANCHOR_OF.video`)는 **무대가 이어받았다**
   *   (`app/[slug]/page.tsx`). 그러지 않으면 메뉴가 허공을 가리킨다(불변 규칙 12).
   * ⚠ 무대가 «안» 섰을 때(영상 0편·미리보기)는 예전 그대로 돈다.
   */
  if (ctx.stageOn && feed.length) return null;

  // ★ 보여 줄 것이 하나도 없으면 **아무것도 그리지 않는다.** 빈 검은 칸이 남으면 안 된다(회장님 지시)
  if (!feed.length && !single) return null;

  const ink = PALETTES[ctx.doc.theme.palette]?.ink ?? "#17202B";
  const on = onColor(ink);
  const title = s.title?.trim() || "사장님 이야기";

  return (
    <section
      id={ANCHOR_OF.video}
      className="reveal"
      style={{
        background: "var(--s-ink)", color: on,
        paddingBlock: "var(--section-y)",
        scrollMarginTop: "var(--bar-h)",
      }}
    >
      <div style={{ paddingInline: "var(--gutter)" }}>
        <div className="mx-auto max-w-3xl">
          <h2 className="t-h2" style={{ marginBottom: feed.length ? "var(--s-2)" : "var(--s-5)", color: on, fontFamily: "inherit" }}>
            <span className="mr-2 inline-block" style={{ height: 3, width: 24, transform: "translateY(-4px)", background: "var(--s-accent)" }} />
            {title}
          </h2>
          {/* 여러 편일 때만 안내 한 줄 — 손님이 «옆으로 넘길 수 있다»는 걸 알아야 넘긴다 */}
          {feed.length > 1 && (
            <p className="t-small" style={{ margin: "0 0 var(--s-5)", color: on, opacity: 0.68 }}>
              {feed.length}편 · 옆으로 넘겨 보세요. 소리는 영상을 누르면 켜집니다.
            </p>
          )}
        </div>
      </div>

      {feed.length > 0 ? (
        /* ★ 피드는 좌우 여백 «밖»까지 흐른다 — 카드가 화면 가장자리에서 잘려 보여야
             「더 있다」가 읽힌다. 릴스·틱톡이 전부 이렇게 한다. */
        <ShortsFeed items={feed} onInk={on} />
      ) : (
        <div style={{ paddingInline: "var(--gutter)" }}>
          <div className="mx-auto max-w-3xl">
            {/* 옛 길 — 섹션이 들고 있는 한 편. 미리보기·옛 사이트가 이 길로 온다 */}
            <div
              style={{
                height: "min(70svh, 560px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "var(--r-lg)", overflow: "hidden",
              }}
            >
              <video
                src={single}
                poster={s.poster}
                controls
                playsInline
                /* ⚠ "metadata" 가 아니라 "none" 이다. metadata 면 **영상을 누르지도 않은 손님이**
                   mp4 머리를 받는다. 표지 사진(WebP 한 장)만 받고, 영상 바이트는 재생을 눌러야 흐른다. */
                preload="none"
                style={{ maxHeight: "100%", maxWidth: "100%", display: "block" }}
              />
            </div>
            {s.caption && (
              <p className="t-small" style={{ marginTop: "var(--s-4)", color: on, opacity: 0.8 }}>{s.caption}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ── 레지스트리 ── */

/**
 * ★★★ **띠(band) — 「같은 바탕을 연속으로 두지 않는다」** (2026-09-17 지시 [19]③)
 *
 * ⚠ **실측으로 찾은 문제:** `sample-interior` 를 재 보니 **소개 · 진행 과정 · 시공 갤러리 ·
 *   오시는 길** 네 섹션이 **전부 같은 흰 바탕**이었다. `docs/DESIGN.md` §7 이 못 박아 둔
 *   「같은 배경 연속 금지 — 경계가 사라져 **한 덩어리로 보인다**」에 정면으로 어긋난다.
 *   대표님이 「여긴 그냥 **평범한** 회사 홈페이지인데」라고 하신 그 느낌의 큰 몫이 여기다.
 *
 * ★ **스스로 바탕을 정하는 섹션**(무대·견적·띠배너)은 건드리지 않는다. 나머지만
 *   바탕색 ↔ 은은한 색으로 **번갈아** 놓는다. 앞 섹션과 같은 색이 나오면 한 칸 밀어 피한다.
 *
 * ⚠ 새 색을 **하나도 만들지 않았다.** 사장님이 고른 팔레트의 `--s-bg`·`--s-soft` 둘뿐이다
 *   (불변 규칙 11 — 색은 토큰만). 어떤 팔레트에서도 두 색은 서로 잘 붙는다.
 */
export type Band = "own" | { bg: "base" | "soft"; line: boolean };
const OWN_BG = new Set<SectionT["type"]>(["video", "quoteForm", "banner", "hero"]);

/** 스스로 바탕을 정하는 섹션이 실제로 «무슨 색»인가 — 앞뒤를 견주려면 이것부터 알아야 한다 */
function ownColorOf(t: SectionT["type"]): "ink" | "soft" | "accent" | "photo" | null {
  if (t === "video") return "ink";
  if (t === "quoteForm") return "soft";
  if (t === "banner") return "accent";
  if (t === "hero") return "photo";
  return null;
}

/** 섹션 목록을 받아 «각 칸이 무슨 띠인지»를 한 번에 정한다 — 화면과 한 곳에서 계산한다 */
export function bandsOf(sections: SectionT[]): Band[] {
  const own = sections.map((x) => ownColorOf(x.type));
  const out: Band[] = [];
  /** 바로 앞 칸이 실제로 무슨 색이었나 */
  let prev: string | null = null;

  for (let i = 0; i < sections.length; i++) {
    if (OWN_BG.has(sections[i].type)) { out.push("own"); prev = own[i]; continue; }

    /* ① 앞 칸과 «다르게». 이것이 첫 번째 규칙이다 */
    let bg: "base" | "soft" = prev === "soft" ? "base" : "soft";
    /* ② 다음 칸이 자기 색을 갖고 있고 그것과 겹치면 뒤집어 본다 */
    const next = own[i + 1] ?? null;
    if (next && next === bg && prev !== (bg === "soft" ? "base" : "soft")) {
      bg = bg === "soft" ? "base" : "soft";
    }
    /* ③ 앞뒤가 둘 다 막혀 뒤집을 수 없으면 — 색은 같아도 **가는 선 한 줄**로 경계를 만든다.
       ⚠ 새 색을 만들지 않는다. `--s-line` 은 팔레트가 이미 가진 토큰이다(불변 규칙 11). */
    const line = !!next && next === bg;
    out.push({ bg, line });
    prev = bg;
  }
  return out;
}

export function RenderSection({ s, ctx, index, band }: { s: SectionT; ctx: Ctx; index?: number; band?: Band }) {
  const el = renderOne({ s, ctx, index });
  /* 스스로 바탕을 정하는 섹션은 그대로 둔다. 나머지만 띠로 감싼다 —
     ⚠ 감싸개는 **여백을 하나도 더하지 않는다.** 섹션이 이미 자기 여백을 갖고 있다. */
  if (!el || !band || band === "own") return el;
  return (
    /* ⚠ `background` 가 아니라 `backgroundColor` 다. 줄임 표기(`background`)를 쓰면
         그것이 **`background-image` 까지 함께 지워** 무대 끝의 «밝아지는» 그라데이션이
         사라진다(실측으로 잡았다 — `globals.css` 의 `.stage + *`). */
    <div style={{
      backgroundColor: band.bg === "soft" ? "var(--s-soft)" : "var(--s-bg)",
      borderBottom: band.line ? "1px solid var(--s-line)" : undefined,
    }}>{el}</div>
  );
}

function renderOne({ s, ctx, index }: { s: SectionT; ctx: Ctx; index?: number }) {
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
    case "video": return <VideoSecR s={s} ctx={ctx} />;
  }
}
