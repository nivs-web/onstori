"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 유튜브 문 — 운영자 손잡이. (2026-09-12 회장님 지시 2 · 상무님 지적)
 *
 * ★★★ **이 화면은 «켜고 끄는 스위치»가 아니다.**
 *   감사 통과 «전»에 올린 영상은 유튜브가 비공개로 잠그고 **항소할 수 없다.**
 *   그러니 여기서 잘못 켜면 그날 올라간 사장님 영상이 **전부, 영영** 죽는다.
 *   그래서 ①기본은 «준비 중» ②정식 공개는 **감사 통과를 먼저 켜야** 고를 수 있다
 *   ③고르고 나서 **한 번 더 확인**을 받는다.
 *
 * ⚠ 「지금 이 설정이면 실제로 어떻게 되나」는 **서버가 계산해서** 내려준다.
 *   화면이 다시 판정하면 두 벌이 생기고, 언젠가 한쪽만 고쳐져 거짓말을 한다(불변 규칙 12).
 */

type Verdict = { ok: true; privacy: string; note?: string } | { ok: false; why: string; operator?: string };
type Gate = {
  mode: "off" | "review" | "on";
  auditPassed: boolean;
  allowSlugs: string[];
  unknown?: string[];
  effectAllowed: Verdict | null;
  effectOthers: Verdict;
};

const MODES = [
  {
    id: "off" as const,
    label: "준비 중",
    hint: "아무도 못 올립니다. 사장님 화면에는 「준비 중」으로만 보여요.",
  },
  {
    id: "review" as const,
    label: "심사용 비공개",
    hint: "아래 «올릴 수 있는 곳»에 적은 사이트만 올립니다. 영상은 비공개로 올라가요.",
  },
  {
    id: "on" as const,
    label: "정식 공개",
    hint: "모든 사장님이 올리고, 영상이 공개로 올라갑니다.",
  },
];

export function YoutubeGate() {
  const [g, setG] = useState<Gate | null>(null);
  const [mode, setMode] = useState<"off" | "review" | "on">("off");
  const [audit, setAudit] = useState(false);
  const [slugs, setSlugs] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/sns-gate", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as Gate & { error?: string };
      if (!r.ok) { setErr(d.error ?? `불러오지 못했어요 (${r.status})`); return; }
      setG(d); setMode(d.mode); setAudit(d.auditPassed); setSlugs((d.allowSlugs ?? []).join(" "));
    } catch { setErr("연결이 끊겼어요."); }
  }, []);

  /* ⚠ 이펙트 본문에서 곧바로 setState 하면 렌더가 연쇄로 돈다 — 한 틱 뒤에 부른다 */
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  /* ★ 감사 통과를 안 켜면 「정식 공개」를 **고를 수 없다.** 고를 수 있게 두면 반드시 눌린다 */
  const canPickOn = audit;
  const changed = !!g && (mode !== g.mode || audit !== g.auditPassed || slugs.trim() !== (g.allowSlugs ?? []).join(" "));

  async function save() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/sns-gate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, auditPassed: audit,
          allowSlugs: slugs.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as Gate & { error?: string; needAudit?: boolean };
      if (!r.ok) {
        /* ⚠ 서버가 「감사 표시가 먼저」라며 거절한 것이다. 화면도 그 자리로 되돌린다 —
           「저장했다」처럼 보이게 두면 다음에 또 같은 실수를 한다. */
        if (d.needAudit) { setMode(g?.mode ?? "off"); setConfirming(false); }
        setErr(d.error ?? `저장하지 못했어요 (${r.status})`);
        return;
      }
      setG(d); setMode(d.mode); setAudit(d.auditPassed); setSlugs((d.allowSlugs ?? []).join(" "));
      setConfirming(false);
      setMsg(d.unknown?.length ? `저장했어요. ⚠ 못 찾은 주소: ${d.unknown.join(", ")}` : "저장했어요.");
    } catch { setErr("연결이 끊겼어요."); }
    finally { setBusy(false); }
  }

  if (!g) {
    return (
      <section className="mt-8 rounded-2xl border border-n-200 p-5">
        <h2 className="t-small font-bold">유튜브 문</h2>
        <p className="mt-2 t-caption text-[var(--text-soft)]">{err || "불러오는 중…"}</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-n-200 p-5">
      <h2 className="t-small font-bold">유튜브 문</h2>

      {/* ★★ 왜 조심해야 하는지를 **맨 위에** 적는다. 스위치 아래에 적으면 안 읽는다 */}
      <div className="mt-3 rounded-xl border border-danger p-3">
        <p className="t-caption font-bold text-danger">읽고 바꿔 주세요 — 되돌릴 수 없습니다</p>
        <p className="mt-1.5 t-caption leading-relaxed">
          유튜브 <b>감사(심사)를 통과하기 전</b>에 올린 영상은 유튜브가 <b>비공개로 잠급니다.</b>
          {" "}그리고 <b>항소할 수 없습니다.</b> 유튜브 스튜디오에서도 못 바꿔요.
          {" "}나중에 감사를 통과해도 <b>이미 잠긴 영상은 그대로</b>입니다 —
          {" "}사장님이 <b>다시 찍어 다시 올리는 수밖에</b> 없습니다.
        </p>
        {/* ★★ 가장 흔한 사고가 여기서 난다 — 「일단 냈으니 켜자」 */}
        <p className="mt-2 t-caption leading-relaxed font-semibold text-danger">
          ⚠ 신청서를 <b>「냈다」</b>와 <b>「통과했다」</b>는 다릅니다. 구글에서 <b>통과 메일</b>을 받으신 뒤에만 켜 주세요.
        </p>
        <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
          (2026-09-13 구글 공식 확인 · support.google.com/youtube/answer/7300965)
        </p>
      </div>

      {/* 지금 상태 — 서버가 계산해 준 «실제로 어떻게 되나» */}
      <div className="mt-4 rounded-xl bg-n-50 p-3">
        <p className="t-caption font-semibold">지금 이 설정이면</p>
        <p className="mt-1 t-caption leading-relaxed">
          · 허용 목록의 사이트 —{" "}
          {g.effectAllowed
            ? g.effectAllowed.ok
              ? <b className="text-green-700">올릴 수 있어요 ({g.effectAllowed.privacy === "public" ? "공개" : "비공개"})</b>
              : <b className="text-danger">못 올려요</b>
            : <span className="text-[var(--text-soft)]">(허용 목록이 비어 있어요)</span>}
          <br />
          · 그 밖의 사장님 —{" "}
          {g.effectOthers.ok
            ? <b className="text-green-700">올릴 수 있어요 ({g.effectOthers.privacy === "public" ? "공개" : "비공개"})</b>
            : <b className="text-danger">못 올려요</b>}
        </p>
      </div>

      {/* ① 감사 통과 — 「정식 공개」의 자물쇠 */}
      <label className="mt-5 flex items-start gap-2">
        <input type="checkbox" checked={audit}
          onChange={(e) => { setAudit(e.target.checked); if (!e.target.checked && mode === "on") setMode("off"); }}
          className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="t-caption font-semibold">유튜브 감사를 통과했습니다</span>
          <span className="block t-caption leading-relaxed text-[var(--text-soft)]">
            구글에서 <b>통과 통보를 실제로 받은 뒤에만</b> 켜 주세요. 짐작으로 켜면 올라간 영상이 전부 잠깁니다.
            {" "}이걸 켜야 아래 <b>[정식 공개]</b> 를 고를 수 있어요.
          </span>
        </span>
      </label>

      {/* ② 라디오 셋 */}
      <div className="mt-4 space-y-2">
        {MODES.map((m) => {
          const locked = m.id === "on" && !canPickOn;
          return (
            <label key={m.id} className={`flex items-start gap-2 ${locked ? "opacity-40" : ""}`}>
              <input type="radio" name="ytgate" disabled={locked}
                checked={mode === m.id} onChange={() => setMode(m.id)}
                className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="t-caption font-semibold">{m.label}</span>
                <span className="block t-caption leading-relaxed text-[var(--text-soft)]">
                  {m.hint}
                  {locked && <> <b>— 위의 「감사를 통과했습니다」를 먼저 켜 주세요.</b></>}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* ③ 허용 목록 */}
      <label className="mt-4 block">
        <span className="t-caption font-semibold">올릴 수 있는 곳 (심사용 비공개일 때)</span>
        <span className="block t-caption leading-relaxed text-[var(--text-soft)]">
          사이트 주소를 띄어쓰기로. <b>온스토리 자체 계정·자체 사이트만</b> 적으세요 —
          여기 적힌 곳이 아니면 못 올립니다.
        </span>
        <input value={slugs} onChange={(e) => setSlugs(e.target.value)}
          placeholder="예: sample-interior"
          className="mt-1 w-full rounded-lg border border-n-300 px-3 py-2 t-caption" />
      </label>

      {/* ④ 저장 — 한 번 더 확인 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {!confirming ? (
          <button type="button" disabled={!changed || busy} onClick={() => setConfirming(true)}
            className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
            바꾸기
          </button>
        ) : (
          <>
            <span className="t-caption font-semibold text-danger">
              「{MODES.find((m) => m.id === mode)?.label}」 로 바꿉니다. 맞습니까?
            </span>
            <button type="button" disabled={busy} onClick={() => void save()}
              className="rounded-full bg-danger px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
              {busy ? "…" : "네, 바꿉니다"}
            </button>
            <button type="button" onClick={() => setConfirming(false)}
              className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">취소</button>
          </>
        )}
        {changed && !confirming && <span className="t-caption text-[var(--text-soft)]">고친 것이 아직 저장 안 됐어요.</span>}
      </div>

      {msg && <p className="mt-2 t-caption font-semibold text-green-700">{msg}</p>}
      {err && <p className="mt-2 t-caption font-semibold text-danger">{err}</p>}
    </section>
  );
}
