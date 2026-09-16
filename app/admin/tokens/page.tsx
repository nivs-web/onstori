import { Fragment } from "react";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { USAGE_KINDS, RATE_NOTE, krwOf, sumUsage, usageRowsOf, type UsageRow } from "@/lib/ai-usage";
import {
  AI_COST_ITEMS, COST_STAGES, MONTHLY_ASSUMPTION, ASSUMPTION_NOTE, MONTHLY_PRICE,
  TOKEN_RULE, NO_AI, isFree, usdToKrw, type CostItem, type CostStatus,
} from "@/config/ai-cost";

export const metadata = { title: "토큰 사용량", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★★ **AI 토큰 사용량 — 「영수증·내역서」.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「어떤 회원이 얼마나 토큰을 썼는지 알게 하고 싶어. 그래야 나중에 **토큰 폭주를
 *   막을 수 있고** … 모든 회원에게 이게 존재한다면, 우리가 토큰 비용을 예상해서 무료 회원에게
 *   **기능을 막아 두거나**, 얼마 안 쓴다면 **마이너스 손해를 보더라도 열어 줄 수 있잖아.**」
 *
 * ★ 화면을 셋으로 나눴다:
 *   ① **회원(사이트)별 합계** — 누가 많이 쓰나. 폭주를 여기서 잡는다
 *   ② **날짜·건별 내역** — 언제 무엇에 얼마나. 「영수증」이 이것이다
 *   ③ **기능별 목록**(2026-09-16 대표님 지시로 추가) — 「어디에 얼마가 드는가」의 «메뉴판».
 *      ①② 는 **지나간 사실**이고 ③ 은 **앞으로의 추정**이다. 단일 출처는 `config/ai-cost.ts`.
 *
 * ★ 대표님 말씀(2026-09-16): 「각각 금액이 얼만지 알아야겠어. 그래야 이 부분은 AI 기능을 넣어야
 *   할지, 그 부분은 토큰 소모가 심하니 빼야 할지 판단한다. **(미적용) (적용중)** 이렇게 앞에
 *   뜨게 만들 거야. … **어떤 기능 추가 시 어느 정도 토큰이 드는지 싹 다 기재해 놔.**」
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

/**
 * 몇 원짜리를 그릴 때 쓴다.
 * 🔴 **반올림하면 「0원」이 되어 거짓말이 된다.** 문구 한 번이 3.5원인데 「0원」으로 보이면
 *   대표님이 「공짜네」라고 판단하신다. 100원 미만은 소수 첫째 자리까지 남긴다.
 */
const wonFine = (v: number) => (v === 0 ? "0원" : v < 100 ? `${v.toFixed(1)}원` : won(v));

/**
 * 한 번 부를 때의 «추정» 원화.
 * 🔴 **이미지는 토큰 단가로 계산하면 틀린다.** 구글은 그림을 글자와 «다른 단가»로 청구한다 —
 *   토큰 수로 계산하면 실제의 1/15 쯤으로 나와, 비싼 기능이 싸 보인다. 그래서 장당 고정
 *   단가(`usdPerCall`)가 있으면 **그것을 먼저** 쓴다. 글자 기능만 `krwOf` 로 계산한다.
 */
function krwPerCall(it: CostItem): number {
  if (isFree(it)) return 0;
  if (it.usdPerCall != null) return usdToKrw(it.usdPerCall);
  return krwOf({ inTok: it.estIn, outTok: it.estOut });
}

/**
 * `config/ai-cost.ts` 의 설명글에 쓴 **굵게** 표시를 진짜 굵은 글씨로 바꾼다.
 * ⚠ **별표가 그대로 화면에 보이면 대표님이 읽기 어렵다.** 그렇다고 설명글에서 강조를 빼면
 *   「여기가 중요하다」가 사라져 한 덩어리 글이 된다. 그래서 그리는 쪽에서 풀어 준다.
 * 🔴 HTML 을 심지 않는다(`dangerouslySetInnerHTML` 금지) — 글자를 쪼개 `<b>` 로 감쌀 뿐이다.
 */
function Emph({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((s, i) => (
    i % 2 ? <b key={i}>{s}</b> : <Fragment key={i}>{s}</Fragment>
  ))}</>;
}

/** 상태 딱지 — 대표님이 「앞에 뜨게」 하라고 하신 것 */
const STATUS_STYLE: Record<CostStatus, string> = {
  적용중: "bg-green-100 text-green-800",
  미적용: "bg-n-200 text-[var(--text)]",
  검토중: "bg-accent-soft text-accent-ink",
};

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

  /* ★ ③ 기능별 — 「유료회원 한 분이 한 달에 얼마인가」 어림셈.
     🔴 **가정이다.** 아직 유료회원이 없어 「얼마나 쓰시나」를 아무도 모른다.
        실제 회원이 생기면 위 ① 표를 보고 `config/ai-cost.ts` 의 가정을 고친다. */
  const monthly = MONTHLY_ASSUMPTION.flatMap((a) => {
    const it = AI_COST_ITEMS.find((x) => x.id === a.itemId);
    if (!it) return [];
    const each = krwPerCall(it);
    return [{ ...a, label: it.label, status: it.status, each, sum: each * a.perMonth }];
  });
  const monthlySum = monthly.reduce((a, m) => a + m.sum, 0);
  /** 지금 «적용중»인 제작 단계 비용 — 가입 한 번에 한 번만 든다 */
  const oneTime = AI_COST_ITEMS
    .filter((i) => i.stage === "site" && i.status === "적용중")
    .reduce((a, i) => a + krwPerCall(i), 0);

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

      {/* ── ③ 기능별 목록 — 「어디에 얼마가 드나」 (2026-09-16 대표님 지시) ── */}
      <h2 className="mt-10 t-h3 font-bold">기능별 — 어디에 얼마가 드나</h2>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        위쪽은 <b>이미 쓴 것(사실)</b>이고, 여기는 <b>앞으로 쓸 것(추정)</b>입니다.
        기능마다 <b>적용중 · 미적용</b>을 앞에 붙였습니다. {TOKEN_RULE}
      </p>

      {COST_STAGES.map((st) => {
        const items = AI_COST_ITEMS.filter((i) => i.stage === st.id);
        if (items.length === 0) return null;
        return (
          <section key={st.id} className="mt-6">
            <h3 className="t-body font-bold">{st.label}</h3>
            <p className="mt-0.5 t-caption text-[var(--text-soft)]"><Emph text={st.note} /></p>
            <div className="table-scroll card mt-2">
              <table className="w-full min-w-[720px] t-small">
                <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
                  <tr>{["기능", "모델", "예상 토큰 (보냄 / 받음)", "한 번에", "실측"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <Fragment key={it.id}>
                      <tr className="border-t border-n-100">
                        <td className="px-3 pt-2.5 align-top">
                          <span className={`mr-1.5 whitespace-nowrap rounded-full px-2 py-0.5 t-caption font-bold ${STATUS_STYLE[it.status]}`}>
                            {it.status}
                          </span>
                          <b>{it.label}</b>
                        </td>
                        <td className="px-3 pt-2.5 align-top t-caption text-[var(--text-soft)]">{it.model}</td>
                        <td className="px-3 pt-2.5 align-top whitespace-nowrap">
                          {isFree(it) ? "—" : `${tok(it.estIn)} / ${tok(it.estOut)}`}
                        </td>
                        <td className="px-3 pt-2.5 align-top whitespace-nowrap font-bold">{wonFine(krwPerCall(it))}</td>
                        <td className="px-3 pt-2.5 align-top t-caption whitespace-nowrap">
                          {it.measured
                            ? <b className="text-green-800">잼 · {it.measured.at}</b>
                            : it.model === NO_AI ? "—" : <span className="text-[var(--text-soft)]">아직 안 쟀음</span>}
                        </td>
                      </tr>
                      {/* 비고는 줄을 따로 준다 — 표를 옆으로 늘리면 폰에서 읽을 수가 없다 */}
                      <tr>
                        <td colSpan={5} className="px-3 pb-2.5 pt-1 t-caption text-[var(--text-soft)]">
                          <Emph text={it.note} />
                          <br />근거 — <Emph text={it.basis} />
                          <br />자리 — {it.where}
                          {it.measured && <><br />잰 법 — <Emph text={it.measured.how} /></>}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* ── 유료회원 1명당 월 얼마인가 ── */}
      <section className="card mt-8 p-5">
        <h2 className="t-body font-bold">유료회원 한 분이 한 달에 쓰시면 얼마인가</h2>
        <p className="mt-2 rounded-xl px-3 py-2 t-caption" style={{ background: "var(--n-50)" }}>
          🔴 <b>이 숫자는 «가정»입니다. 사실이 아닙니다.</b> 아직 유료회원이 없어 한 달에 얼마나
          쓰시는지 아무도 모릅니다. {ASSUMPTION_NOTE}
        </p>
        <div className="table-scroll mt-3">
          <table className="w-full min-w-[560px] t-small">
            <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
              <tr>{["기능", "상태", "월 횟수(가정)", "한 번에", "한 달"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.itemId} className="border-t border-n-100">
                  <td className="px-3 py-2">{m.label}<br /><span className="t-caption text-[var(--text-soft)]">{m.why}</span></td>
                  <td className="px-3 py-2">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 t-caption font-bold ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.perMonth}회</td>
                  <td className="px-3 py-2 whitespace-nowrap">{wonFine(m.each)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-bold">{wonFine(m.sum)}</td>
                </tr>
              ))}
              <tr className="border-t border-n-200">
                <td className="px-3 py-2 font-bold" colSpan={4}>한 분당 한 달 합계 (가정)</td>
                <td className="px-3 py-2 whitespace-nowrap font-bold">{wonFine(monthlySum)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 t-small">
          <li>
            · 월 요금 <b>{won(MONTHLY_PRICE)}</b> 중 <b>{(monthlySum / MONTHLY_PRICE * 100).toFixed(2)}%</b> 입니다 —
            위 네 기능을 <b>전부 열어도</b> 요금의 1%에 못 미칩니다.
          </li>
          <li>
            · 지금 <b>실제로 나가는 돈</b>은 가입 한 분당 약 <b>{wonFine(oneTime)}</b>, <b>그 한 번뿐</b>입니다.
            그 뒤로는 AI 를 부르는 자리가 없습니다.
          </li>
          <li>
            · 🔴 조심할 것은 <b>사진</b>입니다. 글 한 번이 몇 원인데 <b>사진 한 장이 그 15배쯤</b>입니다.
            여시더라도 <b>하루 몇 장</b>으로 막아 두셔야 합니다.
          </li>
          <li>
            · 숫자를 고치실 곳은 <b>한 군데</b>입니다 — <code>config/ai-cost.ts</code>.
            화면·계산이 전부 그 파일 하나를 봅니다.
          </li>
        </ul>
        <p className="mt-2 t-caption text-[var(--text-soft)]">{RATE_NOTE}</p>
      </section>

      {/* ── 어떻게 실측하나 ── */}
      <section className="card mt-8 p-5">
        <h2 className="t-body font-bold">어떻게 «실측»하나 — 한 줄이면 됩니다</h2>
        <p className="mt-2 t-small">
          위 표에서 <b>「아직 안 쟀음」</b>이라고 적힌 것은 <b>추정</b>입니다. 진짜 숫자로 바꾸는 방법은
          그 기능이 AI 를 부른 <b>바로 뒤에 한 줄</b>을 넣는 것입니다 —
          {" "}<code>recordAiUsage(주소, &quot;story_write&quot;, 모델, 응답)</code>.
          구글이 보내 준 응답 안에 <b>실제로 쓴 토큰 수가 이미 들어 있습니다.</b>
          그 줄이 그것을 주워 담아 위쪽 <b>영수증</b>에 쌓습니다.
        </p>
        <h3 className="mt-4 t-small font-bold">⚠ 지금 못 재고 있는 것 — 왜 못 재나</h3>
        <ul className="mt-1.5 space-y-1 t-caption text-[var(--text-soft)]">
          <li>· <b>업종 알아맞히기</b> — AI 를 부르기는 하는데, 그 응답이 영수증 적는 자리까지 넘어오지 않습니다. 넘겨 주기만 하면 바로 잽니다.</li>
          <li>· <b>「하는 일 한 줄」 예시</b> — 아직 <b>홈페이지가 만들어지기 «전»</b>이라 영수증을 붙일 곳이 없습니다. 만든 뒤에 옮겨 붙이는 장치가 필요합니다(아직 없습니다).</li>
          <li>· <b>이미지뱅크 사진</b> — 운영자가 손으로 돌리는 도구라 회원 홈페이지가 없습니다. 대신 <b>2026-09-06 에 실제로 재 두었습니다</b>(장당 1,120토큰).</li>
          <li>· <b>나머지 전부</b> — 기능 자체가 아직 없습니다. 만들 때 위 한 줄을 같이 넣으면 됩니다.</li>
        </ul>
        <p className="mt-3 t-caption text-[var(--text-soft)]">
          ⚠ 사이트 하나에 최근 <b>300건</b>까지 줄로 남기고, 넘치면 오래된 것을 <b>합계 한 줄로 접습니다.</b>
          숫자는 잃지 않고 줄 수만 줄어듭니다.
        </p>
      </section>
    </main>
  );
}
