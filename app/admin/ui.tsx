"use client";

import { useState } from "react";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [err, setErr] = useState(false);
  async function submit() {
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (r.ok) location.reload();
    else setErr(true);
  }
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-bold">운영자 인증</h1>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-3" placeholder="ADMIN KEY" />
      {err && <p className="mt-2 text-sm text-red-500">키가 올바르지 않아요</p>}
      <button onClick={submit} className="mt-4 rounded-full bg-blue-700 py-3 font-semibold text-white">입장</button>
    </main>
  );
}

export function BankCardActions({ id, ok, score }: { id: string; ok: boolean | null; score: number }) {
  const [state, setState] = useState<{ ok: boolean | null; score: number }>({ ok, score });
  const [busy, setBusy] = useState(false);
  async function patch(p: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch("/api/admin/bank", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...p }) });
    if (r.ok) setState((s) => ({ ...s, ...(p as typeof state) }));
    setBusy(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <button disabled={busy} onClick={() => patch({ quality_ok: true })}
        className={`rounded-full px-2.5 py-1 font-semibold ${state.ok === true ? "bg-green-600 text-white" : "border border-neutral-300"}`}>승인</button>
      <button disabled={busy} onClick={() => patch({ quality_ok: false })}
        className={`rounded-full px-2.5 py-1 font-semibold ${state.ok === false ? "bg-red-500 text-white" : "border border-neutral-300"}`}>거부</button>
      <select disabled={busy} value={state.score} onChange={(e) => patch({ quality_score: Number(e.target.value) })}
        className="rounded-full border border-neutral-300 px-2 py-1">
        {[90, 70, 50, 30].map((v) => <option key={v} value={v}>{v}점</option>)}
      </select>
      <button disabled={busy} onClick={() => { if (confirm("이미지를 목록에서 제거할까요?")) patch({ deleted: true, quality_ok: false }); }}
        className="rounded-full border border-neutral-300 px-2.5 py-1 text-neutral-400">삭제</button>
    </div>
  );
}
