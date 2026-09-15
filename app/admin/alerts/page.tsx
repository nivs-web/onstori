import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { readConfig } from "@/lib/admin-config";
import { trialInfo } from "@/lib/trial";
import { isPremade } from "@/lib/premade";
import { formatPhone } from "@/lib/phone";
import { AlertsUi } from "./ui";

export const metadata = { title: "긴급 알림 발송", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★ **긴급 알림 발송 — 화면.** (2026-09-15 대표님 지시로 신설)
 *
 * ⚠ **견본은 목록에서 아예 뺀다.** 화면에 보이면 언젠가 눌린다 —
 *   보이지 않는 것이 가장 확실한 자물쇠다(2026-09-13 P0 에서 배운 것).
 */
export default async function AlertsAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;

  const cfg = await readConfig();
  const { data } = await sbAdmin()
    .from("sites")
    /* ⚠ owner_id·anon_id 는 빼지 마라 — isPremade 가 그 두 칸을 본다 */
    .select("slug, business_name, settings, status, trial_ends_at, paid_at, suspended_at, owner_id, anon_id")
    .in("status", ["trial", "active"])
    .limit(300);

  const sites = (data ?? [])
    .filter((s) => !isPremade(s))
    .map((s) => {
      const st = (s.settings as Record<string, unknown>) ?? {};
      const t = trialInfo(s);
      return {
        slug: s.slug as string,
        name: (s.business_name as string) ?? "",
        phone: formatPhone(String(st.phone ?? "")),
        email: String((st.notify as { email?: string } | undefined)?.email ?? ""),
        dday: t.paid ? "유료" : t.expired ? "끝남" : `D-${t.daysLeft}`,
        alertOff: st.alertOff === true,
      };
    });

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">긴급 알림 발송</h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        사장님께 문자·메일을 보냅니다. <b>만료 예고는 기본이 꺼져 있고</b>, 켜야만 나갑니다.
      </p>
      <p className="mt-3 rounded-xl px-4 py-3 t-small" style={{ background: "var(--n-50)" }}>
        ⚠ <b>미리 만들어 둔 견본은 이 목록에 아예 없습니다.</b> 견본에는 계약도 안 한 가게의
        «진짜 번호»가 들어 있어서, 2026-09-13 에 그쪽으로 문자가 나갈 뻔한 일이 있었습니다.
        <b> 보이지 않는 것이 가장 확실한 자물쇠</b>라 목록에서 뺐습니다.
      </p>
      <AlertsUi initial={cfg} sites={sites} />
    </main>
  );
}
