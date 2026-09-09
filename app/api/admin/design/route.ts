import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { DesignSettingIn, KEY, isStoredTarget, sanitize } from "@/lib/design-settings";

/**
 * 디자인 설정 저장 — `app_settings` 의 한 줄을 통째로 덮어쓴다 (2026-09-09, S2).
 *
 * 쓰는 key 세 개: `design:site` · `design:admin` · `design:editor`
 *
 * ⚠ 운영자 메모(`api/admin/notes`)는 모르는 id 를 조용히 `main` 으로 떨어뜨린다.
 *   **디자인은 그러면 안 된다** — 어드민을 고치려다 손님 화면이 바뀐다. 모르는 대상은 400 이다.
 *
 * ⚠ 표가 아직 없으면(=`db push` 전) 저장이 실패한다. 그때는 화면에
 *   "db push 가 필요합니다"를 그대로 보여준다. 조용히 성공한 척하면 고른 디자인이 사라진다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = (body as { target?: unknown })?.target;
  if (!isStoredTarget(target)) {
    return NextResponse.json({ error: "어느 화면인지 알 수 없어요" }, { status: 400 });
  }

  const parsed = DesignSettingIn.safeParse((body as { setting?: unknown })?.setting);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "값이 올바르지 않아요" }, { status: 400 });
  }
  // ★ 서체를 고를 수 없는 화면이 서체를 보내면 여기서 버려진다 (불변 규칙 4)
  const setting = sanitize(target, parsed.data);

  const { error } = await sbAdmin()
    .from("app_settings")
    .upsert({ key: KEY[target], value: setting, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    /* ⚠ Supabase(PostgREST)는 표가 없을 때 42P01 이 아니라
       "Could not find the table … in the schema cache" 라고 답한다.
       2026-09-07 에 메모장에서 이 문구를 못 잡아 원시 오류가 그대로 떴다. 같은 실수를 하지 않는다. */
    const missing = /relation .*app_settings.* does not exist|42P01|could not find the table/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "app_settings 표가 아직 없어요. `npx supabase db push` 를 한 번 돌려야 저장됩니다."
          : `저장에 실패했어요: ${error.message.slice(0, 120)}`,
      },
      { status: missing ? 503 : 500 },
    );
  }

  /* ★ 저장한 즉시 모든 화면에 반영시킨다.
     두 번째 인자 "layout" 이 있어야 `/terms`·`/faq` 처럼 **완전 정적인 화면까지** 갱신된다.
     빼면 그 화면들은 최대 한 시간(설정 캐시) 동안 옛 디자인으로 남는다.
     ⚠ 앱 전체를 다시 굽게 하는 무거운 호출이다. **[적용] 버튼에서만** 부른다 —
       미리보기·자동저장처럼 자주 부르는 자리에서 부르면 안 된다. */
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, at: new Date().toISOString(), setting });
}
