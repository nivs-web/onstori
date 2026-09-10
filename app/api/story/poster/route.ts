import { NextResponse } from "next/server";
import sharp from "sharp";
import { verifyStoryLink } from "@/lib/story-link";
import * as storage from "@/lib/storage";

export const maxDuration = 30;

/**
 * 60초 녹화의 **표지 사진** 받기 (2026-09-10, V-1).
 *
 * ★ 표지는 녹화 화면이 `blob:` 단계에서 뽑아 보낸다. 나중에(에디터·손님 사이트) 뽑으면
 *   영상 주소가 다른 출처라 canvas 가 오염돼 막힌다(docs/specs/video-섹션-조사-2026-09-07.md §2).
 *
 * ★ 브라우저는 **JPEG** 로만 뽑는다. WebP 변환은 여기 서버 sharp 가 한다 —
 *   iOS 16 이전 사파리는 `canvas.toBlob(...,"image/webp")` 에 **조용히 PNG 를 돌려준다.**
 *   확장자만 .webp 인 수 MB PNG 가 올라가는 사고를 막는다.
 *
 * ★ 저장 자리는 **영상 키에서 계산한다**(`storage.posterKeyOf`). DB 에 칸을 만들지 않으려는 것이다.
 *
 * ⚠ 표지는 100KB 남짓이라 서버를 거쳐도 된다(Vercel 본문 한도 4.5MB). 영상을 서명 URL 로
 *   직접 올리는 이유(한도 초과)가 표지에는 없다.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad-form" }, { status: 400 });
  const slug = String(form.get("slug") ?? "");
  const k = String(form.get("k") ?? "");
  const videoKey = String(form.get("key") ?? "");
  const file = form.get("file");

  if (!verifyStoryLink(slug, k)) return NextResponse.json({ error: "링크가 만료됐어요" }, { status: 403 });
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "2MB 이하만 올릴 수 있어요" }, { status: 413 });
  if (!videoKey.startsWith(`private/stories/${slug}/`)) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  const key = storage.posterKeyOf(videoKey);
  if (!key) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  try {
    const webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await storage.put("media", key, webp, "image/webp");
    return NextResponse.json({ key, url: storage.publicUrl(key) });
  } catch (e) {
    /* ⚠ 표지가 실패해도 **60초 녹화는 살려야 한다.** 부르는 쪽은 이 실패를 삼키고 제출을 계속한다.
       그래도 로그는 남긴다 — 조용히 사라지면 왜 표지가 없는지 영영 모른다. */
    console.error(JSON.stringify({ evt: "story_poster_failed", slug, err: String(e).slice(0, 200) }));
    return NextResponse.json({ error: "표지 사진을 만들지 못했어요" }, { status: 500 });
  }
}
