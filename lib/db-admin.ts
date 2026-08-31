import { createClient } from "@supabase/supabase-js";

/** service_role 클라이언트 — 서버 전용(API 라우트). 클라이언트 번들에 절대 포함 금지. */
export function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}
