import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 문의 상태·메모 변경 — docs/specs/inquiry.md 3장. 사장님·운영자만.
 * 스팸으로 표시하면 그 번호를 30일간 차단 목록에 올린다(같은 번호의 재접수를 막는다).
 */

const Input = z.object({
  slug: z.string(),
  anonId: z.string().optional(),
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "done", "spam"]).optional(),
  memo: z.string().max(300).optional(),
  read: z.boolean().optional(),
});

type Settings = { blocked_phones?: { phone: string; until: string }[] };

export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const sb = sbAdmin();
  // 남의 사이트 문의 id 를 끼워넣는 걸 막는다 — 반드시 이 사이트 소속인지 확인
  const { data: row } = await sb
    .from("inquiries")
    .select("id, phone, site_id")
    .eq("id", body.data.id)
    .eq("site_id", r.site.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.data.status) patch.status = body.data.status;
  if (body.data.memo !== undefined) patch.memo = body.data.memo;
  if (body.data.read) patch.read_at = new Date().toISOString();

  if (Object.keys(patch).length > 0) {
    const { error } = await sb.from("inquiries").update(patch).eq("id", row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.data.status === "spam") {
    const settings = ((r.site.settings as Settings) ?? {}) as Settings;
    const until = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const list = (settings.blocked_phones ?? []).filter((b) => b.phone !== row.phone);
    list.push({ phone: row.phone as string, until });
    settings.blocked_phones = list;
    await sb.from("sites").update({ settings }).eq("id", r.site.id);
  }

  return NextResponse.json({ ok: true });
}
