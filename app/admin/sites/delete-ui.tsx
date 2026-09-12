"use client";

import { useState } from "react";

/**
 * 운영자 전용 «사이트 지우기». (2026-09-12 회장님 지시 E2)
 *
 * ★★ **사장님 화면에는 절대 없다.** 이 파일은 `/admin` 아래에서만 그려지고,
 *   서버(`app/api/admin/site-delete`)가 다시 운영자 인증을 확인한다.
 *
 * ★★ 문턱 셋 — 하나라도 빼면 실수로 남의 홈페이지를 지운다:
 *   ① 먼저 **무엇이 사라지는지 세어 보여 준다**(dryRun). 숫자를 보고 나서 결정한다
 *   ② **상호를 손으로 정확히 타이핑**해야 버튼이 눌린다. 확인창은 습관적으로 눌린다 — 타이핑은 아니다
 *   ③ 지운 기록이 `site_deletions` 에 남는다(서버가 한다)
 */
/**
 * 숫자를 **거짓말하지 않게** 찍는다.
 * ⚠ 서버는 못 센 것을 `-1` 로 돌려준다. 그것을 `?? 0` 으로 받으면 화면에 「0」이 뜨고,
 *   운영자는 「없구나」 하고 지운다 — 실제로는 몇 개인지 모르는 상태였는데도.
 */
const n = (v?: number) => (v === undefined || v < 0 ? "?" : String(v));

/** 파일은 버킷별로 나뉘어 오지만 운영자에게는 **한 숫자**면 된다. 못 센 칸이 하나라도 있으면 「?」 */
const fileTotal = (f: Record<string, number>) => {
  const vs = Object.values(f);
  return vs.some((v) => v < 0) ? "?" : String(vs.reduce((a, b) => a + b, 0));
};

export function DeleteSite({ slug, businessName }: { slug: string; businessName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [files, setFiles] = useState<Record<string, number> | null>(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function call(dryRun: boolean) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/site-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, confirmName: typed, reason, dryRun }),
      });
      const d = (await r.json().catch(() => ({}))) as { counts?: Record<string, number>; files?: Record<string, number>; error?: string; ok?: boolean; filesPurged?: number };
      if (!r.ok) { setMsg(d.error ?? `실패했어요 (${r.status})`); return; }
      if (dryRun) { setCounts(d.counts ?? {}); setFiles(d.files ?? {}); return; }
      setDone(true);
      setMsg(`지웠습니다. 파일 ${d.filesPurged ?? 0}개도 함께 지웠어요. 목록은 새로고침하면 반영됩니다.`);
    } catch {
      setMsg("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  if (done) return <span className="t-caption font-semibold text-green-700">지움 ✓</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); void call(true); }}
        className="rounded-full border border-n-300 px-3 py-1 t-caption text-danger">
        지우기
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-danger p-3 text-left" style={{ minWidth: 280 }}>
      <p className="t-caption font-bold text-danger">이 홈페이지를 «영구히» 지웁니다</p>

      {/* ① 무엇이 사라지는지 — 숫자를 보고 나서 정한다 */}
      {counts ? (
        <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
          함께 사라지는 것 — 문의 {n(counts.inquiries)} · 이야기 {n(counts.story_entries)} ·
          기록 {n(counts.events)} · 발행본 {n(counts.site_versions)} ·
          SNS 연결 {n(counts.sns_connections)} · 올린 기록 {n(counts.sns_posts)}
          {files && <><br /><b className="text-danger">사진·영상 파일 {fileTotal(files)}개</b> (되돌릴 수 없습니다)</>}
        </p>
      ) : (
        <p className="mt-1 t-caption text-[var(--text-soft)]">세어 보는 중…</p>
      )}

      {/* ② 상호를 손으로 */}
      <label className="mt-2 block">
        <span className="t-caption text-[var(--text-soft)]">
          지우려면 상호 <b>「{businessName}」</b> 를 그대로 입력하세요
        </span>
        <input className="mt-1 w-full rounded-lg border border-n-300 px-2 py-1.5 t-caption"
          value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={businessName} />
      </label>
      <label className="mt-2 block">
        <span className="t-caption text-[var(--text-soft)]">이유 (기록에 남습니다)</span>
        <input className="mt-1 w-full rounded-lg border border-n-300 px-2 py-1.5 t-caption"
          value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 박팀장 시험 사이트 정리" />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || typed !== businessName}
          onClick={() => void call(false)}
          className="rounded-full bg-danger px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
          {busy ? "…" : "영구히 지우기"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setTyped(""); setMsg(""); }}
          className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">취소</button>
      </div>
      {msg && <p className="mt-2 t-caption font-semibold text-danger">{msg}</p>}
    </div>
  );
}
