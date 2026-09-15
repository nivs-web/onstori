import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { trialInfo } from "@/lib/trial";
import { formatPhone } from "@/lib/phone";
import { SitesTable, type BulkRow } from "./bulk-ui";

export const metadata = { title: "사이트 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★ **사이트 관리 — 「홈페이지 하나」가 한 줄이다.** (2026-09-15 대표님 확정)
 *
 * ★ **회원 목록과의 경계:**
 *   · **회원 목록** = «사람» 1명이 한 줄. 결제 수단·결제 실패·누적 결제액·동의 기록
 *   · **사이트 관리**(여기) = «홈페이지» 1개가 한 줄. 상태·주소·완성도·기간
 *   한 사람이 홈페이지를 둘 가질 수 있고, 홈페이지에 주인이 없을 수도 있다(견본).
 *   **그래서 둘은 같은 표의 다른 열이 아니라 원래 다른 표다.**
 *
 * ★ 대표님 결정 ③ — 「사장님 정보」는 **회원 목록으로 이동**한다. 같은 정보를 두 곳에 그리면
 *   반드시 한쪽이 낡는다. **단 전화번호만은 표에 바로** 둔다 — 전화 한 통이 가장 급한 일이다.
 */
function stateOf(status: string): { live: boolean; label: string; detail: string } {
  switch (status) {
    case "active": return { live: true, label: "운영중", detail: "유료" };
    case "trial": return { live: true, label: "운영중", detail: "무료 체험" };
    case "expired": return { live: false, label: "폐쇄중", detail: "무료 기간 끝" };
    case "suspended": return { live: false, label: "폐쇄중", detail: "해지·미결제" };
    default: return { live: false, label: "폐쇄중", detail: status };
  }
}

export default async function SitesAdmin({
  searchParams,
}: { searchParams: Promise<{ state?: string }> }) {
  if (!(await isAdmin())) return <AdminLogin />;
  const { state } = await searchParams;

  const { data } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, industry, status, trial_ends_at, created_at, paid_at, suspended_at, settings, owner_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const all: BulkRow[] = (data ?? []).map((s) => {
    const st = stateOf(String(s.status));
    const t = trialInfo(s as never);
    const set = (s.settings as Record<string, unknown>) ?? {};
    /** ★ 이벤트로 기간을 받은 분은 **따로 보인다.** 유료와 섞이면 매출 숫자가 흐려진다 */
    const member = t.paid ? "유료회원" : set.eventMember === true ? "이벤트회원" : t.expired ? "무료 종료" : "무료회원";
    return {
      slug: s.slug as string,
      name: (s.business_name as string) ?? "",
      industry: (s.industry as string) ?? "",
      live: st.live, stateLabel: st.label, stateDetail: st.detail,
      member, paid: t.paid,
      dday: t.paid ? "—" : t.expired ? `삭제 D-${Math.max(0, t.daysUntilDelete)}` : `D-${t.daysLeft}`,
      urgent: !t.paid && (t.expired || t.daysLeft <= 7),
      trialEnds: (s.trial_ends_at as string)?.slice(0, 10) ?? "",
      phone: formatPhone(String(set.phone ?? "")),
      email: String((set.notify as { email?: string } | undefined)?.email ?? ""),
      ownerId: (s.owner_id as string) ?? null,
    };
  });

  const live = all.filter((s) => s.live);
  const closed = all.filter((s) => !s.live);
  const tab = state === "live" ? "live" : state === "closed" ? "closed" : "all";
  const rows = tab === "live" ? live : tab === "closed" ? closed : all;

  const tabs = [
    { id: "all", label: "전체", n: all.length, href: "/admin/sites" },
    { id: "live", label: "운영중", n: live.length, href: "/admin/sites?state=live" },
    { id: "closed", label: "폐쇄중", n: closed.length, href: "/admin/sites?state=closed" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">
        사이트 관리 <span className="t-small font-normal text-[var(--text-soft)]">({all.length})</span>
      </h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        한 줄이 <b>홈페이지 하나</b>입니다. 사람(결제·동의)은 <a className="underline" href="/admin/members">회원 목록</a>에 있습니다.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {tabs.map((t) => {
          const on = tab === t.id;
          const color = t.id === "live" ? "var(--green)" : t.id === "closed" ? "var(--danger)" : "var(--text)";
          return (
            <a key={t.id} href={t.href} className="card px-4 py-3 no-underline"
              style={{ borderColor: on ? color : undefined, borderWidth: on ? 2 : undefined }}>
              <p className="t-caption text-[var(--text-soft)]">{t.label}</p>
              <p className="t-h3 font-bold" style={{ color }}>{t.n}</p>
            </a>
          );
        })}
      </div>

      {tab === "closed" && (
        <p className="mt-4 rounded-xl px-4 py-3 t-small" style={{ background: "var(--n-50)" }}>
          <b>폐쇄중이어도 지워진 것이 아닙니다.</b> 자료는 그대로 있고, 결제가 들어오면 그대로 다시 열립니다.
          손님에게는 「쉬고 있어요」 안내만 보이고, 내용은 <b>운영자만</b> <code>/x/&#123;주소&#125;</code> 에서 볼 수 있습니다.
        </p>
      )}

      <SitesTable rows={rows} />
    </main>
  );
}
