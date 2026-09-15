import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { DeleteSite } from "./delete-ui";
import { ChangeSlug } from "./slug-ui";
import { trialInfo } from "@/lib/trial";

export const metadata = { title: "사이트 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★ **상태를 «한눈에» 본다.** (2026-09-15 대표님 지시)
 *
 * 대표님 말씀: 「"사이트 관리" 에서 **상태** 라는 섹션을 만들어서 "운영중" "폐쇄중" 등 항목을 넣어
 *   한눈에 볼 수 있게. **초록색 빨간색**으로 표기해.」 + 「**폐쇄된 사이트 보기**를 admin 에 만들어서
 *   그 리스트를 볼 수 있게.」
 *
 * ⚠ DB 의 `status` 는 넷이다(`trial`·`active`·`expired`·`suspended`). 그대로 보여 주면
 *   영어라 읽히지 않는다 — **「운영중 / 폐쇄중」 둘로 접어** 보여 주고, 원래 값은 작은 글씨로 덧붙인다.
 * ⚠ **폐쇄중이라고 지워진 것이 아니다.** 자료는 그대로 있고 `/x/{주소}` 에서 원본을 볼 수 있다
 *   (2026-09-15 결정 — 「우리는 그 어떤 사이트도 삭제하지 않는다」).
 */
type Row = {
  slug: string; business_name: string; industry: string; template: string;
  status: string; trial_ends_at: string | null; created_at: string;
  paid_at: string | null; suspended_at: string | null;
};

/**
 * ★★ **회원 종류와 남은 날 — 2026-09-15 대표님 지시.**
 *   「유료회원 항목을 추가하고, 그 옆에 «무료남은일수» 라고 표기하고 표에는 D-15 이런 식으로」
 * ⚠ 판정은 `lib/trial.ts` 한 곳이 한다. 여기서 날짜를 다시 계산하지 않는다 —
 *   두 곳이 세면 반드시 어긋나고, 어긋난 숫자로 사장님께 문자가 나간다.
 */
function membership(s: Row): { label: string; paid: boolean; dday: string; urgent: boolean } {
  const t = trialInfo(s);
  if (t.paid) return { label: "유료회원", paid: true, dday: "—", urgent: false };
  if (t.expired) return { label: "무료 종료", paid: false, dday: `삭제 D-${Math.max(0, t.daysUntilDelete)}`, urgent: true };
  return { label: "무료회원", paid: false, dday: `D-${t.daysLeft}`, urgent: t.daysLeft <= 7 };
}

/** DB 상태 → 사람이 읽는 상태. **운영중(초록) / 폐쇄중(빨강)** 둘뿐이다 */
function stateOf(status: string): { live: boolean; label: string; detail: string } {
  switch (status) {
    case "active": return { live: true, label: "운영중", detail: "유료" };
    case "trial": return { live: true, label: "운영중", detail: "무료 체험" };
    case "expired": return { live: false, label: "폐쇄중", detail: "무료 기간 끝" };
    case "suspended": return { live: false, label: "폐쇄중", detail: "해지·미결제" };
    default: return { live: false, label: "폐쇄중", detail: status };
  }
}

function StateBadge({ status }: { status: string }) {
  const s = stateOf(status);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {/* 색만으로 뜻을 나르지 않는다 — 글자를 함께 둔다(색을 못 가리는 분도 읽으셔야 한다) */}
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: s.live ? "var(--green)" : "var(--danger)" }}
      />
      <b style={{ color: s.live ? "var(--green)" : "var(--danger)" }}>{s.label}</b>
      <span className="t-caption text-[var(--text-soft)]">{s.detail}</span>
    </span>
  );
}

export default async function SitesAdmin({
  searchParams,
}: { searchParams: Promise<{ state?: string }> }) {
  if (!(await isAdmin())) return <AdminLogin />;
  const { state } = await searchParams;

  const { data } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, industry, template, status, trial_ends_at, created_at, paid_at, suspended_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const all = (data ?? []) as Row[];
  const live = all.filter((s) => stateOf(s.status).live);
  const closed = all.filter((s) => !stateOf(s.status).live);

  const tab = state === "live" ? "live" : state === "closed" ? "closed" : "all";
  const rows = tab === "live" ? live : tab === "closed" ? closed : all;

  const tabs = [
    { id: "all", label: "전체", n: all.length, href: "/admin/sites" },
    { id: "live", label: "운영중", n: live.length, href: "/admin/sites?state=live" },
    { id: "closed", label: "폐쇄중", n: closed.length, href: "/admin/sites?state=closed" },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">
        사이트 관리 <span className="t-small font-normal text-[var(--text-soft)]">({all.length})</span>
      </h1>

      {/* ── 상태 요약 — 표를 보기 «전»에 숫자부터 ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tabs.map((t) => {
          const on = tab === t.id;
          const color = t.id === "live" ? "var(--green)" : t.id === "closed" ? "var(--danger)" : "var(--text)";
          return (
            <a
              key={t.id}
              href={t.href}
              className="card px-4 py-3 no-underline"
              style={{ borderColor: on ? color : undefined, borderWidth: on ? 2 : undefined }}
            >
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

      <div className="table-scroll card mt-6">
        <table className="w-full min-w-[760px] t-small">
          <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
            <tr>
              {["상태", "회원", "무료 남은 일수", "주소", "상호", "업종", "체험 만료", "지우기"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--text-soft)]">여기에 해당하는 사이트가 없습니다.</td></tr>
            )}
            {rows.map((s) => {
              const st = stateOf(s.status);
              const m = membership(s);
              return (
                <tr key={s.slug} className="border-t border-n-100">
                  <td className="px-3 py-2"><StateBadge status={s.status} /></td>
                  {/* ★ 유료/무료 — 대표님이 한눈에 보고 전화를 거실 자리다 */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <b style={{ color: m.paid ? "var(--green)" : "var(--text)" }}>{m.label}</b>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span style={{ color: m.urgent ? "var(--danger)" : "var(--text-soft)", fontWeight: m.urgent ? 700 : 400 }}>
                      {m.dday}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {/* ★ 폐쇄중이면 공개 주소로 보내지 않는다 — 「쉬고 있어요」만 나와서 헛걸음이 된다.
                        운영자가 보고 싶은 것은 «내용»이므로 비공개 보관실로 보낸다. */}
                    <a
                      className="underline underline-offset-2"
                      style={{ color: st.live ? "var(--green-700, #15803d)" : "var(--danger)" }}
                      href={st.live ? `/${s.slug}` : `/x/${s.slug}`}
                      target="_blank"
                    >
                      {st.live ? `/${s.slug}` : `/x/${s.slug}`}
                    </a>
                    {/* ★ 2026-09-15 대표님 — 주소는 **운영자만** 바꾼다(전화로 이유를 듣고 우리가 바꾼다) */}
                    <div className="mt-0.5"><ChangeSlug slug={s.slug} businessName={s.business_name ?? ""} /></div>
                  </td>
                  <td className="px-3 py-2">{s.business_name}</td>
                  <td className="px-3 py-2">{s.industry}</td>
                  <td className="px-3 py-2 t-caption">{s.trial_ends_at?.slice(0, 10) ?? "—"}</td>
                  <td className="px-3 py-2 t-caption">{s.created_at?.slice(0, 10)}</td>
                  {/* ★ 운영자 전용 — 사장님 화면에는 없다. 서버가 다시 인증을 확인한다 */}
                  <td className="px-3 py-2"><DeleteSite slug={s.slug} businessName={s.business_name ?? ""} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
