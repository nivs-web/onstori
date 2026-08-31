import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

/**
 * anon-key 서버 클라이언트 — 세션(쿠키) 읽기·갱신용. 데이터 접근은 계속 sbAdmin(service-role).
 * 미들웨어 없음(DECISIONS 2026-08-31 MIDDLEWARE_INVOCATION_FAILED) — 토큰 리프레시는
 * Route Handler에서 이 클라이언트가 쿠키를 다시 써서 처리한다.
 */
export async function sbServer() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase anon env missing");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키 쓰기 불가 — 읽기 전용으로 동작
        }
      },
    },
  });
}

/** 현재 로그인 사용자 (auth 서버 검증). 비로그인이면 null. */
export async function getSessionUser(): Promise<User | null> {
  const { data } = await (await sbServer()).auth.getUser();
  return data.user ?? null;
}
