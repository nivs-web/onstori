"use client";

import { useState } from "react";
import { COPY, type TrialInfo } from "@/lib/trial";
import { BIZ } from "@/config/company";

/**
 * 정회원 결제 모달 — 토스페이먼츠 SDK v2 (기획1 /mainplan #membership).
 * 서버(/api/billing/checkout)가 ready:false 를 주면(가맹 전) "결제 준비 중" 안내만 보여준다.
 * ready:true 면 js.tosspayments.com/v2/standard 를 그때 로드해 결제창을 연다 — successUrl 에서 서버 confirm.
 */
declare global {
  interface Window { TossPayments?: (clientKey: string) => { payment: (o: { customerKey: string }) => { requestBillingAuth: (o: Record<string, unknown>) => Promise<void> } } }
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
      // 정기결제 — 1회 결제창(requestPayment)이 아니라 **카드 등록창**을 연다.
      // 성공하면 successUrl 로 authKey·customerKey 가 붙어 돌아오고, 거기서 서버가 빌링키를 발급한다.
      await toss.payment({ customerKey: d.customerKey! }).requestBillingAuth({
        method: "CARD",
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
        <p className="t-caption font-bold" style={{ color: "var(--teal)" }}>정회원 이용하기</p>
        <h2 className="font-display mt-2 t-h1" style={{ color: "var(--forest)" }}>정회원 {COPY.priceLine}</h2>
        <p className="mt-1 t-small" style={{ color: "var(--muted)" }}>
          {trial?.expired
            ? COPY.suspendedNotice
            : trial
              ? `무료 기간이 ${trial.daysLeft}일 남았어요. 결제하시면 홈페이지가 끊기지 않고 계속 공개됩니다.`
              : "홈페이지를 계속 유지하려면 정회원 전환이 필요해요."}
        </p>
        <ul className="mt-4 grid gap-1.5 t-small">
          {/* ★ 2026-09-12 — **되는 것(✓)과 준비 중(⏳)을 갈라서** 적는다. 홈 가격 카드와 같은 목록이다.
              전에는 「자막 영상」·「다듬은 글 3종 + 사진 카드」를 ✓ 로 적었는데 **둘 다 없다.**
              ⚠ 여기는 카드를 등록하는 화면이다. 돈을 내는 자리에서 없는 것을 약속하면 안 된다. */}
          {([
            ["✓", "onstori.com/상호 홈페이지 유지 · 검색 등록"],
            ["✓", "매주 질문 문자 + 60초 녹화 링크"],
            ["✓", "인스타그램에 함께 올리기"],
            ["⏳", "유튜브 · 틱톡 · 쓰레드 · X · 페이스북 — 준비 중"],
            ["✓", "견적·문의 알림 (이메일)"],
          ] as const).map(([mark, t]) => (
            <li key={t} className="flex gap-2">
              <span style={{ color: mark === "✓" ? "var(--green)" : "var(--muted)" }}>{mark}</span>{t}
            </li>
          ))}
        </ul>
        {notReady ? (
          <div className="mt-5 rounded-2xl p-4 t-small" style={{ background: "var(--cream-2)" }}>
            <b>결제 준비 중입니다.</b> 카드 결제 연결이 곧 열려요. 지금 정회원을 원하시면 카카오톡 채널(준비 중) 또는 홈페이지에 적힌 연락처로 알려 주세요 — 수동으로 정회원 처리해 드립니다.
          </div>
        ) : (
          <>
            {/* 정기결제 사전 고지 — 법이 요구한다. 결제 버튼 위에서 빼지 마라 (lib/trial.ts COPY.autopay) */}
            <p className="mt-5 rounded-2xl p-3.5 t-caption leading-relaxed" style={{ background: "var(--cream-2)", color: "var(--ink)" }}>
              {COPY.autopay}
            </p>
            <button type="button" onClick={pay} disabled={busy} className="btn-lime mt-3 w-full !py-4 !t-body disabled:opacity-50">
              {busy ? "카드 등록창 여는 중…" : `${COPY.priceLine} 정기결제 등록`}
            </button>
          </>
        )}
        {msg && <p className="mt-3 t-small text-danger">{msg}</p>}
        <p className="mt-3 t-caption" style={{ color: "var(--muted)" }}>토스페이먼츠 안전 결제 · 매달 자동 결제 · 언제든 해지 · 자료 전부 반출</p>
        {/* ★ 2026-09-11 신설 — **여기가 계약이 맺어지는 화면인데 파는 사람이 누구인지 없었다.**
            전자상거래법 제13조는 계약 체결 «전»에 판매자 신원과 거래조건을 알리라고 한다.
            본사 푸터에는 있지만 이 모달은 /my 와 /{slug}/edit 에서 뜨고 **그 두 화면엔 푸터가 없다.**
            ⚠ 값은 config/company.ts 하나에서만 온다. 여기에 숫자를 직접 타이핑하지 마라.
            ⚠ 링크는 새 탭이다 — 같은 탭으로 나가면 결제 흐름이 끊긴다. */}
        <p className="mt-2 t-micro leading-relaxed" style={{ color: "var(--muted)" }}>
          판매자 {BIZ.name} · 대표 {BIZ.ceo} · 사업자등록번호 {BIZ.bizNo} · 통신판매업신고 {BIZ.mailOrderNo} · {BIZ.phone}
          {" · "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">이용약관</a>
          {" · "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">개인정보처리방침</a>
        </p>
        {onClose && <button type="button" onClick={onClose} className="mt-3 w-full py-2 t-small underline" style={{ color: "var(--muted)" }}>나중에</button>}
      </div>
    </div>
  );
}

/** 에디터·마이페이지 상단 무료 기간 바 */
export function TrialBar({ trial, onPay }: { trial: TrialInfo; onPay: () => void }) {
  if (trial.paid) return null;
  const urgent = trial.daysLeft <= 3;
  return (
    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: urgent ? "var(--danger)" : "var(--n-200)", background: "var(--n-0)", borderRadius: "var(--r-md)" }}>
      <div className="min-w-0">
        <p className="t-caption font-bold" style={{ color: urgent ? "var(--terra)" : "var(--forest)" }}>
          {trial.expired ? "홈페이지 정지됨" : `무료 기간 D-${trial.daysLeft}`}
          <span className="ml-2 font-medium" style={{ color: "var(--muted)" }}>· {trial.expired ? "결제하면 바로 되살아납니다" : "전 기능 사용 중"}</span>
        </p>
        {/* 문구는 lib/trial.ts 가 단일 출처 — 여기에 문장을 복사하지 마라 */}
        <p className="mt-0.5 t-caption leading-relaxed" style={{ color: "var(--muted)" }}>
          {trial.expired ? COPY.suspendedNotice : COPY.policy}
        </p>
      </div>
      <button type="button" onClick={onPay} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ background: "var(--lime)", color: "var(--forest)" }}>정회원 이용하기</button>
    </section>
  );
}
