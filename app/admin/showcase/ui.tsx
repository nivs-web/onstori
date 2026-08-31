"use client";

import { useState } from "react";
import { PORTFOLIO_TABS } from "@/config/industries";

type Row = { id: string; slug: string; tag: string; sort: number; featured: boolean };
const TAGS = PORTFOLIO_TABS.filter((t) => t !== "전체");

export function ShowcaseManager({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function add() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/showcase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error); return; }
    setMsg(`등록: ${d.businessName} (/${d.slug} · ${d.tag})`);
    setUrl("");
    location.reload();
  }

  async function patch(id: string, p: Partial<Row>) {
    const r = await fetch("/api/admin/showcase", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...p }) });
    if (r.ok) setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  async function remove(id: string, slug: string) {
    if (!confirm(`/${slug} 을(를) 포트폴리오에서 뺄까요? (사이트 자체는 그대로)`)) return;
    const r = await fetch("/api/admin/showcase", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (r.ok) setRows((rs) => rs.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-neutral-200 p-4">
        <p className="text-sm font-semibold">사이트 추가</p>
        <div className="mt-2 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="https://onstori.com/niv 또는 niv"
            className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600" />
          <button onClick={add} disabled={busy || !url}
            className="whitespace-nowrap rounded-full bg-blue-700 px-5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? "확인 중…" : "등록"}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-neutral-500">{msg}</p>}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-3">
            <a href={`/${r.slug}`} target="_blank" className="font-mono text-sm font-semibold text-blue-700">/{r.slug}</a>
            <select value={r.tag} onChange={(e) => patch(r.id, { tag: e.target.value })}
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs">
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-500">
              순서 <input type="number" value={r.sort} onChange={(e) => patch(r.id, { sort: Number(e.target.value) })}
                className="w-16 rounded-lg border border-neutral-300 px-2 py-1" />
            </label>
            <button onClick={() => patch(r.id, { featured: !r.featured })}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.featured ? "bg-amber-400 text-amber-950" : "border border-neutral-300 text-neutral-400"}`}>
              ★ 추천
            </button>
            <button onClick={() => remove(r.id, r.slug)} className="ml-auto rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-400">빼기</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
