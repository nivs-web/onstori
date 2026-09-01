import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase/server";
import { KAKAO_COOKIE, kakaoIdToken } from "@/lib/kakao";

/**
 * 카카오 콜백 — code를 카카오에서 id_token으로 바꾼 뒤 Supabase 세션을 만들고 /login으로 복귀한다.
 * (익명 사이트 claim·목적지 이동은 로그인 페이지가 마무리)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const [savedState, savedNext = "/"] = (store.get(KAKAO_COOKIE)?.value ?? "").split("|");
  const next = savedNext.startsWith("/") && !savedNext.startsWith("//") ? savedNext : "/";

  const dest = new URL("/login", url.origin);
  dest.searchParams.set("next", next);

  const done = (ok: boolean) => {
    if (!ok) dest.searchParams.set("error", "auth");
    const res = NextResponse.redirect(dest);
    res.cookies.delete(KAKAO_COOKIE);
    return res;
  };

  // state 불일치 = CSRF이거나 10분 만료된 시도. 사용자가 동의를 취소해도 여기로 온다(code 없음)
  if (!code || !state || !savedState || state !== savedState) return done(false);

  const token = await kakaoIdToken(code, url.origin);
  if (!token) return done(false);

  const { error } = await (await sbServer()).auth.signInWithIdToken({
    provider: "kakao",
    token: token.idToken,
    access_token: token.accessToken,
  });
  if (error) console.error("[kakao] signInWithIdToken 실패", error.message);
  return done(!error);
}
