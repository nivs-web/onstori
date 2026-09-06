import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 본사 페이지 섹션 노출 토글 (docs/admin.md §7 단계 2).
 * ⚠ 토글만 한다. 섹션 내용 편집은 이번 범위 밖이다(회장님 지시 2026-09-06).
 * ⚠ page_sections 는 읽기만 공개고 쓰기 정책이 없다 — service_role 로만 바뀐다.
 */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, visible } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || typeof visible !== "boolean") {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  // 있는 섹션만 바꾼다 — 새 행을 만들지 않는다(식별자를 임의로 늘리지 않기 위해)
  const { data, error } = await sbAdmin()
    .from("page_sections")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, visible")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "그런 섹션이 없어요" }, { status: 404 });
  return NextResponse.json({ ok: true, ...data });
}
