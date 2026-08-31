import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * 도메인 통합 사이트맵 — 경로 방식의 핵심 이점.
 * 서치어드바이저/서치콘솔에 onstori.com 1회 등록 + 이 사이트맵 1개 제출이면
 * 신규 고객 사이트는 자동으로 크롤 대상에 포함된다 (개별 등록·캡차 불필요).
 * 체험(trial) 사이트는 제외 — 페이지 자체도 noindex.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://onstori.com";
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      const { data } = await sb
        .from("sites")
        .select("slug, published_at")
        .eq("status", "active")
        .not("published", "is", null)
        .limit(5000);
      for (const s of data ?? []) {
        entries.push({
          url: `${base}/${s.slug}`,
          lastModified: s.published_at ?? undefined,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    } catch {
      // DB 불가 시 기본 엔트리만 — 사이트맵은 항상 응답해야 한다
    }
  }
  return entries;
}
