import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "./ui";
import { AdminSidebar } from "@/components/admin/sidebar";
import { themeAttrs, themeVars } from "@/lib/design-tokens";
import { designRev } from "@/lib/admin-theme";
import { readDesignAll } from "@/lib/design-settings";

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

  /* 테마 엔진 — 운영자 콘솔의 밝은/어두운·분위기·색 (2026-09-09, S2).
     ★ `display: contents` 라 이 상자는 **자리를 차지하지 않는다.** 배치는 그대로 두고
       CSS 값만 아래로 흘려보낸다.
     ★ 표시를 `<html>` 이 아니라 여기 붙이는 이유: 어드민 안에 손님 사이트 미리보기를
       띄우는 자리가 있는데, html 에 붙이면 그 미리보기까지 어두워진다.
     ⚠ 로그인 화면에는 테마를 씌우지 않는다 — `isAdmin()` 검사보다 뒤에 있다. */
  const all = await readDesignAll();
  /* ★ 바깥(`<html>`)이 무엇을 쓰는지 **알려 준다.** 안 알려 주면 어드민이 「기본과 같다」며
     아무것도 안 심고 홈 설정에 끌려간다(2026-09-09 조사가 잡아낸 결함). */
  const setting = all.admin;
  return (
    <div
      data-admin-root
      /* ★ 설정 지문 — 밝기 토글이 남긴 **임시값을 무효로 만드는 열쇠**다(2026-09-09 회장님).
         설정이 바뀌면 이 값이 달라지고, 지문이 안 맞는 임시값은 브라우저가 스스로 버린다.
         남의 브라우저 localStorage 는 서버가 지울 수 없어서 이렇게 한다. */
      data-design-rev={designRev(setting)}
      {...themeAttrs(setting, "admin")}
      style={{ display: "contents", ...themeVars(setting, all.site) } as React.CSSProperties}
    >
      <AdminSidebar />
      <div className="admin-shell">{children}</div>
    </div>
  );
}
