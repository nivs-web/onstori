import { NextResponse } from "next/server";
import { z } from "zod";
import { SITES_PER_ACCOUNT } from "@/config/limits";
import { sbAdmin } from "@/lib/db-admin";
import { verifyHandover } from "@/lib/handover";
import { getSessionUser } from "@/lib/supabase/server";
import { WEEKLY_DEFAULT } from "@/lib/weekly";

/**
 * **미리 만들어 둔 홈페이지를 그 가게 사장님이 가져간다.** (2026-09-13 회장님 지시 B1·B3)
 *
 * ★ 왜 기존 `api/auth/claim` 으로는 안 되나: 그쪽은 **그 브라우저의 익명표**로 찾는다.
 *   회장님 PC 에서 만든 것이라 사장님 폰에는 그 익명표가 없다(lib/handover.ts 머리말).
 *
 * ★★ **「한 번만 쓰이는 열쇠」가 지켜지는 자리가 바로 여기다.**
 *   아래 갱신에 `.is("owner_id", null)` 이 붙어 있다 — **주인이 없을 때만** 박힌다.
 *   먼저 가져간 사람이 있으면 0줄이 바뀌고 409 가 나간다. 표를 새로 만들지 않고도
 *   「한 번만」이 된다. ⚠ 이 조건을 빼면 **남의 홈페이지를 빼앗는 길**이 열린다. 빼지 마라.
 */

const Input = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  k: z.string().min(4).max(64),
});

export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });
  const { slug, k } = body.data;

  /* 열쇠가 맞는가 — 로그인보다 먼저 본다. 틀린 열쇠로는 존재 여부도 알려 주지 않는다 */
  if (!verifyHandover(slug, k)) {
    return NextResponse.json(
      { error: "이 링크는 만료됐거나 올바르지 않아요. 보내 드린 분께 다시 요청해 주세요." },
      { status: 403 },
    );
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = sbAdmin();

  const { data: site, error: readErr } = await sb
    .from("sites")
    .select("id, slug, business_name, owner_id, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!site) return NextResponse.json({ error: "이 홈페이지를 찾을 수 없어요." }, { status: 404 });

  /* 이미 주인이 있다 — 열쇠는 이미 쓰였다. 본인이면 그대로 들여보낸다 */
  if (site.owner_id) {
    return site.owner_id === user.id
      ? NextResponse.json({ ok: true, slug, already: true })
      : NextResponse.json(
          { error: "이 홈페이지는 이미 다른 분이 가져가셨어요." },
          { status: 409 },
        );
  }

  /* ★ 한 계정에 홈페이지 하나 (config/limits.ts) — 여기도 막는다.
     ⚠ 여기서는 `claim` 과 달리 **조용히 넘어가지 않고 말해 준다.** 사장님이 이 링크를
       «일부러» 누르신 것이라, 아무 일도 안 일어나면 고장 난 줄 아신다. */
  const { count: mine } = await sb
    .from("sites").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((mine ?? 0) >= SITES_PER_ACCOUNT) {
    return NextResponse.json(
      { error: "이 계정에는 이미 홈페이지가 있어요. 다른 계정으로 로그인해 주세요.", goMy: true },
      { status: 409 },
    );
  }

  /**
   * ★★ **주인이 생겼으니 「미리 만든 곳」 표시를 뗀다.** (lib/premade.ts)
   *   표시가 붙어 있는 동안은 주 1회 문자도 만료 안내도 **전부 건너뛴다.** 떼지 않으면
   *   사장님이 가져가셨는데도 문자가 한 통도 안 가는, 반대쪽 거짓말이 된다.
   * ★ 주 1회 알림은 **가입한 사장님과 똑같이** 기본값으로 켠다. 이 링크를 눌러 로그인까지
   *   하신 분이라 새로 만든 것과 같은 상태가 맞다. 화면에서 그 사실을 «미리» 알린다
   *   (`app/claim/[slug]` — 문구의 출처는 `WEEKLY_NOTICE` 하나다).
   * ⚠ 첫 문자 끝에는 「이 번호가 아니면 STOP」 이 붙는다(lib/weekly.ts `withOptOut`).
   */
  const settings = { ...((site.settings as Record<string, unknown> | null) ?? {}) };
  delete settings.premade;
  settings.weekly = { ...WEEKLY_DEFAULT };

  const { data: done, error: upErr } = await sb
    .from("sites")
    .update({ owner_id: user.id, anon_id: null, settings })
    .eq("id", site.id)
    .is("owner_id", null)     /* ★ 「한 번만」은 이 한 줄이 지킨다 — 빼지 마라 */
    .select("slug");
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  if (!done?.length) {
    return NextResponse.json({ error: "방금 다른 분이 먼저 가져가셨어요." }, { status: 409 });
  }

  console.log(JSON.stringify({ evt: "site_handover", slug, business: site.business_name }));
  return NextResponse.json({ ok: true, slug });
}
