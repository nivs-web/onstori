"use client";

import { useState } from "react";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [err, setErr] = useState(false);
  async function submit() {
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!r.ok) { setErr(true); return; }
    // 잠긴 대시보드(/plandept 등)에서 넘어왔으면 원래 주소로 돌려보낸다.
    // 같은 사이트의 경로만 허용 — "//evil.com" 은 "/" 로 시작해도 브라우저가 외부 주소로
    // 읽으므로(프로토콜 상대) 함께 막는다.
    const next = new URLSearchParams(location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) location.href = next;
    else location.reload();
  }
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-bold">운영자 인증</h1>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-3" placeholder="ADMIN KEY" />
      {err && <p className="mt-2 text-sm text-red-500">키가 올바르지 않아요</p>}
      <button onClick={submit} className="mt-4 rounded-full bg-teal-700 py-3 font-semibold text-white">입장</button>
    </main>
  );
}
