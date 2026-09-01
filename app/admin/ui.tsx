"use client";

import { useState } from "react";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [err, setErr] = useState(false);
  async function submit() {
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (r.ok) location.reload();
    else setErr(true);
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
