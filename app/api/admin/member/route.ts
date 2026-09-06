import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { TRIAL_DAYS } from "@/lib/trial";

/**
 * 어드민 회원 관리 — 메모·이름·블랙리스트 수정(PATCH), 상태 조작(POST).
 * docs/admin.md §3-6. app/api/admin/showcase 패턴 그대로 — 첫 줄 isAdmin() 게이트.
 *
 * ⚠ DELETE 를 만들지 않는다. 사장님 자료를 사람 손으로 지우는 창구는 두지 않는다
 *   (자동 삭제는 정지 후 60일에 크론이 예고 후 처리한다 — lib/trial.ts).
 * ⚠ 여기서 다루는 member_admin 은 RLS 정책이 0개라 service_role 로만 읽힌다.
 *   메모에는 "진상 고객" 같은 말이 적힌다 — 사장님 화면으로 절대 새면 안 된다.
 * ⚠ 클라이언트가 보낸 값을 신뢰하지 않는다 (규칙 4): action 은 화이트리스트 둘,
 *   days 는 7·14·30 만 허용한다.
 */

const MEMO_MAX = 20_000;
const ALLOWED_DAYS = [7, 14, 30] as const;

/** 상태를 바꾼 기록은 메모에 자동으로 한 줄 남긴다 — 돈이 걸린 조작은 흔적이 있어야 한다 */
async function appendMemo(siteId: string, line: string) {
  const sb = sbAdmin();
  const { data } = await sb.from("member_admin").select("memo").eq("site_id", siteId).maybeSingle();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const next = `${data?.memo ? data.memo + "\n" : ""}[${stamp}] ${line}`.slice(-MEMO_MAX);
  await sb.from("member_admin").upsert({ site_id: siteId, memo: next, updated_at: new Date().toISOString() }, { onConflict: "site_id" });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { siteId, memo, contactName, blacklisted, blacklistReason } = await req.json().catch(() => ({}));
  if (typeof siteId !== "string" || !siteId) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const patch: Record<string, unknown> = { site_id: siteId, updated_at: new Date().toISOString() };
  if (typeof memo === "string") patch.memo = memo.slice(0, MEMO_MAX);
  if (typeof contactName === "string") patch.contact_name = contactName.slice(0, 40) || null;
  if (typeof blacklisted === "boolean") patch.blacklisted = blacklisted;
  if (typeof blacklistReason === "string") patch.blacklist_reason = blacklistReason.slice(0, 200) || null;

  const { error } = await sbAdmin().from("member_admin").upsert(patch, { onConflict: "site_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { siteId, action, days } = await req.json().catch(() => ({}));
  if (typeof siteId !== "string" || !siteId) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("id, slug, status, trial_ends_at").eq("id", siteId).maybeSingle();
  if (!site) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (action === "activate") {
    // 수동 정회원 처리 — 결제 없이 여는 컨시어지 경로. 결제 원장(payments)은 건드리지 않는다.
    await sb.from("sites").update({ status: "active", plan: "light", suspended_at: null }).eq("id", siteId);
    await appendMemo(siteId, "운영자가 정회원으로 전환 (결제 없이 수동)");
    return NextResponse.json({ ok: true, status: "active" });
  }

  if (action === "extend") {
    const d = ALLOWED_DAYS.includes(Number(days) as 7 | 14 | 30) ? Number(days) : TRIAL_DAYS;
    // 이미 지난 만료일에 더하면 과거가 되므로, 지났으면 오늘부터 센다
    const base = site.trial_ends_at && new Date(site.trial_ends_at) > new Date() ? new Date(site.trial_ends_at) : new Date();
    const next = new Date(base.getTime() + d * 86_400_000);
    // 무료로 되돌리므로 정지 상태를 풀고 정지 시각도 지운다 (삭제 예정일이 같이 밀린다)
    await sb.from("sites").update({ status: "trial", trial_ends_at: next.toISOString(), suspended_at: null }).eq("id", siteId);
    await appendMemo(siteId, `운영자가 무료 기간 ${d}일 연장 → ${next.toISOString().slice(0, 10)}`);
    return NextResponse.json({ ok: true, trialEndsAt: next.toISOString() });
  }

  return NextResponse.json({ error: "허용되지 않은 동작이에요" }, { status: 400 });
}
