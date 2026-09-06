import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { captureSite } from "@/lib/site-shot";

export const maxDuration = 60;

/** 운영자 수동 재촬영 — 첫 페이지 테마 카드 사진을 다시 찍는다. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || !slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const shot = await captureSite(slug, new URL(req.url).origin);
  if (!shot.ok) {
    // 크롬이 없는 곳이면 여기서 끝난다 — 화면에 이유를 그대로 보여준다
    return NextResponse.json({ error: shot.reason }, { status: 503 });
  }
  const sb = sbAdmin();
  const { data: s } = await sb.from("sites").select("id, settings").eq("slug", slug).single();
  if (!s) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const settings = { ...((s.settings as Record<string, unknown>) ?? {}), shots: { pc: shot.pc, phone: shot.phone, at: shot.at } };
  await sb.from("sites").update({ settings }).eq("id", s.id);
  return NextResponse.json({ ok: true, pc: shot.pc, phone: shot.phone, at: shot.at });
}
