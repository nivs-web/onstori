import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { trialInfo } from "@/lib/trial";
import { MembersTable, type MemberRow } from "./table";

export const dynamic = "force-dynamic";
export const metadata = { title: "회원 목록 — 온스토리 운영자", robots: { index: false, follow: false } };

/**
 * 운영자 회원 목록 (docs/admin.md §3).
 * 서버는 데이터만 모으고, 탭·검색·정렬·메모·블랙리스트는 table.tsx(클라이언트)가 한다.
 *
 * ⚠ 메모·블랙리스트는 member_admin(RLS 정책 0개) 에서 service_role 로만 읽는다.
 *   sites.settings 나 sites 컬럼에 넣으면 api/site/get 을 타고 사장님에게 샌다 (§3-3).
 * ⚠ sites 는 select("*") — 컬럼이 늘어도 화면이 깨지지 않게.
 */
type Row = {
  id: string; slug: string; business_name: string; status: string; created_at: string; updated_at: string;
  trial_ends_at: string | null; suspended_at?: string | null; paid_at?: string | null;
  owner_id: string | null; settings: Record<string, unknown> | null; industry: string;
};

export default async function MembersPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const sb = sbAdmin();
  const { data: sites } = await sb.from("sites").select("*").order("created_at", { ascending: false }).limit(500);
  const rows = (sites ?? []) as Row[];
  const ids = rows.map((r) => r.id);

  const [{ data: progress }, { data: admin }, { data: pays }, { data: inqs }] = await Promise.all([
    ids.length ? sb.from("site_progress").select("site_id, score").in("site_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("member_admin").select("*").in("site_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("payments").select("site_id, status, created_at, fail_message").in("site_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("inquiries").select("site_id").in("site_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const score = new Map((progress ?? []).map((p) => [p.site_id as string, p.score as number]));
  const adm = new Map((admin ?? []).map((a) => [a.site_id as string, a]));
  const inqCount = new Map<string, number>();
  for (const i of inqs ?? []) inqCount.set(i.site_id as string, (inqCount.get(i.site_id as string) ?? 0) + 1);

  // 결제 실패는 **마지막 성공 이후의 것만** 센다 (§3-4).
  // 예전에 실패했다가 결제에 성공한 사람을 실패자로 올리면 안 된다.
  const fail = new Map<string, { n: number; at: string | null; msg: string }>();
  const seenSuccess = new Set<string>();
  for (const p of pays ?? []) { // created_at 내림차순이라 최신부터 본다
    const sid = p.site_id as string;
    if (!sid) continue;
    if (p.status === "paid") { seenSuccess.add(sid); continue; }
    if (seenSuccess.has(sid)) continue; // 이 실패보다 나중에 성공했다 → 안 센다
    if (p.status !== "failed") continue;
    const cur = fail.get(sid) ?? { n: 0, at: null, msg: "" };
    fail.set(sid, { n: cur.n + 1, at: cur.at ?? (p.created_at as string), msg: cur.msg || String(p.fail_message ?? "") });
  }

  const users = new Map<string, { email: string; provider: string; name: string; lastSignInAt: string | null }>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      users.set(u.id, {
        email: u.email ?? "",
        provider: (u.app_metadata?.provider as string) ?? "",
        name: String(meta.name ?? meta.nickname ?? ""),
        lastSignInAt: u.last_sign_in_at ?? null,
      });
    }
  } catch {}

  const list: MemberRow[] = rows.map((r) => {
    const t = trialInfo(r);
    const s = r.settings ?? {};
    const u = r.owner_id ? users.get(r.owner_id) : undefined;
    const a = adm.get(r.id) as { memo?: string; contact_name?: string; blacklisted?: boolean; blacklist_reason?: string } | undefined;
    const f = fail.get(r.id);
    return {
      id: r.id, slug: r.slug, businessName: r.business_name, status: r.status, industry: String(s.industryLabel ?? r.industry),
      createdAt: r.created_at, paidAt: r.paid_at ?? null, trialEndsAt: r.trial_ends_at, suspendedAt: r.suspended_at ?? null,
      daysLeft: t.daysLeft, expired: t.expired, paid: t.paid,
      phone: String(s.phone ?? ""), address: String(s.address ?? ""), score: score.get(r.id) ?? 0,
      email: u?.email ?? "", provider: u ? (u.provider === "kakao" ? "카카오" : u.provider === "email" ? "이메일" : u.provider) : "",
      userName: u?.name ?? "", lastSignInAt: u?.lastSignInAt ?? null,
      updatedAt: r.updated_at, inquiryCount: inqCount.get(r.id) ?? 0,
      failCount: f?.n ?? 0, lastFailAt: f?.at ?? null, lastFailMessage: f?.msg ?? "",
      memo: a?.memo ?? "", contactName: a?.contact_name ?? "", blacklisted: !!a?.blacklisted, blacklistReason: a?.blacklist_reason ?? "",
    };
  });

  const c = { total: list.length, active: list.filter((r) => r.paid).length, trial: list.filter((r) => !r.paid && !r.expired).length, expired: list.filter((r) => r.expired).length };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold kicker-wide text-green-700"><Link href="/admin">ONSTORI ADMIN</Link></p>
          <h1 className="mt-2 text-2xl font-bold">회원 목록</h1>
        </div>
        <p className="text-sm text-n-500">전체 {c.total} · 정회원 {c.active} · 무료 {c.trial} · 정지 {c.expired}</p>
      </div>

      <MembersTable rows={list} />

      <p className="mt-4 t-caption text-n-400">
        무료 30일 → 정지(비공개, 자료 보관) → 정지 후 60일 자동 삭제. 판정 기준은 lib/trial.ts 하나입니다.
        정지·삭제·구독 청구는 매일 03:00 크론(/api/cron/expire)이 처리합니다.
        메모·블랙리스트는 운영자만 보며 사장님 화면으로 나가지 않습니다.
      </p>
    </main>
  );
}
