import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin, BankCardActions } from "../ui";
import { INDUSTRIES } from "@/config/industries";

export const metadata = { title: "이미지뱅크 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function BankPage({ searchParams }: { searchParams: SP }) {
  if (!(await isAdmin())) return <AdminLogin />;
  const sp = await searchParams;

  let q = sbAdmin()
    .from("image_bank")
    .select("id, industry, mood, role, url, quality_ok, quality_score, used_count, model, prompt, width, height")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(120);
  if (sp.industry) q = q.eq("industry", sp.industry);
  if (sp.role) q = q.eq("role", sp.role);
  if (sp.q === "pending") q = q.is("quality_ok", null);
  if (sp.q === "ok") q = q.eq("quality_ok", true);
  const { data: rows } = await q;

  const filter = (k: string, v: string | undefined, label: string, active: boolean) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(sp)) if (val && key !== k) params.set(key, val);
    if (v) params.set(k, v);
    return (
      <Link key={`${k}-${label}`} href={`/admin/bank?${params.toString()}`}
        className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-blue-700 text-white" : "border border-neutral-300"}`}>
        {label}
      </Link>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-400">← 운영자 콘솔</Link>
      <h1 className="mt-1 text-xl font-bold">이미지뱅크 관리 <span className="text-sm font-normal text-neutral-400">({rows?.length ?? 0}장 표시)</span></h1>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {filter("q", undefined, "전체", !sp.q)}
        {filter("q", "pending", "검수 대기", sp.q === "pending")}
        {filter("q", "ok", "승인됨", sp.q === "ok")}
        <span className="mx-1 text-neutral-300">|</span>
        {filter("role", undefined, "역할 전체", !sp.role)}
        {["hero", "gallery", "about", "process"].map((r) => filter("role", r, r, sp.role === r))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {filter("industry", undefined, "업종 전체", !sp.industry)}
        {INDUSTRIES.map((i) => filter("industry", i.id, i.name, sp.industry === i.id))}
      </div>

      {(!rows || rows.length === 0) && (
        <p className="mt-16 text-center text-sm text-neutral-400">
          아직 이미지가 없어요. <code className="rounded bg-neutral-100 px-1.5 py-0.5">npx tsx --env-file=.env.local scripts/bank-generate.ts --count 20</code> 로 생성하세요.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(rows ?? []).map((r) => (
          <figure key={r.id} className="overflow-hidden rounded-xl border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={r.url} target="_blank" rel="noreferrer">
              <img src={r.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </a>
            <figcaption className="space-y-1.5 p-2.5">
              <p className="text-[11px] text-neutral-500">
                {r.industry} · {r.mood} · <b>{r.role}</b> · {r.width}×{r.height}
                {r.quality_ok === null && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">대기</span>}
              </p>
              <BankCardActions id={r.id} ok={r.quality_ok} score={r.quality_score} />
              <details className="text-[10.5px] text-neutral-400">
                <summary className="cursor-pointer">프롬프트</summary>
                <p className="mt-1 leading-4">{r.prompt}</p>
              </details>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
