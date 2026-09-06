import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 이미지뱅크 검수 액션 — 승인/거부/점수/태그/휴지통 (docs/admin.md)
 *
 * ★ 삭제는 **되돌릴 수 있는 표시 변경**으로만 한다 (CLAUDE.md 규칙 10, 2026-09-06 확정).
 *   원본 파일(R2)은 절대 지우지 않는다 — 이미 발행된 손님 사이트가 그 주소를 문서에
 *   갖고 있어서, 파일을 지우면 남의 홈페이지 사진이 깨진다.
 *   deleted=true 로 내리고 deleted_at·deleted_reason 을 남긴다. 복구는 deleted=false.
 */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.quality_ok === "boolean" || body.quality_ok === null) patch.quality_ok = body.quality_ok;
  if (Number.isInteger(body.quality_score) && body.quality_score >= 0 && body.quality_score <= 100) patch.quality_score = body.quality_score;
  if (typeof body.deleted === "boolean") {
    patch.deleted = body.deleted;
    // 내릴 때는 시각·사유를 남기고, 복구할 때는 지운다 — 언제 왜 내렸는지가 있어야 복구 판단이 된다
    patch.deleted_at = body.deleted ? new Date().toISOString() : null;
    patch.deleted_reason = body.deleted ? String(body.reason ?? "").slice(0, 200) || null : null;
  }
  if (typeof body.focal_point === "string") {
    // CSS object-position 값. 화면 적용은 아직 안 한다(2026-09-06 "준비만") — 저장만 받아 둔다.
    patch.focal_point = /^[\d.%\s a-z]{0,24}$/.test(body.focal_point) ? body.focal_point.trim() || null : null;
  }
  if (Array.isArray(body.tags)) patch.tags = normalizeTags(body.tags);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });

  const { error } = await sbAdmin().from("image_bank").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 일괄 승인 — 선택한 id들을 한 번에 quality_ok=true. 거부는 오판 위험이 커서 개별 유지(docs/admin.md) */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "한 번에 200장까지" }, { status: 400 });
  if (!ids.every((v) => typeof v === "string")) return NextResponse.json({ error: "bad ids" }, { status: 400 });

  const { data, error } = await sbAdmin()
    .from("image_bank")
    .update({ quality_ok: true })
    .in("id", ids as string[])
    .eq("deleted", false)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, approved: data?.length ?? 0 });
}

/** 태그 정리 — 공백 제거·중복 제거·빈값 제거, 태그당 20자·최대 12개 */
function normalizeTags(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const v = t.trim().slice(0, 20);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= 12) break;
  }
  return out;
}
