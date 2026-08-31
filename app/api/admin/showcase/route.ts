import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { getSiteBySlug } from "@/lib/sites";
import { PORTFOLIO_TABS, portfolioTagFor } from "@/config/industries";

/** 쇼케이스 관리 — URL만 넣으면 등록(태그 자동 제안), 태그/순서/노출 수정, 삭제 */

function extractSlug(input: string): string | null {
  const t = input.trim();
  const m = t.match(/onstori\.com\/([a-z0-9-]{2,30})/i) ?? t.match(/^\/?([a-z0-9-]{2,30})$/);
  return m ? m[1].toLowerCase() : null;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { url, tag } = await req.json().catch(() => ({}));
  const slug = extractSlug(String(url ?? ""));
  if (!slug) return NextResponse.json({ error: "주소를 확인해주세요 (onstori.com/가게명)" }, { status: 400 });

  const site = await getSiteBySlug(slug);
  if (!site) return NextResponse.json({ error: `'/${slug}' 사이트를 찾을 수 없어요` }, { status: 404 });

  // 태그: 지정값 > DB 업종 자동 제안 > 템플릿 추정
  let finalTag: string | undefined = typeof tag === "string" && PORTFOLIO_TABS.includes(tag as never) && tag !== "전체" ? tag : undefined;
  if (!finalTag) {
    const { data: row } = await sbAdmin().from("sites").select("industry").eq("slug", slug).maybeSingle();
    finalTag = row ? portfolioTagFor(row.industry) : site.doc.template === "visit" ? "카페·식당" : "시공·건설";
  }

  const { error } = await sbAdmin().from("showcase").insert({ slug, tag: finalTag });
  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "이미 등록된 사이트예요" : error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, slug, tag: finalTag, businessName: site.doc.businessName });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body.tag === "string" && PORTFOLIO_TABS.includes(body.tag as never) && body.tag !== "전체") patch.tag = body.tag;
  if (Number.isInteger(body.sort)) patch.sort = body.sort;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });
  const { error } = await sbAdmin().from("showcase").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await sbAdmin().from("showcase").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
