"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";

/**
 * 로그인 뒤 어디로 보낼지.
 *
 * ★ 기본값은 `/my` 다. 첫 페이지가 아니다(2026-09-07 회장님 확정).
 *   로그인은 "내 것을 관리하러" 하는 행동이지 구경하러 하는 행동이 아니다.
 *   전에는 `/` 라서, 주소창에 onstori.com/login 을 직접 치거나 옛 북마크로 들어온 사장님이
 *   로그인하고도 첫 페이지에 떨어져 자기 홈페이지를 어디서 고치는지 알 길이 없었다.
 *
 * ⚠ `//` 로 시작하는 값은 남의 사이트로 튕겨 보내는 수법이라 반드시 막는다.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/my";
}

/** Supabase Email OTP Length 허용 범위 — 대시보드 설정에 따라 달라지므로 자릿수를 고정하지 않는다 */
const OTP_MIN = 6;
const OTP_MAX = 10;

/** 로그인 — 카카오 OAuth + 이메일 6자리 인증번호(OTP). 성공 시 익명 생성 사이트 귀속(claim) 후 next로 이동 */
export function LoginUi() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const sb = useMemo(() => sbBrowser(), []);

  const [step, setStep] = useState<"check" | "email" | "code">("check");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get("error") ? "로그인에 실패했어요. 다시 시도해주세요." : "");

  /** 로그인 완료 공통 처리 — 이 브라우저에서 익명으로 만든 사이트를 계정에 귀속시킨 뒤 이동 */
  async function finish() {
    try {
      const anonId = localStorage.getItem("onstori:anonId");
      if (anonId) {
        await fetch("/api/auth/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonId }),
        });
      }
    } catch {}
    router.replace(next);
  }

  useEffect(() => {
    // 카카오 콜백 복귀 or 이미 로그인 상태면 바로 마무리
    sb.auth.getUser().then(({ data }) => {
      if (data.user) void finish();
      else setStep("email");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 카카오는 서버 라우트가 시작한다 — Supabase 프로바이더는 account_email 스코프 때문에 KOE205로 막힌다(lib/kakao.ts) */
  function kakao() {
    setBusy(true);
    setErr("");
    // 페이지가 아니라 서버 리다이렉트를 내는 Route Handler로 나가야 해서 클라이언트 라우터를 쓸 수 없다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = `/auth/kakao?next=${encodeURIComponent(next)}`;
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setErr("인증 메일을 보내지 못했어요. 주소를 확인하거나 잠시 후 다시 시도해주세요.");
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setErr("인증번호가 맞지 않아요. 메일을 다시 확인해주세요.");
      return;
    }
    await finish();
  }

  if (step === "check") return <main className="px-6 py-24 text-center text-[var(--text-soft)]">확인 중…</main>;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-20">
      {/* 단독으로 서 있는 링크라 폰에서 48px 을 채운다(문장 속 링크는 예외지만 이건 아니다).
          로고 글자만 크게 만들면 균형이 깨지므로 누를 수 있는 넓이를 키운다. */}
      <Link
        href="/"
        className="t-body inline-flex items-center font-bold"
        style={{ color: "var(--accent)", minHeight: "var(--tap)", paddingRight: "var(--s-3)" }}
      >
        온스토리
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">로그인</h1>
      <p className="mt-2 t-body" style={{ color: "var(--muted)" }}>
        로그인하면 내 홈페이지를 어느 기기에서든 수정할 수 있어요.
      </p>

      <button
        onClick={kakao}
        disabled={busy}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 t-body font-semibold disabled:opacity-50"
        // 카카오 브랜드색 — 남의 로고/버튼 색이라 토큰으로 바꾸지 않는다 (docs/DESIGN.md §9 예외)
        style={{ background: "#FEE500", color: "#191919" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.25 4.65 6.64-.2.75-.75 2.73-.86 3.15-.13.53.2.52.41.38.17-.11 2.65-1.8 3.72-2.53.66.1 1.36.16 2.08.16 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
        </svg>
        카카오로 시작하기
      </button>

      <div className="my-6 flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        또는 이메일로
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full rounded-xl border bg-white px-4 py-3 t-body outline-none focus:border-green-700"
            style={{ borderColor: "var(--line)" }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-xl px-4 py-3.5 t-body font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "보내는 중…" : "인증번호 받기"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="t-body">
            <b>{email}</b> 로 보낸 인증번호를 입력해주세요.
          </p>
          {/* Supabase의 Email OTP Length는 대시보드에서 6~10자리로 바뀔 수 있다(현재 8자리).
              자릿수를 하드코딩하면 설정만 바뀌어도 로그인이 막히므로 범위로 받는다. */}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))}
            placeholder="인증번호"
            className="field kicker-wide text-center text-lg"
            style={{ borderColor: "var(--line)" }}
          />
          <button
            type="submit"
            disabled={busy || code.length < OTP_MIN}
            className="w-full rounded-xl px-4 py-3.5 t-body font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "확인 중…" : "로그인"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setErr(""); }}
            className="w-full py-2 t-body underline"
            style={{ color: "var(--muted)" }}
          >
            다른 이메일로 받기
          </button>
        </form>
      )}

      {err && <p className="mt-4 t-body text-danger">{err}</p>}
    </main>
  );
}
