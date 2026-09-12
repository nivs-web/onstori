import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { DeleteSite } from "./delete-ui";

export const metadata = { title: "사이트 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SitesAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  const { data: rows } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, industry, template, status, trial_ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-4xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">사이트 관리 <span className="t-small font-normal text-[var(--text-soft)]">({rows?.length ?? 0})</span></h1>
      <div className="table-scroll card mt-6">
        <table className="w-full min-w-[640px] t-small">
          <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
            <tr>{["주소", "상호", "업종", "템플릿", "상태", "체험 만료", "생성일", "지우기"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.slug} className="border-t border-n-100">
                <td className="px-3 py-2"><a className="text-green-700 underline underline-offset-2" href={`/${s.slug}`} target="_blank">/{s.slug}</a></td>
                <td className="px-3 py-2">{s.business_name}</td>
                <td className="px-3 py-2">{s.industry}</td>
                <td className="px-3 py-2">{s.template}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2 t-caption">{s.trial_ends_at?.slice(0, 10) ?? "—"}</td>
                <td className="px-3 py-2 t-caption">{s.created_at?.slice(0, 10)}</td>
                {/* ★ 운영자 전용 — 사장님 화면에는 없다. 서버가 다시 인증을 확인한다 */}
                <td className="px-3 py-2"><DeleteSite slug={s.slug as string} businessName={(s.business_name as string) ?? ""} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
