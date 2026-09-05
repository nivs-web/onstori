import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/sites";
import { PALETTES, RenderSection } from "@/components/sections";
import { ConnectWidget } from "@/components/sections/connect-widget";

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
        className="relative min-h-svh"
        style={{
          background: "var(--s-bg)",
          fontFamily: `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
        }}
      >
        {/* 온보딩 로고 — 히어로 위 좌상단에 얹는다. 섹션 스키마 밖(settings.logo)이라 렌더러는 그대로 (2026-09-05) */}
        {site.logo && (
          <div className="pointer-events-none absolute left-5 top-5 z-10 sm:left-8 sm:top-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logo} alt={site.doc.businessName} className="h-11 w-11 rounded-xl bg-white/90 object-contain p-1 shadow sm:h-14 sm:w-14" />
          </div>
        )}
        {site.doc.sections.map((s, i) => (
          <RenderSection key={i} s={s} ctx={{ doc: site.doc, stories: site.stories, slug }} />
        ))}
        <footer className="px-5 py-10 text-center text-[12.5px]" style={{ color: "var(--s-muted)" }}>
          © {new Date().getFullYear()} {site.doc.businessName} ·{" "}
          <a href="https://onstori.com" className="underline underline-offset-2">Made with 온스토리</a>
        </footer>
        {/* 플로팅 연결 위젯 — footer '뒤'여야 스페이서가 문서 맨 끝에 붙어 고정 바가 footer 를 덮지 않는다.
            미리보기 셸(preview-client.tsx)에도 같이 넣는다 — 한 곳만 넣으면 갈라진다 */}
        <ConnectWidget doc={site.doc} />
      </main>
    </div>
  );
}
