"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function BillingResult() {
  const p = useSearchParams();
  const slug = p.get("slug") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "fail">("busy");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    // 정기결제(빌링키): 카드 등록창이 authKey·customerKey 를 붙여 돌려보낸다.
    // 서버가 빌링키를 발급·저장하고 첫 달을 청구한다. 금액은 서버가 정한다(규칙 4).
    fetch("/api/billing/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        authKey: p.get("authKey"),
        customerKey: p.get("customerKey"),
        anonId: (() => { try { return localStorage.getItem("onstori:anonId") ?? undefined; } catch { return undefined; } })(),
      }),
    }).then(async (r) => {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) setState("ok"); else { setMsg(d.error ?? "카드 등록에 실패했어요"); setState("fail"); }
    }).catch(() => { setMsg("네트워크 오류"); setState("fail"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      {state === "busy" && <p style={{ color: "var(--muted)" }}>카드를 등록하고 첫 달 결제를 확인하고 있어요…</p>}
      {state === "ok" && (<>
        <p className="t-h1">🎉</p>
        <h1 className="font-display mt-3 t-h1">정회원이 되셨어요</h1>
        <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>홈페이지는 계속 유지되고, 매주 질문이 문자로 갑니다.<br />다음 달부터 매달 자동으로 결제되며, 언제든 해지하실 수 있어요.</p>
        <a href={`/${slug}/edit`} className="btn-lime mt-8">내 홈페이지 관리로 →</a>
      </>)}
      {state === "fail" && (<>
        <h1 className="font-display t-h1">정기결제를 등록하지 못했어요</h1>
        <p className="mt-2 t-small text-danger">{msg}</p>
        <a href={`/${slug}/edit`} className="btn-ghost mt-8">에디터로 돌아가기</a>
      </>)}
    </main>
  );
}
