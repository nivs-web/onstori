import { publicUrl, posterKeyOf } from "./storage";
import { SHORTS_MAX } from "@/config/shorts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 홈페이지 «숏폼 피드»에 실을 영상 목록. (2026-09-16 대표님 지시로 신설)
 *
 * ★★ **왜 만들었나 — 이것이 이 사업의 정체성이다.**
 *   전에는 홈페이지에 영상이 **한 편만** 걸렸다(`video` 섹션의 `url` 이 한 칸이라서).
 *   사장님이 열 편을 찍어도 손님은 한 편만 봤다. 대표님 말씀:
 *   「힘들게 찍은 영상인데 자동 노출이 안 된다면 우리 온스토리 쓰는 이유가 없는 거지.」
 *
 * ★★ **「걸렸다」의 판정은 `video_out_key` 하나다.**
 *   그 칸에 값이 있으면 = 공개 창고(R2)에 사본이 있다 = 손님이 볼 수 있다.
 *   「홈페이지에서 내리기」를 누르면 그 칸이 비워진다. **새 칸을 만들지 않는다**(불변 규칙 12 —
 *   판정하는 값 · 화면이 채우는 값 · 힌트가 데려가는 곳 셋이 같아야 한다).
 *
 * ⚠ `visible` 로 거르지 «않는다». 그 칸은 이야기(글)가 쓰는 칸이고, 영상은 녹화 직후
 *   `visible=false` 로 들어온다(`api/story/submit`). 그걸로 거르면 **방금 찍은 영상이
 *   홈페이지에 안 나온다.** 완성도 점수가 영상을 visible 과 무관하게 세는 것과 같은 이유다.
 *
 * ★ SNS 주소는 **올라간 것만** 붙인다(`sns_posts.status = 'published'`).
 *   실패·대기 중인 것을 붙이면 손님이 눌렀을 때 아무 데도 안 간다.
 */

/**
 * 바깥 SNS 글 하나.
 *
 * 🔴 **`likes`·`comments` 는 «아직 아무도 안 채운다».** (2026-09-17 지시 [49]③)
 *   가져오는 일은 **[46]** 이다. 그전까지는 늘 `undefined` 라 **화면에 아무것도 안 그린다.**
 * ⚠ **`0` 과 `undefined` 를 갈라 둔다** — `0` 은 「세어 봤더니 0」, `undefined` 는 「아직 안 세어 봤다」다.
 *   🔴 **둘 다 안 그리지만 뜻이 다르다.** 「♡ 0」은 「아무도 안 좋아했다」로 읽혀서 안 그리는 것이고
 *   (권반장 지시), `undefined` 는 **우리가 모르는 것**이라 안 그린다.
 */
export type ShortLink = {
  provider: "instagram" | "tiktok" | "youtube" | "facebook" | "threads" | "x";
  url: string;
  /** 좋아요 수 — **[46] 이 채운다.** 안 세어 봤으면 `undefined` */
  likes?: number;
  /** 댓글 수 — **[46] 이 채운다.** 안 세어 봤으면 `undefined` */
  comments?: number;
};

export type ShortT = {
  id: string;
  /** 공개 mp4 주소 */
  src: string;
  /** 표지 한 장. 없으면 브라우저가 첫 프레임을 쓴다 */
  poster?: string;
  /** 영상 아래 한 줄 — 녹화할 때의 질문, 없으면 제목 */
  caption: string;
  /** YYYY-MM-DD */
  date: string;
  /** 「인스타에서 보기」 같은 바깥 링크 */
  links: ShortLink[];
};

/** 화면에 한 번에 담는 최대 편수. 이보다 많으면 최신 것부터 자른다.
    🔴 **값은 `config/shorts.ts` 에 있다** — 화면 코드도 읽어야 해서 그리로 옮겼다(2026-09-17). */
export { SHORTS_MAX };

const KNOWN: ShortLink["provider"][] = ["instagram", "tiktok", "youtube", "facebook", "threads", "x"];

/**
 * 한 사이트의 숏폼 목록을 읽는다.
 *
 * ⚠ **절대 던지지 않는다.** 실패하면 빈 배열이다 — 영상 목록을 못 읽었다고 해서
 *   사장님 홈페이지 전체가 안 열리면 안 된다.
 * ⚠ `video_out_key` 칸은 마이그레이션(20260905090000) 이후에 생긴다. 옛 DB 에서 이 조회가
 *   실패할 수 있어 `catch` 로 감싼다 — 그때는 영상 없는 사이트처럼 보인다.
 */
export async function loadShorts(client: SupabaseClient, siteId: string): Promise<ShortT[]> {
  try {
    /* ★ 순서를 «사장님이 편집화면에서 보는 순서»와 같게 맞춘다 — sort 먼저, 같으면 최신이 위.
       화면마다 순서가 다르면 「위로 올렸는데 홈페이지는 그대로네」가 된다. */
    const base = () => client
      .from("story_entries")
      .select("id, title, question, video_key, video_out_key, entry_date, created_at, sort")
      .eq("site_id", siteId)
      .not("video_out_key", "is", null)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(SHORTS_MAX);

    /* ⚠ `deleted_at` 칸은 마이그레이션(20260912200000) 뒤에 생긴다. 아직이면 그 조건만 빼고 읽는다 —
       칸 하나 때문에 영상이 **하나도 안 나오면** 안 된다(`api/site/videos` 가 같은 함정을 이미 겪었다). */
    let rows: Record<string, unknown>[] | null = null;
    const alive = await base().is("deleted_at", null);
    if (alive.error) {
      const all = await base();
      if (all.error) return [];
      rows = all.data as Record<string, unknown>[];
    } else rows = alive.data as Record<string, unknown>[];
    if (!rows?.length) return [];

    /* ★ SNS 주소를 한 번에 모아 온다 — 영상 편수만큼 조회를 반복하지 않는다 */
    const ids = rows.map((r) => String(r.id));
    const linksBy = new Map<string, ShortLink[]>();
    /**
     * 🔴🔴 **그쪽에서 «지워진» 글의 버튼은 안 그린다.** (2026-09-17 지시 [48]③)
     *
     * > 대표님: 「나머지에는 영상을 다 지웠어. **그러면 링크가 사라져?** …
     * >   사장님이 안 좋은 댓글 때문에 **비공개로 할 수도 있고, 그러면 에러가 뜨면 안 됨**」
     *
     * ⚠ 지금까지는 **지워진 글의 「인스타에서 보기」가 손님 화면에 그대로** 떠 있었다.
     *   눌러도 **없는 글**로 간다 — 화면이 사실과 다르면 그 자체가 거짓말이다(불변 규칙 12).
     *
     * ⚠⚠ **`remote_deleted_at` 칸은 마이그레이션(20260912140000) 뒤에 생긴다.**
     *   그 칸이 «없는» DB 에서 이 조건을 걸면 조회가 통째로 실패해
     *   🔴 **영상 링크가 하나도 안 나온다**(검증이 짚은 바로 그 위험).
     *   ⇒ **`app/api/site/videos/route.ts` 와 «같은 방식»** — 먼저 그 칸까지 걸어 보고,
     *     실패하면 **그 조건만 빼고 다시** 읽는다. 위의 `deleted_at` 도 같은 이유로 그렇게 한다(§56).
     */
    try {
      const cols = "entry_id, provider, remote_url, status";
      const base = () => client
        .from("sns_posts")
        .select(cols)
        .in("entry_id", ids)
        .eq("status", "published")
        .not("remote_url", "is", null);
      const first = await base().is("remote_deleted_at", null);
      let posts = first.data;
      if (first.error) {
        /* 칸이 아직 없다 — 그 조건만 빼고 읽는다. 링크가 하나도 안 나오는 것보다 낫다 */
        const again = await base();
        posts = again.data;
      }
      for (const p of posts ?? []) {
        const prov = String(p.provider) as ShortLink["provider"];
        const url = String(p.remote_url ?? "");
        if (!KNOWN.includes(prov) || !/^https?:\/\//i.test(url)) continue;
        const k = String(p.entry_id);
        const arr = linksBy.get(k) ?? [];
        /* 같은 곳에 두 번 올라간 기록이 있으면 첫 줄만 쓴다 — 버튼이 두 개 뜨면 안 된다 */
        if (!arr.some((l) => l.provider === prov)) arr.push({ provider: prov, url });
        linksBy.set(k, arr);
      }
    } catch { /* SNS 기록을 못 읽어도 영상은 보여 준다 */ }

    return rows.flatMap((r) => {
      const outKey = String(r.video_out_key ?? "");
      if (!outKey) return [];
      let src = "";
      try { src = publicUrl(outKey); } catch { return []; }
      if (!src) return [];

      /* 표지는 «원본 키»에서 계산한다 — 공개 사본과 표지는 이름 규칙이 다르다 */
      let poster: string | undefined;
      const vk = r.video_key ? String(r.video_key) : "";
      if (vk) {
        const pk = posterKeyOf(vk);
        if (pk) { try { poster = publicUrl(pk); } catch { /* 표지는 없어도 된다 */ } }
      }

      const caption = String(r.question ?? "").trim() || String(r.title ?? "").trim();
      const date = String(r.entry_date ?? r.created_at ?? "").slice(0, 10);

      return [{ id: String(r.id), src, poster, caption, date, links: linksBy.get(String(r.id)) ?? [] }];
    });
  } catch {
    return [];
  }
}
