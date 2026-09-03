import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/sites";
import { PALETTES, RenderSection } from "@/components/sections";

/**
 * 고객 사이트 렌더러 — 경로 방식: onstori.com/{slug}
 * (서브도메인 방식 폐기: 네이버 서치어드바이저 자동화 불가·수집 지연·도메인 권위 — DECISIONS 참조)
 * 정적 라우트(/new, /admin, /api…)가 파일시스템 우선이며, 예약어 200개는 reserved_slugs가 방어.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return {};
  const hero = site.doc.sections.find((s) => s.type === "hero");
  const url = `https://onstori.com/${slug}`;
  return {
    title: site.doc.businessName,
    description: (hero && "sub" in hero && hero.sub) || `${site.doc.businessName} 공식 홈페이지`,
    robots: site.status === "trial" ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: site.doc.businessName,
      url,
      description: (hero && "sub" in hero && hero.sub) || undefined,
      images: hero && "image" in hero && hero.image ? [hero.image] : undefined,
    },
  };
}

export default async function SitePage({ params }: Props) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) notFound();

  const p = PALETTES[site.doc.theme.palette];
  const accent = site.doc.theme.accent ?? p.accent;
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft, "--s-on-accent": p.onAccent,
  } as React.CSSProperties;

  return (
    <div style={vars}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <main
        className="min-h-svh"
        style={{
          background: "var(--s-bg)",
          fontFamily: `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
        }}
      >
        {site.doc.sections.map((s, i) => (
          <RenderSection key={i} s={s} ctx={{ doc: site.doc, stories: site.stories, slug }} />
        ))}
        <footer className="px-5 py-10 text-center text-[12.5px]" style={{ color: "var(--s-muted)" }}>
          © {new Date().getFullYear()} {site.doc.businessName} ·{" "}
          <a href="https://onstori.com" className="underline underline-offset-2">Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
