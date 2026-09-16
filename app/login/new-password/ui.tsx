"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";

/** 🔴 비밀번호 최소 길이 — 로그인 화면과 **같은 값**이어야 한다(권반장 지시 [25] 3번) */
const PW_MIN = 8;

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/my";
}

/**
 * 새 비밀번호 정하기. (2026-09-17 지시 [25])
 *
 * ★★ **어떻게 들어오나:** 재설정 메일의 링크를 누르면 여기로 옵니다.
 *   주소에 `?code=…` 가 실려 오고, 그것을 **세션으로 바꿔야** 비밀번호를 고칠 수 있습니다.
 *   ⚠ `@supabase/ssr` 브라우저 클라이언트는 그 교환을 **스스로 하기도** 합니다.
 *     그래서 ①이미 됐는지 먼저 보고 ②안 됐으면 우리가 한 번 더 시도합니다. 두 번 해도 해롭지 않습니다.
 *
 * ⚠ **링크는 한 번 쓰면 끝이고 시간이 지나면 만료됩니다.** 그때는 「다시 받아 주세요」로 돌려보냅니다 —
 *   막다른 길을 만들지 않습니다.
 */
export function NewPasswordUi() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const sb = useMemo(() => sbBrowser(), []);

  const [ready, setReady] = useState<"check" | "ok" | "bad">("check");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => {
      /* ① 이미 세션이 생겼나 — ssr 클라이언트가 스스로 교환했을 수 있다 */
      const { data } = await sb.auth.getUser();
      if (data.user) { setReady("ok"); return; }
      /* ② 아니면 주소의 코드로 우리가 교환한다 */
      const code = params.get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (!error) { setReady("ok"); return; }
      }
      setReady("bad");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < PW_MIN) { setErr(`비밀번호는 ${PW_MIN}자 이상으로 만들어 주세요.`); return; }
    setBusy(true); setErr("");
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr("비밀번호를 바꾸지 못했어요. 링크가 오래됐을 수 있어요 — 메일을 다시 받아 주세요.");
      return;
    }
    /* ★ 바꾸는 순간 그대로 **로그인된 상태**다. 다시 로그인하라고 하지 않는다 —
       한 걸음이라도 줄이는 것이 이 작업의 이유다. */
    router.replace(next);
  }

  if (ready === "check") return <main className="px-6 py-24 text-center text-[var(--text-soft)]">확인 중…</main>;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      <Link href="/" className="t-body inline-flex items-center font-bold"
        style={{ color: "var(--accent)", minHeight: "var(--tap)", paddingRight: "var(--s-3)" }}>
        온스토리
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">새 비밀번호 정하기</h1>

      {ready === "bad" ? (
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
            <button type="submit" disabled={busy || pw.length < PW_MIN}
              className="w-full rounded-xl px-4 py-3.5 t-body font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {busy ? "바꾸는 중…" : "이 비밀번호로 정하기"}
            </button>
          </form>
        </>
      )}

      {err && <p className="mt-4 t-body text-danger">{err}</p>}
    </main>
  );
}
