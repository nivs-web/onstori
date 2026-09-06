import { createClient } from "@supabase/supabase-js";
import { getSiteBySlug } from "@/lib/sites";
import { PortfolioTabs } from "./portfolio-ui";

/**
 * 랜딩 포트폴리오 — 폰 프레임 안에서 실제 사이트가 라이브로 스크롤되는 쇼케이스.
 * 목록은 어드민(/admin/showcase)에서 URL 등록·태그·순서·추천으로 관리.
 */
export type ShowcaseItem = { slug: string; tag: string; featured: boolean; name: string };

export async function loadShowcase(): Promise<ShowcaseItem[]> {
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

export async function Portfolio({ items }: { items?: ShowcaseItem[] }) {
  const list = items ?? (await loadShowcase());
  if (list.length === 0) return null;
  return (
    <section id="portfolio">
      <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ textWrap: "balance" }}>온스토리로 만든 홈페이지</h2>
      <p className="mt-2 text-[15px]" style={{ color: "var(--muted)" }}>
        실제로 작동하는 화면이에요 — 안을 <b style={{ color: "var(--ink)" }}>직접 스크롤</b>해보세요.
        {/* ⚠ 지금 걸려 있는 것은 온스토리가 만든 샘플이다. 실고객 사이트가 올라오면 이 괄호를 뺀다. (규칙 7, 2026-09-06) */}
        {" "}(현재는 온스토리가 만든 샘플입니다.)
      </p>
      <PortfolioTabs items={list} />
    </section>
  );
}
