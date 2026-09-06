import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { SectionToggles } from "./ui";
import type { SectionRow } from "@/lib/page-sections";

export const dynamic = "force-dynamic";
export const metadata = { title: "홈페이지 관리 — 온스토리 운영자", robots: { index: false, follow: false } };

/** 본사 첫 페이지 섹션 보이기/가리기 (docs/admin.md §7 단계 2). 토글만. */
export default async function AdminPagesPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const { data } = await sbAdmin().from("page_sections").select("id, label, visible, sort").order("sort", { ascending: true });
  return (
    <main className="mx-auto max-w-3xl min-w-0 px-6 py-10">
      <p className="text-xs font-semibold kicker-wide text-green-700"><Link href="/admin">ONSTORI ADMIN</Link></p>
      <h1 className="mt-2 text-2xl font-bold">홈페이지 관리</h1>
      <p className="mt-2 t-small text-[var(--text-soft)]">
        온스토리 첫 페이지에서 어떤 섹션을 보여줄지 켜고 끕니다. 내용 수정은 여기서 하지 않습니다.
      </p>
      <SectionToggles rows={(data ?? []) as SectionRow[]} />
      <p className="mt-4 t-caption text-[var(--text-soft)]">
        DB 를 못 읽는 상황에서는 안전을 위해 모든 섹션이 <b>보이도록</b> 동작합니다 —
        첫 페이지가 통째로 비는 사고를 막기 위해서입니다(&lsquo;스토리 페이지 들여다보기&rsquo;만 예외로 기본 꺼짐).
      </p>
    </main>
  );
}
