import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";

/** 에디터 초기 데이터 — 소유자(anonId 또는 운영자)만 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const { data: progress } = await sbAdmin()
    .from("site_progress").select("score, rules_done").eq("site_id", r.site.id).maybeSingle();
  const { count: storyCount } = await sbAdmin()
    .from("story_entries").select("*", { count: "exact", head: true }).eq("site_id", r.site.id).eq("visible", true);

  return NextResponse.json({
    slug: r.site.slug,
    businessName: r.site.business_name,
    status: r.site.status,
    draft: r.site.draft,
    settings: r.site.settings,
    score: progress?.score ?? 0,
    rulesDone: progress?.rules_done ?? [],
    storyCount: storyCount ?? 0,
    isAdmin: r.admin,
  });
}
