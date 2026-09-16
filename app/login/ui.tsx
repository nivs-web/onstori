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

/**
 * 🔴 **비밀번호 최소 길이 — 8자.** (2026-09-17 대표님 확정 · 권반장 지시 [25] 3번)
 *
 * ⚠ **대문자·특수문자를 강요하지 않는다.** 우리 손님은 가게 사장님이다.
 *   까다로우면 **그 자리에서 나간다.** 짧은 규칙 하나가 긴 규칙 넷보다 낫다.
 */
const PW_MIN = 8;

/**
 * 로그인 — 카카오 + **이메일·비밀번호**. (2026-09-17 대표님 확정으로 인증번호 방식을 걷어냈다)
 *
 * ★★ 대표님 원문: 「이메일 인증 로그인 너무 불편한 거 같아. 이메일 들어가서 확인하고 인증번호 넣고 —
 *   **누가 요즘 그런 방식을 쓰니?** … 이메일 가입 시 인증은 필요하지만, 이메일로 «로그인»은
 *   이메일과 비밀번호 입력 방식이다. **이걸로 확정!**」
 *
 * ★ 화면은 넷이다 — `signin`(로그인) · `signup`(가입) · `forgot`(비밀번호 찾기) · `sent`(메일 보냄).
 * ⚠ **카카오는 한 글자도 안 건드렸다.** `lib/kakao.ts` 와 `/auth/kakao` 는 그대로다 —
 *   그것을 깨뜨리는 것이 이 작업에서 가장 위험하다(권반장 경고).
 */
export function LoginUi() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const sb = useMemo(() => sbBrowser(), []);

  const [step, setStep] = useState<"check" | "signin" | "signup" | "forgot" | "sent">("check");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  /** 🔴 「보기」 눈 — 폰에서 오타로 못 들어가는 일이 가장 흔하다(권반장 지시 4번) */
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get("error") ? "로그인에 실패했어요. 다시 시도해주세요." : "");
  /** 카카오로 시작한 분께 드리는 안내 — 로그인이 «실패한 뒤에만» 켜진다 */
  const [kakaoHint, setKakaoHint] = useState(false);
  /** `sent` 화면에서 무엇을 보냈는지 — 문구가 달라진다 */
  const [sentKind, setSentKind] = useState<"signup" | "reset">("signup");

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
      else setStep("signin");
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

  /**
   * 🔴 **「우리 쪽 메일이 안 나간 것」인가.** (2026-09-17 지시 [28])
   *
   * ⚠ **이 구별이 없으면 사장님께 거짓말을 합니다.** 2026-09-17 실측 —
   *   조직 «밖» 주소로 가입하면 Supabase 가 **500 `Error sending confirmation email`** 을 주고
   *   **계정이 아예 안 만들어집니다.** 그런데 화면은 「주소를 확인하세요」라고 했습니다.
   *   사장님은 자기 이메일이 틀린 줄 알고 **몇 번이고 다시 칩니다.** 그러다 떠납니다.
   *
   * ★ 지금 그런 이유: Supabase **기본 메일**은 「시간당 2통 · 조직 구성원 주소만」입니다.
   *   자체 SMTP 를 붙이면 사라집니다 — `docs/WAITING.md` 에 대표님 판단으로 올려 두었습니다.
   */
  function isMailDown(msg: string, status?: number): boolean {
    return /sending|smtp|rate limit|over_email_send|not authorized/i.test(msg) || status === 429 || status === 500;
  }

  /** 🔴 메일이 안 나갔을 때 하는 말 — **주소 탓을 하지 않는다.** 그리고 갈 길을 준다 */
  const MAIL_DOWN =
    "지금은 저희 쪽에서 메일을 보내지 못하고 있어요. 사장님 주소 문제가 아닙니다. " +
    "잠시 후 다시 해 보시거나, 위의 [카카오로 시작하기]를 눌러 주세요.";

  /** 로그인 실패 뒤 — 「혹시 카카오로 시작하신 분인가」만 물어본다(`/api/auth/how` 머리말 참조) */
  async function askKakaoOnly(addr: string): Promise<boolean> {
    try {
      const r = await fetch("/api/auth/how", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      return !!((await r.json()) as { kakaoOnly?: boolean }).kakaoOnly;
    } catch { return false; }
  }

  /** ── 로그인 — 이메일 + 비밀번호 ── */
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setKakaoHint(false);
    const addr = email.trim();
    const { error } = await sb.auth.signInWithPassword({ email: addr, password: pw });
    if (!error) { await finish(); return; }
    /* 🔴 **어느 쪽이 틀렸는지 알려 주지 않는다**(권반장 지시 5번).
       「이 메일은 없습니다」라고 하면 남의 계정이 있는지 캐내는 데 쓰인다. */
    setErr("이메일이나 비밀번호가 맞지 않아요.");
    /* 다만 **카카오로 시작한 분**께는 길을 알려 드린다 — 그분은 비밀번호가 아예 없어서
       무엇을 넣어도 영원히 틀리고, 「비밀번호 찾기」도 소용이 없다(만든 적이 없으니까). */
    if (await askKakaoOnly(addr)) { setKakaoHint(true); setErr(""); }
    setBusy(false);
  }

  /** ── 가입 — 🔴 이메일 인증은 그대로 필요하다(대표님 확정) ── */
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < PW_MIN) { setErr(`비밀번호는 ${PW_MIN}자 이상으로 만들어 주세요.`); return; }
    setBusy(true); setErr(""); setKakaoHint(false);
    const { data, error } = await sb.auth.signUp({
      email: email.trim(), password: pw,
      /* 확인 메일의 링크가 돌아올 곳 — 돌아오면 그대로 로그인된 채로 이어진다 */
      options: { emailRedirectTo: `${location.origin}/login?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) {
      /* 🔴 **메일이 안 나간 것과 주소가 이상한 것을 «갈라서» 말한다**(2026-09-17 지시 [28]).
         갈라 놓지 않으면 사장님이 자기 주소를 탓하며 몇 번이고 다시 칩니다. */
      if (isMailDown(error.message, (error as { status?: number }).status)) { setErr(MAIL_DOWN); return; }
      /* 이미 있는 메일이면 Supabase 가 «가짜 성공»을 주기도 한다(계정 캐내기 방지).
         그래서 오류 문구도 「이미 있다」를 단정하지 않는다. */
      setErr("가입하지 못했어요. 주소를 확인하시거나, 이미 계정이 있으시면 [비밀번호를 잊으셨나요?]를 눌러 주세요.");
      return;
    }
    /* 확인이 필요 없게 설정돼 있으면 세션이 바로 생긴다 — 그때는 곧장 들어간다 */
    if (data.session) { await finish(); return; }
    setSentKind("signup"); setStep("sent");
  }

  /**
   * ── 비밀번호 찾기 / 만들기 ──
   * 🔴 **인증번호로 가입하신 분들에게도 이 길이 «비밀번호 만들기»다**(권반장 지시 2번).
   *   그분들은 비밀번호가 없으니 「잊었다」가 아니라 「아직 없다」이고, 길은 같다.
   * ⚠ **보냈는지 안 보냈는지 구별해 주지 않는다** — 없는 메일에도 같은 화면을 보여 준다.
   *   그래야 「이 메일이 우리 손님인가」를 캐낼 수 없다.
   */
  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setKakaoHint(false);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/login/new-password?next=${encodeURIComponent(next)}`,
    }).catch((e: Error) => ({ error: e }));
    setBusy(false);
    /* 🔴 **메일이 «안 나간» 것을 삼키지 않는다**(2026-09-17 지시 [28] 3번).
       전에는 무슨 일이 있어도 「메일을 보냈어요」를 띄웠습니다 — 못 보냈을 때도 그랬습니다.
       사장님은 오지 않는 메일을 **영영 기다립니다.** 그건 침묵보다 나쁩니다.
       ⚠ **「없는 주소」는 여전히 구별해 주지 않습니다** — 그때는 Supabase 가 200 을 주고,
         우리도 「보냈어요」를 그대로 띄웁니다(계정 캐내기 방지). 갈라지는 것은 «우리 쪽 고장»뿐입니다.
       ⚠ SMTP 를 제대로 붙이면 이 오류는 드물어집니다. 그때는 이 갈래가 거의 안 쓰입니다. */
    if (error && isMailDown(error.message, (error as { status?: number }).status)) { setErr(MAIL_DOWN); return; }
    setSentKind("reset"); setStep("sent");
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

      {/* ══ 이메일 — 로그인 / 가입 / 비밀번호 찾기 ══ */}
      {step === "sent" ? (
        <section className="rounded-xl p-4" style={{ background: "var(--n-50)" }}>
          <p className="t-body font-semibold">메일을 보냈어요</p>
          <p className="mt-2 t-body" style={{ color: "var(--text)" }}>
            <b>{email.trim()}</b> 로 보냈습니다.{" "}
            {sentKind === "signup"
              ? "메일 속 링크를 누르시면 가입이 끝나고 바로 로그인됩니다."
              : "메일 속 링크를 누르시면 새 비밀번호를 정하실 수 있어요."}
          </p>
          <p className="mt-2 t-caption" style={{ color: "var(--muted)" }}>
            메일이 안 보이면 <b>스팸함</b>도 한 번 봐 주세요. 몇 분 걸릴 수 있어요.
          </p>
          <button type="button" onClick={() => { setStep("signin"); setPw(""); }}
            className="mt-4 w-full py-2 t-body underline" style={{ color: "var(--muted)" }}>
            로그인 화면으로
          </button>
        </section>
      ) : (
        <form onSubmit={step === "signin" ? signIn : step === "signup" ? signUp : forgot} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setKakaoHint(false); }}
            placeholder="이메일 주소"
            className="w-full rounded-xl border bg-white px-4 py-3 t-body outline-none focus:border-green-700"
            style={{ borderColor: "var(--line)" }}
          />

          {/* 비밀번호 — 찾기 화면에서는 안 받는다 */}
          {step !== "forgot" && (
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={step === "signup" ? PW_MIN : undefined}
                autoComplete={step === "signup" ? "new-password" : "current-password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={step === "signup" ? `비밀번호 (${PW_MIN}자 이상)` : "비밀번호"}
                className="w-full rounded-xl border bg-white py-3 t-body outline-none focus:border-green-700"
                style={{ borderColor: "var(--line)", paddingLeft: "var(--s-4)", paddingRight: "var(--s-8)" }}
              />
              {/* 🔴 「보기」 눈 — 폰에서 오타로 못 들어가는 일이 가장 흔하다(권반장 지시 4번).
                  ⚠ 글자가 아니라 «상태»를 읽어 주는 단추라 aria-pressed 를 단다. */}
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
                aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="absolute inset-y-0 right-0 flex items-center t-caption font-semibold"
                style={{ paddingInline: "var(--s-3)", color: "var(--muted)", minHeight: "var(--tap)" }}
              >
                {showPw ? "숨기기" : "보기"}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim() || (step !== "forgot" && !pw)}
            className="w-full rounded-xl px-4 py-3.5 t-body font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "잠시만요…" : step === "signin" ? "로그인" : step === "signup" ? "가입하기" : "비밀번호 재설정 메일 받기"}
          </button>

          {/* ── 아래 줄 — 화면마다 갈 곳이 다르다 ── */}
          {step === "signin" && (
            <div className="flex items-center justify-between" style={{ paddingTop: "var(--s-1)" }}>
              <button type="button" onClick={() => { setStep("forgot"); setErr(""); setKakaoHint(false); }}
                className="t-caption underline" style={{ color: "var(--muted)", minHeight: "var(--tap)" }}>
                비밀번호를 잊으셨나요?
              </button>
              <button type="button" onClick={() => { setStep("signup"); setErr(""); setKakaoHint(false); }}
                className="t-caption font-semibold underline" style={{ color: "var(--accent)", minHeight: "var(--tap)" }}>
                처음이신가요? 가입하기
              </button>
            </div>
          )}
          {step !== "signin" && (
            <button type="button" onClick={() => { setStep("signin"); setErr(""); setKakaoHint(false); }}
              className="w-full py-2 t-body underline" style={{ color: "var(--muted)" }}>
              로그인 화면으로
            </button>
          )}

          {/* 🔴 인증번호로 가입하신 분 안내 — 그분들에겐 «아직 비밀번호가 없다»(권반장 지시 2번).
              「잊었다」가 아니라 「아직 없다」라서, 같은 길을 다른 말로 한 번 더 알려 드린다. */}
          {step === "signin" && (
            <p className="t-caption" style={{ marginTop: "var(--s-3)", color: "var(--muted)", lineHeight: 1.6 }}>
              전에 <b>인증번호</b>로 로그인하셨나요? 그때는 비밀번호가 없었어요 —
              [비밀번호를 잊으셨나요?]를 누르시면 <b>비밀번호를 새로 만드실 수 있습니다.</b>
            </p>
          )}
          {step === "signup" && (
            <p className="t-caption" style={{ marginTop: "var(--s-2)", color: "var(--muted)", lineHeight: 1.6 }}>
              가입하시면 <b>확인 메일</b>이 갑니다. 메일 속 링크를 한 번 눌러 주셔야 가입이 끝나요.
            </p>
          )}
        </form>
      )}

      {/* 🔴 카카오로 시작하신 분 — 비밀번호가 «아예 없어» 무엇을 넣어도 안 됩니다(권반장 지시 6번) */}
      {kakaoHint && (
        <section className="mt-4 rounded-xl p-4" style={{ background: "var(--n-50)" }}>
          <p className="t-body font-semibold">이 이메일은 <b>카카오로 시작하셨어요</b></p>
          <p className="mt-2 t-body" style={{ color: "var(--text)" }}>
            그때는 비밀번호를 만들지 않으셨어요. 위의 <b>[카카오로 시작하기]</b> 버튼을 눌러 주세요.
          </p>
        </section>
      )}

      {err && <p className="mt-4 t-body text-danger">{err}</p>}
    </main>
  );
}
