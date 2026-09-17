import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { quickCheckForInstagram } from "@/lib/sns/mp4";
import { SHORTS_MAX, shortsStyleOf, shortsOrderOf } from "@/config/shorts";

export const dynamic = "force-dynamic";

/**
 * 한 번에 보여줄 최대 개수. 60초 녹화가 이보다 많으면 오래된 것부터 밀린다.
 *
 * ⚠⚠ **2026-09-17 — 숫자 20 이 «두 파일»에 따로 박혀 있었다**(권반장 조사 8-2 [1]b).
 *   여기와 `lib/shorts.ts` 의 `SHORTS_MAX`. **한쪽만 고치면 어긋난다** —
 *   편집화면은 25편을 보여 주는데 홈페이지는 20편만 나오는 식이 된다.
 *   ⇒ **`SHORTS_MAX` 한 곳에서 가져다 쓴다.**
 */
const LIMIT = SHORTS_MAX;

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

  /* ★★ 순서는 **사장님이 정한 것**(sort)이 먼저고, 같으면 최신이 위다 (2026-09-12 지시 D2).
     ⚠ `deleted_at` 칸은 마이그레이션(20260912200000) 뒤에 생긴다. 아직이면 그 조건만 빼고 읽는다 —
       칸 하나 때문에 **영상 목록 전체가 안 뜨면** 안 된다(캡션 칸에서 같은 함정을 이미 겪었다). */
  const COLS = "id, title, question, entry_date, created_at, video_key, video_out_key, media_status, visible, sort";
  const base = () => sbAdmin().from("story_entries").select(COLS)
    .eq("site_id", r.site.id).not("video_key", "is", null)
    .order("sort", { ascending: true }).order("created_at", { ascending: false }).limit(LIMIT);

  let data: Record<string, unknown>[] | null = null;
  let softDeleteReady = true;
  {
    const alive = await base().is("deleted_at", null);
    if (alive.error) {
      softDeleteReady = false;
      const all = await base();
      if (all.error) {
        console.error(JSON.stringify({ evt: "video_list_failed", slug, err: all.error.message.slice(0, 160) }));
        return NextResponse.json({ error: "영상 목록을 불러오지 못했어요" }, { status: 500 });
      }
      data = all.data as Record<string, unknown>[];
    } else data = alive.data as Record<string, unknown>[];
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
  type PostRow = {
    entry_id: string; provider: string; status: string;
    remote_url: string | null; published_at: string | null;
    /** ★ 실패 이유·시도 횟수까지 읽는다 — 없으면 화면이 「안 올라갔어요」조차 말할 수 없다 */
    error_kind?: string | null; attempts?: number | null;
    remote_deleted_at?: string | null;
    created_at?: string | null;
  };

  /**
   * 🔴🔴 **한 영상·한 SNS 에 «줄이 여럿»일 수 있다.** (2026-09-17 지시 [40])
   *
   * ⚠ 유일 제약(`sns_posts_live_uniq`)은 **«살아 있는» 시도에만** 걸려 있다 —
   *   `where status in ('queued','uploading','processing','published')`.
   *   **실패·취소는 다시 시도할 수 있어야 해서 일부러 뺀 것**이다. 그래서 실패할 때마다 줄이 쌓인다.
   *   실측(2026-09-17 · 읽기만 함): 한 영상에 `tiktok` 이 **8줄**(failed 7 + published 1),
   *   다른 영상에 **4줄**(failed 4).
   *
   * 🔴 그래서 **둘이 깨졌다:**
   *   ① 편집화면이 `key={provider}` 로 그려서 **「Encountered two children with the same key」**
   *   ② 같은 영상 밑에 **「안 올라갔어요」 일곱 줄과 「올라갔어요」 한 줄**이 나란히 떴다.
   *      🔴 **화면이 스스로와 어긋나면 그게 곧 거짓말이다**(불변 규칙 12).
   *
   * ⇒ **SNS 한 곳당 «가장 참인 한 줄»만** 내보낸다. 기록은 **DB 에 그대로 남는다** —
   *   지우는 것이 아니라 **화면에 한 줄만 고르는 것**이다(불변 규칙 10).
   *
   * ★ 고르는 차례: **올라간 것 > 가는 중 > 실패 > 취소**, 같으면 **나중 것**.
   *   (실패를 일곱 번 하고 여덟 번째에 올라갔으면 **「올라갔어요」가 참**이다.
   *    몇 번 시도했는지는 그 줄의 `attempts` 가 들고 있다.)
   */
  const 살아있음 = 3;
  const 참한줄순서: Record<string, number> = {
    published: 4,
    processing: 살아있음, uploading: 살아있음, queued: 살아있음,
    failed: 2, canceled: 1,
  };
  const 때 = (p: PostRow) => Date.parse(p.published_at ?? p.created_at ?? "") || 0;
  const SNS한곳에한줄 = (rows: PostRow[]): PostRow[] => {
    const best = new Map<string, PostRow>();
    for (const r of rows) {
      const old = best.get(r.provider);
      if (!old) { best.set(r.provider, r); continue; }
      const a = 참한줄순서[r.status] ?? 0;
      const b = 참한줄순서[old.status] ?? 0;
      if (a > b || (a === b && 때(r) > 때(old))) best.set(r.provider, r);
    }
    return [...best.values()];
  };
  let posts: PostRow[] = [];
  if (entryIds.length) {
    const cols = "entry_id, provider, status, remote_url, published_at, error_kind, attempts, created_at";
    const first = await sbAdmin().from("sns_posts").select(`${cols}, remote_deleted_at`).in("entry_id", entryIds);
    if (first.error) {
      const fallback = await sbAdmin().from("sns_posts").select(cols).in("entry_id", entryIds);
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
        /** 이 영상을 어디에 올렸나 — 새로고침해도 남는다. 🔴 **SNS 한 곳당 한 줄**(지시 [40]) */
        posted: SNS한곳에한줄(posts.filter((p) => p.entry_id === row.id))
          .map((p) => ({
            provider: p.provider, status: p.status,
            /* ⚠ 이 영어(error_kind)는 **화면에 그대로 찍으면 안 된다.**
               반드시 lib/sns/status-say.ts 의 sayPost() 를 거쳐 한국어로 바꿔 쓴다 */
            errorKind: p.error_kind ?? null,
            attempts: p.attempts ?? null,
            url: p.remote_url, publishedAt: p.published_at,
            /** 그쪽에서 지워진 것을 **확인한** 시각. null 이면 「살아 있다」가 아니라 「확인 못 했거나 살아 있다」 */
            deletedAt: p.remote_deleted_at ?? null,
          })),
        id: row.id as string,
        title: (row.title as string) ?? "",
        /** 홈페이지에 보일까 — 「숨기기」의 값. 칸이 비어 있으면 «보임»이 기본이다 */
        visible: row.visible !== false,
        sort: (row.sort as number) ?? 0,
        question: (row.question as string) ?? "",
        date: (row.entry_date as string) ?? "",
        poster,
        preview,
        /** 홈페이지에 걸면 손님이 받게 될 주소. 클라이언트가 자기 doc 과 대조해 «걸림»을 판정한다 */
        publicUrl: publicKey ? storage.publicUrl(publicKey) : null,
        /**
         * ★★ **지금 홈페이지에 «실제로» 걸려 있나.** (2026-09-16 — 숏폼 피드와 짝)
         *   전에는 화면이 「doc 의 video 섹션 url 과 같은가」로 판정했다. 그때는 한 편만 걸렸으니
         *   그게 맞았다. 이제 홈페이지는 `video_out_key` 가 있는 영상을 **전부** 보여 준다
         *   (`lib/shorts.ts`). 그러니 걸림 판정도 그 칸이어야 한다 — 판정하는 값과 화면이
         *   보여 주는 값이 갈리면 「내렸는데 아직 보이네」가 된다(불변 규칙 12).
         */
        attached: !!row.video_out_key,
        posterUrl: poster,
      };
    }),
  );

  /* ⚠ 「지우기」가 아직 준비 안 됐으면 화면이 그 버튼을 **안 그린다.**
     눌러도 아무 일이 안 나는 버튼이 가장 나쁘다. */
  /**
   * 🔴🔴 **「홈페이지에 «몇 편»이 걸려 있나」를 따로 세어 준다.** (2026-09-17 지시 [38])
   *
   * ⚠⚠ **이게 없으면 편집화면이 «21편이 있는지 알 수가 없다».**
   *   위 조회가 이미 `LIMIT`(= `SHORTS_MAX`) 로 **잘라서** 주기 때문이다 —
   *   25편을 거셔도 목록은 20줄이라, 화면은 「20편이구나」로 본다.
   *   (제가 처음에 목록 길이로 세었다가 **안내가 영영 안 뜨는** 것을 실측으로 잡았다.)
   * ★ 세기만 한다(`head: true`) — 줄을 가져오지 않아 값이 싸다.
   */
  let attachedTotal: number | null = null;
  try {
    const q = () => sbAdmin().from("story_entries")
      .select("id", { count: "exact", head: true })
      .eq("site_id", r.site.id).not("video_out_key", "is", null);
    const alive = await q().is("deleted_at", null);
    attachedTotal = alive.error ? (await q()).count ?? null : alive.count ?? null;
  } catch { /* 못 세도 목록은 그대로 나간다 */ }

  /* 🔴 편집화면이 「지금 어떤 모양인가」를 알아야 고르는 칸에 표시할 수 있다 (지시 [42] §4) */
  return NextResponse.json({ items, softDeleteReady, attachedTotal, shortsStyle: shortsStyleOf(r.site.settings), shortsOrder: shortsOrderOf(r.site.settings) });
}
