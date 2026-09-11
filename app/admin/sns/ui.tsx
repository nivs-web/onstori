"use client";

import { useEffect, useState } from "react";

type Row = {
  provider: string; name: string;
  published: number; failed: number; inFlight: number; published30: number;
  estUsd: number | null;
};

/**
 * ⚠ 숫자를 «사실»과 «추정»으로 갈라 적는다. 추정치를 사실처럼 보여주면
 *   회장님이 그 숫자로 판단하시게 된다 — 그게 더 위험하다.
 */
export function SnsUsage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/sns-usage", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { rows?: Row[]; tableMissing?: boolean; error?: string };
        if (!r.ok) { setErr(d.error ?? `불러오지 못했어요 (${r.status})`); setRows([]); return; }
        setRows(d.rows ?? []);
        setTableMissing(!!d.tableMissing);
      } catch { setErr("연결이 끊겼어요."); setRows([]); }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  if (rows === null) return <p className="mt-6 t-small text-[var(--text-soft)]">불러오는 중…</p>;

  const totalEst = rows.reduce((a, r) => a + (r.estUsd ?? 0), 0);

  return (
    <div className="mt-6 space-y-4">
      {err && <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold text-danger">{err}</p>}
      {tableMissing && (
        <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold leading-relaxed text-danger">
          `sns_posts` 표가 아직 없어요. <b>npx supabase db push</b> 를 한 번 돌려야 숫자가 나옵니다.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse t-small">
          <thead>
            <tr className="border-b border-n-200 text-left">
              <th className="py-2 pr-3 font-semibold">채널</th>
              <th className="py-2 pr-3 font-semibold">올림</th>
              <th className="py-2 pr-3 font-semibold">30일</th>
              <th className="py-2 pr-3 font-semibold">진행 중</th>
              <th className="py-2 pr-3 font-semibold">실패</th>
              <th className="py-2 font-semibold">추정 비용</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.provider} className="border-b border-n-100">
                <td className="py-2 pr-3">{r.name}</td>
                <td className="py-2 pr-3 font-bold">{r.published}</td>
                <td className="py-2 pr-3">{r.published30}</td>
                <td className="py-2 pr-3">{r.inFlight}</td>
                <td className={`py-2 pr-3 ${r.failed > 0 ? "font-semibold text-danger" : ""}`}>{r.failed}</td>
                <td className="py-2 text-[var(--text-soft)]">
                  {r.estUsd === null ? "—" : `약 $${r.estUsd.toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-n-200 p-4 t-caption leading-relaxed text-[var(--text-soft)]">
        <p><b className="text-[var(--text)]">추정 비용 합계 — 약 ${totalEst.toFixed(2)}</b></p>
        <p className="mt-2">
          ⚠ <b>추정입니다.</b> 우리가 보낸 횟수 × 단가로 계산한 값이고, 그쪽 청구서가 아닙니다.
          단가는 확인이 끝나면 정확해집니다.
        </p>
        <p className="mt-1">
          ⚠ <b>남은 잔액은 아직 못 보여 드립니다.</b> X API 에 잔액을 조회하는 길이 있는지 확인 중입니다 —
          없으면 이 자리에 「추정 사용액」만 남습니다.
        </p>
      </div>
    </div>
  );
}
