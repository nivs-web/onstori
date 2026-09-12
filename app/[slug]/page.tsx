import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { localBusinessJsonLd } from "@/lib/jsonld";
import { getSiteBySlug, getPausedSite } from "@/lib/sites";
import { PALETTES, RenderSection, onColor } from "@/components/sections";
import { SiteChrome } from "@/components/sections/site-chrome";
import { PausedSite } from "@/components/sections/paused";

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

/**
 * ★ 발행된 손님 사이트를 **빌드 때 미리 만들어 둔다.**
 *
 * `revalidate = 60` 만으로는 부족했다 — 2026-09-07 실측에서 /barun 이 세 번 연속
 * `x-vercel-cache: MISS`(age 0) 였고 TTFB 0.73~1.19초가 나왔다. 즉 요청마다 DB 를 읽고 있었다.
 * 여기서 목록을 주면 그 사이트들은 처음부터 만들어진 상태로 나간다.
 *
 * ⚠ 목록에 없는 새 사이트도 그대로 열린다(dynamicParams 기본값 true) — 첫 손님만
 *   조금 기다리고 그 뒤로는 캐시된다. 새로 만든 사장님이 못 여는 일은 없다.
 * ⚠ 빌드가 DB 를 한 번 읽는다. 못 읽어도 빌드를 세우지 않는다 — 빈 배열로 넘어간다.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await sb.from("sites").select("slug").not("published_at", "is", null).limit(200);
    return (data ?? []).map((r) => ({ slug: r.slug as string }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  /* 쉬고 있는 홈페이지 — **검색에 남기지 않는다.** 사장님 상호로 「지금은 볼 수 없어요」가
     검색되면 그게 더 큰 손해다. 결제하면 api/billing 이 곧바로 캐시를 풀어 원래 화면으로 돌아온다. */
  if (!site) return { robots: { index: false, follow: false } };
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
  if (!site) {
    /* ★ 「없는 주소」와 「쉬고 있는 홈페이지」를 가른다 (2026-09-12 지시 5).
       손님 권한으로는 둘이 똑같이 «없음»으로 보인다. 하지만 뒤쪽은 사장님이 **명함에 적어 둔
       주소**라 죽은 링크가 되면 안 된다. 이 조회는 «없을 때만» 도므로 평소 비용이 없다. */
    const paused = await getPausedSite(slug);
    if (paused) return <PausedSite businessName={paused.businessName} />;
    notFound();
  }

  const p = PALETTES[site.doc.theme.palette];
  const accent = site.doc.theme.accent ?? p.accent;
  const firstIsHero = site.doc.sections[0]?.type === "hero";
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft,
    // 팔레트 값이 아니라 **고른 강조색에서** 계산한다 (components/sections/index.tsx onColor)
    "--s-on-accent": onColor(accent),
  } as React.CSSProperties;

  /**
   * ★★ **검색엔진용 «기계 쪽지»** (2026-09-13 김팀장 지시서 · 회장님 지시 11).
   *   검색 결과에 상호 아래 주소가 함께 뜨고, 지도 검색에 잡힐 확률이 올라간다.
   * ⚠ 번호는 **공개로 켜 두신 분만** 실린다 — 화면에서 숨긴 것을 검색엔진에 넘기면
   *   숨긴 의미가 없다(lib/jsonld.ts 주석).
   * ⚠ `dangerouslySetInnerHTML` 을 쓰지만 안전하다 — `localBusinessJsonLd` 가
   *   `<` 를 유니코드로 바꿔 `</script>` 를 막는다. **그 줄을 지우지 마라.**
   */
  const jsonLd = localBusinessJsonLd(site, site.settings ?? {});

  return (
    <div style={vars}>
      {/* ★★ **예시 홈페이지라는 것을 맨 위에서 말한다.** (2026-09-13 박팀장 지적 13)
          ⚠ 손님이 진짜 가게로 알고 전화를 걸거나 문의를 남기면 아무도 안 받는다.
          ⚠ 불변 규칙 7 — 예시 후기·예시 실적은 «예시» 표시를 달아야 쓸 수 있다. */}
      {site.sample && (
        <div
          className="t-small text-center font-medium"
          style={{ padding: "var(--s-3) var(--gutter)", background: "var(--n-900)", color: "var(--n-0)" }}
        >
          이 홈페이지는 <b>온스토리가 만든 예시</b>입니다 — 실제 업체가 아니에요.
        </div>
      )}
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
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
