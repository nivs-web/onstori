import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyStoryLink } from "@/lib/story-link";
import * as storage from "@/lib/storage";

/**
 * 녹화 업로드 경로 발급 (기획1 /mainplan #rec).
 * R2 가 있으면 브라우저 → R2 직접 PUT(서명 URL 10분). 없으면 mode:'server' — /api/story/upload 로 multipart(≤20MB).
 * 키: private/stories/{slug}/{uuid}.{webm|mp4} — 비공개 버킷. 발행본(자막 영상)은 워커가 media 버킷으로 낸다.
 */
export async function POST(req: Request) {
  const { slug, k, contentType } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || !verifyStoryLink(slug, typeof k === "string" ? k : null)) {
    return NextResponse.json({ error: "링크가 만료됐어요. 에디터에서 새 링크를 받아 주세요." }, { status: 403 });
  }
  const ct = typeof contentType === "string" && /^(video|audio)\/[a-z0-9.+-]+$/i.test(contentType) ? contentType.split(";")[0] : "video/webm";
  const ext = ct.includes("mp4") ? "mp4" : ct.includes("quicktime") ? "mov" : ct.startsWith("audio/") ? "weba" : "webm";
  const key = `private/stories/${slug}/${randomUUID()}.${ext}`;
  const url = await storage.signedPutUrl("private", key, ct);
  if (url) return NextResponse.json({ mode: "r2", url, key, contentType: ct });
  return NextResponse.json({ mode: "server", key, contentType: ct });
}
