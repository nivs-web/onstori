import { NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase/server";

/** 카카오 OAuth 콜백 — code→세션 교환 후 /login으로 복귀 (claim·목적지 이동은 로그인 페이지가 마무리) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const dest = new URL("/login", url.origin);
  dest.searchParams.set("next", next);

  if (!code) {
    dest.searchParams.set("error", "auth");
    return NextResponse.redirect(dest);
  }
  const { error } = await (await sbServer()).auth.exchangeCodeForSession(code);
  if (error) dest.searchParams.set("error", "auth");
  return NextResponse.redirect(dest);
}
