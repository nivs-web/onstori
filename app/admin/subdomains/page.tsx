import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "../ui";

export const metadata = { title: "서브도메인 만들기", robots: { index: false, follow: false } };

/**
 * 서브도메인 만들기 — 공간만 확보 (2026-08-31 결정).
 * 고객 사이트는 경로 방식(onstori.com/{slug})으로 확정. 서브도메인은 본사 내부
 * 기능(예: status.onstori.com, docs.onstori.com)에만 사용 예정이며,
 * 지금은 {sub}.onstori.com → onstori.com/{sub} 301 리다이렉트가 기본 동작.
 * 필요해지면 여기에 "고정 매핑(서브도메인 → 내부 경로)" 관리 기능을 붙인다.
 */
export default async function SubdomainsAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/admin" className="text-xs text-neutral-400">← 운영자 콘솔</Link>
      <h1 className="mt-1 text-xl font-bold">서브도메인 만들기</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-sm leading-relaxed text-neutral-500">
        <p><b className="text-neutral-700">준비된 공간입니다 — 아직 사용하지 않습니다.</b></p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>고객 사이트 주소는 <b>onstori.com/가게명</b> 경로 방식으로 확정 (서치어드바이저 1회 등록·통합 사이트맵)</li>
          <li>모든 <code>*.onstori.com</code> 접속은 현재 <code>onstori.com/*</code>로 301 리다이렉트됩니다</li>
          <li>추후 본사 기능(예: status·docs)이 필요할 때, 여기서 서브도메인 → 내부 경로 <b>고정 매핑</b>을 관리합니다</li>
        </ul>
      </div>
    </main>
  );
}
