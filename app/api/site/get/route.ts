import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";
import { trialInfo } from "@/lib/trial";

/** 에디터 초기 데이터 — 소유자(anonId 또는 운영자)만 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) {
    // 거부 화면이 "로그인하세요"로 잘못 안내하지 않도록 요청자 본인의 세션 유무만 같이 준다.
    // 요청자가 이미 아는 자기 상태라 사이트·타인에 대한 정보는 새로 나가지 않는다.
    const signedIn = r.error === "forbidden" && !!(await getSessionUser().catch(() => null));
    return NextResponse.json({ error: r.error, signedIn }, { status: r.error === "forbidden" ? 403 : 404 });
  }

  const { data: progress } = await sbAdmin()
    .from("site_progress").select("score, rules_done").eq("site_id", r.site.id).maybeSingle();
  const { count: storyCount } = await sbAdmin()
    .from("story_entries").select("*", { count: "exact", head: true }).eq("site_id", r.site.id).eq("visible", true);

  // 소유 상태(서버 판정 — 규칙 4). owner_id가 없는데 통과했다면 anonId 폴백뿐이므로,
  // 그때만 세션을 1회 물어 "로그인했지만 아직 계정에 안 붙은" 사이트를 가려낸다.
  const ownership = r.admin
    ? "admin"
    : r.site.owner_id
      ? "account"
      // catch: anon env 누락 등으로 세션 조회가 실패해도 익명 편집 경로를 끌고 내려가지 않는다
      : (await getSessionUser().catch(() => null)) ? "anon-signedin" : "anon";

  return NextResponse.json({
    slug: r.site.slug,
    businessName: r.site.business_name,
    status: r.site.status,
    draft: r.site.draft,
    settings: r.site.settings,
    score: progress?.score ?? 0,
    rulesDone: progress?.rules_done ?? [],
    storyCount: storyCount ?? 0,
    isAdmin: r.admin,
    ownership,
    // 14일 무료 판정 (2026-09-05 정회원 정책) — 에디터 상단 바·차단 화면이 이 값만 본다
    trial: trialInfo(r.site),
  });
}
