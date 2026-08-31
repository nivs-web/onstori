import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { SiteDoc } from "@/lib/schema";
import { recomputeScore, markFunnel } from "@/lib/score";

const Input = z.object({
  slug: z.string(),
  anonId: z.string().optional(),
  draft: z.unknown(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** draft 저장 (발행 아님) — SiteDoc zod 검증이 불량 데이터를 차단 */
export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const parsed = SiteDoc.safeParse(body.data.draft);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-doc", detail: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const patch: Record<string, unknown> = { draft: parsed.data, theme: parsed.data.theme, business_name: parsed.data.businessName };
  if (body.data.settings) patch.settings = { ...(r.site.settings as object), ...body.data.settings };

  const { error } = await sbAdmin().from("sites").update(patch).eq("id", r.site.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await markFunnel(r.site.id, "first_edit_at");
  const score = await recomputeScore(r.site.id);
  return NextResponse.json({ ok: true, score: score?.score ?? 0, rulesDone: score?.done ?? [] });
}
