import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 운영자 전용 — **사이트를 실제로 지운다.** (2026-09-12 회장님 지시 E2)
 *
 * ★★ **불변 규칙 10(「삭제는 복구 가능한 표시 변경으로」)의 예외다.** 왜 예외인가:
 *   규칙 10 이 지키려는 것은 **「이미 발행된 손님 사이트의 사진이 깨지는 것」**이다.
 *   시험 사이트를 치우는 일은 그 위험이 없고, 회장님이 「내가 불편하다」고 하신 실제 필요다.
 *   대신 문턱을 셋 둔다 — ①운영자 인증 ②**상호를 손으로 타이핑** ③**기록을 남긴다.**
 *
 * ★★ **사장님용 창구가 아니다.** `app/api/admin/member` 의 「DELETE 를 만들지 않는다」는
 *   그쪽 이야기고, 그 파일 주석에 구분을 적어 뒀다. 사장님 화면에서는 이 길이 보이지도 않는다.
 *
 * ⚠ **결제 이력이 있으면 지우지 않는다.** 전자상거래법상 5년 보존 대상이다.
 *   그때는 이유를 말하고 거절한다 — 「지웠는데 법을 어겼다」가 가장 나쁘다.
 *
 * 지우는 순서 (뒤집으면 고아 파일이 남는다)
 *   ① 셈 → ② 기록 남기기 → ③ R2 파일 → ④ showcase(슬러그로만 엮여 캐스케이드가 안 걸린다) → ⑤ sites
 *   `sites` 를 지우면 story_entries·site_versions·site_progress·inquiries·events·sns_* 는
 *   `on delete cascade` 로 함께 사라진다.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { slug?: string; confirmName?: string; reason?: string; dryRun?: boolean };
  const slug = String(body.slug ?? "").trim();
  const confirmName = String(body.confirmName ?? "").trim();
  const dryRun = body.dryRun === true;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return NextResponse.json({ error: "주소(slug)가 이상해요" }, { status: 400 });

  const sb = sbAdmin();
  const { data: site } = await sb.from("sites")
    .select("id, slug, business_name, status, paid_at, payment").eq("slug", slug).maybeSingle();
  if (!site) return NextResponse.json({ error: "그런 홈페이지가 없어요" }, { status: 404 });

  /* ★★ 상호를 **손으로 정확히** 쳐야 한다 (회장님 지시).
     목록에서 잘못 누르는 사고를 막는 유일한 장치다 — 확인창은 습관적으로 눌린다. */
  const expected = String(site.business_name ?? "");
  if (!dryRun && confirmName !== expected) {
    return NextResponse.json(
      { error: `지우려면 상호를 정확히 입력해 주세요. (이 홈페이지의 상호: 「${expected}」)`, expected },
      { status: 409 },
    );
  }

  /* ⚠ 결제 이력이 있으면 못 지운다 — 전자상거래법 5년 보존 */
  const hadPayment = !!site.paid_at || !!site.payment;
  if (hadPayment) {
    const { count } = await sb.from("payments").select("id", { count: "exact", head: true }).eq("site_id", site.id);
    return NextResponse.json(
      { error: `결제 이력이 있는 홈페이지는 지울 수 없어요 (결제 기록 ${count ?? "?"}건). 전자상거래법상 5년 보관해야 합니다.` },
      { status: 409 },
    );
  }

  /* ① 무엇이 사라지는지 센다 — 기록에 남길 값이고, dryRun 이면 이것만 돌려준다 */
  const countOf = async (t: string) => {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true }).eq("site_id", site.id);
    return error ? -1 : (count ?? 0);
  };
  const counts: Record<string, number> = {};
  for (const t of ["inquiries", "story_entries", "events", "site_versions", "sns_connections", "sns_posts"]) {
    counts[t] = await countOf(t);
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, slug, businessName: expected, status: site.status, counts });
  }

  /* ② 기록을 «먼저» 남긴다. 지운 뒤에 남기려다 실패하면 흔적 없는 삭제가 된다 */
  const { error: logErr } = await sb.from("site_deletions").insert({
    slug, business_name: expected, site_id: site.id,
    counts, status: site.status, had_payment: false,
    reason: String(body.reason ?? "").slice(0, 500) || null,
  });
  if (logErr) {
    /* ⚠ 여기서 **멈춘다.** 기록을 못 남기면 지우지 않는다 (DB 백업 규칙과 같은 정신) */
    console.error(JSON.stringify({ evt: "site_delete_log_failed", slug, err: logErr.message.slice(0, 200) }));
    return NextResponse.json({ error: "삭제 기록을 남기지 못해 중단했어요. (마이그레이션 20260912160000 이 적용됐는지 확인해 주세요)" }, { status: 500 });
  }

  /* ③ 파일 먼저 — 순서를 뒤집으면 경로를 잃어 파일만 남는 고아가 생긴다 */
  let filesPurged = 0;
  for (const [bucket, prefix] of [
    ["media", `uploads/${slug}/`],
    ["private", `inquiries/${site.id}/`],
    ["private", `private/stories/${slug}/`],
  ] as const) {
    try { filesPurged += await storage.removePrefix(bucket, prefix); }
    catch (e) { console.error(JSON.stringify({ evt: "site_delete_files_failed", slug, prefix, err: String(e).slice(0, 160) })); }
  }

  /* ④ showcase 는 slug 로만 엮여 있어 캐스케이드가 안 걸린다 */
  await sb.from("showcase").delete().eq("slug", slug);

  /* ⑤ 마지막으로 사이트 */
  const { error: delErr } = await sb.from("sites").delete().eq("id", site.id);
  if (delErr) {
    console.error(JSON.stringify({ evt: "site_delete_failed", slug, err: delErr.message.slice(0, 200) }));
    return NextResponse.json({ error: `지우지 못했어요: ${delErr.message}` }, { status: 500 });
  }

  console.log(JSON.stringify({ evt: "site_deleted_by_admin", slug, counts, filesPurged }));
  return NextResponse.json({ ok: true, slug, businessName: expected, counts, filesPurged });
}
