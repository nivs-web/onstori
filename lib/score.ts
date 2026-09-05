import { RULES } from "@/config/completeness";
import { sbAdmin } from "./db-admin";
import { isValidPhone } from "./phone";
import type { SiteDocT } from "./schema";

/**
 * 완성도 점수 계산 (서버 전용) — config/completeness.ts 규칙표를 사이트 상태에 대입.
 * v1 판정 가능 규칙만 채점(로고·위젯은 기능 도입 시 활성). 저장·발행·스토리 작성 시 재계산.
 */

type Ctx = {
  doc: SiteDocT | null;
  settings: Record<string, unknown>;
  storyCount: number;
  storyPhotoCount: number;
  publishedAt: boolean;
};

const CHECKS: Record<string, (c: Ctx) => boolean> = {
  hero_text: (c) => {
    const h = c.doc?.sections.find((s) => s.type === "hero");
    return !!h && "headline" in h && h.headline.trim().length >= 8;
  },
  photo_real: (c) => c.storyPhotoCount >= 3,
  hours: (c) => typeof c.settings.hours === "string" && (c.settings.hours as string).length > 0,
  contact: (c) => isValidPhone(typeof c.settings.phone === "string" ? c.settings.phone : ""),
  story_1: (c) => c.storyCount >= 1,
  cta_form: (c) => !!c.doc?.sections.some((s) => s.type === "quoteForm"),
  logo: () => false,     // P6 브랜드키트에서 활성
  published: (c) => c.publishedAt,
  widget_1: () => false, // P8 연결 위젯에서 활성
};

export async function recomputeScore(siteId: string) {
  const sb = sbAdmin();
  const [{ data: site }, { data: stories }] = await Promise.all([
    sb.from("sites").select("draft, settings, published_at").eq("id", siteId).single(),
    sb.from("story_entries").select("photos").eq("site_id", siteId).eq("visible", true),
  ]);
  if (!site) return null;

  const ctx: Ctx = {
    doc: (site.draft as SiteDocT) ?? null,
    settings: (site.settings as Record<string, unknown>) ?? {},
    storyCount: stories?.length ?? 0,
    storyPhotoCount: (stories ?? []).reduce((n, s) => n + ((s.photos as unknown[])?.length ?? 0), 0),
    publishedAt: !!site.published_at,
  };

  const done = RULES.filter((r) => CHECKS[r.id]?.(ctx));
  const score = done.reduce((s, r) => s + r.pts, 0);
  await sb.from("site_progress").upsert(
    { site_id: siteId, score, rules_done: done.map((r) => r.id), updated_at: new Date().toISOString() },
    { onConflict: "site_id" },
  );
  return { score, done: done.map((r) => r.id) };
}

/** funnel 이정표 기록 (최초 1회만) */
export async function markFunnel(siteId: string, key: "first_edit_at" | "first_story_at" | "published_at" | "activated_at") {
  const sb = sbAdmin();
  const { data } = await sb.from("site_progress").select("funnel").eq("site_id", siteId).maybeSingle();
  const funnel = (data?.funnel as Record<string, string>) ?? {};
  if (funnel[key]) return;
  funnel[key] = new Date().toISOString();
  await sb.from("site_progress").upsert({ site_id: siteId, funnel }, { onConflict: "site_id" });
}
