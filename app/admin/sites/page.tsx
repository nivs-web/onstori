import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";

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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-400">← 운영자 콘솔</Link>
      <h1 className="mt-1 text-xl font-bold">사이트 관리 <span className="text-sm font-normal text-neutral-400">({rows?.length ?? 0})</span></h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>{["주소", "상호", "업종", "템플릿", "상태", "체험 만료", "생성일"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.slug} className="border-t border-neutral-100">
                <td className="px-3 py-2"><a className="text-teal-700 underline underline-offset-2" href={`/${s.slug}`} target="_blank">/{s.slug}</a></td>
                <td className="px-3 py-2">{s.business_name}</td>
                <td className="px-3 py-2">{s.industry}</td>
                <td className="px-3 py-2">{s.template}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2 text-xs">{s.trial_ends_at?.slice(0, 10) ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
