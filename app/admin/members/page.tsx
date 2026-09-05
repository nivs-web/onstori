import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { trialInfo } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const metadata = { title: "회원 목록 — 온스토리 운영자", robots: { index: false, follow: false } };

/**
 * 운영자 회원 목록 (기획1 /mainplan #membership · 2026-09-05)
 * 상호명·주소(홈페이지)·최초 개설일·결제일·무료 남은 기간·연락처·주소·완성도·이메일·상태.
 * sites 는 select("*") — paid_at 컬럼이 마이그레이션 전이어도 화면이 깨지지 않게.
 * 이메일·로그인 방식은 auth.users(service role) 에서 owner_id 로 붙인다.
 */
type Row = {
  id: string; slug: string; business_name: string; status: string; created_at: string; trial_ends_at: string | null;
  paid_at?: string | null; owner_id: string | null; settings: Record<string, unknown> | null; industry: string;
};

function fmt(d?: string | null) { return d ? new Date(d).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—"; }

export default async function MembersPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const sb = sbAdmin();
  const { data: sites } = await sb.from("sites").select("*").order("created_at", { ascending: false }).limit(500);
  const rows = (sites ?? []) as Row[];
  const ids = rows.map((r) => r.id);
  const { data: progress } = ids.length ? await sb.from("site_progress").select("site_id, score").in("site_id", ids) : { data: [] };
  const score = new Map((progress ?? []).map((p) => [p.site_id as string, p.score as number]));

  const users = new Map<string, { email: string; provider: string; name: string }>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      users.set(u.id, {
        email: u.email ?? "",
        provider: (u.app_metadata?.provider as string) ?? "",
        name: String(meta.name ?? meta.nickname ?? ""),
      });
    }
  } catch {}

  const counts = { total: rows.length, trial: 0, active: 0, expired: 0 };
  for (const r of rows) { if (r.status === "trial") counts.trial++; else if (r.status === "active") counts.active++; else if (r.status === "expired") counts.expired++; }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-teal-700"><Link href="/admin">ONSTORI ADMIN</Link></p>
          <h1 className="mt-2 text-2xl font-bold">회원 목록</h1>
        </div>
        <p className="text-sm text-neutral-500">전체 {counts.total} · 무료 {counts.trial} · 정회원 {counts.active} · 만료 {counts.expired}</p>
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead className="bg-neutral-50 text-left text-[12px] text-neutral-500">
            <tr>
              {["상호명", "홈페이지 주소", "상태", "최초 개설일", "결제일", "무료 남은 기간", "연락처", "주소", "완성도", "이메일", "가입", "업종"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = trialInfo(r);
              const s = r.settings ?? {};
              const u = r.owner_id ? users.get(r.owner_id) : undefined;
              const badge = r.status === "active" ? "bg-green-100 text-green-800" : r.status === "expired" ? "bg-neutral-200 text-neutral-600" : t.daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
              return (
                <tr key={r.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2.5 font-semibold">{r.business_name}</td>
                  <td className="px-3 py-2.5"><a href={`/${r.slug}`} target="_blank" rel="noopener" className="text-teal-700 underline">onstori.com/{r.slug}</a> · <Link href={`/${r.slug}/edit`} className="text-neutral-500 underline">편집</Link></td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${badge}`}>{r.status === "active" ? "정회원" : r.status === "expired" ? "만료" : "무료"}</span></td>
                  <td className="px-3 py-2.5">{fmt(r.created_at)}</td>
                  <td className="px-3 py-2.5">{fmt(r.paid_at)}</td>
                  <td className="px-3 py-2.5">{t.paid ? "—" : t.expired ? "만료" : `D-${t.daysLeft}`}<span className="block text-[11px] text-neutral-400">{fmt(r.trial_ends_at)} 까지</span></td>
                  <td className="px-3 py-2.5">{String(s.phone ?? "—")}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate" title={String(s.address ?? "")}>{String(s.address ?? "—")}</td>
                  <td className="px-3 py-2.5"><b className="text-teal-700">{score.get(r.id) ?? 0}</b>점</td>
                  <td className="px-3 py-2.5">{u?.email || (r.owner_id ? "(이메일 없음)" : <span className="text-neutral-400">미가입(익명)</span>)}</td>
                  <td className="px-3 py-2.5">{u ? (u.provider === "kakao" ? "카카오" : u.provider === "email" ? "이메일" : u.provider) : "—"}{u?.name ? ` · ${u.name}` : ""}</td>
                  <td className="px-3 py-2.5">{String(s.industryLabel ?? r.industry)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={12} className="px-3 py-10 text-center text-neutral-400">아직 회원이 없어요</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12px] text-neutral-400">결제일은 2026-09-05 마이그레이션(paid_at) 적용 뒤 채워진다. 만료 처리는 매일 03:00 크론(/api/cron/expire).</p>
    </main>
  );
}
