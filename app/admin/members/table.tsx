"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * 회원 목록 표 (docs/admin.md §3-2) — 탭·검색·정렬·메모·블랙리스트·CSV.
 *
 * ⚠ 메모·블랙리스트는 **운영자만** 보는 값이다(member_admin, RLS 정책 0개).
 *   이 컴포넌트는 어드민 화면에서만 마운트된다 — 손님·사장님 화면에 재사용하지 마라.
 * ⚠ 블랙리스트는 **표시만** 한다. 차단 기능을 여기에 붙이지 마라(회장님 확정).
 * ⚠ CSV 에는 개인정보가 나간다 — 메모·블랙리스트 사유는 넣지 않는다.
 */

export type MemberRow = {
  id: string; slug: string; businessName: string; status: string; industry: string;
  createdAt: string; paidAt: string | null; trialEndsAt: string | null; suspendedAt: string | null;
  daysLeft: number; expired: boolean; paid: boolean;
  phone: string; address: string; score: number;
  email: string; provider: string; userName: string; lastSignInAt: string | null;
  updatedAt: string; inquiryCount: number;
  /** 마지막 성공 결제 이후의 실패 횟수. 0 이면 실패 탭에 뜨지 않는다 */
  failCount: number; lastFailAt: string | null; lastFailMessage: string;
  memo: string; contactName: string; blacklisted: boolean; blacklistReason: string;
};

type Tab = "all" | "active" | "trial" | "failed" | "black";
type SortKey = "createdAt" | "paidAt" | "daysLeft" | "score" | "businessName";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—");

export function MembersTable({ rows: initial }: { rows: MemberRow[] }) {
  const [rows, setRows] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "createdAt", desc: true });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r.paid).length,
    trial: rows.filter((r) => !r.paid).length,
    failed: rows.filter((r) => r.failCount > 0).length,
    black: rows.filter((r) => r.blacklisted).length,
  }), [rows]);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (tab === "active" && !r.paid) return false;
      if (tab === "trial" && r.paid) return false;
      if (tab === "failed" && r.failCount === 0) return false;
      if (tab === "black" && !r.blacklisted) return false;
      if (!needle) return true;
      return [r.businessName, r.slug, r.phone, r.email, r.contactName, r.address, r.status]
        .some((v) => (v ?? "").toLowerCase().includes(needle));
    });
    const dir = sort.desc ? -1 : 1;
    out = [...out].sort((a, b) => {
      const k = sort.key;
      if (k === "businessName") return a.businessName.localeCompare(b.businessName) * dir;
      if (k === "score" || k === "daysLeft") return ((a[k] as number) - (b[k] as number)) * dir;
      return String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * dir;
    });
    return out;
  }, [rows, tab, q, sort]);

  function th(label: string, key?: SortKey) {
    if (!key) return <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>;
    const on = sort.key === key;
    return (
      <th key={label} className="px-3 py-2.5 font-semibold">
        <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
          className={`hover:underline ${on ? "text-teal-700" : ""}`}>
          {label}{on ? (sort.desc ? " ▾" : " ▴") : ""}
        </button>
      </th>
    );
  }

  async function patch(siteId: string, body: Record<string, unknown>) {
    setBusy(siteId); setMsg("");
    try {
      const r = await fetch("/api/admin/member", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, ...body }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "저장 실패");
      setRows((rs) => rs.map((x) => (x.id === siteId ? { ...x, ...body } as MemberRow : x)));
      setMsg("저장했어요");
    } catch (e) { setMsg(e instanceof Error ? e.message : "저장 실패"); }
    setBusy("");
  }

  async function act(siteId: string, action: "activate" | "extend", days?: number) {
    const label = action === "activate" ? "정회원으로 전환할까요? (결제 없이 수동)" : `무료 기간을 ${days}일 연장할까요?`;
    if (!confirm(label)) return;
    setBusy(siteId); setMsg("");
    try {
      const r = await fetch("/api/admin/member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, action, days }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "처리 실패");
      setMsg("처리했어요 — 새로고침하면 반영됩니다");
    } catch (e) { setMsg(e instanceof Error ? e.message : "처리 실패"); }
    setBusy("");
  }

  /** ⚠ 개인정보가 나간다. 메모·블랙리스트 사유는 넣지 않는다 (§3-2) */
  function csv() {
    const head = ["상호명", "주소(홈페이지)", "상태", "개설일", "결제일", "무료남은", "연락처", "지역", "완성도", "이메일", "가입방식", "문의건수"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = view.map((r) => [r.businessName, `onstori.com/${r.slug}`, r.paid ? "정회원" : r.expired ? "정지" : "무료",
      fmt(r.createdAt), fmt(r.paidAt), r.paid ? "—" : r.expired ? "정지" : `D-${r.daysLeft}`,
      r.phone, r.address, r.score, r.email, r.provider, r.inquiryCount].map(esc).join(","));
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `onstori-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  const TABS: [Tab, string, number][] = [
    ["all", "전체", counts.all], ["active", "정회원", counts.active], ["trial", "무료·정지", counts.trial],
    ["failed", "결제 실패", counts.failed], ["black", "블랙리스트", counts.black],
  ];

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map(([id, label, n]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === id ? "bg-teal-700 text-white" : "border border-neutral-300 text-neutral-600"}`}>
            {label} {n}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상호·주소·전화·이메일 검색"
          className="ml-auto w-56 rounded-full border border-neutral-300 px-4 py-1.5 text-[13px]" />
        <button type="button" onClick={csv} className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-[13px] font-semibold">CSV 내려받기</button>
      </div>
      {msg && <p className="mt-2 text-[13px] text-teal-700">{msg}</p>}
      {tab === "failed" && counts.failed === 0 && (
        <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-[12.5px] text-neutral-500">
          아직 결제 실패 기록이 없습니다. 토스 가맹 심사가 끝나고 첫 결제가 시작되면 여기에 쌓입니다.
          마지막 성공 결제 <b>이후</b>의 실패만 셉니다 — 예전에 실패했다가 결제에 성공한 분은 여기 안 뜹니다.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[1250px] text-[13px]">
          <thead className="bg-neutral-50 text-left text-[12px] text-neutral-500">
            <tr>
              {th("상호명", "businessName")}{th("홈페이지 주소")}{th("상태")}{th("개설일", "createdAt")}{th("결제일", "paidAt")}
              {th("무료 남은", "daysLeft")}{th("연락처")}{th("완성도", "score")}{th("문의")}{th("마지막 편집")}{th("마지막 로그인")}{th("이메일")}{th("")}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <RowView key={r.id} r={r} open={open === r.id} busy={busy === r.id}
                onToggle={() => setOpen(open === r.id ? null : r.id)} onPatch={patch} onAct={act} />
            ))}
            {view.length === 0 && <tr><td colSpan={13} className="px-3 py-10 text-center text-neutral-400">해당하는 회원이 없어요</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RowView({ r, open, busy, onToggle, onPatch, onAct }: {
  r: MemberRow; open: boolean; busy: boolean; onToggle: () => void;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onAct: (id: string, a: "activate" | "extend", d?: number) => void;
}) {
  const [memo, setMemo] = useState(r.memo);
  const [name, setName] = useState(r.contactName);
  const [reason, setReason] = useState(r.blacklistReason);

  const badge = r.paid ? "bg-green-100 text-green-800" : r.expired ? "bg-neutral-200 text-neutral-600" : r.daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
  return (
    <>
      <tr className={`border-t border-neutral-100 align-top ${r.blacklisted ? "bg-red-50" : ""}`}>
        <td className="px-3 py-2.5 font-semibold">
          {r.blacklisted && <span title={r.blacklistReason || "블랙리스트"} className="mr-1 text-red-600">⚑</span>}
          {r.businessName}
          {r.contactName && <span className="block text-[11px] font-normal text-neutral-400">{r.contactName}</span>}
        </td>
        <td className="px-3 py-2.5">
          <a href={`/${r.slug}`} target="_blank" rel="noopener" className="text-teal-700 underline">onstori.com/{r.slug}</a>
          {" · "}<Link href={`/${r.slug}/edit`} className="text-neutral-500 underline">편집</Link>
        </td>
        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${badge}`}>{r.paid ? "정회원" : r.expired ? "정지" : "무료"}</span></td>
        <td className="px-3 py-2.5">{fmt(r.createdAt)}</td>
        <td className="px-3 py-2.5">{fmt(r.paidAt)}</td>
        <td className="px-3 py-2.5">
          {r.paid ? "—" : r.expired ? "정지" : `D-${r.daysLeft}`}
          <span className="block text-[11px] text-neutral-400">{r.expired ? `${fmt(r.suspendedAt)} 정지` : `${fmt(r.trialEndsAt)} 까지`}</span>
        </td>
        <td className="px-3 py-2.5">{r.phone || "—"}</td>
        <td className="px-3 py-2.5"><b className="text-teal-700">{r.score}</b>점</td>
        <td className="px-3 py-2.5">{r.inquiryCount || "—"}</td>
        <td className="px-3 py-2.5">{fmt(r.updatedAt)}</td>
        <td className="px-3 py-2.5">{fmt(r.lastSignInAt)}</td>
        <td className="px-3 py-2.5 max-w-[180px] truncate" title={r.email}>{r.email || <span className="text-neutral-400">미가입</span>}</td>
        <td className="px-3 py-2.5">
          <button type="button" onClick={onToggle} className="rounded-full border border-neutral-300 px-3 py-1 text-[12px] font-semibold">
            {open ? "닫기" : "관리"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-neutral-100 bg-neutral-50">
          <td colSpan={13} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div>
                <label className="text-[12px] font-semibold text-neutral-500">메모 (운영자만 봅니다 · 최대 20,000자)</label>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 20000))} rows={6}
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 text-[13px]" placeholder="날짜별 메모·요청사항·참고사항" />
                <div className="mt-1 flex items-center gap-2">
                  <button type="button" disabled={busy} onClick={() => onPatch(r.id, { memo })}
                    className="rounded-full bg-teal-700 px-4 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">메모 저장</button>
                  <span className="text-[11.5px] text-neutral-400">{memo.length.toLocaleString()} / 20,000</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-semibold text-neutral-500">이름</label>
                  <div className="mt-1 flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="사장님 성함"
                      className="w-full rounded-full border border-neutral-300 px-3.5 py-1.5 text-[13px]" />
                    <button type="button" disabled={busy} onClick={() => onPatch(r.id, { contactName: name })}
                      className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-[12.5px] font-semibold">저장</button>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-white p-3">
                  <label className="flex items-center gap-2 text-[13px] font-semibold">
                    <input type="checkbox" checked={r.blacklisted}
                      onChange={(e) => onPatch(r.id, { blacklisted: e.target.checked, blacklistReason: reason })} />
                    블랙리스트로 표시
                  </label>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (선택)"
                    className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-[12.5px]" />
                  <p className="mt-1.5 text-[11.5px] text-neutral-500">표시만 합니다. 이용을 막지 않습니다.</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <p className="text-[12px] font-semibold text-neutral-500">상태 조작</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => onAct(r.id, "activate")}
                      className="rounded-full border border-green-300 px-3 py-1.5 text-[12.5px] font-semibold text-green-800 disabled:opacity-50">정회원으로</button>
                    {[7, 14, 30].map((d) => (
                      <button key={d} type="button" disabled={busy} onClick={() => onAct(r.id, "extend", d)}
                        className="rounded-full border border-neutral-300 px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">무료 {d}일 연장</button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-neutral-500">바꾸면 메모에 자동으로 기록이 남습니다.</p>
                </div>
                {r.failCount > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px]">
                    <b className="text-red-700">결제 실패 {r.failCount}회</b>
                    <span className="block text-neutral-600">마지막 {fmt(r.lastFailAt)} · {r.lastFailMessage || "사유 없음"}</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
