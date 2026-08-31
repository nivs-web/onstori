import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "./ui";

export const metadata = { title: "온스토리 운영자", robots: { index: false, follow: false } };

export default async function AdminHome() {
  if (!(await isAdmin())) return <AdminLogin />;

  const menus = [
    { href: "/admin/bank", title: "이미지뱅크 관리", desc: "생성 이미지 검수·점수·삭제 — 품질은 선별에서 나온다", ready: true },
    { href: "/admin/sites", title: "사이트 관리", desc: "전체 고객 사이트 목록·상태", ready: true },
    { href: "/admin/subdomains", title: "서브도메인 만들기", desc: "본사 내부 기능 전용 (추후 사용, 공간만)", ready: true },
    { href: "#", title: "신청 접수함", desc: "당근·지인 무료 제작 신청 (P3 예정 — 지금은 시트)", ready: false },
    { href: "#", title: "무비 주문 관리", desc: "히어로 무비 제작 보드 (P6 예정)", ready: false },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs font-semibold tracking-[0.25em] text-blue-700">ONSTORI ADMIN</p>
      <h1 className="mt-2 text-2xl font-bold">운영자 콘솔</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {menus.map((m) => (
          <Link key={m.title} href={m.href}
            className={`rounded-2xl border p-5 ${m.ready ? "border-neutral-200 hover:border-blue-600" : "pointer-events-none border-dashed border-neutral-200 opacity-50"}`}>
            <h2 className="font-bold">{m.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
