import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { ShowcaseManager } from "./ui";

export const metadata = { title: "포트폴리오 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ShowcaseAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  const sb = sbAdmin();
  const { data: rows } = await sb
    .from("showcase")
    .select("id, slug, tag, sort, featured")
    .order("featured", { ascending: false })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });

  /**
   * ★★ **「추가했는데 첫 화면에 안 뜬다」를 여기서 밝힌다.** (2026-09-15 대표님 지적)
   *
   * ⚠ `components/portfolio.tsx` 에 **조용한 관문이 둘** 있다:
   *   ① 정지(`expired`)된 사이트는 안 싣는다
   *   ② **전화번호가 자리표시(010-0000-0000 류)면 안 싣는다**
   *   등록은 성공하고 「등록됨」이라고 답하는데 첫 화면에는 안 나오니
   *   대표님은 **「추가가 안 된다」**로 겪으셨다. **조용히 거르는 것이 가장 나쁘다.**
   * ★ 그래서 같은 판정을 여기서 다시 해 **줄마다 이유를 적어 준다.**
   * ⚠ 판정 규칙이 두 곳이 됐다. 한쪽을 고치면 다른 쪽도 고쳐야 한다 —
   *   합치려면 `portfolio.tsx` 에서 판정 함수를 빼 와야 하는데 그건 손님 화면을 건드리는 일이라
   *   이번 범위 밖으로 둔다. **이 경고를 지우지 마라.**
   */
  const slugs = (rows ?? []).map((r) => r.slug as string);
  const { data: meta } = slugs.length
    ? await sb.from("sites").select("slug, status, settings").in("slug", slugs)
    : { data: [] };

  /** 랜딩이 쓰는 것과 **같은 기준** — 자리표시 번호를 걸러 낸다 */
  const realPhone = (v: unknown) => {
    const d = String(v ?? "").replace(/[^0-9]/g, "");
    if (d.length < 9) return false;
    if (new Set(d).size === 1) return false;   // 0000000000 류
    if (d.endsWith("0000")) return false;      // 010-0000-0000 류
    return true;
  };

  const ALLOW = new Set(["sample-interior", "moksu"]);
  const byslug = new Map((meta ?? []).map((m) => [m.slug as string, m]));
  const why: Record<string, string> = {};
  for (const s of slugs) {
    if (ALLOW.has(s)) { why[s] = ""; continue; }
    const m = byslug.get(s) as { status?: string; settings?: { phone?: unknown } } | undefined;
    if (!m) why[s] = "사이트를 못 찾았어요 — 지워졌거나 주소가 바뀌었습니다";
    else if (m.status === "expired") why[s] = "정지된 사이트라 첫 화면에 안 실립니다";
    else if (!realPhone(m.settings?.phone)) why[s] = "전화번호가 자리표시(010-0000-0000 류)라 안 실립니다";
    else why[s] = "";
  }

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">랜딩 포트폴리오 관리 <span className="t-small font-normal text-[var(--text-soft)]">({rows?.length ?? 0})</span></h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">주소(onstori.com/가게명)를 넣으면 자동 등록돼요. 태그·순서·추천을 지정하면 랜딩 첫 화면에 반영됩니다.</p>
      <ShowcaseManager initial={rows ?? []} why={why} />
    </main>
  );
}
