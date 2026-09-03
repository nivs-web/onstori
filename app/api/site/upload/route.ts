import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { loadOwnedSite } from "@/lib/site-owner";
import * as storage from "@/lib/storage";

export const maxDuration = 30;

/** 고객 사진 업로드 — WebP 변환(최대 1600w) 후 uploads 버킷 저장. 소유자만. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad-form" }, { status: 400 });
  const slug = String(form.get("slug") ?? "");
  const anonId = form.get("anonId") ? String(form.get("anonId")) : undefined;
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "15MB 이하만 가능해요" }, { status: 413 });

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const webp = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const { key } = await storage.put("media", `uploads/${slug}/${randomUUID()}.webp`, webp, "image/webp");
    return NextResponse.json({ url: storage.publicUrl(key) });
  } catch (e) {
    return NextResponse.json({ error: "이미지 처리에 실패했어요", detail: String(e).slice(0, 120) }, { status: 500 });
  }
}
