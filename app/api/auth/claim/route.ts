import { NextResponse } from "next/server";
import { z } from "zod";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";

const Input = z.object({ anonId: z.string().min(8).max(64) });

/**
 * 익명 생성 사이트 귀속 — 로그인 직후 브라우저 anonId를 받아
 * anon_id 일치 & 무주인(owner_id null) 사이트에 owner_id 부여, anon_id는 소거(재claim 방지).
 */
export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sbAdmin()
    .from("sites")
    .update({ owner_id: user.id, anon_id: null })
    .eq("anon_id", body.data.anonId)
    .is("owner_id", null)
    .select("slug");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, claimed: data?.map((s) => s.slug) ?? [] });
}
