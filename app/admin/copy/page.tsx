import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { readConfig } from "@/lib/admin-config";
import { CopyEditor } from "./ui";

export const metadata = { title: "카피 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★ **카피 관리 — 대표님이 핵심 문구를 직접 정하시는 곳.** (2026-09-15 지시로 신설)
 *
 * ⚠ 「한 번도 저장 안 하셨나」를 알아야 화면이 정직해진다. 그래서 표를 직접 한 번 본다 —
 *   `readConfig()` 는 없으면 조용히 기본값을 주기 때문에 그것만으로는 구별이 안 된다.
 */
export default async function CopyAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;

  const cfg = await readConfig();
  let saved = false;
  try {
    const { data } = await sbAdmin().from("admin_notes").select("id").eq("id", "config").maybeSingle();
    saved = Boolean(data);
  } catch { /* 표가 없으면 「저장한 적 없음」이 맞다 */ }

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">카피 관리</h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        손님이 보는 <b>핵심 문구</b>를 여기서 고칩니다. 여기서 바꾸면 <b>화면 전체에 한 번에</b> 반영됩니다.
      </p>
      <CopyEditor initial={cfg} fromDefault={!saved} />
    </main>
  );
}
