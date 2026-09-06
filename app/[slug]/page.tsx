import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/sites";
import { PALETTES, RenderSection, onColor } from "@/components/sections";
import { SiteChrome } from "@/components/sections/site-chrome";

/**
 * 고객 사이트 렌더러 — 경로 방식: onstori.com/{slug}
 * (서브도메인 방식 폐기: 네이버 서치어드바이저 자동화 불가·수집 지연·도메인 권위 — DECISIONS 참조)
 * 정적 라우트(/new, /admin, /api…)가 파일시스템 우선이며, 예약어 200개는 reserved_slugs가 방어.
 */

/**
 * ISR — 손님 사이트는 매 요청마다 DB 를 볼 필요가 없다 (docs/PERFORMANCE.md).
 * 발행 시 app/api/site/publish 가 revalidatePath 로 즉시 갱신한다. 이 둘은 한 쌍이다.
 */
export const revalidate = 60;

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
  const firstIsHero = site.doc.sections[0]?.type === "hero";
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft,
    // 팔레트 값이 아니라 **고른 강조색에서** 계산한다 (components/sections/index.tsx onColor)
    "--s-on-accent": onColor(accent),
  } as React.CSSProperties;

  return (
    <div style={vars}>
      <main
        className="relative min-h-svh"
        style={{
          background: "var(--s-bg)",
          /* 고정 상단 바는 히어로 **위에 겹친다** — 히어로는 화면 맨 위(0)부터 시작해야
             폰에서 100svh 를 온전히 채운다. 그래서 첫 섹션이 히어로면 위를 비우지 않는다.
             띠 같은 다른 섹션이 먼저 오면 그때만 바 높이만큼 비운다.
             아래 여백은 하단 고정 바 자리다(폰 전용) — 스페이서 <div> 로 넣으면
             그게 문서 앞쪽에 끼어 히어로를 밀어낸다. */
          paddingTop: firstIsHero ? 0 : "var(--bar-h)",
          paddingBottom: "var(--dock-pad)",
          // 폰트는 app/fonts.css 가 자체 호스팅한다. 전에는 여기서 jsDelivr CDN 을
          // <link> 로 불렀는데, 손님 사이트마다 렌더를 막는 사슬이 하나 더 붙는 셈이었다.
          fontFamily: "var(--font-body)",
        }}
      >
        {/* 상단 바(로고·햄버거)와 하단 고정 바 — 미리보기 셸과 같은 컴포넌트를 쓴다 */}
        <SiteChrome doc={site.doc} businessName={site.doc.businessName} logo={site.logo} />
        {site.doc.sections.map((s, i) => (
          <RenderSection key={i} s={s} index={i} ctx={{ doc: site.doc, stories: site.stories, slug }} />
        ))}
        <footer className="t-caption text-center" style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-7)", color: "var(--s-muted)" }}>
          © {new Date().getFullYear()}{" "}
          {/* 숨은 에디터 진입로 — 손님에겐 그냥 글자로 보여야 하므로 커서·밑줄·색을 바꾸지 않는다.
              /edit 은 robots noindex 라 색인되지 않지만 nofollow 도 붙인다.
              권한 확인은 에디터가 한다(edit/ui.tsx "수정 권한이 없어요"). 여기선 열어만 준다. */}
          <Link href={`/${slug}/edit`} rel="nofollow" tabIndex={-1}
                className="no-underline" style={{ color: "inherit", cursor: "inherit" }}>
            {site.doc.businessName}
          </Link>{" "}
          ·{" "}
          <a href="https://onstori.com" className="tap-row underline underline-offset-2" style={{ display: "inline-flex" }}>Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
