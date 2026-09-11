"use client";

import { useEffect, useState } from "react";

type Balance =
  | { ok: true; totalUsd: number; prepaidUsd: number; freeUsd: number; grants: { amountUsd: number; expiresAt: string }[] }
  | { ok: false; why: "no-key" | "not-enrolled" | "error"; detail: string };
type Pricing = { plain: number; withUrl: number; live: boolean };

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
  const [balance, setBalance] = useState<Balance | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/sns-usage", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { rows?: Row[]; tableMissing?: boolean; balance?: Balance; pricing?: Pricing; error?: string };
        if (!r.ok) { setErr(d.error ?? `불러오지 못했어요 (${r.status})`); setRows([]); return; }
        setRows(d.rows ?? []);
        setTableMissing(!!d.tableMissing);
        setBalance(d.balance ?? null);
        setPricing(d.pricing ?? null);
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

      {/* ★★ X 잔액 — 「100건도 안 썼는데 $10 이 사라졌다」를 가리는 자리 */}
      <section className="rounded-2xl border border-n-200 p-4">
        <p className="t-small font-bold">X 남은 잔액</p>
        {balance === null ? (
          <p className="mt-2 t-caption text-[var(--text-soft)]">불러오는 중…</p>
        ) : balance.ok ? (
          <>
            <p className="mt-2 t-h3 font-bold">${balance.totalUsd.toFixed(2)}</p>
            <p className="mt-1 t-caption text-[var(--text-soft)]">
              충전한 돈 ${balance.prepaidUsd.toFixed(2)} · 공짜로 받은 돈 ${balance.freeUsd.toFixed(2)}
            </p>
            {/* ★★★ 공짜 돈은 **만료일이 있다.** 한 건도 안 올려도 조용히 사라진다.
                 이걸 안 보여주면 「안 썼는데 없어졌다」의 원인을 영영 못 찾는다. */}
            {balance.grants.length > 0 && (
              <div className="mt-3 rounded-xl bg-n-50 p-3">
                <p className="t-caption font-semibold">공짜로 받은 돈 — <b>만료일이 있습니다</b></p>
                <ul className="mt-1 space-y-0.5">
                  {balance.grants.map((g, i) => (
                    <li key={i} className="t-caption text-[var(--text-soft)]">
                      ${g.amountUsd.toFixed(2)} — {g.expiresAt ? g.expiresAt.slice(0, 10) : "만료일 모름"} 까지
                    </li>
                  ))}
                </ul>
                <p className="mt-2 t-caption text-[var(--text-soft)]">
                  ⚠ 이 돈은 <b>한 건도 안 올려도</b> 만료일이 지나면 사라집니다. 잔액이 줄었는데 올린 건수가 적다면 여기를 먼저 보세요.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
            {balance.detail}
            {balance.why === "not-enrolled" && <> — 고장이 아닙니다. X 가 아직 이 계정에 안 열어 준 상태입니다.</>}
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-n-200 p-4 t-caption leading-relaxed text-[var(--text-soft)]">
        <p><b className="text-[var(--text)]">추정 사용액 — 약 ${totalEst.toFixed(2)}</b></p>
        <p className="mt-2">
          ⚠ <b>추정입니다.</b> 우리가 보낸 횟수 × 단가로 계산한 값이고, 그쪽 청구서가 아닙니다.
          위의 <b>남은 잔액</b>이 진짜 숫자입니다.
        </p>
        {pricing && (
          <p className="mt-2">
            X 단가 — 글 1건 <b>${pricing.plain.toFixed(3)}</b> · <b>링크가 든 글 ${pricing.withUrl.toFixed(3)}</b>
            {" "}({(pricing.withUrl / pricing.plain).toFixed(0)}배){pricing.live ? " · X 단가표에서 방금 읽음" : " · 문서 확인값"}
          </p>
        )}
        <p className="mt-2">
          ★ 온스토리는 X 로 나가는 글에서 <b>주소를 서버가 지웁니다.</b> 그래서 링크 요금이 붙지 않습니다.
        </p>
        <p className="mt-2">
          ⚠ X 개발자 콘솔의 <b>자동 충전(auto-recharge)</b>을 확인해 주세요. 켜져 있으면 잔액이 조용히 다시 채워지고 결제가 계속됩니다.
        </p>
      </div>
    </div>
  );
}
