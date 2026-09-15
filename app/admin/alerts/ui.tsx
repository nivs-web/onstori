"use client";

import { useState } from "react";
import type { AdminConfig } from "@/lib/admin-config";

type SiteRow = { slug: string; name: string; phone: string; email: string; dday: string; alertOff: boolean };

/**
 * ★★★ **긴급 문자·메일 발송 + 만료 예고 설정.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「어드민에 **「긴급문자발송」**이라는 항목을 추가하고, **중지하기·실행하기,
 *   사이트별로 켜고 끄게** 만들어. … 가끔 내가 사장님한테 전달할 광고나 소식이나 홈페이지 변경
 *   소식이 있으면 클릭해서 **사장님에게 바로 문자도 보낼 수 있도록** 하고 …
 *   **기본으로는 7일 전 3일 전 1일 전 문자 발송이 꺼져 있는 걸로** 세팅하고, 켤 수 있게 만들어.」
 *
 * 🔴 **문턱 셋. 하나라도 빼면 손님·사장님께 잘못 나간다:**
 *   ① **기본이 꺼짐.** 켜는 것은 대표님 손이다
 *   ② 즉시 발송은 **「몇 명에게 갑니다」를 먼저 세어 보여 준다**(미리보기)
 *   ③ 보내기 전에 **「보냅니다」를 손으로 타이핑**해야 버튼이 열린다
 *
 * ⚠ 문자는 **건당 약 20원**이다. 금액이 작아도 **건수는 우리가 못 막는다** — 그래서 하루 상한이 있다.
 */
export function AlertsUi({ initial, sites }: { initial: AdminConfig; sites: SiteRow[] }) {
  const [cfg, setCfg] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(patch: Partial<AdminConfig>) {
    setBusy(true); setMsg(""); setErr("");
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(String(d.error ?? `실패했어요 (${r.status})`)); return; }
      setMsg("저장했습니다.");
    } finally { setBusy(false); }
  }

  const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-n-100 py-3">
      <span>
        <b className="t-small">{label}</b>
        {sub && <span className="block t-caption text-[var(--text-soft)]">{sub}</span>}
      </span>
      <span
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className="relative mt-0.5 inline-block shrink-0"
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: on ? "var(--green)" : "var(--n-300)",
          transition: "background .15s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20,
          borderRadius: "50%", background: "#fff", transition: "left .15s",
        }} />
      </span>
    </label>
  );

  return (
    <div className="mt-6 space-y-6">
      {/* ───────── ① 만료 예고 ───────── */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-body font-bold">무료 기간 만료 예고</h2>
          <span className="t-small font-bold" style={{ color: cfg.expiryAlertOn ? "var(--green)" : "var(--danger)" }}>
            {cfg.expiryAlertOn ? "● 켜짐 — 나갑니다" : "● 꺼짐 — 한 통도 안 나갑니다"}
          </span>
        </div>
        <p className="mt-1 t-small text-[var(--text-soft)]">
          무료 기간이 끝나 가는 사장님께 미리 알려 드립니다. <b>지금은 꺼져 있는 것이 기본</b>입니다.
        </p>

        <Toggle
          on={cfg.expiryAlertOn}
          onChange={(v) => save({ expiryAlertOn: v })}
          label="자동으로 만료 예고 보내기"
          sub="켜는 순간부터 아래 날짜에 맞춰 나갑니다. 끄면 그 자리에서 멈춥니다."
        />
        <Toggle on={cfg.expiryBySms} onChange={(v) => save({ expiryBySms: v })}
          label="문자로 보내기" sub="건당 약 20원이 듭니다" />
        <Toggle on={cfg.expiryByEmail} onChange={(v) => save({ expiryByEmail: v })}
          label="메일로 보내기" sub="거의 무료입니다. 먼저 메일을 보내고 답이 없으면 문자를 보내는 방식을 권합니다" />

        <div className="mt-4">
          <p className="t-small font-bold">며칠 전에 보낼까요</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[14, 10, 7, 5, 3, 1].map((d) => {
              const on = cfg.expiryAlertDays.includes(d);
              return (
                <button key={d} type="button"
                  onClick={() => save({ expiryAlertDays: on ? cfg.expiryAlertDays.filter((x) => x !== d) : [...cfg.expiryAlertDays, d] })}
                  className="tap-row rounded-full border px-3 py-1 t-small"
                  style={{ borderColor: on ? "var(--green)" : "var(--n-300)", background: on ? "var(--green-50)" : "transparent", fontWeight: on ? 700 : 400 }}>
                  D-{d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="t-small font-bold">보낼 내용</p>
          <textarea className="field mt-2" rows={4} maxLength={500}
            value={cfg.expiryText}
            onChange={(e) => setCfg({ ...cfg, expiryText: e.target.value })}
            onBlur={() => save({ expiryText: cfg.expiryText })} />
          <p className="mt-1 t-caption text-[var(--text-soft)}">
            <b>{"{남은일}"}</b> · <b>{"{주소}"}</b> · <b>{"{상호}"}</b> · <b>{"{기간}"}</b> 는 자동으로 채워집니다.
            그 글자는 지우지 마시고 나머지만 고치세요.
          </p>
        </div>

        <div className="mt-4">
          <p className="t-small font-bold">하루 최대 문자 건수</p>
          <input type="number" className="field mt-2" style={{ maxWidth: 160 }}
            value={cfg.smsDailyCap} min={0} max={5000}
            onChange={(e) => setCfg({ ...cfg, smsDailyCap: Number(e.target.value) })}
            onBlur={() => save({ smsDailyCap: cfg.smsDailyCap })} />
          <p className="mt-1 t-caption text-[var(--text-soft)]">
            🔴 <b>마지막 방어선입니다.</b> 금액이 작아도 건수는 우리가 못 막습니다. 넘으면 다음 날로 미룹니다.
          </p>
        </div>

        {msg && <p className="mt-3 t-small" style={{ color: "var(--green)" }}>{msg}</p>}
        {err && <p className="mt-3 t-small font-semibold text-danger">{err}</p>}
        {busy && <p className="mt-3 t-caption text-[var(--text-soft)]">저장하는 중…</p>}
      </section>

      {/* ───────── ② 즉시 발송 ───────── */}
      <SendNow sites={sites} />

      {/* ───────── ③ 사이트별 ───────── */}
      <section className="card p-5">
        <h2 className="t-body font-bold">사이트별 받기/끄기</h2>
        <p className="mt-1 t-small text-[var(--text-soft)]">
          특정 사장님께만 안 보내고 싶을 때 여기서 끕니다. <b>끈 곳은 위 설정이 켜져 있어도 안 나갑니다.</b>
        </p>
        <div className="table-scroll mt-3">
          <table className="w-full min-w-[620px] t-small">
            <thead className="bg-n-50 t-caption text-[var(--text-soft)]">
              <tr>{["주소", "상호", "연락처", "무료 남은", "알림"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {sites.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--text-soft)]">사이트가 없습니다</td></tr>}
              {sites.map((s) => <SiteToggle key={s.slug} s={s} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** 한 사이트의 알림 켜기/끄기 — 서버가 `settings.alertOff` 를 뒤집는다 */
function SiteToggle({ s }: { s: SiteRow }) {
  const [off, setOff] = useState(s.alertOff);
  const [busy, setBusy] = useState(false);
  return (
    <tr className="border-t border-n-100">
      <td className="px-3 py-2"><a className="underline" href={`/${s.slug}`} target="_blank">/{s.slug}</a></td>
      <td className="px-3 py-2">{s.name}</td>
      <td className="px-3 py-2 t-caption">{s.phone || "—"}<br />{s.email || "—"}</td>
      <td className="px-3 py-2">{s.dday}</td>
      <td className="px-3 py-2">
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            const next = !off;
            const r = await fetch("/api/admin/alert-send", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "toggle", slug: s.slug, off: next }),
            });
            if (r.ok) setOff(next);
            setBusy(false);
          }}
          className="rounded-full border px-2.5 py-1 t-caption font-semibold"
          style={{ borderColor: off ? "var(--danger)" : "var(--green)", color: off ? "var(--danger)" : "var(--green)" }}>
          {off ? "꺼짐" : "켜짐"}
        </button>
      </td>
    </tr>
  );
}

/** 즉시 발송 — 미리보기 → 타이핑 확인 → 보내기 */
function SendNow({ sites }: { sites: SiteRow[] }) {
  const [text, setText] = useState("");
  const [bySms, setBySms] = useState(true);
  const [byEmail, setByEmail] = useState(true);
  const [only, setOnly] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");

  const targets = only ? sites.filter((s) => s.slug === only) : sites.filter((s) => !s.alertOff);
  const smsN = bySms ? targets.filter((s) => s.phone).length : 0;
  const mailN = byEmail ? targets.filter((s) => s.email).length : 0;
  const ready = text.trim().length >= 5 && typed.trim() === "보냅니다" && (smsN + mailN) > 0 && !busy;

  async function go() {
    setBusy(true); setOut("");
    try {
      const r = await fetch("/api/admin/alert-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "send", text, bySms, byEmail, slug: only || undefined, confirm: typed }),
      });
      const d = await r.json().catch(() => ({}));
      setOut(r.ok
        ? `보냈습니다 — 문자 ${d.sms ?? 0}통 · 메일 ${d.email ?? 0}통${d.failed ? ` · 실패 ${d.failed}건` : ""}`
        : `실패: ${d.error ?? r.status}`);
      if (r.ok) { setTyped(""); }
    } finally { setBusy(false); }
  }

  return (
    <section className="card p-5">
      <h2 className="t-body font-bold">지금 바로 보내기</h2>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        홈페이지 변경 소식·안내처럼 <b>지금 알려야 하는 것</b>을 보냅니다. 광고·홍보 문구는 넣지 마십시오.
      </p>

      <textarea className="field mt-3" rows={4} maxLength={500} value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: [온스토리] 홈페이지 주소가 바뀌었습니다. 확인 부탁드립니다 — https://onstori.com/…" />

      <div className="mt-3 flex flex-wrap items-center gap-3 t-small">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={bySms} onChange={(e) => setBySms(e.target.checked)} /> 문자</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={byEmail} onChange={(e) => setByEmail(e.target.checked)} /> 메일</label>
        <select className="field" style={{ maxWidth: 240 }} value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="">알림 켜진 사이트 전체</option>
          {sites.map((s) => <option key={s.slug} value={s.slug}>{s.name} (/{s.slug})</option>)}
        </select>
      </div>

      {/* 🔴 문턱 ② — 몇 명에게 가는지 «먼저» 센다 */}
      <p className="mt-3 rounded-xl px-4 py-3 t-small" style={{ background: smsN + mailN ? "var(--green-50)" : "var(--n-50)" }}>
        <b>문자 {smsN}통 · 메일 {mailN}통</b>이 나갑니다.
        {smsN > 0 && <> 문자 비용은 <b>약 {(smsN * 20).toLocaleString()}원</b>(건당 20원 추정)입니다.</>}
      </p>

      {/* 🔴 문턱 ③ — 타이핑해야 열린다 */}
      <input className="field mt-3" value={typed} onChange={(e) => setTyped(e.target.value)}
        placeholder="확인: 「보냅니다」 를 그대로 입력" />

      <button type="button" onClick={go} disabled={!ready}
        className="btn btn-primary mt-3 disabled:opacity-40">
        {busy ? "보내는 중…" : "지금 보내기"}
      </button>
      {out && <p className="mt-3 t-small font-semibold">{out}</p>}
    </section>
  );
}
