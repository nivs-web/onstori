"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";
import { PayModal } from "@/components/site/pay-modal";
import type { TrialInfo } from "@/lib/trial";

/**
 * 카드 안 버튼 3개 — [수정하기] [보러가기] [결제]
 *
 * ★ [결제 문의] 가 아니라 **[결제]** 다(2026-09-07 회장님 확정).
 *   빌링키 발급·정기결제·원장이 이미 다 구현돼 있고, 막고 있는 건 Vercel 의 TOSS_* 뿐이다.
 *   PayModal 은 서버가 `ready:false` 를 주면 "결제 준비 중" 안내를 대신 띄우는 분기를
 *   이미 갖고 있다. 그래서 지금 [결제] 로 만들어 두면 —
 *     오늘: 눌러도 안내만 뜬다(손해 없음)
 *     TOSS_* 넣는 날: **화면을 한 줄도 안 고치고** 같은 버튼이 진짜 카드 등록창을 연다
 *   [결제 문의] 로 만들면 그날 이름·연결·안내를 전부 다시 손봐야 한다.
 *
 * ⚠ 주 버튼(초록 면)은 뷰포트당 1개다(규칙 11) — [수정하기] 하나만 초록이다.
 */
export function MyCardActions({ slug, trial }: { slug: string; trial: TrialInfo }) {
  const [payOpen, setPayOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center" style={{ marginTop: "var(--s-5)", gap: "var(--s-3)" }}>
        <Link href={`/${slug}/edit`} className="btn btn-primary">수정하기</Link>
        <Link href={`/${slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary">보러가기</Link>
        <button type="button" onClick={() => setPayOpen(true)} className="btn btn-secondary">
          {trial.paid ? "결제 관리" : "결제"}
        </button>
      </div>

      {/* 구독 중이면 해지 진입점을 1뎁스로 — 가입만큼 쉬워야 한다(전자상거래법 제21조의2) */}
      {trial.paid && <div style={{ marginTop: "var(--s-3)" }}><CancelSubscription slug={slug} /></div>}

      {payOpen && <PayModal slug={slug} trial={trial} onClose={() => setPayOpen(false)} />}
    </>
  );
}

/** 로그아웃 — 세션 쿠키는 @supabase/ssr가 httpOnly 없이 심으므로 브라우저 클라이언트로 지울 수 있다(별도 API 불필요) */
export function LogoutButton({ next = "/" }: { next?: string } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await sbBrowser().auth.signOut();
    router.replace(next);
    router.refresh(); // 서버 컴포넌트(헤더)가 비로그인 상태로 다시 그려지도록
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="rounded-full border px-4 py-2 t-small font-semibold disabled:opacity-50"
      style={{ borderColor: "var(--n-200)", color: "var(--text-soft)" }}
    >
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}

/**
 * 구독 해지 버튼 — 전자상거래법 제21조의2 제1항 제4호 나목.
 *
 * ★ 가입·결제가 웹 클릭으로 끝나면 **해지도 웹 클릭으로 끝나야 한다.**
 *   전화·이메일로만 받으면 "가입과 다른 방법으로만 해지하도록 제한"에 해당해
 *   시정조치와 영업정지(1차 3개월)까지 갈 수 있는 유형이다. 이 버튼을 없애지 마라.
 * ★ 확인은 한 번만 묻는다. 붙잡는 안내·할인 제안을 반복해 띄우지 않는다(다크패턴).
 */
export function CancelSubscription({ slug, paidUntilLabel }: { slug: string; paidUntilLabel?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");
  /** 「○월 ○일까지 그대로 쓰실 수 있어요」 — 누르기 «전»에 보여 드린다 */
  const [until, setUntil] = useState<string | null>(null);

  const anon = () => { try { return localStorage.getItem("onstori:anonId") ?? undefined; } catch { return undefined; } };
  const fmt = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
  };

  /**
   * ★ **안내 화면을 열기 «전»에 날짜부터 물어본다.** (2026-09-17 지시 [29])
   *   ⚠ 못 읽어도 화면은 연다 — 날짜 하나 때문에 해지를 막으면 그게 더 나쁘다(전자상거래법 제21조의2).
   */
  async function open() {
    setStep("confirm"); setMsg("");
    try {
      const q = new URLSearchParams({ slug, ...(anon() ? { anonId: anon()! } : {}) });
      const r = await fetch(`/api/billing/cancel?${q}`);
      const d = (await r.json().catch(() => ({}))) as { paidUntil?: string | null };
      if (r.ok && d.paidUntil) setUntil(d.paidUntil);
    } catch { /* 날짜를 못 읽어도 그냥 연다 */ }
  }

  async function cancel() {
    setStep("busy"); setMsg("");
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon() }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; paidUntil?: string };
      if (!r.ok) throw new Error(d.error ?? "해지 처리에 실패했어요");
      if (d.paidUntil) setUntil(d.paidUntil);
      setStep("done");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "해지 처리에 실패했어요");
      setStep("idle");
    }
  }

  const untilLabel = fmt(until) || paidUntilLabel || "";

  if (step === "done") {
    return (
      <p className="t-caption font-semibold" style={{ color: "var(--green-700)" }}>
        해지됐습니다. {untilLabel ? `${untilLabel}까지는 그대로 쓰실 수 있어요.` : "결제하신 회차는 마지막 날까지 그대로 쓰실 수 있어요."}
      </p>
    );
  }

  return (
    <div className="text-right">
      {step === "confirm" ? (
        /**
         * ★★★ **해지 안내 화면** — 대표님 지시 [29] ②.
         *   「결제 관리 들어가면 해지 버튼 있고 **해지 안내 페이지** 있고, 그 다음에 해지 누르면 해지」
         *
         * 🔴 **다섯 가지는 «약관 제5조»에서 그대로 옮겼다. 새로 쓰지 않았다.**
         *   약관과 화면이 다르면 그게 분쟁이다(권반장 지시). 그래서 아래에 **［환불 규정 보기］**로
         *   제5조를 바로 열 수 있게 두었다 — 손님이 두 글을 맞대 볼 수 있어야 한다.
         *
         * 🔴 **다크패턴을 만들지 않는다**(전자상거래법 제21조의2):
         *   · 확인은 **한 번**뿐이다. 「정말요?」를 두 번 묻지 않는다
         *   · ［해지하기］를 숨기거나 흐리게 하지 않는다 — ［그대로 두기］와 **같은 크기**다
         *   · 할인·쿠폰으로 붙잡지 않는다(그런 것이 있지도 않다)
         *   · 화면에서 끝난다. 전화·메일을 요구하지 않는다
         */
        <div className="rounded-xl border p-3 text-left" style={{ borderColor: "var(--n-200)" }}>
          <p className="t-small font-bold" style={{ color: "var(--text-strong)" }}>해지하면 이렇게 됩니다</p>
          <ul className="mt-2 space-y-1.5 t-caption" style={{ color: "var(--text-strong)" }}>
            <li>
              <b>언제까지 쓰나요</b> — 이미 결제하신 회차는{untilLabel ? <> <b>{untilLabel}까지</b></> : " 마지막 날까지"} 그대로 쓰십니다.
              다음 회차부터 청구되지 않고, <b>위약금·해지 수수료는 없습니다.</b>
            </li>
            <li><b>홈페이지는요</b> — 그 회차가 끝나면 <b>비공개</b>로 바뀝니다. <b>지워지지 않습니다.</b></li>
            <li><b>제 자료는요</b> — <b>그대로 보관</b>됩니다.</li>
            <li><b>다시 오시려면</b> — <b>결제 한 번이면 바로 다시 공개</b>됩니다.</li>
            <li>
              <b>환불되나요</b> — 결제하신 날부터 <b>7일 이내</b>면 그 회차 금액을 <b>전액</b> 돌려드립니다.
              그 뒤에는 남은 기간을 그대로 쓰시는 것입니다.{" "}
              <Link href="/terms#refund" target="_blank" className="underline underline-offset-2">환불 규정 보기</Link>
            </li>
          </ul>
          {/* ⚠ 두 버튼은 **같은 크기·같은 선명도**다. 해지 쪽을 작게 만들면 그게 다크패턴이다 */}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setStep("idle")} className="rounded-full border px-3 py-1.5 t-caption font-semibold" style={{ borderColor: "var(--n-200)", color: "var(--text-soft)" }}>
              그대로 두기
            </button>
            <button type="button" onClick={cancel} className="rounded-full px-3 py-1.5 t-caption font-semibold text-white" style={{ background: "var(--terra)" }}>
              해지하기
            </button>
          </div>
        </div>
      ) : (
        <>
          {msg && <p className="t-caption" style={{ color: "var(--danger)" }}>{msg}</p>}
          {/* ⚠ 가입이 웹 클릭으로 끝나면 해지도 웹 클릭으로 끝나야 한다 — 이 버튼을 숨기지 마라 */}
          <button type="button" disabled={step === "busy"} onClick={open}
            className="t-caption underline underline-offset-2 disabled:opacity-50" style={{ color: "var(--text-soft)" }}>
            {step === "busy" ? "해지하는 중…" : "구독 해지"}
          </button>
        </>
      )}
    </div>
  );
}
