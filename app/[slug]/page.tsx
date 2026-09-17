import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { localBusinessJsonLd } from "@/lib/jsonld";
import { getSiteBySlug, getPausedSite, NOINDEX_SLUGS } from "@/lib/sites";
import { PALETTES, RenderSection, onColor, bandsOf } from "@/components/sections";
import { SiteChrome, FinalCta } from "@/components/sections/site-chrome";
import { PausedSite } from "@/components/sections/paused";
import { ChannelWidget } from "@/components/sections/channel-widget";
import ShortsStage from "@/components/sections/shorts-stage";
import { shortsStyleOf, shortsOrderOf } from "@/config/shorts";
import ShortsSns from "@/components/sections/shorts-sns";
import { ANCHOR_OF } from "@/components/sections/nav";

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
    /**
     * ★★★ **2026-09-15 대표님 결정 — 무료 체험도 검색에 올린다.**
     *   전에는 `trial` 이면 `noindex` 였다. 사이트맵에서 빼는 것과 **한 쌍**이었는데,
     *   사이트맵 쪽을 열면서(`lib/indexable.ts`) 이쪽도 같이 풀지 않으면
     *   **검색엔진이 사이트맵을 받고도 그냥 무시한다.** 둘은 반드시 함께 움직인다.
     * ⚠ 속이 빈 홈페이지를 막는 것은 여전히 `lib/indexable.ts` 의 문턱 셋이 한다
     *   (완성도 75점 · 올바른 전화번호 · 한 번이라도 직접 고침).
     *   여기서 막는 것이 아니다 — **우리가 «먼저 알리지» 않을 뿐, 「지우라」고는 하지 않는다.**
     */
    /* 🔴 **토스 심사용 껍데기는 검색에서 아예 뺀다** (2026-09-17 지시 [22]).
       목록은 `lib/sites.ts` 의 `NOINDEX_SLUGS` 하나다 — 여기에 슬러그를 손으로 적지 마라.
       ⚠ `sample-interior` 는 그 목록에 **없다.** 심사관이 검색으로도 찾아 볼 수 있어야 한다. */
    ...(NOINDEX_SLUGS.has(slug) ? { robots: { index: false, follow: false } } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: site.doc.businessName,
      url,
      description: (hero && "sub" in hero && hero.sub) || undefined,
      images: hero && "image" in hero && hero.image ? [hero.image] : undefined,
      /* ★ 2026-09-15 — 경쟁사(홈ON) 실측에서 빠져 있던 것 둘을 채웠다.
         카톡·블로그에 링크를 붙일 때 「한국어 사이트」·「웹사이트」로 바로 읽힌다.
         ⚠ `siteName` 은 **사장님 상호**다. 「온스토리」가 아니다 — 그 홈페이지의 주인은 사장님이다. */
      locale: "ko_KR",
      type: "website",
      siteName: site.doc.businessName,
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
    if (paused) {
      /* ★★ **운영자는 「쉬고 있어요」 안내를 볼 이유가 없다** — 비공개 보관실로 보낸다.
         (2026-09-15 대표님: 「비공개 사이트 주소를 정해서 **그쪽으로 이동해서 관리한다**」)
         ⚠ 손님에게는 이 갈림길 자체가 안 보인다. `isAdmin()` 이 아니면 아래 안내로 그대로 간다.
         ⚠ 이 조회는 **사이트가 «없을 때만»** 돈다. 평소 손님 화면의 빠르기에 영향이 없다. */
      if (await isAdmin()) redirect(`/x/${slug}`);
      return <PausedSite businessName={paused.businessName} />;
    }
    notFound();
  }

  const p = PALETTES[site.doc.theme.palette];
  const accent = site.doc.theme.accent ?? p.accent;
  const firstIsHero = site.doc.sections[0]?.type === "hero";

  /**
   * ★★★ **숏폼 무대를 «히어로 바로 아래»에 끼운다.** (2026-09-17 지시 [19]①)
   *
   * > 대표님: 「여긴 그냥 평범한 회사 홈페이지인데, 히어로 섹션 아래 바로 숏폼 재생창이 있네?
   * >   이건 뭐야? **이렇게 놀라게 하자.**」
   *
   * ⚠ **섹션 스키마를 늘리지 않았다**(불변 규칙 2 — 늘리면 네 곳이 함께 움직여야 한다).
   *   무대는 사장님이 배치하는 «섹션»이 아니라, 영상이 걸려 있으면 **저절로 서는 무대**다.
   *   진실은 이미 DB 에 있다(`story_entries.video_out_key`).
   *
   * 🔴 **영상이 0편이면 아무것도 끼우지 않는다.** 빈 검은 화면은 「고장 난 사이트」로 보인다(지시 ②).
   *   그리고 그때는 `shorts-stage.tsx` 의 JS 가 **한 바이트도 안 나간다.**
   */
  const stageItems = site.shorts ?? [];
  /**
   * 🔴🔴 **어느 «모양»으로 보여 줄지는 사장님이 고른다.** (2026-09-17 지시 [42] §3)
   *
   * ⚠⚠ 2026-09-17 까지는 **「영상이 있으면 무조건 숏폼형태」**였다.
   *   그래서 **카드형태(`shorts-feed.tsx`)는 아무 사이트에서도 안 그려지고 있었다** — 있는데 잠들어 있었다.
   * ⇒ 이제 `settings.shorts.style` 이 정한다. **아무것도 안 고른 사장님은 지금까지와 똑같다**(기본 = 숏폼형태).
   * ⚠ 모르는 값이 들어 있으면 `shortsStyleOf` 가 **조용히 기본값으로** 떨어뜨린다.
   */
  const shortsStyle = shortsStyleOf(site.settings);
  /* 🔴 재생 순서는 «브라우저»가 쓴다 — 값만 내려보낸다(지시 [42] §5) */
  const shortsOrder = shortsOrderOf(site.settings);
  const stageOn = shortsStyle === "shorts" && stageItems.length > 0;
  /* 히어로가 없는 사이트도 있다 — 그때는 맨 앞에 세운다 */
  const heroAt = site.doc.sections.findIndex((x) => x.type === "hero");
  const stageAfter = stageOn ? Math.max(0, heroAt) : -1;
  /**
   * ⚠ **차림표의 「사장님 이야기」가 데려가는 곳을 무대로 옮긴다**(불변 규칙 12 —
   *   힌트가 데려가는 곳과 화면이 같아야 한다). 무대가 서면 아래 영상 섹션은 자기를 지우므로
   *   그 자리 표(`ANCHOR_OF.video`)를 여기서 이어받지 않으면 **메뉴가 허공을 가리킨다.**
   */
  /* 🔴 「같은 바탕을 연속으로 두지 않는다」(DESIGN.md §7) — 한 곳에서 미리 정한다 */
  const bands = bandsOf(site.doc.sections);

  /**
   * ⚠ **손님이 보는 글이다.** 대표님 승인 전까지 쓰는 «임시» 문장이라 여기 한 곳에만 둔다 —
   *   바꾸라고 하시면 이 줄 하나만 고치면 된다(`docs/WAITING.md` 에 올려 두었다).
   */
  const SNS_STRIP_TITLE = "이 가게 영상이 나가고 있는 곳";

  const videoTitle =
    (site.doc.sections.find((x) => x.type === "video") as { title?: string } | undefined)?.title?.trim()
    || "사장님 이야기";
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
    <div className="site-shell" style={vars}>
      {/* ★★ 2026-09-15 대표님 — **상단 검은 띠를 뗐다.**
          전에는 여기에 「이 홈페이지는 온스토리가 만든 예시입니다」 띠가 있었다.
          왜 뗐나: 정식 영업을 시작했고, 예시는 `sample-interior` **한 곳뿐**이며,
          그 화면은 **히어로 위에 「샘플 예시 사이트」 글자를 이미 달고 있다**(사이트 내용에 들어 있음).
          같은 말이 두 번 나와서 첫인상이 어수선했다.

          🔴 **그래서 지켜야 하는 것 — 없애면 안 되는 표시가 하나 남았다**
          ⚠ `sample-interior` 의 히어로 위 「샘플 예시 사이트」 글자를 **지우지 마라.**
            그것까지 지우면 예시 표시가 **하나도 안 남는다.** 유료 고객 0명인 지금
            실제 사례처럼 보이면 **표시광고법**에 걸린다(불변 규칙 7 · R-0017).
          ⚠ 손님이 진짜 가게로 알고 전화를 걸면 **아무도 안 받는다.** 그 위험은 그대로다.
          ★ 예시를 새로 만들면 `SAMPLE_SLUGS`(lib/sites.ts)에 넣고,
            그 사이트 **화면 안에** 예시 표시를 직접 넣어라. */}
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
        {/* 상단 바(로고·햄버거)와 하단 고정 바 — 미리보기 셸과 같은 컴포넌트를 쓴다.
            ⚠ `cta` 는 settings.ctaChannels 다 — settings.channels(owner-channels, SEO 용)와 다른 칸이다. */}
        <SiteChrome doc={site.doc} businessName={site.doc.businessName} logo={site.logo} cta={site.settings?.ctaChannels as { selected?: string[]; links?: Record<string, string> } | undefined} />
        {/* ★ 떠 있는 채널 위젯 — 사장님이 «직접 넣은» 채널만 뜬다(2026-09-15 대표님 지시).
            채널이 하나도 없으면 아무것도 그리지 않는다. */}
        <ChannelWidget channels={(site.settings?.channels as Record<string, unknown> | undefined) ?? null} />
        {site.doc.sections.map((s, i) => (
          <React.Fragment key={i}>
            <RenderSection s={s} index={i} band={bands[i]} ctx={{ doc: site.doc, stories: site.stories, slug, shorts: site.shorts, stageOn, shortsStyle, shortsOrder }} />
            {i === stageAfter && (
              <>
                <ShortsStage items={stageItems} anchorId={ANCHOR_OF.video} title={videoTitle} slug={slug} order={shortsOrder} />
                {/* 🔴 무대 «바로 아래» — 이 홈페이지가 실제로 영상을 퍼뜨린 곳들 (지시 [31]⑤).
                    ⚠ 실제로 «올라간» 기록이 하나도 없으면 스스로 안 그린다. */}
                <ShortsSns items={stageItems} title={SNS_STRIP_TITLE} />
              </>
            )}
          </React.Fragment>
        ))}
        {/* ★ PC 전용 — 스크롤을 내리면 만나는 최종 문의 CTA (2026-09-16, 반장 지시 [3]) */}
        <FinalCta doc={site.doc} cta={site.settings?.ctaChannels as { selected?: string[]; links?: Record<string, string> } | undefined} />
        <footer className="t-caption text-center" style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-7)", color: "var(--s-muted)" }}>
          {/* ★★ 숨은 에디터 진입로 — 2026-09-16 대표님 지시로 **「© 연도 + 상호」 줄 전체**가 문이 됐다.
              왜 넓혔나: 사장님이 자기 홈페이지를 고치러 올 때 여기가 «유일한» 문인데, 전에는
              상호 글자만 눌렸다. 폰에서 손가락이 자꾸 빗나가 「안 눌린다」는 말이 나왔다.
              ★ 「모든 서브 사이트 공통」이라는 지시는 이 한 곳만 고치면 그대로 지켜진다 —
                 손님 사이트는 상호가 무엇이든 전부 이 파일 하나로 그려진다.

              ⚠ 손님에게는 **그냥 글자로 보여야 한다.** 밑줄·기본 글자색·커서를 바꾸지 않는다.
                 손님이 「여기 뭐가 있나」 하고 눌러 로그인 창을 만나는 것 자체가 사고다.
              ★ 딱 하나만 허락한다 — **마우스를 올렸을 때만** 색이
                 var(--s-muted) → var(--s-ink) 로 또렷해진다. 팔레트가 밝든 어둡든
                 «흐린 글자 → 본문 글자»라 어느 사이트에서도 과하지 않고, 새 색을 만들지 않는다.
                 폰·태블릿에는 hover 가 없으니 **손님 대부분의 화면은 지금과 한 픽셀도 다르지 않다.**
              ⚠ 커서는 그대로 두었다(cursor: inherit). 손가락 모양이 뜨면 «누르는 곳»이라고
                 광고하는 셈이라, 색보다 훨씬 크게 티가 난다.

              /edit 은 robots noindex 라 색인되지 않지만 nofollow 도 붙인다. tabIndex={-1} 은
              키보드 Tab 으로도 걸리지 않게 한다 — 이 둘을 빼지 마라.
              권한 확인은 에디터가 한다(edit/ui.tsx "수정 권한이 없어요"). 여기선 열어만 준다. */}
          <Link href={`/${slug}/edit`} rel="nofollow" tabIndex={-1}
                className="no-underline text-[var(--s-muted)] hover:text-[var(--s-ink)]"
                style={{ cursor: "inherit" }}>
            © {new Date().getFullYear()} {site.doc.businessName}
          </Link>{" "}
          ·{" "}
          <a href="https://onstori.com" className="tap-row underline underline-offset-2" style={{ display: "inline-flex" }}>Made with 온스토리</a>
        </footer>
      </main>
    </div>
  );
}
