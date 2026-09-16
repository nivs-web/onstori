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
      {/* ★ 한글·영문을 같이 쓴다 (2026-09-17 지시 [21]).
          유튜브·인스타 심사관(외국인)과 토스페이먼츠 심사관(한국인)이 **같은 화면**을 본다.
          한쪽 말만 쓰면 다른 쪽이 「이게 무슨 화면인가」로 걸고 넘어진다. */}
      <h1 className="t-h3 font-bold">심사용 로그인 / Reviewer sign-in</h1>
      <p className="mt-2 t-caption text-[var(--text-soft)]">
        심사를 위한 화면입니다. 안내받으신 아이디와 비밀번호를 넣어 주세요.
        <br />
        For app review only. Use the credentials provided in the review notes.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="field" value={id} onChange={(e) => setId(e.target.value)}
          autoComplete="username" placeholder="아이디 / ID" aria-label="아이디 / ID" />
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" placeholder="비밀번호 / Password" aria-label="비밀번호 / Password" />
        <button type="submit" disabled={busy || !id || !password}
          className="btn btn-primary w-full disabled:opacity-40">
          {busy ? "로그인 중… / Signing in…" : "로그인 / Sign in"}
        </button>
      </form>
      {err && <p className="mt-3 t-small font-semibold text-danger">{err}</p>}
    </main>
  );
}
