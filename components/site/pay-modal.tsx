"use client";

import { useState } from "react";
import { MEMBERSHIP_PRICE, TRIAL_DAYS, type TrialInfo } from "@/lib/trial";

/**
 * 정회원 결제 모달 — 토스페이먼츠 SDK v2 (기획1 /mainplan #membership).
 * 서버(/api/billing/checkout)가 ready:false 를 주면(가맹 전) "결제 준비 중" 안내만 보여준다.
 * ready:true 면 js.tosspayments.com/v2/standard 를 그때 로드해 결제창을 연다 — successUrl 에서 서버 confirm.
 */
declare global {
  interface Window { TossPayments?: (clientKey: string) => { payment: (o: { customerKey: string }) => { requestPayment: (o: Record<string, unknown>) => Promise<void> } } }
}

function loadToss(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("결제 모듈을 불러오지 못했어요"));
    document.head.appendChild(s);
  });
}

function anonId(): string | undefined {
  try { return localStorage.getItem("onstori:anonId") ?? undefined; } catch { return undefined; }
}

export function PayModal({ slug, trial, onClose }: { slug: string; trial?: TrialInfo; onClose?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [notReady, setNotReady] = useState(false);

  async function pay() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anonId() }) });
      const d = (await r.json()) as { ready?: boolean; alreadyPaid?: boolean; error?: string; clientKey?: string; orderId?: string; amount?: number; orderName?: string; customerKey?: string };
      if (!r.ok) throw new Error(d.error ?? "결제를 시작하지 못했어요");
      if (d.alreadyPaid) { setMsg("이미 정회원이에요."); setBusy(false); return; }
      if (!d.ready) { setNotReady(true); setBusy(false); return; }
      await loadToss();
      const toss = window.TossPayments!(d.clientKey!);
      await toss.payment({ customerKey: d.customerKey! }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: d.amount },
        orderId: d.orderId,
        orderName: d.orderName,
        successUrl: `${location.origin}/billing/success?slug=${encodeURIComponent(slug)}`,
        failUrl: `${location.origin}/billing/fail?slug=${encodeURIComponent(slug)}`,
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "결제를 시작하지 못했어요");
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="정회원 이용하기" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" style={{ color: "var(--ink)" }}>
        <p className="text-[11.5px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>정회원 이용하기</p>
        <h2 className="font-display mt-2 text-[26px]" style={{ color: "var(--forest)" }}>정회원 {MEMBERSHIP_PRICE.toLocaleString()}원</h2>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>
          {trial?.expired ? `${TRIAL_DAYS}일 무료 기간이 끝났어요. 결제하시면 홈페이지가 다시 공개되고 모든 기능이 열립니다.` : trial ? `무료 기간이 ${trial.daysLeft}일 남았어요. 지금 결제하시면 ${TRIAL_DAYS}일 이후에도 홈페이지가 계속 유지됩니다.` : "홈페이지를 계속 유지하려면 정회원 전환이 필요해요."}
        </p>
        <ul className="mt-4 grid gap-1.5 text-[13.5px]">
          {["홈페이지 유지 · 검색 등록", "매주 질문 문자 + 60초 녹화 링크", "자막 영상 세로·가로 두 판", "다듬은 글 3종 + 사진 카드", "쇼츠·릴스·쓰레드·네이버·홈페이지 발행", "견적·문의 알림"].map((t) => (
            <li key={t} className="flex gap-2"><span style={{ color: "var(--green)" }}>✓</span>{t}</li>
          ))}
        </ul>
        {notReady ? (
          <div className="mt-5 rounded-2xl p-4 text-[13.5px]" style={{ background: "var(--cream-2)" }}>
            <b>결제 준비 중입니다.</b> 카드 결제 연결이 곧 열려요. 지금 정회원을 원하시면 카카오톡 채널(준비 중) 또는 홈페이지에 적힌 연락처로 알려 주세요 — 수동으로 정회원 처리해 드립니다.
          </div>
        ) : (
          <button type="button" onClick={pay} disabled={busy} className="btn-lime mt-5 w-full !py-4 !text-[16px] disabled:opacity-50">
            {busy ? "결제창 여는 중…" : `${MEMBERSHIP_PRICE.toLocaleString()}원 결제하기`}
          </button>
        )}
        {msg && <p className="mt-3 text-[13px] text-red-600">{msg}</p>}
        <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>토스페이먼츠 안전 결제 · 결제 뒤 언제든 해지 · 자료 전부 반출</p>
        {onClose && <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-[13px] underline" style={{ color: "var(--muted)" }}>나중에</button>}
      </div>
    </div>
  );
}

/** 에디터·마이페이지 상단 무료 기간 바 */
export function TrialBar({ trial, onPay }: { trial: TrialInfo; onPay: () => void }) {
  if (trial.paid) return null;
  const urgent = trial.daysLeft <= 3;
  return (
    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: urgent ? "var(--terra)" : "var(--line)", background: "#fff" }}>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold" style={{ color: urgent ? "var(--terra)" : "var(--forest)" }}>
          {trial.expired ? "무료 기간이 끝났어요" : `무료 기간 D-${trial.daysLeft}`}
          <span className="ml-2 font-medium" style={{ color: "var(--muted)" }}>· 전 기능 사용 중</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {TRIAL_DAYS}일 이내에 결제하시면 이 홈페이지를 계속 유지하실 수 있습니다. {TRIAL_DAYS}일 이후에는 자동으로 삭제됩니다.
        </p>
      </div>
      <button type="button" onClick={onPay} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ background: "var(--lime)", color: "var(--forest)" }}>정회원 이용하기</button>
    </section>
  );
}
