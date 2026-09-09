import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "../../ui";
import { readDesignAll } from "@/lib/design-settings";
import { DesignSettingsUi } from "./ui";

/**
 * 디자인 설정 — 온스토리 홈 · 운영자 콘솔 · 사장님 편집화면의 분위기·색·밝기를 정한다.
 *
 * ★ 서버가 값을 읽고 화면에는 **prop 으로만** 내려준다.
 *   `lib/design-settings.ts` 는 서비스 롤 키를 만지는 **서버 전용** 파일이라
 *   `./ui.tsx`("use client")에서 import 하면 키가 손님 번들에 실린다.
 *
 * ⚠ 서체는 여기 없다. 이 셋은 Pretendard 고정이다(CLAUDE.md 규칙 11).
 *   서체를 고르는 곳은 사장님 사이트(`/{상호}/edit`)뿐이다.
 *
 * ⚠ 레이아웃(`app/admin/layout.tsx`)이 이미 `isAdmin()` 을 보지만 여기서도 본다 — 이중 방어.
 */
export const dynamic = "force-dynamic";

export default async function DesignSettingsPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const all = await readDesignAll();
  return <DesignSettingsUi initial={all} />;
}
