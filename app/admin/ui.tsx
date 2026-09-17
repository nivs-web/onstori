"use client";

import { useState } from "react";

/**
 * 운영자 입장 — **문이 둘**이다. (2026-09-17 지시 [34])
 *
 * ★ 대표님: 「**키 입력이 불편해.** 아이디랑 비밀번호로 들어가게 해 줘.」
 *
 * 🔴 **［열쇠로 들어가기］를 지우지 마라.** 아이디·비밀번호를 잊으시면 **그게 유일한 비상구**다.
 *   ⚠ 다만 **기본으로 펼치지 않는다** — 평소엔 아이디·비밀번호가 앞에 있어야 편하다.
 */
export function AdminLogin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [key, setKey] = useState("");
  const [useKey, setUseKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true); setErr("");
    try {
      const body = useKey ? { key } : { id, password: pw };
      const r = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        /* ⚠ 어느 쪽이 틀렸는지 알려 주지 않는다 */
        setErr(d.error ?? (useKey ? "열쇠가 올바르지 않아요" : "아이디나 비밀번호가 맞지 않아요"));
        return;
      }
      // 잠긴 대시보드(/plandept 등)에서 넘어왔으면 원래 주소로 돌려보낸다.
      // 같은 사이트의 경로만 허용 — "//evil.com" 은 "/" 로 시작해도 브라우저가 외부 주소로
      // 읽으므로(프로토콜 상대) 함께 막는다.
      const next = new URLSearchParams(location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) location.href = next;
      else location.reload();
    } finally { setBusy(false); }
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") void submit(); };

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="t-h3 font-bold">운영자 인증</h1>

      {useKey ? (
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={onKey}
          className="mt-4 w-full rounded-xl border border-n-300 px-4 py-3" placeholder="ADMIN KEY" autoFocus />
      ) : (
        <>
          <input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={onKey}
            autoComplete="username" autoCapitalize="none" spellCheck={false}
            className="mt-4 w-full rounded-xl border border-n-300 px-4 py-3" placeholder="아이디" autoFocus />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey}
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-n-300 px-4 py-3" placeholder="비밀번호" />
        </>
      )}

      {err && <p className="mt-2 t-small text-danger">{err}</p>}

      <button onClick={submit} disabled={busy}
        className="mt-4 rounded-full bg-green-700 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? "확인 중…" : "입장"}
      </button>

      {/* 🔴 비상구. 아이디·비밀번호를 아직 안 만드셨거나 잊으셨을 때 */}
      <button type="button" onClick={() => { setUseKey((v) => !v); setErr(""); }}
        className="mt-3 t-caption underline text-[var(--text-soft)]">
        {useKey ? "아이디·비밀번호로 들어가기" : "열쇠(ADMIN KEY)로 들어가기"}
      </button>
    </main>
  );
}
