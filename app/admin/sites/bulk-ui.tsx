"use client";

import { useState } from "react";
import { ChangeSlug } from "./slug-ui";
import { DeleteSite } from "./delete-ui";

export type BulkRow = {
  slug: string; name: string; industry: string;
  live: boolean; stateLabel: string; stateDetail: string;
  member: string; paid: boolean; byHand: boolean; dday: string; urgent: boolean;
  trialEnds: string;
  phone: string; email: string; ownerId: string | null;
};

/**
 * ★★★ **사이트 관리 표 — 체크박스 · 일괄 처리 · 사장님 정보.** (2026-09-15 대표님 지시)
 *
 * ★ 대표님이 정하신 셋(결정 3건):
 *   ① 일괄 **「유료 전환」은 뺀다** → 대신 **이벤트 기간 주기**
 *   ② 만료 예고 문자는 **켜되 기본은 꺼짐** (그 설정은 `/admin/alerts`)
 *   ③ 「사장님 정보」는 **회원 목록으로 이동** · 단 **전화번호는 표에 바로**
 *
 * ⚠ **되돌리기 어려운 것은 한 번 더 묻는다.** 폐쇄·이벤트는 바로 실행하지 않고
 *   「몇 곳에 적용됩니다」를 먼저 세어 보여 준다.
 */
export function SitesTable({ rows }: { rows: BulkRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [openEvent, setOpenEvent] = useState(false);
  /** 등급 바꾸기 칸 (2026-09-17 지시 [23]) — 「올리기」인지 「내리기」인지 */
  const [openGrade, setOpenGrade] = useState<null | "up" | "down">(null);
  /** 내릴 때 어디로 — 기본은 무료체험(지시 3번) */
  const [downTo, setDownTo] = useState<"trial" | "suspended">("trial");
  const [months, setMonths] = useState(3);
  const [reason, setReason] = useState("");

  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.slug));
  const toggle = (slug: string) =>
    setSel((p) => { const n = new Set(p); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  async function run(mode: "close" | "open" | "event" | "grade", to?: string) {
    const slugs = [...sel];
    if (!slugs.length) return;
    /* 🔴 **등급은 한 번에 하나씩**(지시 6번). 서버도 막지만 화면에서 먼저 말해 준다 —
       200곳을 고른 채 눌렀다가 서버 오류만 보는 것보다 낫다. */
    if (mode === "grade" && slugs.length !== 1) {
      setErr("등급은 한 번에 한 곳만 바꿀 수 있어요. 하나만 고르고 다시 눌러 주세요.");
      return;
    }
    /* 🔴🔴 **2026-09-17 실측으로 잡은 버그** — 여기에 `mode !== "event"` 라고만 적혀 있어서
         **등급 바꾸기도 이 확인창에 걸렸다.** 화면에는 「1곳을 «다시 열기» 합니다 —
         폐쇄해도 자료는 지워지지 않고…」가 떴다. **등급과 아무 상관 없는 말**이다.
       ⇒ 등급은 **등급의 말로** 물어본다. 「무엇을 누르는지」와 「무엇이 뜨는지」가 달라선 안 된다. */
    if (mode === "grade") {
      const one = slugs[0];
      const q = to === "active"
        ? `「${one}」 을 정회원으로 올립니다.

결제 없이 올리는 것이라 매출로는 잡지 않습니다.
계속할까요?`
        : `「${one}」 을 ${to === "suspended" ? "폐쇄(손님에게 안 보임)" : "무료회원(체험)"} 으로 내립니다.

계속할까요?`;
      if (!confirm(q)) return;
    } else if (mode !== "event") {
      const word = mode === "close" ? "폐쇄" : "다시 열기";
      if (!confirm(`${slugs.length}곳을 ${word} 합니다.\n\n폐쇄해도 자료는 지워지지 않고, 손님에게만 안 보입니다.\n계속할까요?`)) return;
    }
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/site-bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, slugs, months, reason, to }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(String(d.error ?? `실패했어요 (${r.status})`)); return; }
      setMsg(mode === "grade"
        ? `등급을 바꿨습니다 (${d.from} → ${d.to}). 새로고침하면 표에 반영됩니다.`
        : `${d.done}곳에 적용했습니다. 새로고침하면 표에 반영됩니다.`);
      setSel(new Set()); setOpenEvent(false); setOpenGrade(null); setReason("");
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* ── 고른 것이 있을 때만 뜨는 막대 ── */}
      {sel.size > 0 && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 p-4" style={{ borderColor: "var(--green)", borderWidth: 2 }}>
          <b className="t-small">{sel.size}곳 선택됨</b>
          <button type="button" disabled={busy} onClick={() => run("close")}
            className="rounded-full border px-3 py-1 t-small font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>폐쇄하기</button>
          <button type="button" disabled={busy} onClick={() => run("open")}
            className="rounded-full border px-3 py-1 t-small font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}>다시 열기</button>
          <button type="button" disabled={busy} onClick={() => setOpenEvent((v) => !v)}
            className="rounded-full border border-n-300 px-3 py-1 t-small font-semibold disabled:opacity-40">
            이벤트 기간 주기
          </button>
          {/* ★★ 2026-09-17 대표님 지시 [23] — **등급 올리기·내리기.**
              대표님: 「정회원으로 올려줬는데 **무료회원으로 다시 바꾸는 게 없어.**」
              🔴 한 번에 **한 곳만** 바꿉니다. 200곳을 실수로 정회원으로 만들면 되돌릴 수 없습니다. */}
          <button type="button" disabled={busy} onClick={() => setOpenGrade((v) => (v === "up" ? null : "up"))}
            className="rounded-full border px-3 py-1 t-small font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--green)", color: "var(--green)" }}>⬆ 정회원으로 올리기</button>
          <button type="button" disabled={busy} onClick={() => setOpenGrade((v) => (v === "down" ? null : "down"))}
            className="rounded-full border border-n-300 px-3 py-1 t-small font-semibold disabled:opacity-40">
            ⬇ 무료회원으로 내리기
          </button>
          <button type="button" onClick={() => setSel(new Set())} className="t-caption underline text-[var(--text-soft)]">선택 해제</button>

          {openGrade && (
            <div className="w-full border-t border-n-200 pt-3">
              <p className="t-small font-bold">
                {openGrade === "up" ? "정회원으로 올립니다" : "정회원에서 내립니다"}
              </p>
              {openGrade === "up" ? (
                <p className="mt-1 t-caption text-[var(--text-soft)]">
                  화면에서는 <b>결제하신 분과 똑같이</b> 보입니다. 다만 <b>돈을 받은 것으로 잡지 않습니다</b> —
                  「손으로 올림」 표시가 따로 남아 매출 숫자가 흐려지지 않습니다.
                </p>
              ) : (
                <p className="mt-1 t-caption text-[var(--text-soft)]">
                  🔴 <b>자동결제가 걸려 있으면 막습니다.</b> 그냥 내리면 <b>다음 달에 또 결제됩니다</b> —
                  먼저 해지하셔야 합니다.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {openGrade === "down" && (
                  <label className="t-small">어디로
                    <select value={downTo} onChange={(e) => setDownTo(e.target.value as "trial" | "suspended")}
                      className="field ml-2" style={{ width: 150, display: "inline-block" }}>
                      <option value="trial">무료회원(체험)</option>
                      <option value="suspended">폐쇄(손님에게 안 보임)</option>
                    </select>
                  </label>
                )}
                <input className="field min-w-0 flex-1" value={reason} maxLength={120}
                  placeholder={openGrade === "up"
                    ? "왜 올리나요? 예) 우리 회사 사이트 · 파트너 계약 · 오프라인 입금"
                    : "왜 내리나요? 예) 해지 요청 · 이벤트 종료 · 실수로 올림"}
                  onChange={(e) => setReason(e.target.value)} />
                <button type="button"
                  disabled={busy || reason.trim().length < 2 || sel.size !== 1}
                  onClick={() => run("grade", openGrade === "up" ? "active" : downTo)}
                  className="btn btn-primary !py-1.5 !t-small disabled:opacity-40">
                  {busy ? "바꾸는 중…" : sel.size !== 1 ? "한 곳만 고르세요" : openGrade === "up" ? "정회원으로 올리기" : "내리기"}
                </button>
              </div>
            </div>
          )}

          {openEvent && (
            <div className="w-full border-t border-n-200 pt-3">
              <p className="t-small font-bold">무료 기간을 늘려 드립니다</p>
              <p className="mt-1 t-caption text-[var(--text-soft)]">
                남은 날이 있으면 <b>그 뒤에 이어서</b> 더합니다. 이미 끝난 분은 오늘부터 셉니다.
                <b> 「유료회원」으로 바꾸지 않습니다</b> — 결제 기록이 없는 유료회원이 생기면 매출 숫자가 틀어집니다.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="t-small">개월 수
                  <input type="number" min={1} max={36} value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="field ml-2" style={{ width: 90, display: "inline-block" }} />
                </label>
                <input className="field min-w-0 flex-1" value={reason} maxLength={120}
                  placeholder="왜 드리나요? 예) 지인 홍보 · 불만 응대 · 베타 파트너"
                  onChange={(e) => setReason(e.target.value)} />
                <button type="button" disabled={busy || reason.trim().length < 2} onClick={() => run("event")}
                  className="btn btn-primary !py-1.5 !t-small disabled:opacity-40">
                  {busy ? "적용 중…" : `${sel.size}곳에 ${months}개월 주기`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <p className="mt-3 t-small" style={{ color: "var(--green)" }}>{msg}</p>}
      {err && <p className="mt-3 t-small font-semibold text-danger">{err}</p>}

      <div className="table-scroll card mt-4">
        <table className="w-full min-w-[900px] t-small">
          <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={allOn} aria-label="전체 선택"
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.slug)) : new Set())} />
              </th>
              {["상태", "회원", "무료 남은", "주소", "상호", "연락처", "사장님", "지우기"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--text-soft)]">여기에 해당하는 사이트가 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.slug} className="border-t border-n-100" style={{ background: sel.has(r.slug) ? "var(--green-50)" : undefined }}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={sel.has(r.slug)} onChange={() => toggle(r.slug)} aria-label={`${r.name} 선택`} />
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {/* 색만으로 뜻을 나르지 않는다 — 글자를 함께 둔다 */}
                    <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: r.live ? "var(--green)" : "var(--danger)" }} />
                    <b style={{ color: r.live ? "var(--green)" : "var(--danger)" }}>{r.stateLabel}</b>
                    <span className="t-caption text-[var(--text-soft)]">{r.stateDetail}</span>
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {/* 손으로 올린 정회원은 **초록으로 칠하지 않는다** — 초록은 「돈이 들어왔다」는 뜻이다 */}
                  <b style={{ color: r.paid && !r.byHand ? "var(--green)" : undefined }}
                    title={r.byHand ? "결제 없이 어드민에서 올린 정회원입니다. 매출로 잡히지 않습니다." : undefined}>
                    {r.member}
                  </b>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span style={{ color: r.urgent ? "var(--danger)" : "var(--text-soft)", fontWeight: r.urgent ? 700 : 400 }}>{r.dday}</span>
                </td>
                <td className="px-3 py-2">
                  <a className="underline underline-offset-2"
                    style={{ color: r.live ? "var(--green-700, #15803d)" : "var(--danger)" }}
                    href={r.live ? `/${r.slug}` : `/x/${r.slug}`} target="_blank">
                    {r.live ? `/${r.slug}` : `/x/${r.slug}`}
                  </a>
                  <div className="mt-0.5"><ChangeSlug slug={r.slug} businessName={r.name} /></div>
                </td>
                <td className="px-3 py-2">{r.name}<div className="t-caption text-[var(--text-soft)]">{r.industry}</div></td>
                {/* ★ 대표님 결정 ③ — 전화번호는 «표에 바로». 급한 것이 눈앞에 있어야 한다 */}
                <td className="px-3 py-2 whitespace-nowrap t-caption">
                  {r.phone ? <a className="underline" href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`}>{r.phone}</a> : "—"}
                </td>
                {/* ★ 나머지(메일·결제·동의)는 회원 목록으로 «이동». 같은 정보를 두 곳에 그리면 한쪽이 낡는다 */}
                <td className="px-3 py-2 whitespace-nowrap">
                  <a className="t-caption underline text-[var(--text-soft)]"
                    href={`/admin/members?q=${encodeURIComponent(r.email || r.name)}`}>사장님 정보</a>
                </td>
                <td className="px-3 py-2"><DeleteSite slug={r.slug} businessName={r.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
