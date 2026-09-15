import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { USAGE_KINDS, RATE_NOTE, krwOf, sumUsage, usageRowsOf, type UsageRow } from "@/lib/ai-usage";

export const metadata = { title: "토큰 사용량", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★★ **AI 토큰 사용량 — 「영수증·내역서」.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「어떤 회원이 얼마나 토큰을 썼는지 알게 하고 싶어. 그래야 나중에 **토큰 폭주를
 *   막을 수 있고** … 모든 회원에게 이게 존재한다면, 우리가 토큰 비용을 예상해서 무료 회원에게
 *   **기능을 막아 두거나**, 얼마 안 쓴다면 **마이너스 손해를 보더라도 열어 줄 수 있잖아.**」
 *
 * ★ 화면을 둘로 나눴다:
 *   ① **회원(사이트)별 합계** — 누가 많이 쓰나. 폭주를 여기서 잡는다
 *   ② **날짜·건별 내역** — 언제 무엇에 얼마나. 「영수증」이 이것이다
 *
 * 🔴 **원화는 «추정»이다.** 구글 단가는 모델·지역·시점마다 다르다. 그래서
 *   **토큰 수(정확한 값)를 크게**, 원화는 작게 「추정」이라고 써서 곁들인다.
 *   단가는 환경변수로 바꾼다(`lib/ai-usage.ts` 의 `RATE_NOTE` 가 지금 값을 말해 준다).
 *
 * ⚠ **지금 기록되는 것은 「홈페이지 제작」 하나뿐이다.** 이야기 쓰기·영상 편집·자막은
 *   아직 AI 호출 자리에 영수증을 안 붙였다. 붙이는 법은 한 줄이다 —
 *   `recordAiUsage(slug, "story_write", model, raw)`. 그 기능을 만들 때 같이 넣어라.
 */
const won = (v: number) => `${Math.round(v).toLocaleString()}원`;
const tok = (v: number) => v.toLocaleString();

export default async function TokensAdmin({
  searchParams,
}: { searchParams: Promise<{ slug?: string }> }) {
  if (!(await isAdmin())) return <AdminLogin />;
  const { slug: picked } = await searchParams;

  const { data } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, status, settings")
    .limit(300);

  const rows = (data ?? []).map((s) => {
    const list = usageRowsOf(s.settings);
    return {
      slug: s.slug as string,
      name: (s.business_name as string) ?? "",
      status: (s.status as string) ?? "",
      list,
      sum: sumUsage(list),
    };
  });

  const used = rows.filter((r) => r.list.length > 0).sort((a, b) => b.sum.total - a.sum.total);
  const grand = {
    calls: used.reduce((a, r) => a + r.sum.calls, 0),
    total: used.reduce((a, r) => a + r.sum.total, 0),
    krw: used.reduce((a, r) => a + r.sum.krw, 0),
  };
  const detail = picked ? rows.find((r) => r.slug === picked) : null;

  /** 하루치로 접은 내역 — 「몇 월 며칠에 얼마나」를 보시려는 것이 목적이다 */
  const byDay = new Map<string, UsageRow[]>();
  for (const r of detail?.list ?? []) {
    const d = (r.at || "").slice(0, 10) || "(날짜 없음)";
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }

  return (
    <main className="mx-auto w-full max-w-4xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">토큰 사용량</h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        홈페이지를 만들고 고칠 때 쓴 AI 토큰입니다. <b>토큰 수는 정확하고, 원화는 추정</b>입니다.
      </p>

      {/* ── 전체 합계 ── */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <p className="t-caption text-[var(--text-soft)]">쓴 사이트</p>
          <p className="t-h3 font-bold">{used.length}곳</p>
        </div>
        <div className="card px-4 py-3">
          <p className="t-caption text-[var(--text-soft)]">전체 토큰</p>
          <p className="t-h3 font-bold">{tok(grand.total)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="t-caption text-[var(--text-soft)]">추정 비용</p>
          <p className="t-h3 font-bold">{won(grand.krw)}</p>
        </div>
      </div>
      <p className="mt-2 t-caption text-[var(--text-soft)]">{RATE_NOTE}</p>

      {used.length === 0 && (
        <p className="mt-5 rounded-xl px-4 py-4 t-small" style={{ background: "var(--n-50)" }}>
          아직 기록이 없습니다. <b>2026-09-15 부터 새로 만드는 홈페이지</b>에 영수증이 쌓입니다 —
          그 전에 만든 사이트는 토큰 수를 남기지 않아서 <b>뒤늦게 채울 수 없습니다.</b>
        </p>
      )}

      {/* ── ① 사이트별 합계 ── */}
      {used.length > 0 && (
        <>
          <h2 className="mt-8 t-body font-bold">사이트별 — 누가 많이 쓰나</h2>
          <div className="table-scroll card mt-3">
            <table className="w-full min-w-[640px] t-small">
              <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
                <tr>{["주소", "상호", "횟수", "토큰", "추정 비용", "내역"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {used.map((r) => (
                  <tr key={r.slug} className="border-t border-n-100">
                    <td className="px-3 py-2"><a className="underline" href={`/${r.slug}`} target="_blank">/{r.slug}</a></td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.sum.calls}회</td>
                    <td className="px-3 py-2 font-bold">{tok(r.sum.total)}</td>
                    <td className="px-3 py-2">{won(r.sum.krw)}</td>
                    <td className="px-3 py-2">
                      <a className="underline text-[var(--text-soft)]" href={`/admin/tokens?slug=${r.slug}`}>영수증 보기</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ② 한 사이트의 영수증 ── */}
      {detail && (
        <section className="card mt-8 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="t-body font-bold">영수증 · {detail.name} <span className="font-normal text-[var(--text-soft)]">/{detail.slug}</span></h2>
            <a className="t-caption underline text-[var(--text-soft)]" href="/admin/tokens">닫기</a>
          </div>
          <p className="mt-1 t-small">
            모두 <b>{detail.sum.calls}회</b> · <b>{tok(detail.sum.total)}</b> 토큰 · 추정 <b>{won(detail.sum.krw)}</b>
            <span className="t-caption text-[var(--text-soft)]">
              {"  "}(보낸 글 {tok(detail.sum.inTok)} · 받은 글 {tok(detail.sum.outTok)})
            </span>
          </p>

          {[...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => {
            const s = sumUsage(list);
            return (
              <div key={day} className="mt-4">
                <div className="flex items-baseline justify-between border-b border-n-200 pb-1">
                  <b className="t-small">{day}</b>
                  <span className="t-caption text-[var(--text-soft)]">{tok(s.total)} 토큰 · {won(s.krw)}</span>
                </div>
                <ul className="mt-1.5 space-y-1 t-caption">
                  {list.slice().reverse().map((r, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        <b>{USAGE_KINDS[r.kind]}</b>
                        <span className="text-[var(--text-soft)]">
                          {"  "}{(r.at || "").slice(11, 16)} · {r.model}
                          {r.folded ? ` · 예전 ${r.folded}건 합침` : ""}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[var(--text-soft)]">
                        {tok(r.total)} 토큰 · {won(krwOf(r))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section className="card mt-8 p-5">
        <h2 className="t-body font-bold">⚠ 지금 무엇이 기록되고 무엇이 안 되나</h2>
        <ul className="mt-2 space-y-1 t-small">
          <li>✅ <b>홈페이지 제작</b> — 가입 마지막 단계의 문구 생성</li>
          <li>❌ 이야기 쓰기 · 영상 편집 · 자막 달기 · 이미지 생성 — <b>아직 영수증을 안 붙였습니다</b></li>
        </ul>
        <p className="mt-2 t-caption text-[var(--text-soft)]">
          붙이는 것은 그 기능의 AI 호출 뒤에 한 줄이면 됩니다 —
          <code>recordAiUsage(주소, &quot;story_write&quot;, 모델, 응답)</code>.
          그 기능을 만들 때 같이 넣습니다.
        </p>
        <p className="mt-2 t-caption text-[var(--text-soft)]">
          ⚠ 사이트 하나에 최근 <b>300건</b>까지 줄로 남기고, 넘치면 오래된 것을 <b>합계 한 줄로 접습니다.</b>
          숫자는 잃지 않고 줄 수만 줄어듭니다.
        </p>
      </section>
    </main>
  );
}
