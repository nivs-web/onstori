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
  /* ⚠ **음성만 녹음을 먼저 가른다.** `audio/mp4` 도 "mp4" 를 포함해서, 예전 순서로는
     소리만 있는 파일이 영상과 똑같은 이름을 받았다. 그러면 편집화면의 「영상」 목록에
     소리만 있는 것이 섞여 들어가고, 사장님이 그걸 걸면 **그림 없는 검은 영상**이 홈페이지에 붙는다.
     이름에 `audio-` 를 붙여 **구조로** 갈라 둔다 — `storage.publicVideoKeyOf()` 가
     그 이름을 못 읽으므로 영상 목록·걸기에서 저절로 빠진다(주석이 아니라 구조로 막는다). */
  const isAudio = ct.startsWith("audio/");
  const ext = isAudio
    ? (ct.includes("mp4") ? "m4a" : "weba")
    : ct.includes("mp4") ? "mp4" : ct.includes("quicktime") ? "mov" : "webm";
  const key = `private/stories/${slug}/${isAudio ? "audio-" : ""}${randomUUID()}.${ext}`;
  const url = await storage.signedPutUrl("private", key, ct);
  if (url) return NextResponse.json({ mode: "r2", url, key, contentType: ct });
  return NextResponse.json({ mode: "server", key, contentType: ct });
}
