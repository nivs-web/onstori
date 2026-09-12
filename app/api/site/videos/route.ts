import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { quickCheckForInstagram } from "@/lib/sns/mp4";

export const dynamic = "force-dynamic";

/** 한 번에 보여줄 최대 개수. 60초 녹화가 이보다 많으면 오래된 것부터 밀린다 */
const LIMIT = 20;

/**
 * 사장님이 찍어 올린 60초 영상 **목록** (2026-09-11, V-1 C).
 *
 * ★ 이 화면은 편집화면(동적 페이지)에서만 쓴다. 그래서 **서명 URL 을 써도 된다** —
 *   손님 사이트(정적)에 서명 주소를 구워 넣는 것과는 완전히 다른 이야기다.
 *   서명 주소로 사장님이 **직접 보고** 어느 영상인지 확인할 수 있다(회장님 지시 4).
 *
 * ★ **길이(duration)는 DB 에 칸이 없다.** 브라우저가 서명 주소로 metadata 만 읽어 잰다.
 *   칸을 만들면 마이그레이션 → `db push`(사람이 해야 함) → 그때까지 이 화면이 멈춘다.
 *
 * ★ 「이미 걸렸는지」는 **서버가 판정하지 않는다.** 편집화면이 들고 있는 draft 가 진실이고,
 *   서버가 읽은 draft 는 이미 낡았을 수 있다(사장님이 방금 고쳤을 수 있다).
 *   대신 「걸면 이 주소가 된다」(`publicUrl`)를 같이 줘서 클라이언트가 자기 doc 과 대조한다.
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  }

  const { data, error } = await sbAdmin()
    .from("story_entries")
    .select("id, title, question, entry_date, created_at, video_key, video_out_key, media_status")
    .eq("site_id", r.site.id)
    .not("video_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error(JSON.stringify({ evt: "video_list_failed", slug, err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "영상 목록을 불러오지 못했어요" }, { status: 500 });
  }

  /* ⚠ **소리만 녹음한 것은 이 목록에서 뺀다.** 그것도 `video_key` 에 저장되지만
     그림이 없다 — 걸면 홈페이지에 검은 칸이 붙는다.
     `audio-` 이름은 `publicVideoKeyOf` 가 못 읽으므로 여기서 저절로 걸러진다
     (주석이 아니라 구조로 막는다 — `app/api/story/upload-url/route.ts`). */
  const videoRows = (data ?? []).filter((row) => storage.publicVideoKeyOf(String(row.video_key ?? "")) !== null);

  /* ★★ 「이 영상을 어디에 올렸나」를 **기록에서** 읽는다 (2026-09-12 회장님 지시 2).
     전에는 올린 결과가 화면 메모리에만 있어서 **새로고침하면 통째로 사라졌다.**
     그러면 사장님은 올렸는지 안 올렸는지 알 수 없고, 같은 영상을 또 올리려 한다.
     ⚠ `remote_deleted_at` 은 마이그레이션(20260912140000) 뒤에 생긴다. 없으면 그 칸만 빼고 읽는다 —
       칸 하나 때문에 영상 목록 전체가 안 뜨면 안 된다. */
  const entryIds = videoRows.map((r) => r.id as string);
  type PostRow = { entry_id: string; provider: string; status: string; remote_url: string | null; published_at: string | null; remote_deleted_at?: string | null };
  let posts: PostRow[] = [];
  if (entryIds.length) {
    const base = "entry_id, provider, status, remote_url, published_at";
    const first = await sbAdmin().from("sns_posts").select(`${base}, remote_deleted_at`).in("entry_id", entryIds);
    if (first.error) {
      const fallback = await sbAdmin().from("sns_posts").select(base).in("entry_id", entryIds);
      posts = (fallback.data ?? []) as PostRow[];
    } else {
      posts = (first.data ?? []) as PostRow[];
    }
  }

  const items = await Promise.all(
    videoRows.map(async (row) => {
      const key = row.video_key as string;
      const publicKey = storage.publicVideoKeyOf(key);
      const posterKey = storage.posterKeyOf(key);

      /* 표지가 실제로 있는지 본다 — 없으면 깨진 사진이 잠깐 번쩍인다.
         A덩어리에서 표지 뽑기가 실패하면 아예 안 올라간다(그때는 null 이 맞다). */
      let poster: string | null = null;
      if (posterKey) {
        try { await storage.readHead("media", posterKey, 1); poster = storage.publicUrl(posterKey); }
        catch { poster = null; }
      }

      /* 미리보기용 서명 주소 — 10분. 사장님이 «어느 영상인지» 보고 고르는 데 쓴다 */
      let preview: string | null = null;
      try { preview = await storage.signedGetUrl(key, 600); } catch { preview = null; }

      /* ★ **누르기 전에** 인스타에 올릴 수 있는지 본다 (2026-09-12 회장님 지시).
         눌러서 실패하면 **하루 한도 1개가 이미 줄어든 뒤**다. 그 손해를 없앤다.
         ⚠ 가벼운 검사다(머리 64바이트 + 크기). 가로폭·파일구조는 올릴 때 본다.
         ⚠ 못 재면 막지 않는다 — 「모르니까 거절」은 멀쩡한 영상을 버린다. */
      const ig = await quickCheckForInstagram(key).catch(() => ({ ok: true, why: "" }));

      return {
        ig,
        /** 이 영상을 어디에 올렸나 — 새로고침해도 남는다 */
        posted: posts
          .filter((p) => p.entry_id === row.id)
          .map((p) => ({
            provider: p.provider, status: p.status,
            url: p.remote_url, publishedAt: p.published_at,
            /** 그쪽에서 지워진 것을 **확인한** 시각. null 이면 「살아 있다」가 아니라 「확인 못 했거나 살아 있다」 */
            deletedAt: p.remote_deleted_at ?? null,
          })),
        id: row.id as string,
        title: (row.title as string) ?? "",
        question: (row.question as string) ?? "",
        date: (row.entry_date as string) ?? "",
        poster,
        preview,
        /** 홈페이지에 걸면 손님이 받게 될 주소. 클라이언트가 자기 doc 과 대조해 «걸림»을 판정한다 */
        publicUrl: publicKey ? storage.publicUrl(publicKey) : null,
        posterUrl: poster,
      };
    }),
  );

  return NextResponse.json({ items });
}
