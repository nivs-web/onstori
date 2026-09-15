"use client";

import { useEffect, useState } from "react";

/**
 * 운영자 전용 «홈페이지 주소 바꾸기». (2026-09-15 대표님 지시)
 *
 * ★ 대표님 말씀: 「주소를 변경 원하는 고객은 onstori.com 관리자가 변경해 주는 걸로 가자.」
 *
 * ⚠ **주소는 되돌리기 어려운 것**이다. 사장님이 명함·플레이스·현수막에 적어 둔 주소라
 *   바꾸는 순간 그 종이들이 죽은 링크가 된다. 그래서 문턱을 둘 둔다 —
 *   ①비어 있는 주소인지 **치는 동안** 확인 ②**상호를 손으로 타이핑**해야 버튼이 열린다.
 *   (확인창은 습관적으로 눌린다. 타이핑은 아니다 — `delete-ui.tsx` 와 같은 원칙이다)
 */
export function ChangeSlug({ slug, businessName }: { slug: string; businessName: string }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  /** null = 아직 안 봤다 */
  const [free, setFree] = useState<boolean | null>(null);
  const [freeWhy, setFreeWhy] = useState("");

  /* 가입 화면과 **같은 검사**를 쓴다 — 두 곳이 다르면 한쪽이 거짓말을 한다 */
  useEffect(() => {
    const v = next.trim().toLowerCase();
    if (!v || v === slug) { setFree(null); setFreeWhy(""); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/slug-check?slug=${encodeURIComponent(v)}`);
        const d = await r.json();
        if (!alive) return;
        setFree(Boolean(d.available));
        setFreeWhy(d.available ? `onstori.com/${v} — 쓸 수 있어요` : String(d.reason ?? ""));
      } catch { if (alive) { setFree(null); setFreeWhy(""); } }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [next, slug]);

  const ready = free === true && typed.trim() === businessName.trim() && !busy;

  async function go() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/site-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: slug, to: next.trim().toLowerCase(), confirmName: typed }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(String(d.error ?? `실패했어요 (${r.status})`)); return; }
      setMsg(`onstori.com/${d.to} 로 바꿨습니다.${d.oldLocked ? " 옛 주소는 다른 분이 못 가져가게 잠가 뒀어요." : ""} 새로고침하면 목록에 반영됩니다.`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="t-caption underline underline-offset-2 text-[var(--text-soft)]">
        주소 변경
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-xl border p-3" style={{ borderColor: "var(--n-300)", minWidth: 260 }}>
      <p className="t-caption text-[var(--text-soft)]">지금 주소 · onstori.com/<b>{slug}</b></p>

      <div className="mt-2 flex items-center" style={{ gap: 4 }}>
        <span className="t-caption shrink-0 text-[var(--text-soft)]">onstori.com/</span>
        <input
          className="field min-w-0 flex-1"
          value={next}
          maxLength={30}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="새 주소"
          onChange={(e) => setNext(e.target.value.trim().toLowerCase())}
          style={{ borderColor: free === false ? "var(--danger)" : undefined }}
        />
      </div>
      {freeWhy && (
        <p className="mt-1 t-caption" style={{ color: free ? "var(--green)" : "var(--danger)" }}>{freeWhy}</p>
      )}

      {/* 🔴 문턱 — 상호를 손으로 쳐야 버튼이 열린다 */}
      <input
        className="field mt-2"
        value={typed}
        placeholder={`확인: 「${businessName}」 를 그대로 입력`}
        onChange={(e) => setTyped(e.target.value)}
      />

      <p className="mt-2 t-caption text-[var(--text-soft)]">
        ⚠ 사장님이 명함·플레이스에 적어 두신 주소가 바뀝니다. 옛 주소는 <b>잠가만 두고 자동 이동은 아직 없습니다.</b>
      </p>

      <div className="mt-2 flex items-center" style={{ gap: "var(--s-2)" }}>
        <button type="button" onClick={go} disabled={!ready}
          className="btn btn-primary !py-1.5 !t-small disabled:opacity-40">
          {busy ? "바꾸는 중…" : "주소 바꾸기"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setNext(""); setTyped(""); setMsg(""); setErr(""); }}
          className="t-caption underline text-[var(--text-soft)]">닫기</button>
      </div>

      {msg && <p className="mt-2 t-caption" style={{ color: "var(--green)" }}>{msg}</p>}
      {err && <p className="mt-2 t-caption text-danger">{err}</p>}
    </div>
  );
}
