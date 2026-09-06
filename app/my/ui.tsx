"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";

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
      className="rounded-full border px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
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

  async function cancel() {
    setStep("busy"); setMsg("");
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: (() => { try { return localStorage.getItem("onstori:anonId") ?? undefined; } catch { return undefined; } })() }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; paidUntil?: string };
      if (!r.ok) throw new Error(d.error ?? "해지 처리에 실패했어요");
      setStep("done");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "해지 처리에 실패했어요");
      setStep("idle");
    }
  }

  if (step === "done") {
    return <p className="text-[12.5px] font-semibold" style={{ color: "var(--forest)" }}>해지됐습니다. 결제하신 달까지는 그대로 쓰실 수 있어요.</p>;
  }

  return (
    <div className="text-right">
      {step === "confirm" ? (
        <div className="rounded-xl border p-3 text-left" style={{ borderColor: "var(--line)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--ink)" }}>
            다음 달부터 청구되지 않습니다.{paidUntilLabel ? ` 이미 결제하신 ${paidUntilLabel}까지는 그대로 쓰실 수 있어요.` : " 이미 결제하신 달은 그대로 쓰실 수 있어요."}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setStep("idle")} className="rounded-full border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
              그대로 두기
            </button>
            <button type="button" onClick={cancel} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: "var(--terra)" }}>
              해지하기
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setStep("confirm")} disabled={step === "busy"}
          className="text-[12px] font-semibold underline underline-offset-4 disabled:opacity-50" style={{ color: "var(--muted)" }}>
          {step === "busy" ? "해지 중…" : "구독 해지"}
        </button>
      )}
      {msg && <p className="mt-1 text-[12px] text-red-600">{msg}</p>}
    </div>
  );
}
