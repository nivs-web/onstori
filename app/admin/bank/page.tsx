import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { loadImageUsage } from "@/lib/image-usage";
import { heroStock, HERO_STOCK_MIN } from "@/lib/bank";
import { AdminLogin } from "../ui";
import { BankGrid, type BankRow } from "./ui";
import { INDUSTRIES } from "@/config/industries";

export const metadata = { title: "이미지뱅크 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function BankPage({ searchParams }: { searchParams: SP }) {
  if (!(await isAdmin())) return <AdminLogin />;
  const sp = await searchParams;

  let q = sbAdmin()
    .from("image_bank")
    .select("id, industry, mood, role, url, quality_ok, quality_score, used_count, model, prompt, tags, width, height")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(120);
  if (sp.industry) q = q.eq("industry", sp.industry);
  if (sp.role) q = q.eq("role", sp.role);
  if (sp.q === "pending") q = q.is("quality_ok", null);
  if (sp.q === "ok") q = q.eq("quality_ok", true);

  const [{ data: raw }, usage, stock] = await Promise.all([q, loadImageUsage(), heroStock()]);

  const rows: BankRow[] = (raw ?? []).map((r) => ({
    id: r.id, industry: r.industry, mood: r.mood, role: r.role, url: r.url,
    quality_ok: r.quality_ok, quality_score: r.quality_score, used_count: r.used_count,
    prompt: r.prompt, tags: r.tags, width: r.width, height: r.height,
    usedBy: usage.get(r.url) ?? [],
  }));

  const low = stock.filter((s) => s.free < HERO_STOCK_MIN);

  const filter = (k: string, v: string | undefined, label: string, active: boolean) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(sp)) if (val && key !== k) params.set(key, val);
    if (v) params.set(k, v);
    return (
      <Link key={`${k}-${label}`} href={`/admin/bank?${params.toString()}`}
        className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-teal-700 text-white" : "border border-neutral-300"}`}>
        {label}
      </Link>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-400">← 운영자 콘솔</Link>
      <h1 className="mt-1 text-xl font-bold">이미지뱅크 관리 <span className="text-sm font-normal text-neutral-400">({rows.length}장 표시)</span></h1>

      {low.length > 0 && (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-sm font-semibold text-amber-900">
            히어로 재고 부족 — {low.length}개 조합이 미사용 {HERO_STOCK_MIN}장 미만
          </p>
          <p className="mt-1 text-[11.5px] leading-5 text-amber-800">
            히어로는 다른 사이트가 쓰고 있으면 후보에서 빠집니다. 아래 조합은 새 사이트를 만들 때 이미지가 겹치거나 플레이스홀더로 떨어질 수 있어요.
            <code className="ml-1 rounded bg-amber-100 px-1">scripts/bank-generate.ts --roles hero</code> 로 보충하세요.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {low.map((s) => (
              <span key={`${s.industry}-${s.mood}`}
                className={`rounded-full px-2 py-0.5 text-[11px] ${s.free === 0 ? "bg-red-100 text-red-700" : "bg-white text-amber-900"}`}>
                {s.industry}·{s.mood} <b>{s.free}</b>/{s.total}
              </span>
            ))}
          </div>
        </section>
      )}

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

      {rows.length === 0 ? (
        <p className="mt-16 text-center text-sm text-neutral-400">
          아직 이미지가 없어요. <code className="rounded bg-neutral-100 px-1.5 py-0.5">npx tsx --env-file=.env.local scripts/bank-generate.ts --limit 20 --count 20</code> 로 생성하세요.
        </p>
      ) : (
        <BankGrid rows={rows} />
      )}
    </main>
  );
}
