import { cookies } from "next/headers";

/**
 * 운영자 어드민 임시 게이트 (P4 전) — ADMIN_KEY 환경변수 + httpOnly 쿠키.
 * P4에서 Supabase Auth 이메일 화이트리스트로 교체 예정 (docs/admin.md).
 */
export async function isAdmin(): Promise<boolean> {
  const key = process.env.ADMIN_KEY;
  if (!key) return false;
  const c = (await cookies()).get("onstori_admin");
  return c?.value === key;
}
