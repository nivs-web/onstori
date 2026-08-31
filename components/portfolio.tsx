import { createClient } from "@supabase/supabase-js";
import { getSiteBySlug } from "@/lib/sites";
import { PortfolioTabs } from "./portfolio-ui";

/**
 * 랜딩 포트폴리오 — 폰 프레임 안에서 실제 사이트가 라이브로 스크롤되는 쇼케이스.
 * 목록은 어드민(/admin/showcase)에서 URL 등록·태그·순서·추천으로 관리.
 */
export type ShowcaseItem = { slug: string; tag: string; featured: boolean; name: string };

async function loadShowcase(): Promise<ShowcaseItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await sb
      .from("showcase")
      .select("slug, tag, featured, sort")
      .order("featured", { ascending: false })
      .order("sort", { ascending: true })
      .limit(24);
    const items = await Promise.all(
      (data ?? []).map(async (r) => {
        const site = await getSiteBySlug(r.slug);
        return site ? { slug: r.slug, tag: r.tag, featured: r.featured, name: site.doc.businessName } : null;
      }),
    );
    return items.filter((x): x is ShowcaseItem => !!x);
  } catch {
    return [];
  }
}

export async function Portfolio() {
  const items = await loadShowcase();
  if (items.length === 0) return null;
  return (
    <section id="portfolio" className="mt-20">
      <h2 className="text-xl font-bold sm:text-2xl">이미 온스토리로 만든 가게들</h2>
      <p className="mt-1.5 text-sm text-neutral-500">
        전부 실제로 작동하는 홈페이지예요 — 화면 안을 <b>직접 스크롤</b>해보세요.
      </p>
      <PortfolioTabs items={items} />
    </section>
  );
}
