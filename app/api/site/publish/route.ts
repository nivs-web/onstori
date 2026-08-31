import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { recomputeScore, markFunnel } from "@/lib/score";

/** 사이트 반영 — draft→published 복사 + 이전 발행본 스냅샷(롤백용) */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  if (!r.site.draft) return NextResponse.json({ error: "no-draft" }, { status: 400 });

  const sb = sbAdmin();
  if (r.site.published) {
    await sb.from("site_versions").insert({ site_id: r.site.id, snapshot: r.site.published });
  }
  const { error } = await sb
    .from("sites")
    .update({ published: r.site.draft, published_at: new Date().toISOString() })
    .eq("id", r.site.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await markFunnel(r.site.id, "published_at");
  const score = await recomputeScore(r.site.id);
  return NextResponse.json({ ok: true, score: score?.score ?? 0 });
}
