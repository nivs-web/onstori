import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyStoryLink } from "@/lib/story-link";
import * as storage from "@/lib/storage";
import { sbAdmin } from "@/lib/db-admin";
import { videosToday, overDailyLimit } from "@/lib/story-quota";
import { VIDEOS_PER_DAY, VIDEOS_PER_DAY_MSG } from "@/config/limits";

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
  /**
   * 🔴 **하루 5건 — 올리기 «전»에 먼저 막는다.** (2026-09-18 대표님 지시 B-5)
   *
   * ⚠⚠ **왜 여기서도 막나:** 여기서 안 막으면 사장님이 **60초를 다 찍고 40MB 를 올린 «뒤»**
   *   제출에서 거절당한다. **시간을 쓰게 만든 뒤에 버리는 것**이 가장 나쁘다(2026-09-10 회장님 지시 4 정신).
   * ⚠ 못 세면(옛 DB·장애) **막지 않는다.** 셀 수 없는 것으로 사장님을 멈춰 세우지 않는다.
   * ⚠ 이것은 «예의»이고, **마지막 관문은 `submit`** 이다. 둘 다 있어야 한다.
   */
  try {
    const { data: site } = await sbAdmin().from("sites").select("id").eq("slug", slug).maybeSingle();
    if (site?.id) {
      const used = await videosToday(site.id as string);
      if (overDailyLimit(used)) {
        return NextResponse.json({ error: VIDEOS_PER_DAY_MSG, used, limit: VIDEOS_PER_DAY }, { status: 429 });
      }
    }
  } catch { /* 물어보지 못했으면 막지 않는다 — 제출에서 다시 본다 */ }

  /* ⚠ **기본값을 `video/webm` 으로 두지 않는다** (2026-09-12).
     화면이 형식을 못 보내면 예전에는 조용히 「webm」이 됐다. 그런데 녹화기는 mp4 만 만든다
     (webm 후보를 2026-09-10 에 지웠고, 못 만드는 브라우저는 아예 못 찍게 막는다).
     즉 기본값이 **거의 항상 거짓말**이었고, 실제로 12건이 «이름은 webm, 내용은 mp4» 로 쌓였다.
     이름·딱지가 내용과 다르면 그걸 보고 판단하는 코드가 전부 함께 속는다. */
  const ct = typeof contentType === "string" && /^(video|audio)\/[a-z0-9.+-]+$/i.test(contentType) ? contentType.split(";")[0] : "video/mp4";
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
