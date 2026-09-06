"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BankRow } from "./ui";

/**
 * 빠른 검수 — 한 장씩 크게 보고 **키 하나로** 점수를 매긴다 (2026-09-06).
 *
 * 왜 만들었나: 격자 화면에서 한 장을 승인하고 점수까지 매기려면 세 번을 눌러야 한다
 * (승인 → 점수 열기 → 점수 고르기). 200장이면 600번이다.
 * 여기서는 **한 번**이면 끝나고 자동으로 다음 장으로 넘어간다.
 *
 * 키: 1=90점 · 2=70점 · 3=50점 · 0=거부 · ←→ 이동 · Esc 닫기
 * ⚠ 점수 키는 승인(quality_ok=true)까지 함께 처리한다. 매칭이 "점수 높은 순"이라
 *   승인만 하고 점수를 안 매기면 새 사진이 옛 사진과 같은 순위로 섞인다.
 * ⚠ 저장은 낙관적으로 화면을 먼저 넘기고 뒤에서 보낸다 — 200장을 넘기는 게 목적이라
 *   한 장마다 응답을 기다리면 느리다. 실패하면 그 장을 표시해 되돌아갈 수 있게 한다.
 */

const SCORES: Record<string, { score: number; ok: boolean; label: string }> = {
  "1": { score: 90, ok: true, label: "90점" },
  "2": { score: 70, ok: true, label: "70점" },
  "3": { score: 50, ok: true, label: "50점" },
  "0": { score: 30, ok: false, label: "거부" },
};

export function FastReview({ rows, onClose }: { rows: BankRow[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const cur = rows[i];
  const remaining = rows.length - Object.keys(done).length;

  const mark = useCallback((key: string) => {
    const s = SCORES[key];
    const row = rows[i];
    if (!s || !row) return;
    setDone((d) => ({ ...d, [row.id]: s.label }));
    setI((n) => Math.min(n + 1, rows.length)); // 먼저 넘긴다
    void fetch("/api/admin/bank", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, quality_ok: s.ok, quality_score: s.score }),
    }).then((r) => { if (!r.ok) setFailed((f) => [...f, row.id]); })
      .catch(() => setFailed((f) => [...f, row.id]));
  }, [i, rows]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight") return setI((n) => Math.min(n + 1, rows.length - 1));
      if (e.key === "ArrowLeft") return setI((n) => Math.max(n - 1, 0));
      if (e.key in SCORES) { e.preventDefault(); mark(e.key); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark, onClose, rows.length]);

  // 다음 두 장을 미리 받아 둔다 — 넘길 때마다 기다리면 속도가 안 난다
  useEffect(() => {
    for (const n of [i + 1, i + 2]) {
      const r = rows[n];
      if (r) { const img = new Image(); img.src = r.url; }
    }
  }, [i, rows]);

  if (!cur) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900/95 p-6 text-center text-white">
        <p className="text-[40px]">✓</p>
        <h2 className="mt-3 text-[22px] font-bold">이 목록을 다 봤습니다</h2>
        <p className="mt-2 text-[14px] text-white/70">{Object.keys(done).length}장 처리{failed.length ? ` · 저장 실패 ${failed.length}장` : ""}</p>
        <button type="button" onClick={onClose} className="mt-8 rounded-full bg-white px-6 py-3 text-[15px] font-bold text-neutral-900">
          닫고 목록 새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900/95 text-white">
      <div className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
        <span>{i + 1} / {rows.length} · 남은 {remaining}장{failed.length ? ` · ⚠ 저장 실패 ${failed.length}` : ""}</span>
        <span className="hidden text-white/60 sm:inline">
          <b>1</b> 90점 · <b>2</b> 70점 · <b>3</b> 50점 · <b>0</b> 거부 · <b>←→</b> 이동 · <b>Esc</b> 닫기
        </span>
        <button type="button" onClick={onClose} className="rounded-full border border-white/30 px-3 py-1 font-semibold">닫기</button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt="" className="max-h-full max-w-full object-contain" />
      </div>

      <p ref={liveRef} aria-live="polite" className="px-5 pt-2 text-center text-[12.5px] text-white/60">
        {cur.industry} · {cur.mood} · <b>{cur.role}</b> · {cur.width}×{cur.height}
        {done[cur.id] ? ` — ${done[cur.id]} 매김` : ""}
        {failed.includes(cur.id) ? " — ⚠ 저장 실패, 다시 눌러 주세요" : ""}
      </p>

      {/* 폰에서는 키보드가 없으니 버튼으로 — 한 번 누르면 똑같이 넘어간다 */}
      <div className="flex justify-center gap-2 px-5 pb-5 pt-3">
        {Object.entries(SCORES).map(([k, s]) => (
          <button key={k} type="button" onClick={() => mark(k)}
            className={`rounded-full px-5 py-3 text-[15px] font-bold ${s.ok ? "bg-white text-neutral-900" : "bg-red-500 text-white"}`}>
            {s.label}<span className="ml-1.5 text-[11px] opacity-50">{k}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
