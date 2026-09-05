"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function BillingResult() {
  const p = useSearchParams();
  const slug = p.get("slug") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "fail">("busy");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/billing/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, paymentKey: p.get("paymentKey"), orderId: p.get("orderId"), amount: Number(p.get("amount")) }),
    }).then(async (r) => {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) setState("ok"); else { setMsg(d.error ?? "승인에 실패했어요"); setState("fail"); }
    }).catch(() => { setMsg("네트워크 오류"); setState("fail"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      {state === "busy" && <p style={{ color: "var(--muted)" }}>결제를 확인하고 있어요…</p>}
      {state === "ok" && (<>
        <p className="text-[44px]">🎉</p>
        <h1 className="font-display mt-3 text-[28px]">정회원이 되셨어요</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: "var(--muted)" }}>홈페이지는 계속 유지되고, 매주 질문이 문자로 갑니다.</p>
        <a href={`/${slug}/edit`} className="btn-lime mt-8">내 홈페이지 관리로 →</a>
      </>)}
      {state === "fail" && (<>
        <h1 className="font-display text-[26px]">결제를 확인하지 못했어요</h1>
        <p className="mt-2 text-[14px] text-red-600">{msg}</p>
        <a href={`/${slug}/edit`} className="btn-ghost mt-8">에디터로 돌아가기</a>
      </>)}
    </main>
  );
}
