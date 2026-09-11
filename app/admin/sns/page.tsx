import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "../ui";
import { SnsUsage } from "./ui";

export const metadata = { title: "SNS 발행 현황", robots: { index: false, follow: false } };

/**
 * SNS 발행 현황 — 몇 건 나갔고 얼마나 썼나. (2026-09-11 회장님 요청)
 *
 * ★ 왜: 「100건도 안 썼는데 $10 이 사라졌다」를 **알아챌 수 있어야** 한다.
 *   지금은 X 에 몇 건 나갔는지 볼 곳이 아예 없다.
 */
export default async function SnsAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">SNS 발행 현황</h1>
      <p className="mt-2 t-small text-[var(--text-soft)]">
        우리가 <b>보낸 횟수</b>를 셉니다. 그쪽 청구서와 1:1 이 아닐 수 있어요 — 재시도·실패분이 다릅니다.
      </p>
      <SnsUsage />
    </main>
  );
}
