"use client";

import { useState } from "react";
import type { AdminConfig } from "@/lib/admin-config";

/**
 * 「카피 관리」 편집기 — 손님이 보는 **핵심 문구**를 대표님이 직접 고치는 곳.
 * (2026-09-15 대표님 지시)
 *
 * ⚠ **저장 전까지는 코드의 기본값이 쓰인다.** 한 번이라도 저장하시면 그 값이 이긴다.
 *   그래서 「지금 화면에 나가는 글자」를 위에 그대로 보여 준다 — 무엇이 이기고 있는지 보이게.
 */
export function CopyEditor({ initial, fromDefault }: { initial: AdminConfig; fromDefault: boolean }) {
  const [sns, setSns] = useState(initial.snsLine);
  const [copyright, setCopyright] = useState(initial.copyright);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dirty = sns !== initial.snsLine || copyright !== initial.copyright;

  async function save() {
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snsLine: sns, copyright }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(String(d.error ?? `실패했어요 (${r.status})`)); return; }
      setMsg("저장했습니다. 첫 페이지에 바로 반영됩니다.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="card p-5">
        <h2 className="t-body font-bold">SNS 채널 문구</h2>
        <p className="mt-1 t-small text-[var(--text-soft)]">
          온스토리 <b>전체 홈페이지의 핵심 문구</b>입니다. 채널이 열릴 때마다 여기서 「(준비 중)」만 빼시면 됩니다.
        </p>
        {fromDefault && (
          <p className="mt-2 rounded-lg px-3 py-2 t-caption" style={{ background: "var(--n-50)" }}>
            아직 한 번도 저장하지 않으셨습니다 — 지금은 <b>코드의 기본값</b>이 나가고 있습니다.
            한 번 저장하시면 그 뒤로는 <b>여기 적은 글자가 이깁니다.</b>
          </p>
        )}
        <textarea
          className="field mt-3"
          rows={3}
          maxLength={300}
          value={sns}
          onChange={(e) => setSns(e.target.value)}
        />
        <p className="mt-1 t-caption text-[var(--text-soft)]">
          예) 유튜브 쇼츠(준비 중) · 인스타 릴스 · 틱톡 · 쓰레드(준비 중) · X 트위터(준비 중) · 페이스북(준비 중)
        </p>
      </section>

      <section className="card p-5">
        <h2 className="t-body font-bold">저작권 문구</h2>
        <p className="mt-1 t-small text-[var(--text-soft)]">사장님 홈페이지 맨 아래에 붙는 한 줄입니다.</p>
        <input className="field mt-3" maxLength={80} value={copyright} onChange={(e) => setCopyright(e.target.value)} />
      </section>

      <div className="flex items-center" style={{ gap: "var(--s-3)" }}>
        <button type="button" onClick={save} disabled={!dirty || busy}
          className="btn btn-primary disabled:opacity-40">
          {busy ? "저장하는 중…" : "저장"}
        </button>
        {!dirty && <span className="t-caption text-[var(--text-soft)]">바뀐 것이 없습니다</span>}
      </div>
      {msg && <p className="t-small" style={{ color: "var(--green)" }}>{msg}</p>}
      {err && <p className="t-small font-semibold text-danger">{err}</p>}
    </div>
  );
}
