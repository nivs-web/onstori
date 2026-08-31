import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/** 이미지뱅크 검수 액션 — 승인/거부/점수/소프트삭제 (docs/admin.md) */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.quality_ok === "boolean" || body.quality_ok === null) patch.quality_ok = body.quality_ok;
  if (Number.isInteger(body.quality_score) && body.quality_score >= 0 && body.quality_score <= 100) patch.quality_score = body.quality_score;
  if (typeof body.deleted === "boolean") patch.deleted = body.deleted;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });

  const { error } = await sbAdmin().from("image_bank").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
