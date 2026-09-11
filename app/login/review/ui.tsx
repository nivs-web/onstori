"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 심사관용 — 아이디·비밀번호 한 쌍만 받는다. 꾸미지 않는다, 심사관이 쓰는 화면이다. */
export function ReviewLoginUi() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErr(d.error ?? `로그인에 실패했어요 (${r.status})`); return; }
      /* 로그인 뒤 마이페이지로 — 심사관이 바로 기능을 볼 수 있는 자리다 */
      router.replace("/my");
    } catch {
      setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="t-h3 font-bold">Reviewer sign-in</h1>
      <p className="mt-2 t-caption text-[var(--text-soft)]">
        For app review only. Use the credentials provided in the review notes.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="field" value={id} onChange={(e) => setId(e.target.value)}
          autoComplete="username" placeholder="ID" aria-label="ID" />
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" placeholder="Password" aria-label="Password" />
        <button type="submit" disabled={busy || !id || !password}
          className="btn btn-primary w-full disabled:opacity-40">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {err && <p className="mt-3 t-small font-semibold text-danger">{err}</p>}
    </main>
  );
}
