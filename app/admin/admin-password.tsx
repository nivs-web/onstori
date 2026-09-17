"use client";

import { useEffect, useState } from "react";
import { ADMIN_SESSION_DAYS } from "@/config/admin-session";

/**
 * 🔴 **어드민 아이디·비밀번호 만들기 / 바꾸기.** (2026-09-17 지시 [34])
 *
 * ★ 대표님: 「키 입력이 불편해. **아이디랑 비밀번호**로 들어가게 해 줘.
 *   **첫 로그인할 때 즉시 내가 스스로 바꿀게.**」 — 그 「스스로」가 이 칸입니다.
 *
 * 🔴🔴 **대표님 제안대로 «심사용 비밀번호와 같은 값»으로는 안 만들었습니다.**
 *   그 값은 **토스·유튜브·메타 심사관에게 우리가 직접 알려 주는** 비밀번호입니다.
 *   어드민이 그 값을 받아 주면 **심사관이 회원 명부·결제·문자 발송 화면에 들어올 수** 있습니다.
 *   「곧 바꿀 거니까 괜찮다」로 넘기기엔 **바꾸시기 «전»까지**가 위험합니다.
 *   ⇒ 대신 **여기서 한 번 정하시면 끝**입니다. 제가 그 값을 볼 일도 없습니다.
 *
 * ⚠ **비밀번호는 되돌릴 수 없게 바꿔 저장**합니다(`lib/admin-pw.ts`). 저장소를 통째로
 *   가져가도 비밀번호는 안 나옵니다. 그래서 **잊으시면 저도 못 알려 드립니다** —
 *   그때는 **［열쇠로 들어가기］**로 들어와 여기서 다시 정하시면 됩니다.
 */
type State = { ready?: boolean; id?: string | null; at?: string | null; error?: string; saved?: boolean };

export function AdminPassword() {
  const [st, setSt] = useState<State | null>(null);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/admin/password");
        const d = (await r.json().catch(() => ({}))) as State;
        setSt(d);
        if (d.id) setId(d.id);
      } catch { setSt({ error: "불러오지 못했어요" }); }
    })();
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      location.href = "/admin";
    } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: pw }),
      });
      const d = (await r.json().catch(() => ({}))) as State;
      if (!r.ok) { setErr(d.error ?? "저장하지 못했어요"); return; }
      setSt(d);
      setPw("");
      setOpen(false);
      setMsg("됐습니다. 다음부터 이 아이디와 비밀번호로 들어오시면 됩니다.");
    } finally { setBusy(false); }
  }

  const ready = st?.ready === true;

  return (
    <section className="mt-10">
      <h2 className="t-body font-bold">어드민 로그인</h2>
      <div className="mt-3 rounded-2xl border border-n-200 bg-n-0 p-4">
        {st === null ? (
          <p className="t-small text-[var(--text-soft)]">보는 중…</p>
        ) : (
          <>
            <p className="t-small">
              {ready
                ? <>지금 아이디는 <b>{st.id}</b> 입니다. 긴 열쇠 대신 <b>아이디·비밀번호</b>로 들어오실 수 있어요.</>
                : <>아직 <b>아이디·비밀번호를 안 만드셨습니다.</b> 지금은 긴 열쇠로만 들어오실 수 있어요.</>}
            </p>
            <p className="mt-1 t-caption text-[var(--text-soft)]">
              ⚠ 비밀번호는 <b>되돌릴 수 없게</b> 저장됩니다 — 잊으시면 저도 못 알려 드려요.
              그때는 로그인 화면의 <b>［열쇠로 들어가기］</b>로 들어와 여기서 다시 정하시면 됩니다.
              <br />🔴 <b>［열쇠로 들어가기］는 없애지 않았습니다.</b> 그게 비상구입니다.
            </p>

            {!open ? (
              <button type="button" onClick={() => setOpen(true)}
                className="btn btn-primary !py-1.5 !t-small mt-3">
                {ready ? "아이디·비밀번호 바꾸기" : "아이디·비밀번호 만들기"}
              </button>
            ) : (
              <div className="mt-3 rounded-xl bg-n-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디 (영문·숫자)"
                    autoCapitalize="none" spellCheck={false} className="field" style={{ width: 190 }} />
                  <span className="relative inline-flex items-center">
                    <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
                      placeholder="새 비밀번호 (8자 이상)" autoComplete="new-password"
                      className="field" style={{ width: 230, paddingRight: 52 }} />
                    <button type="button" onClick={() => setShow((v) => !v)}
                      className="absolute right-3 t-caption font-semibold text-[var(--text-soft)]">
                      {show ? "숨기기" : "보기"}
                    </button>
                  </span>
                  <button type="button" disabled={busy || pw.length < 8 || id.trim().length < 3} onClick={save}
                    className="btn btn-primary !py-1.5 !t-small disabled:opacity-40">
                    {busy ? "저장 중…" : "저장"}
                  </button>
                  <button type="button" onClick={() => { setOpen(false); setPw(""); setErr(""); }}
                    className="t-caption underline text-[var(--text-soft)]">그만두기</button>
                </div>
                <p className="mt-2 t-caption text-[var(--text-soft)]">
                  🔴 <b>심사용 계정과 같은 비밀번호는 못 씁니다.</b> 그 비밀번호는 <b>심사관에게 알려 드리는 값</b>이라,
                  같게 두면 심사관이 이 화면에 들어올 수 있습니다.
                </p>
              </div>
            )}

            {msg && <p className="mt-2 t-small" style={{ color: "var(--green)" }}>{msg}</p>}
            {err && <p className="mt-2 t-small text-danger">{err}</p>}

            {/**
              * 🔴 **나가기** — 권반장 지시: 「P7 로 미루지 마십시오.」
              *   운영자 쿠키는 **`ADMIN_SESSION_DAYS` 일**이나 산다. 대표님은 **여러 PC 를 쓰시고 원격으로도** 접속하신다.
              *   나가는 버튼이 없으면 **그 PC 에 그동안 계속 로그인된 채로** 남는다.
              */}
            <div className="mt-4 border-t border-n-100 pt-3">
              <button type="button" disabled={busy} onClick={logout}
                className="rounded-full border border-n-300 px-4 py-1.5 t-small font-semibold disabled:opacity-40">
                이 컴퓨터에서 나가기
              </button>
              <span className="ml-2 t-caption text-[var(--text-soft)]">
                공용 PC 를 쓰셨으면 <b>꼭 눌러 주세요.</b> 안 누르면 <b>{ADMIN_SESSION_DAYS}일 동안</b> 로그인된 채로 남습니다.
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
