"use client";

import { useState } from "react";
import type { SectionRow } from "@/lib/page-sections";

/** 섹션 토글 — 켜고 끄기만 한다. 내용 편집은 범위 밖(회장님 지시). */
export function SectionToggles({ rows }: { rows: SectionRow[] }) {
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function toggle(id: string, visible: boolean) {
    setBusy(id); setMsg("");
    try {
      const r = await fetch("/api/admin/page-sections", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visible }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "저장 실패");
      setList((l) => l.map((x) => (x.id === id ? { ...x, visible } : x)));
      setMsg("저장했어요 — 첫 페이지를 새로고침하면 반영됩니다");
    } catch (e) { setMsg(e instanceof Error ? e.message : "저장 실패"); }
    setBusy("");
  }

  return (
    <>
      {msg && <p className="mt-3 t-small text-green-700">{msg}</p>}
      <ul className="mt-4 divide-y divide-n-100 rounded-2xl border border-n-200 bg-white">
        {list.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="t-small font-semibold">{s.label}</p>
              <p className="t-caption text-[var(--text-soft)]">{s.id}</p>
            </div>
            <button type="button" disabled={busy === s.id} onClick={() => toggle(s.id, !s.visible)}
              className={`rounded-full px-4 py-1.5 t-caption font-bold disabled:opacity-50 ${s.visible ? "bg-green-700 text-white" : "border border-n-300 text-[var(--text-soft)]"}`}>
              {busy === s.id ? "…" : s.visible ? "보임" : "숨김"}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-8 text-center t-small text-[var(--text-soft)]">섹션 목록이 비어 있어요 — 마이그레이션이 아직 안 올라갔을 수 있습니다.</li>}
      </ul>
    </>
  );
}
