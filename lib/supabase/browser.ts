import { createBrowserClient } from "@supabase/ssr";

/** anon-key 브라우저 클라이언트 — 로그인 UI 전용(이메일 OTP·세션 확인). 데이터 접근 금지. */
export function sbBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
