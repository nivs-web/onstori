"use client";

import { useEffect, useId, useState } from "react";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { lockedPayload } from "@/lib/plan-gate";

/**
 * [녹화 링크 메일로 받기] · [녹화 링크 문자로 받기] — 에디터 상단 (이야기 엔진 1차, 기획1 /mainplan #rec).
 *
 * ★★ **2026-09-16 대표님 지시 — 버튼 둘 + 받는 곳 직접 입력.**
 *   「2개 중 1개를 누르면 **바로 문자가 날아가는 게 아니라**, 하단에 입력폼이 뜨고 보내기 버튼도
 *    뜨게 만들어. **원하는 이메일 주소 혹은 원하는 폰 번호로 전송 가능한 시스템**으로.」
 *
 * 🔴 **버튼을 누르는 것만으로는 아무것도 나가지 않는다.** 버튼은 «칸을 펼치기»만 한다.
 *   실제 발송은 [보내기] 를 눌러 `mode` 를 실어 보낼 때뿐이다 — 서버도 `mode` 가 없으면
 *   보내지 않고 기본값만 돌려준다(app/api/story/send-link/route.ts).
 *
 * 🔴 **문자는 정회원만.** 잠겼어도 **버튼을 숨기지 않는다** — 보이게 두고 누르면 안내가 뜨는 것이
 *   결제 유도다(대표님 방침 · lib/plan-gate.ts). 문구는 `lockedPayload("sms")` 한 곳에서 온다.
 *
 * ★ 받는 곳은 **미리 채워 드린다.** 서버가 「설정 → 사이트 번호 / 로그인 메일」 순으로 찾아 준다.
 *   사장님은 다른 데로 받고 싶으면 그 자리에서 고치시면 된다.
 * ⚠ 투어 앵커 목록(config/tours.ts)에 없는 요소라 data-tour 는 붙이지 않는다(규칙 3).
 */

/** 잠금 문구의 단일 출처 — 화면에 다시 적지 않는다 */
const LOCK = lockedPayload("sms");

type Mode = "email" | "sms";

type Probe = {
  fill: { email: string; phone: string };
  smsLocked: boolean;
  ready: { sms: boolean; email: boolean };
  link: string;
  question: string;
};

export function StoryLinkButton({ slug, phone }: { slug: string; phone: string }) {
  /* ⚠ 이 부품은 한 화면에 **여러 번** 걸린다(이야기 메뉴 · 영상 메뉴 두 자리).
     id 를 글자로 박으면 라벨이 엉뚱한 칸을 가리킨다 — React 가 주는 고유 id 를 쓴다. */
  const inputId = useId();
  const [probe, setProbe] = useState<Probe | null>(null);
  /** 지금 펼쳐진 칸 — null 이면 버튼 둘만 보인다 */
  const [open, setOpen] = useState<Mode | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  /** 보낸 뒤 그 자리에 보여 줄 말 */
  const [done, setDone] = useState<{ to: string; question: string; link: string } | null>(null);
  const [err, setErr] = useState("");
  /** 서버가 402(결제 필요)로 답했을 때 — probe 를 못 받았어도 잠금을 보여 줄 수 있게 */
  const [locked, setLocked] = useState(false);

  const anon = () => { try { return localStorage.getItem("onstori:anonId") ?? undefined; } catch { return undefined; } };

  /* 기본값·잠금 상태를 미리 물어본다. ⚠ 이 요청은 **아무것도 보내지 않는다**(probe) */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/story/send-link", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, anonId: anon(), probe: true }),
        });
        const d = (await r.json().catch(() => ({}))) as Partial<Probe> & { error?: string };
        if (!alive || !r.ok || !d.fill) return;
        setProbe(d as Probe);
        setLocked(d.smsLocked === true);
      } catch { /* 못 불러와도 화면은 돈다 — 칸을 비워 두고 사장님이 직접 치시면 된다 */ }
    })();
    return () => { alive = false; };
  }, [slug]);

  /** 버튼을 누르면 «칸만» 펼친다. 같은 버튼을 다시 누르면 접는다 */
  function openMode(m: Mode) {
    setErr(""); setDone(null);
    if (open === m) { setOpen(null); return; }
    setOpen(m);
    setTo(m === "email" ? (probe?.fill.email ?? "") : (probe?.fill.phone ?? formatPhone(phone)));
  }

  async function send() {
    if (!open || busy) return;
    /* ⚠ 서버도 같은 검사를 한다. 여기 검사는 «왕복 한 번을 아끼려고» 있는 것이다 */
    if (open === "sms" && !isValidPhone(to)) { setErr("받을 전화번호를 다시 확인해 주세요."); return; }
    if (open === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setErr("받을 이메일 주소를 다시 확인해 주세요."); return; }

    setBusy(true); setErr(""); setDone(null);
    try {
      const r = await fetch("/api/story/send-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon(), mode: open, to: to.trim() }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        error?: string; sent?: boolean; to?: string | null; link?: string; question?: string; blocked?: string | null; locked?: boolean;
      };
      /* 🔴 402 = 「결제하세요」. 401·403 과 섞이면 「로그인하세요」가 떠 버린다 */
      if (r.status === 402 || d.locked) { setLocked(true); setBusy(false); return; }
      if (!r.ok) { setErr(d.error ?? "보내지 못했어요."); setBusy(false); return; }
      if (!d.sent) { setErr(d.blocked ?? "보내지 못했어요."); setBusy(false); return; }
      setDone({ to: d.to ?? to, question: d.question ?? "", link: d.link ?? probe?.link ?? "" });
    } catch { setErr("연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요."); }
    setBusy(false);
  }

  const showLock = open === "sms" && locked;

  return (
    <section className="mt-4 rounded-xl p-3" style={{ background: "var(--forest)", color: "var(--cream)" }}>
      <div className="min-w-0">
        <p className="t-caption font-bold">이번 주 이야기, 60초만 말씀해 주세요</p>
        <p className="mt-0.5 t-caption leading-relaxed opacity-75">문자로 온 링크를 브라우저에서 열면 바로 녹화됩니다. 글쓰기 없음 · 앱 설치 없음.</p>
      </div>

      {/* 버튼 둘 — 누르면 «아래 칸이 펼쳐질» 뿐, 여기서는 아무것도 나가지 않는다 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {([["email", "녹화 링크 메일로 받기"], ["sms", "녹화 링크 문자로 받기"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => openMode(m)} aria-expanded={open === m}
            className="shrink-0 rounded-full px-3.5 py-1.5 t-caption font-bold"
            style={open === m
              ? { background: "var(--lime)", color: "var(--forest)" }
              : { background: "transparent", color: "var(--cream)", border: "1px solid var(--lime)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* 🔴 잠금 안내 — 문자 버튼은 «보이게 두고» 누르면 여기가 뜬다. 그게 결제 유도다 */}
      {showLock && (
        <div className="mt-3 rounded-lg bg-white/10 p-3 t-caption leading-relaxed">
          <p className="font-bold">{LOCK.title}</p>
          <p className="mt-1">{LOCK.body}</p>
          <p className="mt-1 opacity-80">{LOCK.why}</p>
          <a href={LOCK.href} className="mt-2 inline-block rounded-full px-3 py-1 font-bold"
            style={{ background: "var(--lime)", color: "var(--forest)" }}>{LOCK.cta}</a>
        </div>
      )}

      {/* 입력칸 + [보내기] — 여기를 눌러야 나간다 */}
      {open && !showLock && (
        <div className="mt-3 rounded-lg bg-white/10 p-3">
          <label htmlFor={inputId} className="t-caption font-bold">
            {open === "email" ? "받을 이메일 주소" : "받을 전화번호"}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input id={inputId} className="field" style={{ flex: "1 1 14rem", width: "auto" }}
              type={open === "email" ? "email" : "tel"}
              inputMode={open === "email" ? "email" : "tel"}
              autoComplete={open === "email" ? "email" : "tel"}
              maxLength={open === "email" ? 120 : 20}
              placeholder={open === "email" ? "sajang@example.com" : "010-0000-0000"}
              value={to}
              /* ★ 전화번호는 치는 대로 하이픈이 들어간다 — 판정·모양 모두 lib/phone.ts 가 한다 */
              onChange={(e) => setTo(open === "sms" ? formatPhone(e.target.value) : e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }} />
            <button type="button" onClick={() => void send()} disabled={busy}
              className="shrink-0 rounded-full px-4 py-2 t-caption font-bold disabled:opacity-50"
              style={{ background: "var(--lime)", color: "var(--forest)" }}>
              {busy ? "보내는 중…" : "보내기"}
            </button>
          </div>
          <p className="mt-2 t-caption leading-relaxed opacity-75">
            {open === "email"
              ? "원하시는 메일 주소로 바꿔서 받으실 수 있어요."
              : "원하시는 번호로 바꿔서 받으실 수 있어요."}
          </p>
        </div>
      )}

      {/* 보낸 뒤 — 「○○로 보냈습니다」를 그 자리에 */}
      {done && (
        <div className="mt-3 rounded-lg bg-white/10 p-3 t-caption leading-relaxed">
          <p className="font-bold">{done.to} 로 보냈습니다.</p>
          {done.question && <p className="mt-1 opacity-80">오늘의 질문: {done.question}</p>}
          {done.link && <a href={done.link} target="_blank" rel="noopener" className="mt-2 inline-block rounded-full border border-white/40 px-3 py-1 font-bold">지금 열기 ↗</a>}
        </div>
      )}

      {/* ★ 보내지 않고 **이 기기에서 바로** 열 수도 있다 — 견본·문자 채널이 없을 때의 길이다 */}
      {probe?.link && !done && (
        <a href={probe.link} target="_blank" rel="noopener"
          className="mt-3 inline-block rounded-full border border-white/40 px-3 py-1 t-caption font-bold">지금 열기 ↗</a>
      )}

      {err && <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--danger)" }}>{err}</p>}
    </section>
  );
}
