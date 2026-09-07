"use client";

import { useState } from "react";

/**
 * 운영자 메모장 — 대시보드 오른쪽 위 (2026-09-07 회장님 지시).
 *
 * 왜 있는가: 통신판매업 신고번호·Meta 심사 일정·토스 상점아이디처럼 **잊으면 곤란한 사실**이
 * 대화에만 남아 있었다. 운영자가 매일 보는 화면에 둔다.
 *
 * ⚠ 글씨는 v5 에서 제일 작은 `t-caption` 이다(회장님: 9~10pt, 볼 수 있을 정도만).
 *   토큰 밖의 크기를 직접 적지 않는다 — 불변 규칙 11.
 * ⚠ 글꼴은 Pretendard 하나다. 메모장이라고 등폭 글꼴을 쓰지 않는다 — 규칙 11.
 * ⚠ 저장 버튼은 **보조 버튼**(연회색 면)이다. 주 버튼(초록)은 뷰포트당 1개라 여기 쓰지 않는다.
 */
export function AdminNotes({ initial, saved }: { initial: string; saved: boolean }) {
  const [body, setBody] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [err, setErr] = useState("");

  async function save() {
    setState("saving");
    setErr("");
    try {
      const r = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `저장 실패 (${r.status})`);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setState("idle");
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="rounded-2xl border border-n-200 bg-white p-5" aria-label="운영자 메모">
      <div className="flex items-baseline justify-between" style={{ gap: "var(--s-3)" }}>
        <h2 className="t-small font-bold">중요사항 메모</h2>
        {/* 아직 한 번도 저장하지 않았으면 지금 보이는 글이 기본값이라는 것을 알려 준다 */}
        {!saved && <span className="t-caption">아직 저장 전 (기본 내용)</span>}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        spellCheck={false}
        aria-label="중요사항 메모 내용"
        className="t-caption mt-3 w-full rounded-xl border border-n-200 bg-n-50"
        style={{ padding: "var(--s-3)", color: "var(--text)", resize: "vertical" }}
      />

      <div className="mt-3 flex items-center justify-between" style={{ gap: "var(--s-3)" }}>
        <p className="t-caption" style={{ minHeight: "1.5em" }}>
          {err ? <span style={{ color: "var(--danger)" }}>{err}</span> : state === "done" ? "저장했습니다" : ""}
        </p>
        <button type="button" onClick={save} disabled={state === "saving"} className="btn btn-secondary t-small">
          {state === "saving" ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </section>
  );
}
