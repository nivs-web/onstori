import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { ShowcaseManager } from "./ui";

export const metadata = { title: "포트폴리오 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ShowcaseAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  const { data: rows } = await sbAdmin()
    .from("showcase")
    .select("id, slug, tag, sort, featured")
    .order("featured", { ascending: false })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 text-xl font-bold">랜딩 포트폴리오 관리 <span className="text-sm font-normal text-[var(--text-soft)]">({rows?.length ?? 0})</span></h1>
      <p className="mt-1 text-sm text-[var(--text-soft)]">주소(onstori.com/가게명)를 넣으면 자동 등록돼요. 태그·순서·추천을 지정하면 랜딩 첫 화면에 반영됩니다.</p>
      <ShowcaseManager initial={rows ?? []} />
    </main>
  );
}
