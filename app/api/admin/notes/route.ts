import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 운영자 메모장 저장 — `admin_notes` 표의 한 줄을 통째로 덮어쓴다.
 *
 * 쓰는 id 세 개 (2026-09-07 회장님: 메모장 3개로):
 *   main — 온스토리 메모장 (자유 글). body = 그냥 글
 *   todo — 할일 메모.       body = JSON 배열 문자열
 *   done — 완료된 메모.     body = JSON 배열 문자열
 *
 * ★ 표를 늘리지 않았다. body 가 text 라 JSON 을 그대로 담으면 된다 —
 *   **마이그레이션이 필요 없다.** 항목 구조가 바뀌어도 DB 는 그대로다.
 *
 * ⚠ 표가 아직 없으면(=`db push` 전) 저장이 실패한다. 그때는 화면에
 *   "db push 가 필요합니다"를 그대로 보여준다. 조용히 성공한 척하면 적은 글이 사라진다.
 */
export const dynamic = "force-dynamic";

const MAX = 20_000;
const IDS = new Set(["main", "todo", "done"]);

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, body } = await req.json().catch(() => ({}));
  const key = typeof id === "string" && IDS.has(id) ? id : "main";
  if (typeof body !== "string") return NextResponse.json({ error: "본문이 없어요" }, { status: 400 });
  if (body.length > MAX) return NextResponse.json({ error: `${MAX.toLocaleString()}자를 넘었어요` }, { status: 413 });

  const { error } = await sbAdmin()
    .from("admin_notes")
    .upsert({ id: key, body, updated_at: new Date().toISOString() }, { onConflict: "id" });

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
