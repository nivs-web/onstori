"use client";

import { useState } from "react";

/**
 * [녹화 링크 문자로 받기] — 에디터 상단 (이야기 엔진 1차, 기획1 /mainplan #rec).
 * 문자 채널이 없으면 링크를 화면에 보여주고 '지금 열기'로 안내한다.
 * 투어 앵커 목록(config/tours.ts)에 없는 요소라 data-tour 는 붙이지 않는다(규칙 3).
 */
export function StoryLinkButton({ slug, phone }: { slug: string; phone: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ sent: boolean; link: string; phone: string | null; question: string } | null>(null);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true); setErr("");
    try {
      let anonId: string | undefined;
      try { anonId = localStorage.getItem("onstori:anonId") ?? undefined; } catch {}
      const r = await fetch("/api/story/send-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId }) });
      const d = (await r.json()) as { error?: string; sent?: boolean; link?: string; phone?: string | null; question?: string };
      if (!r.ok || !d.link) throw new Error(d.error ?? "링크를 만들지 못했어요");
      setRes({ sent: !!d.sent, link: d.link, phone: d.phone ?? null, question: d.question ?? "" });
    } catch (e) { setErr(e instanceof Error ? e.message : "실패"); }
    setBusy(false);
  }

  return (
    <section className="mt-4 rounded-xl p-3" style={{ background: "var(--forest)", color: "var(--cream)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold">이번 주 이야기, 60초만 말씀해 주세요</p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-75">문자로 온 링크를 크롬에서 열면 바로 녹화됩니다. 글쓰기 없음 · 앱 설치 없음.</p>
        </div>
        <button type="button" onClick={go} disabled={busy} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "var(--lime)", color: "var(--forest)" }}>
          {busy ? "보내는 중…" : phone ? "녹화 링크 문자로 받기" : "녹화 링크 열기"}
        </button>
      </div>
      {res && (
        <div className="mt-3 rounded-lg bg-white/10 p-3 text-xs leading-relaxed">
          <p>{res.sent ? `문자를 보냈어요 (${res.phone}). 폰에서 링크를 크롬으로 열어 주세요.` : "지금 이 기기에서 바로 열 수도 있어요."}</p>
          <p className="mt-1 opacity-80">오늘의 질문: {res.question}</p>
          <a href={res.link} target="_blank" rel="noopener" className="mt-2 inline-block rounded-full border border-white/40 px-3 py-1 font-bold">지금 열기 ↗</a>
        </div>
      )}
      {err && <p className="mt-2 text-xs" style={{ color: "#F5B7A6" }}>{err}</p>}
    </section>
  );
}
