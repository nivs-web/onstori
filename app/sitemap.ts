import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { sitemapVerdict, SITEMAP_MIN_SCORE } from "@/lib/indexable";

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
    // 본사 메뉴 페이지 (2026-09-05 레멘토 구조 전환)
    ...["/how-it-works", "/our-story", "/faq", "/reviews", "/blog", "/privacy", "/terms"].map((p) => ({
      url: `${base}${p}`, changeFrequency: "weekly" as const, priority: 0.6,
    })),
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  /* ★★ **운영자 열쇠로 읽는다** (2026-09-12). 손님 열쇠(anon)로는 `site_progress` 가 안 보인다 —
     그 표의 RLS 는 «주인만 읽기»(`progress_owner_read`)이고 사이트맵에는 로그인이 없다.
     손님 열쇠로 조인하면 점수가 전부 null 이 되어 **모든 사이트가 사이트맵에서 조용히 사라진다.**
     ⚠ 이 파일은 서버에서만 돈다. 열쇠가 브라우저로 나가지 않는다.
     ⚠ 열쇠가 없으면 문턱 검사를 **끄고** 옛 규칙(결제한 사이트 전부)으로 돈다 —
       사이트맵이 통째로 비는 것보다 낫다. 그 사실을 로그에 남긴다. */
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = service ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const gated = !!service;
  if (!gated) console.warn(JSON.stringify({ evt: "sitemap_no_service_key", why: "완성도 문턱 검사를 건너뛴다" }));
  if (url && anon) {
    try {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      /* ★ 완성도·전화·편집 여부까지 함께 읽는다 — 판단은 `lib/indexable.ts` 한 곳에서 한다.
         ⚠ `site_progress` 는 없을 수도 있다(옛 사이트). 그때는 점수 0으로 보아 뺀다 —
           빈 사이트를 넣는 쪽보다 안 넣는 쪽이 안전하다. 사장님이 채우면 다음 갱신에 들어간다. */
      const { data } = await sb
        .from("sites")
        .select("slug, published_at, status, settings, site_progress(score, funnel)")
        .eq("status", "active")
        .not("published", "is", null)
        .limit(5000);
      const skipped: Record<string, number> = {};
      for (const s of data ?? []) {
        const prog = Array.isArray(s.site_progress) ? s.site_progress[0] : s.site_progress;
        const funnel = (prog?.funnel as Record<string, string> | null) ?? {};
        const v = sitemapVerdict({
          status: s.status as string,
          publishedAt: (s.published_at as string) ?? null,
          score: (prog?.score as number) ?? null,
          phone: (s.settings as { phone?: unknown } | null)?.phone,
          firstEditAt: funnel.first_edit_at ?? null,
        });
        if (gated && !v.ok) { skipped[v.why] = (skipped[v.why] ?? 0) + 1; continue; }
        entries.push({
          url: `${base}/${s.slug}`,
          lastModified: s.published_at ?? undefined,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
      /* ★ **조용히 빼지 않는다.** 몇 곳을 왜 뺐는지 로그에 남긴다 —
         「사이트맵에 왜 안 들어갔지」를 나중에 사람이 추적할 수 있어야 한다. */
      if (Object.keys(skipped).length) {
        console.log(JSON.stringify({ evt: "sitemap_skipped", skipped, min: SITEMAP_MIN_SCORE }));
      }
    } catch {
      // DB 불가 시 기본 엔트리만 — 사이트맵은 항상 응답해야 한다
    }
  }
  return entries;
}
