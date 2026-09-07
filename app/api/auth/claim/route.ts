import { NextResponse } from "next/server";
import { z } from "zod";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";
import { SITES_PER_ACCOUNT } from "@/config/limits";

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

  const sb = sbAdmin();

  /* ★ 한 계정에 홈페이지 하나 (config/limits.ts).
     ⚠ 여기도 막아야 한다. 생성 라우트만 막으면 "로그아웃하고 익명으로 만든 뒤 로그인" 으로
       그대로 우회된다 — 익명 생성은 일부러 열어 두기 때문이다.
     ⚠ 이미 갖고 있으면 **조용히 넘어간다**(에러가 아니다). 로그인 흐름 한복판이라
       여기서 막아 세우면 사장님은 로그인 자체가 실패한 줄 안다. 안 가져올 뿐이다. */
  const { count: mine } = await sb
    .from("sites").select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((mine ?? 0) >= SITES_PER_ACCOUNT) {
    return NextResponse.json({ ok: true, claimed: [], skipped: "already-has-site" });
  }

  const { data, error } = await sb
    .from("sites")
    .update({ owner_id: user.id, anon_id: null })
    .eq("anon_id", body.data.anonId)
    .is("owner_id", null)
    .select("slug")
    .limit(SITES_PER_ACCOUNT);   // 익명으로 여러 개 만들어 뒀어도 하나만 가져온다
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, claimed: data?.map((s) => s.slug) ?? [] });
}
