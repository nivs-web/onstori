import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";

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

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
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

      return {
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
