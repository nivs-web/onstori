import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStoryLink } from "@/lib/story-link";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 녹화 제출 — story_entries 에 '업로드됨' 행을 남긴다 (기획1 /mainplan #rec).
 * visible=false 로 두고, 워커(STEP 4)가 자막 영상을 만들면 ready + visible=true 로 바꾼다.
 * 20260905 마이그레이션(question·video_key·media_status) 전이면 body 에 키를 적어 두는 최소 삽입으로 폴백.
 */
const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  k: z.string().max(40),
  key: z.string().max(200),
  question: z.string().max(200),
  questionId: z.string().max(40).optional(),
  mode: z.enum(["video", "audio"]).default("video"),
  durationSec: z.number().min(1).max(90).optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });
  const { slug, k, key, question, questionId, mode, durationSec } = parsed.data;
  if (!verifyStoryLink(slug, k)) return NextResponse.json({ error: "링크가 만료됐어요" }, { status: 403 });
  if (!key.startsWith(`private/stories/${slug}/`)) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("id, status").eq("slug", slug).maybeSingle();
  if (!site) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (site.status === "expired" || site.status === "suspended") return NextResponse.json({ error: "정회원 전환 뒤 녹화할 수 있어요" }, { status: 402 });

  const base = { site_id: site.id, entry_type: "work", title: question.slice(0, 60), entry_date: new Date().toISOString().slice(0, 10), visible: false };
  const full = await sb.from("story_entries").insert({ ...base, body: "", question, video_key: key, media_status: "uploaded", photos: [] }).select("id").single();
  if (!full.error) return NextResponse.json({ ok: true, id: full.data.id });

  // 마이그레이션 전 폴백
  const min = await sb.from("story_entries").insert({ ...base, body: `[녹화 업로드됨 · ${mode} · ${durationSec ?? "?"}s · ${questionId ?? ""}] ${key}`, photos: [] }).select("id").single();
  if (min.error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  return NextResponse.json({ ok: true, id: min.data.id, fallback: true });
}
