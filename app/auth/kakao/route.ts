import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { KAKAO_COOKIE, kakaoAuthorizeUrl } from "@/lib/kakao";

/**
 * 카카오 로그인 시작 — state(CSRF)와 복귀 경로를 httpOnly 쿠키에 담고 카카오 동의 화면으로 보낸다.
 * Supabase 프로바이더를 우회하는 이유는 lib/kakao.ts 주석 참조.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const state = randomUUID();
  const authorize = kakaoAuthorizeUrl(url.origin, state);

  if (!authorize) {
    const dest = new URL("/login", url.origin);
    dest.searchParams.set("next", next);
    dest.searchParams.set("error", "auth");
    return NextResponse.redirect(dest);
  }

  const res = NextResponse.redirect(authorize);
  res.cookies.set(KAKAO_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return res;
}
