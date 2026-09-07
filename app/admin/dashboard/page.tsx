import { redirect } from "next/navigation";

/**
 * 옛 주소 보호 — 대시보드는 이제 `/admin` 첫 화면이다(2026-09-07).
 * 북마크·문서·옛 링크가 깨지지 않게 넘겨준다. 화면은 여기 없다.
 */
export default function DashboardRedirect() {
  redirect("/admin");
}
