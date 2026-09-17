"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";
import { PW_MIN } from "@/config/password";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/my";
}

/**
 * 새 비밀번호 정하기. (2026-09-17 지시 [25] · 🔴 [41] 로 «지금 비밀번호»를 묻게 고침)
 *
 * ★★ **이 화면은 «두 사람»이 옵니다. 둘을 갈라야 합니다.**
 *
 * | 누가 | 어떻게 들어오나 | 지금 비밀번호를 묻나 |
 * |---|---|---|
 * | **잊어버린 분** | 재설정 메일의 링크 | ❌ **안 묻습니다** — 잊어서 오신 분입니다 |
 * | **로그인한 사장님** | 마이페이지 「비밀번호 바꾸기」 | ✅ 🔴 **묻습니다** |
 *
 * 🔴🔴 **[41] 에서 뚫려 있던 것:** [34] 로 마이페이지에 길이 났는데 **이 화면을 그대로 재사용**해
 *   **로그인만 돼 있으면 아무것도 안 묻고 바꿔 줬습니다.**
 *   ⇒ **로그인한 채 자리를 비우면 남이 비밀번호를 바꿔 계정을 가져갑니다.**
 *
 * ⚠⚠ **가르는 판정은 이 화면이 하지 않습니다.** 화면에서 정하면 개발자도구로 건너뛰면 그만입니다.
 *   **서버(`/api/account/password`)가 세션 토큰의 `amr` 을 보고 정하고**, 이 화면은 그 답을
 *   **받아서 칸을 띄울 뿐**입니다. 바꾸는 길도 그 라우트 하나뿐입니다
 *   (전에는 여기서 `sb.auth.updateUser({password})` 를 직접 불렀습니다 — 그 줄이 구멍이었습니다).
 *
 * ★★ **어떻게 들어오나(메일 링크):** 주소에 `?code=…` 가 실려 오고, 그것을 **세션으로 바꿔야** 합니다.
 *   ⚠ `@supabase/ssr` 브라우저 클라이언트는 그 교환을 **스스로 하기도** 합니다.
 *     그래서 ①이미 됐는지 먼저 보고 ②안 됐으면 우리가 한 번 더 시도합니다.
 * ⚠ **링크는 한 번 쓰면 끝이고 시간이 지나면 만료됩니다.** 그때는 「다시 받아 주세요」로 돌려보냅니다 —
 *   막다른 길을 만들지 않습니다.
 */
export function NewPasswordUi() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const sb = useMemo(() => sbBrowser(), []);

  const [ready, setReady] = useState<"check" | "ok" | "bad">("check");
  /** 서버가 정해 준다. `null` 이면 아직 못 물어본 것 — 그동안 단추를 잠가 둔다 */
  const [needsCurrent, setNeedsCurrent] = useState<boolean | null>(null);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** 다 바꾼 뒤 화면. `othersOut` 은 「다른 기기를 끊었나」 */
  const [done, setDone] = useState<{ othersOut: boolean } | null>(null);

  useEffect(() => {
    void (async () => {
      /* ① 이미 세션이 생겼나 — ssr 클라이언트가 스스로 교환했을 수 있다 */
      const { data } = await sb.auth.getUser();
      let ok = !!data.user;
      /* ② 아니면 주소의 코드로 우리가 교환한다 */
      if (!ok) {
        const code = params.get("code");
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          ok = !error;
        }
      }
      if (!ok) { setReady("bad"); return; }
      setReady("ok");

      /* 🔴 **묻는지 마는지는 서버에게 묻는다.** 화면이 정하지 않는다 */
      try {
        const r = await fetch("/api/account/password", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { needsCurrent?: boolean };
        setNeedsCurrent(r.ok ? !!d.needsCurrent : true);   // 못 물어봤으면 «묻는» 쪽으로
      } catch {
        setNeedsCurrent(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < PW_MIN) { setErr(`비밀번호는 ${PW_MIN}자 이상으로 만들어 주세요.`); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: needsCurrent ? cur : undefined, newPassword: pw }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; othersOut?: boolean; needsCurrent?: boolean };
      setBusy(false);
      if (!r.ok) {
        /* ⚠ 서버가 「지금 비밀번호가 필요하다」고 하면 **칸을 띄운다** —
             화면이 안 띄우고 있었더라도 여기서 바로잡힌다 */
        if (d.needsCurrent) setNeedsCurrent(true);
        setErr(d.error ?? "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      /* 🔴 **바꿨다고 «분명히» 알려 준다**(권반장 지시 [41] ③).
         조용히 넘어가면 사장님은 바뀐 건지 아닌지 모른 채 떠난다. */
      setDone({ othersOut: d.othersOut !== false });
    } catch {
      setBusy(false);
      setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  if (ready === "check") return <main className="px-6 py-24 text-center text-[var(--text-soft)]">확인 중…</main>;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <Link href="/" className="t-body inline-flex items-center font-bold"
        style={{ color: "var(--accent)", minHeight: "var(--tap)", paddingRight: "var(--s-3)" }}>
        온스토리
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {done ? "비밀번호를 바꿨어요" : "새 비밀번호 정하기"}
      </h1>

      {done ? (
        <>
          <p className="mt-2 t-body" style={{ color: "var(--text)" }}>
            앞으로는 <b>새 비밀번호</b>로 로그인하세요.
          </p>
          {/* ⚠ **끊었는지 못 끊었는지를 사실대로 말한다.** 「끊었어요」라고 해 놓고 안 끊으면 그게 거짓말이다 */}
          <p className="mt-2 t-caption" style={{ color: "var(--muted)" }}>
            {done.othersOut
              ? "다른 기기에 남아 있던 로그인은 모두 끊었어요. 이 기기는 그대로 쓰셔도 됩니다."
              : "⚠ 다른 기기의 로그인은 끊지 못했어요. 쓰시던 다른 기기가 있으면 거기서 직접 로그아웃해 주세요."}
          </p>
          <Link href={next}
            className="mt-8 block w-full rounded-xl px-4 py-3.5 text-center t-body font-semibold text-white"
            style={{ background: "var(--accent)" }}>
            계속하기
          </Link>
        </>
      ) : ready === "bad" ? (
        /* ⚠ 막다른 길을 만들지 않는다 — 왜 안 되는지와 무엇을 하면 되는지를 함께 준다 */
        <>
          <p className="mt-2 t-body" style={{ color: "var(--text)" }}>
            이 링크는 <b>이미 쓰셨거나 시간이 지났어요.</b> 메일을 다시 받아 주세요.
          </p>
          <Link href={`/login?next=${encodeURIComponent(next)}`}
            className="mt-8 block w-full rounded-xl px-4 py-3.5 text-center t-body font-semibold text-white"
            style={{ background: "var(--accent)" }}>
            비밀번호 재설정 메일 다시 받기
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 t-body" style={{ color: "var(--muted)" }}>
            앞으로 이 비밀번호로 로그인하시게 됩니다.
          </p>
          <form onSubmit={save} className="mt-8 space-y-3">
            {/* 🔴 **지금 비밀번호** — 로그인한 채 바꾸실 때만 뜹니다(서버가 정합니다) */}
            {needsCurrent && (
              <input
                type="password"
                required
                autoComplete="current-password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                placeholder="지금 쓰시는 비밀번호"
                className="w-full rounded-xl border bg-white py-3 t-body outline-none focus:border-green-700"
                style={{ borderColor: "var(--line)", paddingLeft: "var(--s-4)", paddingRight: "var(--s-4)" }}
              />
            )}
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={PW_MIN}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={`새 비밀번호 (${PW_MIN}자 이상)`}
                className="w-full rounded-xl border bg-white py-3 t-body outline-none focus:border-green-700"
                style={{ borderColor: "var(--line)", paddingLeft: "var(--s-4)", paddingRight: "var(--s-8)" }}
              />
              {/* 🔴 「보기」 눈 — 로그인 화면과 같은 이유다(폰 오타) */}
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
                aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="absolute inset-y-0 right-0 flex items-center t-caption font-semibold"
                style={{ paddingInline: "var(--s-3)", color: "var(--muted)", minHeight: "var(--tap)" }}>
                {showPw ? "숨기기" : "보기"}
              </button>
            </div>
            {/* ⚠ 서버에게 «묻는지 마는지»를 못 들었으면 아직 누르지 못하게 한다 —
                  칸이 없는 채로 보냈다가 「지금 비밀번호를 넣어 주세요」로 되돌아오면 놀란다 */}
            <button type="submit" disabled={busy || needsCurrent === null || pw.length < PW_MIN || (needsCurrent && !cur)}
              className="w-full rounded-xl px-4 py-3.5 t-body font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {busy ? "바꾸는 중…" : "이 비밀번호로 정하기"}
            </button>
          </form>
          {needsCurrent && (
            <p className="mt-3 t-caption" style={{ color: "var(--muted)" }}>
              비밀번호가 기억나지 않으시면 로그아웃하신 뒤 <b>「비밀번호를 잊으셨나요?」</b>로 메일을 받아 주세요.
            </p>
          )}
        </>
      )}

      {err && <p className="mt-4 t-body text-danger">{err}</p>}
    </main>
  );
}
