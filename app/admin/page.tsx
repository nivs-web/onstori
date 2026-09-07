/*
 * ⚠ 이 파일은 **`/admin` 첫 화면**이다 (2026-09-07 회장님 확정).
 *   전에는 링크 카드 13장짜리 목차가 여기 있었는데, 왼쪽 고정 메뉴가 그 일을 대신하므로
 *   중복이라 버렸다. 목차에는 라우트가 없는 카드 5장까지 섞여 있었다.
 *   옛 주소 `/admin/dashboard` 는 여기로 넘겨준다(북마크 보호).
 */
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "./ui";
import { AdminNotes, parseItems } from "./notes";
import { ADMIN_NOTES_SEED } from "@/config/admin-notes-seed";
import { trialInfo, TRIAL_DAYS, DELETE_AFTER_SUSPEND_DAYS, DELETE_NOTICE_DAYS } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const metadata = { title: "대시보드 — 온스토리 운영자", robots: { index: false, follow: false } };

/**
 * 운영자 대시보드 (docs/admin.md §6 · §7 단계 4).
 *
 * ★ 첫 목적은 "오늘 밤 크론이 무엇을 할 것인가"를 사람이 미리 보는 것이다.
 *   정지·삭제·구독 청구가 매일 03:00 에 자동으로 돈다. 되돌릴 수 없는 조치(삭제)가
 *   사람 눈에 안 보이는 채로 실행되는 것이 지금 가장 큰 위험이라 그것부터 보여준다.
 * ⚠ 숫자가 0 일 때 그럴듯한 화면을 만들지 않는다 — 없으면 "아직 없다"고 적는다.
 */

const DAY = 86_400_000;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "—");

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-accent" : "text-green-700";
  return (
    <div className="rounded-2xl border border-n-200 bg-white p-5">
      <p className="t-caption text-[var(--text-soft)]">{label}</p>
      <p className={`mt-1 t-h1 font-bold ${color}`}>{value}</p>
      {sub ? <p className="mt-1 t-caption text-[var(--text-soft)]">{sub}</p> : null}
    </div>
  );
}

export default async function DashboardPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const sb = sbAdmin();
  const now = Date.now();

  const [{ data: sites }, { data: pays }, { data: inqs }, { data: bank }, { data: stories }, { data: note }] = await Promise.all([
    sb.from("sites").select("slug, business_name, status, created_at, trial_ends_at, suspended_at, paid_at, payment, settings"),
    sb.from("payments").select("status, amount, created_at"),
    sb.from("inquiries").select("created_at"),
    sb.from("image_bank").select("model, quality_ok").eq("deleted", false),
    sb.from("story_entries").select("created_at"),
    /* ⚠ `db push` 전에는 이 표가 없다. supabase-js 는 던지지 않고 {data:null,error} 를 주므로
       Promise.all 이 깨지지 않는다 — 그때는 아래에서 기본 메모(seed)를 보여준다.
       세 줄(main·todo·done)을 한 번에 읽는다 — 왕복을 셋으로 늘리지 않는다. */
    sb.from("admin_notes").select("id, body"),
  ]);
  const noteOf = (id: string) => (note ?? []).find((n) => n.id === id)?.body ?? "";

  const rows = sites ?? [];
  const since = (ms: number) => (r: { created_at: string }) => now - new Date(r.created_at).getTime() < ms;

  const made = rows.length;
  const openCount = rows.filter((r) => r.status !== "expired").length;
  const paidCount = rows.filter((r) => trialInfo(r).paid).length;

  // 오늘 밤 크론이 손댈 것들
  const willSuspend = rows.filter((r) => { const t = trialInfo(r); return !t.paid && !t.expired && t.daysLeft <= 1; });
  const willDelete = rows.filter((r) => {
    const t = trialInfo(r);
    return !t.paid && t.expired && !r.paid_at && !r.payment && t.daysUntilDelete <= 1;
  });
  const willNotice = rows.filter((r) => {
    const t = trialInfo(r);
    return !t.paid && t.expired && (DELETE_NOTICE_DAYS as readonly number[]).includes(t.daysUntilDelete);
  });
  const noPhone = rows.filter((r) => !(r.settings as { phone?: string } | null)?.phone);

  const paidRows = (pays ?? []).filter((p) => p.status === "paid");
  const failRows = (pays ?? []).filter((p) => p.status === "failed");
  const revenue = paidRows.reduce((s, p) => s + (p.amount ?? 0), 0);
  const revenueMonth = paidRows.filter(since(30 * DAY)).reduce((s, p) => s + (p.amount ?? 0), 0);

  // AI 비용 — 단가는 scripts/bank-generate.ts 의 표와 같은 값이다
  const COST: Record<string, number> = { "gemini-3-pro-image": 0.134, "gemini-3.1-flash-image": 0.039 };
  const aiUsd = (bank ?? []).reduce((s, b) => s + (COST[b.model as string] ?? 0), 0);
  const pendingReview = (bank ?? []).filter((b) => b.quality_ok === null).length;

  const slugs = (list: { slug: string }[]) => (list.length ? list.map((r) => r.slug).join(", ") : "없음");

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 px-6 py-10">
      <p className="text-xs font-semibold kicker-wide text-green-700"><Link href="/admin">ONSTORI ADMIN</Link></p>
      <h1 className="mt-2 text-2xl font-bold">대시보드</h1>

      {/* 메모장 3종 — **대시보드 맨 위, 1/3씩** (2026-09-07 회장님).
          폰에서는 세로로 쌓인다(lg 이상에서만 3열). */}
      <div className="mt-5">
        <AdminNotes
          mainInit={noteOf("main") || ADMIN_NOTES_SEED}
          mainSaved={Boolean(noteOf("main"))}
          todoInit={parseItems(noteOf("todo"))}
          doneInit={parseItems(noteOf("done"))}
        />
      </div>

      <h2 className="mt-8 t-body font-bold">오늘 밤 03:00 크론이 할 일</h2>
      <p className="mt-1 t-caption text-[var(--text-soft)]">
        무료 {TRIAL_DAYS}일 → 정지(자료 보관) → 정지 후 {DELETE_AFTER_SUSPEND_DAYS}일 삭제.
        되돌릴 수 없는 것은 삭제뿐이고, 예고 문자를 한 번도 못 보내면 삭제하지 않습니다.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="정지될 홈페이지" value={`${willSuspend.length}곳`} tone={willSuspend.length ? "warn" : undefined} sub={slugs(willSuspend)} />
        <Card label="영구 삭제될 홈페이지" value={`${willDelete.length}곳`} tone={willDelete.length ? "danger" : undefined} sub={slugs(willDelete)} />
        <Card label="삭제 예고 문자" value={`${willNotice.length}건`} sub={slugs(willNotice)} />
        <Card label="연락처 없는 사이트" value={`${noPhone.length}곳`} tone={noPhone.length ? "warn" : undefined}
          sub="예고를 못 보내면 삭제하지 않고 넘어갑니다" />
      </div>

      <h2 className="mt-10 t-body font-bold">사장님</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="전체 홈페이지" value={`${made}곳`} sub={`오늘 ${rows.filter(since(DAY)).length} · 이번 주 ${rows.filter(since(7 * DAY)).length}`} />
        <Card label="공개 중" value={`${openCount}곳`} sub={`정지 ${made - openCount}곳`} />
        <Card label="정회원" value={`${paidCount}명`} sub={made ? `전환율 ${Math.round((paidCount / made) * 100)}%` : "—"} />
        <Card label="손님 문의" value={`${(inqs ?? []).length}건`} sub={`오늘 ${(inqs ?? []).filter(since(DAY)).length}건`} />
      </div>

      <h2 className="mt-10 t-body font-bold">돈</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="누적 결제" value={`${revenue.toLocaleString()}원`} sub={`${paidRows.length}건`} />
        <Card label="최근 30일" value={`${revenueMonth.toLocaleString()}원`} />
        <Card label="결제 실패" value={`${failRows.length}건`} tone={failRows.length ? "warn" : undefined}
          sub={failRows.length ? <Link href="/admin/members" className="underline">회원 목록에서 보기</Link> : "없음"} />
        <Card label="AI 이미지 누적 비용" value={`$${aiUsd.toFixed(2)}`} sub={`${(bank ?? []).length}장 · 검수 대기 ${pendingReview}장`} />
      </div>
      {paidRows.length === 0 && (
        <p className="mt-3 rounded-xl bg-n-50 p-3 t-caption text-[var(--text-soft)]">
          아직 결제가 한 건도 없습니다. 토스 정기결제 가맹 심사가 끝나고 첫 결제가 들어오면 여기부터 채워집니다.
        </p>
      )}

      <h2 className="mt-10 t-body font-bold">이야기</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="누적 이야기" value={`${(stories ?? []).length}건`} sub={`이번 주 ${(stories ?? []).filter(since(7 * DAY)).length}건`} />
      </div>

      <h2 className="mt-10 t-body font-bold">가까운 만료</h2>
      <ul className="mt-3 divide-y divide-n-100 rounded-2xl border border-n-200 bg-white t-small">
        {rows.filter((r) => !trialInfo(r).paid)
          .sort((a, b) => String(a.trial_ends_at ?? "").localeCompare(String(b.trial_ends_at ?? "")))
          .slice(0, 8).map((r) => {
            const t = trialInfo(r);
            return (
              <li key={r.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span><b>{r.business_name}</b> <span className="text-[var(--text-soft)]">onstori.com/{r.slug}</span></span>
                <span className={t.expired ? "text-[var(--text-soft)]" : t.daysLeft <= 3 ? "font-bold text-danger" : ""}>
                  {t.expired
                    ? `정지 · 삭제까지 D-${Math.max(0, t.daysUntilDelete)} (${fmt(t.deleteAt)})`
                    : `무료 D-${t.daysLeft} (${fmt(r.trial_ends_at)})`}
                </span>
              </li>
            );
          })}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-[var(--text-soft)]">아직 홈페이지가 없어요</li>}
      </ul>
    </main>
  );
}
