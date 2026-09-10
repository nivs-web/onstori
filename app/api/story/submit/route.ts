import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStoryLink } from "@/lib/story-link";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { SNIFF_BYTES, isPlayableVideo, sniff, whyNotPlayable } from "@/lib/media-sniff";

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

  const base = { site_id: site.id, entry_type: "work", title: question.slice(0, 60), entry_date: new Date().toISOString().slice(0, 10), visible: false };
  const full = await sb.from("story_entries").insert({ ...base, body: "", question, video_key: key, media_status: "uploaded", photos: [] }).select("id").single();
  if (!full.error) return NextResponse.json({ ok: true, id: full.data.id });

  // 마이그레이션 전 폴백
  const min = await sb.from("story_entries").insert({ ...base, body: `[녹화 업로드됨 · ${mode} · ${source} · ${durationSec ?? "?"}s · ${questionId ?? ""}] ${key}`, photos: [] }).select("id").single();
  if (min.error) return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  return NextResponse.json({ ok: true, id: min.data.id, fallback: true });
}
