import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 운영자 메모장 저장 — `admin_notes` 표의 id='main' 한 줄만 쓴다.
 *
 * ⚠ 표가 아직 없으면(=`db push` 전) 저장이 실패한다. 그때는 화면에
 *   "표가 아직 없어요 — db push 가 필요합니다"를 그대로 보여준다.
 *   조용히 성공한 척하면 회장님이 적은 글이 사라진다.
 */
export const dynamic = "force-dynamic";

const MAX = 20_000;

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { body } = await req.json().catch(() => ({}));
  if (typeof body !== "string") return NextResponse.json({ error: "본문이 없어요" }, { status: 400 });
  if (body.length > MAX) return NextResponse.json({ error: `${MAX.toLocaleString()}자를 넘었어요` }, { status: 413 });

  const { error } = await sbAdmin()
    .from("admin_notes")
    .upsert({ id: "main", body, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) {
    /* 표가 없을 때(42P01)와 그 밖의 오류를 구분해 준다 — 원인을 짐작하게 두지 않는다 */
    const missing = /relation .*admin_notes.* does not exist|42P01/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "admin_notes 표가 아직 없어요. `npx supabase db push` 를 한 번 돌려야 저장됩니다."
          : `저장에 실패했어요: ${error.message.slice(0, 120)}`,
      },
      { status: missing ? 503 : 500 },
    );
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
