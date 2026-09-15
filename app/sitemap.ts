import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { sitemapVerdict, SITEMAP_MIN_SCORE } from "@/lib/indexable";
import { readConfig } from "@/lib/admin-config";

/**
 * 도메인 통합 사이트맵 — 경로 방식의 핵심 이점.
 * 서치어드바이저/서치콘솔에 onstori.com 1회 등록 + 이 사이트맵 1개 제출이면
 * 신규 고객 사이트는 자동으로 크롤 대상에 포함된다 (개별 등록·캡차 불필요).
 * ★★ **2026-09-15 대표님 결정 — 체험(trial) 사이트도 «싣는다».**
 *   옛 규칙은 「체험은 제외 — 페이지 자체도 noindex」였다. 그러면 사장님이 무료 기간 내내
 *   검색에 안 잡혀 **돈을 내기 전에 제품 가치를 못 보신다.**
 * ⚠ 색인에 관한 판단은 **셋이 한 몸**이다 — ①이 사이트맵 ②`app/[slug]/page.tsx` 의 noindex
 *   ③`lib/jsonld.ts` 의 구조화 데이터. **하나를 고치면 셋을 다 봐야 한다.**
 *   2026-09-15 에 실제로 ①을 빼먹어 나머지 둘만 열려 있었다.
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
        /**
         * 🔴 **2026-09-15 — 여기가 진짜 관문이었다.**
         *   `lib/indexable.ts` 의 판정을 무료(trial)까지 열어 놨는데, **이 조회가 유료만 가져와서**
         *   무료 사장님은 판정 함수에 **닿지도 못했다.** 한 결정이 여러 파일에 걸쳐 있을 때
         *   «전부»를 찾지 않으면 이렇게 **조용히 무효**가 된다.
         * ⚠ 무료를 넣을지 말지는 `/admin/seo` 에서 끌 수 있다(`indexTrial`).
         */
        .in("status", ["active", "trial"])
        .not("published", "is", null)
        .limit(5000);
      /* 운영자가 「무료는 빼라」고 꺼 두셨을 수 있다 — 설정이 없거나 표가 없으면 기본(켬)으로 돈다 */
      const cfg = await readConfig();
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
        }, { indexTrial: cfg.indexTrial });
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
