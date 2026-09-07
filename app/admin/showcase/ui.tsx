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

  /** 수동 재촬영 — 첫 페이지 테마 카드 사진을 다시 찍는다.
      크롬이 없는 서버에서는 이유를 그대로 보여준다(조용히 실패하지 않는다). */
  const [shooting, setShooting] = useState("");
  async function reshoot(slug: string) {
    setShooting(slug); setMsg("");
    const r = await fetch("/api/admin/site-shot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
    const d = await r.json().catch(() => ({}));
    setShooting("");
    /* ⚠ 서버(Vercel)에는 크롬이 없다 — 실패가 아니라 "촬영 대기"다.
       @sparticuz/chromium 을 얹지 않기로 했다(2026-09-07 회장님): 배포가 무거워지고
       관리 지점이 는다. 고객 100곳을 넘으면 그때 다시 본다. */
    setMsg(r.ok
      ? `/${slug} 사진을 다시 찍었어요`
      : d.error === "no-browser"
        ? `/${slug} 촬영 대기 — 서버에서는 못 찍어요. 사무실 PC 에서 scripts/site-shots.ts --slug ${slug} 로 돌리세요.`
        : `/${slug} 재촬영 실패 — ${d.error}`);
  }

  async function remove(id: string, slug: string) {
    if (!confirm(`/${slug} 을(를) 포트폴리오에서 뺄까요? (사이트 자체는 그대로)`)) return;
    const r = await fetch("/api/admin/showcase", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (r.ok) setRows((rs) => rs.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-n-200 p-4">
        <p className="t-small font-semibold">사이트 추가</p>
        <div className="mt-2 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="https://onstori.com/niv 또는 niv"
            className="w-full rounded-xl border border-n-200 px-3.5 py-2.5 t-small outline-none focus:border-green-700" />
          <button onClick={add} disabled={busy || !url}
            className="whitespace-nowrap rounded-full bg-green-700 px-5 t-small font-semibold text-white disabled:opacity-40">
            {busy ? "확인 중…" : "등록"}
          </button>
        </div>
        {msg && <p className="mt-2 t-caption text-[var(--text-soft)]">{msg}</p>}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-n-200 p-3">
            <a href={`/${r.slug}`} target="_blank" className="font-mono t-small font-semibold text-green-700">/{r.slug}</a>
            <select value={r.tag} onChange={(e) => patch(r.id, { tag: e.target.value })}
              className="rounded-full border border-n-300 px-2.5 py-1 t-caption">
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 t-caption text-[var(--text-soft)]">
              순서 <input type="number" value={r.sort} onChange={(e) => patch(r.id, { sort: Number(e.target.value) })}
                className="w-16 rounded-lg border border-n-300 px-2 py-1" />
            </label>
            <button onClick={() => patch(r.id, { featured: !r.featured })}
              className={`rounded-full px-2.5 py-1 t-caption font-semibold ${r.featured ? "bg-accent text-accent-ink" : "border border-n-300 text-[var(--text-soft)]"}`}>
              ★ 추천
            </button>
            <button onClick={() => reshoot(r.slug)} disabled={shooting === r.slug}
              className="ml-auto rounded-full border border-n-300 px-2.5 py-1 t-caption font-semibold disabled:opacity-50">
              {shooting === r.slug ? "찍는 중…" : "사진 다시 찍기"}
            </button>
            <button onClick={() => remove(r.id, r.slug)} className="rounded-full border border-n-300 px-2.5 py-1 t-caption text-[var(--text-soft)]">빼기</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
