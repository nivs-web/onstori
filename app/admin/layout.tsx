import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "./ui";
import { AdminSidebar } from "@/components/admin/sidebar";

export const metadata = { robots: { index: false, follow: false } };

/**
 * 운영자 콘솔 껍데기 — 왼쪽 고정 메뉴(240px) + 폰 서랍.
 *
 * 왜 만들었나(2026-09-07 실측):
 *  · `app/admin/` 에 layout.tsx 가 아예 없어 화면마다 제각각이었다.
 *  · 8개 화면 중 **4곳은 뒤로가기 링크조차 없는 막다른 길**이었다
 *    (/admin · /admin/dashboard · /admin/members · /admin/pages).
 *  · 화면↔화면 직접 이동이 없어 회원 목록에서 사이트 관리로 가려면 /admin 을 거쳐야 했다.
 *
 * 인증도 여기 한 곳으로 모은다. 전에는 8개 화면이 각자 `isAdmin()` 을 부르고
 * 각자 `<AdminLogin/>` 을 그렸다 — 화면을 하나 더 만들 때 빠뜨리기 쉬웠다.
 * ⚠ 각 화면의 `isAdmin()` 검사는 **그대로 둔다.** 여기가 뚫려도 화면이 스스로 막게(이중 방어).
 *
 * ⚠ 인증 방식(ADMIN_KEY)은 이 작업에서 건드리지 않는다 — P7 묶음이다(docs/admin.md §2).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 로그인 화면에는 메뉴를 씌우지 않는다 — 아직 아무 데도 갈 수 없는 사람이다
  if (!(await isAdmin())) return <AdminLogin />;

  return (
    <>
      <AdminSidebar />
      <div className="admin-shell">{children}</div>
    </>
  );
}
