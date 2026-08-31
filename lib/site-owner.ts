import { sbAdmin } from "./db-admin";
import { isAdmin } from "./admin-auth";
import { getSessionUser } from "./supabase/server";

/**
 * 사이트 소유권 확인 (P4)
 * - owner_id 있는 사이트: 로그인 세션의 auth.uid 일치 필요
 * - owner_id 없는 사이트(가입 전 익명 생성): anon_id ↔ 브라우저 anonId 매칭 폴백 — 가입 없이도 편집 유지
 * - 운영자: ADMIN_KEY 쿠키면 모든 사이트 수정 가능 (무료 컨시어지 운영에 필수 — 세션 결정 1)
 */
export async function loadOwnedSite(slug: string, anonId?: string | null) {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return { error: "bad-slug" as const };
  const sb = sbAdmin();
  const { data: site } = await sb
    .from("sites")
    .select("id, slug, anon_id, owner_id, business_name, status, theme, settings, draft, published")
    .eq("slug", slug)
    .maybeSingle();
  if (!site) return { error: "not-found" as const };

  const admin = await isAdmin();
  let owner = admin;
  if (!owner) {
    if (site.owner_id) {
      const user = await getSessionUser();
      owner = user?.id === site.owner_id;
    } else {
      owner = !!anonId && !!site.anon_id && site.anon_id === anonId;
    }
  }
  if (!owner) return { error: "forbidden" as const };
  return { site, admin };
}
