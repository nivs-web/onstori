import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { recomputeScore, markFunnel } from "@/lib/score";

const Input = z.object({
  slug: z.string(),
  anonId: z.string().optional(),
  entryType: z.enum(["work", "news", "milestone", "guest"]),
  title: z.string().min(1).max(60),
  body: z.string().max(1000).default(""),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photos: z.array(z.string().url()).max(10).default([]),
});

/** 스토리 작성 — 온스토리의 심장. 발행과 무관하게 즉시 공개(스토리는 append 자산) */
export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const { error } = await sbAdmin().from("story_entries").insert({
    site_id: r.site.id,
    entry_type: body.data.entryType,
    title: body.data.title,
    body: body.data.body,
    photos: body.data.photos,
    entry_date: body.data.entryDate,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await markFunnel(r.site.id, "first_story_at");
  const score = await recomputeScore(r.site.id);
  return NextResponse.json({ ok: true, score: score?.score ?? 0 });
}
