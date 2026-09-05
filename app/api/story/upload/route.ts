import { NextResponse } from "next/server";
import { verifyStoryLink } from "@/lib/story-link";
import * as storage from "@/lib/storage";

export const maxDuration = 60;

/** 서버 경유 업로드 폴백(R2 env 없을 때) — Vercel 본문 한도 때문에 프로덕션에서는 R2 직접 업로드가 정상 경로다. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad-form" }, { status: 400 });
  const slug = String(form.get("slug") ?? "");
  const k = String(form.get("k") ?? "");
  const key = String(form.get("key") ?? "");
  const file = form.get("file");
  if (!verifyStoryLink(slug, k)) return NextResponse.json({ error: "링크가 만료됐어요" }, { status: 403 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!key.startsWith(`private/stories/${slug}/`)) return NextResponse.json({ error: "bad-key" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "20MB 이하만 올릴 수 있어요" }, { status: 413 });
  try {
    await storage.put("private", key, Buffer.from(await file.arrayBuffer()), file.type || "video/webm");
    return NextResponse.json({ ok: true, key });
  } catch (e) {
    return NextResponse.json({ error: "업로드 실패", detail: String(e).slice(0, 120) }, { status: 500 });
  }
}
