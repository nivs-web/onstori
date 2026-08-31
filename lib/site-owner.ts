import { sbAdmin } from "./db-admin";
import { isAdmin } from "./admin-auth";

/**
 * 사이트 소유권 확인 (P4 인증 전 임시 체계)
 * - 고객: 생성 시 저장한 anon_id 와 브라우저 anonId 일치
 * - 운영자: ADMIN_KEY 쿠키면 모든 사이트 수정 가능 (무료 10곳 컨시어지 운영에 필수)
 * P4에서 owner_id(auth.uid) 기반으로 교체하되 운영자 우회는 유지.
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
  const owner = admin || (!!anonId && !!site.anon_id && site.anon_id === anonId);
  if (!owner) return { error: "forbidden" as const };
  return { site, admin };
}
