import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStoryLink } from "@/lib/story-link";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { SNIFF_BYTES, isPlayableVideo, sniff, whyNotPlayable } from "@/lib/media-sniff";
import { recomputeScore } from "@/lib/score";
import { videosToday, overDailyLimit } from "@/lib/story-quota";
import { VIDEOS_PER_DAY, VIDEOS_PER_DAY_MSG } from "@/config/limits";

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
  /** 어느 길로 찍었나 — 브라우저 녹화 / 폰 기본 카메라. 새 칸을 만들지 않고 본문에 적어 둔다 */
  source: z.enum(["browser", "camera"]).default("browser"),
  /** 표지 사진이 올라갔나. 주소는 영상 키에서 계산되므로(storage.posterKeyOf) 따로 저장하지 않는다 */
  poster: z.boolean().default(false),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });
  const { slug, k, key, question, questionId, mode, durationSec, source, poster } = parsed.data;
  if (!verifyStoryLink(slug, k)) return NextResponse.json({ error: "링크가 만료됐어요" }, { status: 403 });
  if (!key.startsWith(`private/stories/${slug}/`)) return NextResponse.json({ error: "bad-key" }, { status: 400 });

  /* ★ 마지막 관문 — **파일 머리를 직접 본다** (2026-09-10, 회장님 지시 4).
     브라우저가 이미 한 번 걸렀지만, 브라우저가 뭐라 하든 서버는 실물을 확인한다.
     「조용히 받아서 나중에 재생이 안 되는 것이 최악이다.」

     ★ 64바이트만 읽는다(Range 요청). 8MB 영상이어도 오가는 건 64바이트다.
     ⚠ 소리만 녹음한 것(audio)은 검사하지 않는다 — 아이폰이 audio/mp4, 안드로이드가
       audio/webm 을 내는데 소리는 어느 쪽이든 재생된다. 영상만 mp4 여야 한다. */
  if (mode === "video") {
    let head: Uint8Array | null = null;
    try {
      head = await storage.readHead("private", key, SNIFF_BYTES);
    } catch (e) {
      console.error(JSON.stringify({ evt: "story_head_read_failed", slug, err: String(e).slice(0, 160) }));
    }
    if (head) {
      const found = sniff(head);
      if (!isPlayableVideo(found)) {
        /* ⚠ 못 쓰는 파일이라도 **지우지 않는다** — 불변 규칙 10(원본 파일을 지우지 않는다).
           비공개 버킷에 남을 뿐 아무 데서도 참조되지 않는다. 로그로 찾을 수 있게 남긴다. */
        console.error(JSON.stringify({ evt: "story_bad_container", slug, key, container: found.container, brand: found.brand, source }));
        return NextResponse.json({ error: whyNotPlayable(found), retake: true }, { status: 422 });
      }
      console.log(JSON.stringify({ evt: "story_ok", slug, brand: found.brand, source, poster, durationSec }));
    }
  }

  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("id, status").eq("slug", slug).maybeSingle();
  if (!site) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (site.status === "expired" || site.status === "suspended") return NextResponse.json({ error: "홈페이지가 정지 상태예요. 정기결제를 시작하시면 바로 다시 녹화하실 수 있어요" }, { status: 402 });

  /**
   * 🔴🔴 **하루 5건 — «진짜» 관문은 여기다.** (2026-09-18 대표님 지시 B-5)
   *
   * ⚠ 앞의 `upload-url` 에서도 한 번 막지만, 그것은 **60초를 헛되이 올리지 않게** 하는 «예의»다.
   *   파일은 다른 길로도 올 수 있으므로 **줄을 만드는 이 자리**가 마지막 관문이어야 한다.
   * ⚠ **막더라도 이미 올라간 파일은 지우지 않는다**(불변 규칙 10) — 비공개 버킷에 남을 뿐
   *   아무 데서도 참조되지 않는다.
   * ⚠ 429 는 「너무 자주」라는 뜻의 상태 번호다. 화면은 이 글을 그대로 보여 준다.
   */
  const usedToday = await videosToday(site.id as string);
  if (overDailyLimit(usedToday)) {
    console.log(JSON.stringify({ evt: "story_daily_limit", slug, used: usedToday, limit: VIDEOS_PER_DAY }));
    return NextResponse.json({ error: VIDEOS_PER_DAY_MSG, used: usedToday, limit: VIDEOS_PER_DAY }, { status: 429 });
  }

  const base = { site_id: site.id, entry_type: "work", title: question.slice(0, 60), entry_date: new Date().toISOString().slice(0, 10), visible: false };

  /* ★★ 2026-09-16 — **점수를 여기서 다시 센다.** (지시 [13] 을 만들다 찾은 것)
   *
   * 🔴 **전에는 안 셌다.** 완성도 「첫 영상」(10점)의 판정은 `story_entries.video_key` 가
   *   하나라도 있나인데(`lib/score.ts`), 그 판정을 **부르는 곳이 이 길에 없었다.**
   *   ⇒ 사장님이 영상을 찍어도 점수가 그대로였고, 나중에 «다른 일»(저장·발행·로고)을
   *     했을 때에야 10점이 뒤늦게 붙었다. 「시키는 대로 했는데 안 오른다」 —
   *     CLAUDE.md 규칙 12 가 경계하는 바로 그 모양이다.
   *   ⚠ 점수 «규칙»은 한 글자도 안 고쳤다. 이미 있던 규칙이 **실제로 켜지게** 한 것뿐이다.
   *
   * ⚠ 점수 계산이 실패해도 **녹화는 성공이다.** 60초를 날리지 않는다 —
   *   영상은 이미 저장소와 DB 에 들어갔고, 점수는 다음 저장 때 어차피 다시 계산된다.
   */
  async function scoreQuietly(): Promise<number | null> {
    try { return (await recomputeScore(site!.id as string))?.score ?? null; }
    catch (e) { console.warn(JSON.stringify({ evt: "story_score_failed", slug, err: String(e).slice(0, 160) })); return null; }
  }

  const full = await sb.from("story_entries").insert({ ...base, body: "", question, video_key: key, media_status: "uploaded", photos: [] }).select("id").single();
  if (!full.error) return NextResponse.json({ ok: true, id: full.data.id, score: await scoreQuietly() });

  // 마이그레이션 전 폴백
  const min = await sb.from("story_entries").insert({ ...base, body: `[녹화 업로드됨 · ${mode} · ${source} · ${durationSec ?? "?"}s · ${questionId ?? ""}] ${key}`, photos: [] }).select("id").single();
  if (min.error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  /* ⚠ 폴백 길에는 `video_key` 칸이 없다 — 점수의 「첫 영상」은 여기서 안 붙는 것이 «맞다».
     그래도 다시 세 둔다: 다른 규칙이 그 사이 바뀌었을 수 있고, 세는 비용이 거의 없다. */
  return NextResponse.json({ ok: true, id: min.data.id, fallback: true, score: await scoreQuietly() });
}
