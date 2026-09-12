import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug } from "@/lib/sites";
import { PALETTES, RenderSection, onColor } from "@/components/sections";
import { SiteChrome } from "@/components/sections/site-chrome";

/**
 * **미리 만들어 둔 견본 — 영업용 주소.** (2026-09-13 상무님 지적 7 · 회장님 지시 B)
 *
 * ★★ **왜 손님 주소(`/{상호}`)와 갈랐나.**
 *   견본은 «그 가게가 만든 홈페이지»가 아니다. 우리가 콜드콜용으로 미리 만들어 둔 것이다.
 *   그것이 그 가게 상호로 검색에 잡히면 **사장님 허락 없이 그 가게 홈페이지 행세**를 하게 된다.
 *   그래서 주소를 따로 두고, 검색에도 안 걸리게 한다.
 *
 * ★★ **왜 `/{상호}` 페이지에 조건을 더하지 않았나 (상무님 지적).**
 *   그 페이지는 ISR 로 캐시되고 빌드 때 200곳을 미리 만든다(`generateStaticParams`).
 *   거기에 요청마다 봐야 하는 조건을 넣으면 **손님 사이트 200곳의 캐시가 통째로 무너진다.**
 *   그래서 ①거르는 일은 자료를 읽는 곳(`lib/sites.ts`)에서 하고 ②이 페이지는 따로 두되
 *   `force-dynamic` 으로 **캐시를 아예 안 쓴다.** 선례: `app/rec/[slug]/page.tsx`.
 *
 * ⚠ 견본은 몇 개 안 되고 회장님만 여신다. 느려도 상관없다 — 손님 사이트의 빠르기를 지키는 것이 먼저다.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "견본 홈페이지 — 온스토리",
  /* ⚠ 검색에 **절대** 걸리면 안 된다. 남의 가게 상호로 우리 견본이 뜨면 안 된다 */
  robots: { index: false, follow: false },
};

export default async function PremadeSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /* ★ 견본«만» 본다. 진짜 사장님 홈페이지는 여기서 안 열린다 — 열리면 주소가 둘이 된다 */
  const site = await getSiteBySlug(slug, "only");
  if (!site) notFound();

  const p = PALETTES[site.doc.theme.palette];
  const accent = site.doc.theme.accent ?? p.accent;
  const firstIsHero = site.doc.sections[0]?.type === "hero";
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft,
    "--s-on-accent": onColor(accent),
  } as React.CSSProperties;

  return (
    <div style={vars}>
      {/* ★★ **이것이 견본이라는 것을 화면에서 말한다.** (박팀장 지적 13)
          ⚠ 사장님께 이 주소를 보내 드리는데 아무 표시가 없으면 「이미 내 홈페이지가 올라가 있다」로
            오해하신다. 그건 우리가 안 한 일을 한 것처럼 보이는 것이다. */}
      <div
        className="t-small flex flex-wrap items-center justify-center gap-2 text-center font-medium"
        style={{ padding: "var(--s-3) var(--gutter)", background: "var(--n-900)", color: "var(--n-0)" }}
      >
        <span>이 홈페이지는 <b>온스토리가 미리 만들어 본 견본</b>입니다 — 아직 공개되지 않았어요.</span>
      </div>

      <main
        className="relative min-h-svh"
        style={{
          background: "var(--s-bg)",
          paddingTop: firstIsHero ? 0 : "var(--bar-h)",
          paddingBottom: "var(--dock-pad)",
          fontFamily: "var(--font-body)",
        }}
      >
        <SiteChrome doc={site.doc} businessName={site.doc.businessName} logo={site.logo} />
        {site.doc.sections.map((s, i) => (
          <RenderSection key={i} s={s} index={i} ctx={{ doc: site.doc, stories: site.stories, slug }} />
        ))}
        <footer className="t-caption text-center" style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-7)", color: "var(--s-muted)" }}>
          {site.doc.businessName} ·{" "}
          <a href="https://onstori.com" className="tap-row underline underline-offset-2" style={{ display: "inline-flex" }}>Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
