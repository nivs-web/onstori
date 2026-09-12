import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";

export const dynamic = "force-dynamic";

/**
 * 영상관리 — **고치기 · 숨기기 · 순서 · 지우기.** (2026-09-12 회장님 지시 D2)
 *
 * ★★ **지우기는 파일을 지우지 않는다.** `deleted_at` 만 찍는다(불변 규칙 10).
 *   이미 발행된 손님 사이트가 그 영상 주소를 문서에 갖고 있어서, 파일을 지우면
 *   **남의 홈페이지 영상이 깨진다.** 그리고 SNS 에 올라간 것은 그쪽에서 지워야 한다 —
 *   화면이 확인창에서 그 사실을 그대로 말한다.
 *
 * ★ **숨기기와 지우기는 다른 일이다.** 합치면 사장님이 헷갈린다:
 *   · 숨기기 — 목록에는 남고 홈페이지에만 안 보인다 (`visible`)
 *   · 지우기 — 목록에서도 빠진다 (`deleted_at`)
 *
 * ⚠ 순서(`sort`)는 **작을수록 위**다. 위/아래 한 칸씩 옮기는 것만 한다 —
 *   끌어서 옮기기는 폰에서 잘 안 되고, 사장님 화면은 폰이 먼저다.
 */

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid(),
  action: z.enum(["rename", "visible", "move", "delete"]),
  /** rename 일 때 — 제목 */
  title: z.string().max(100).optional(),
  /** visible 일 때 */
  visible: z.boolean().optional(),
  /** move 일 때 */
  dir: z.enum(["up", "down"]).optional(),
  /** delete 일 때 — 기록에 남는다 */
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const v = parsed.data;

  const r = await loadOwnedSite(v.slug, v.anonId);
  if ("error" in r) {
    return NextResponse.json(
      { error: r.error === "forbidden" ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
      { status: r.error === "forbidden" ? 403 : 404 },
    );
  }
  const sb = sbAdmin();
  const siteId = r.site.id as string;

  /* ⚠ 남의 사이트 영상을 건드릴 수 없게 `site_id` 를 **항상 함께** 건다 */
  const { data: row } = await sb.from("story_entries")
    .select("id, sort, visible, title").eq("id", v.entryId).eq("site_id", siteId).maybeSingle();
  if (!row) return NextResponse.json({ error: "그 영상을 찾지 못했어요" }, { status: 404 });

  if (v.action === "rename") {
    const { error } = await sb.from("story_entries")
      .update({ title: (v.title ?? "").slice(0, 100) }).eq("id", v.entryId).eq("site_id", siteId);
    if (error) return fail("제목을 바꾸지 못했어요", error.message);
    return NextResponse.json({ ok: true, title: v.title ?? "" });
  }

  if (v.action === "visible") {
    const { error } = await sb.from("story_entries")
      .update({ visible: v.visible !== false }).eq("id", v.entryId).eq("site_id", siteId);
    if (error) return fail("바꾸지 못했어요", error.message);
    return NextResponse.json({ ok: true, visible: v.visible !== false });
  }

  if (v.action === "move") {
    /* ★ 위/아래 «한 칸». 옆 사람과 `sort` 를 맞바꾼다.
       ⚠ `sort` 가 전부 같은 값(0)일 수 있다 — 처음 만들어진 영상들이 그렇다.
         그때는 생성순으로 번호를 새로 매겨 두고 나서 바꾼다. 안 그러면 아무 일도 안 일어난다. */
    const { data: all } = await sb.from("story_entries")
      .select("id, sort, created_at").eq("site_id", siteId).not("video_key", "is", null)
      .order("sort", { ascending: true }).order("created_at", { ascending: false });
    const list = (all ?? []) as { id: string; sort: number | null }[];

    const allSame = list.length > 1 && list.every((x) => (x.sort ?? 0) === (list[0].sort ?? 0));
    if (allSame) {
      for (let i = 0; i < list.length; i++) {
        await sb.from("story_entries").update({ sort: i }).eq("id", list[i].id).eq("site_id", siteId);
        list[i].sort = i;
      }
    }

    const idx = list.findIndex((x) => x.id === v.entryId);
    const other = v.dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || other < 0 || other >= list.length) {
      /* ⚠ 끝이면 **조용히 성공했다고 하지 않는다.** 아무 일도 안 일어난 것을 말해 준다 */
      return NextResponse.json({ ok: true, moved: false, why: v.dir === "up" ? "이미 맨 위예요" : "이미 맨 아래예요" });
    }
    const a = list[idx], b = list[other];
    await sb.from("story_entries").update({ sort: b.sort ?? other }).eq("id", a.id).eq("site_id", siteId);
    await sb.from("story_entries").update({ sort: a.sort ?? idx }).eq("id", b.id).eq("site_id", siteId);
    return NextResponse.json({ ok: true, moved: true });
  }

  /* delete — ★ 표시만 바꾼다. 파일도 SNS 기록도 그대로 둔다 */
  const { error } = await sb.from("story_entries")
    .update({ deleted_at: new Date().toISOString(), deleted_reason: (v.reason ?? "").slice(0, 200) || null })
    .eq("id", v.entryId).eq("site_id", siteId);
  if (error) {
    /* ⚠ 마이그레이션(20260912200000) 전이면 칸이 없다. **거짓으로 「지웠다」고 하지 않는다.** */
    console.warn(JSON.stringify({ evt: "video_delete_column_missing", err: error.message.slice(0, 160) }));
    return NextResponse.json(
      { error: "아직 지우기 준비가 끝나지 않았어요. 대신 [숨기기]를 쓰시면 홈페이지에서 안 보입니다.", notReady: true },
      { status: 409 },
    );
  }
  console.log(JSON.stringify({ evt: "video_soft_deleted", entryId: v.entryId }));
  return NextResponse.json({ ok: true, deleted: true });

  function fail(msg: string, detail: string) {
    console.error(JSON.stringify({ evt: "video_manage_failed", action: v.action, err: detail.slice(0, 160) }));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
