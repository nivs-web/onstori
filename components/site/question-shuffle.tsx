"use client";

import { useState } from "react";
import Link from "next/link";
import { pickQuestions, QUESTION_CATEGORIES, type Question } from "@/config/questions";

/**
 * 랜덤 질문 위젯 — "사장님, 어떤 이야기를 들려주시겠습니까?" + [랜덤 질문 바꾸기] + 카드 4장.
 * 레멘토 "What stories will you uncover? / Shuffle Prompts" 대응 (기획1 #core).
 * 첫 페이지 · 작동방식 · 녹화 화면(/rec)이 같은 부품을 쓴다. onPick 이 있으면 카드 클릭이 선택이 되고,
 * 없으면 /new 로 보낸다.
 */
export function QuestionShuffle({
  onPick, dark = true, initialSeed = 7, count = 4, exclude = [],
}: { onPick?: (q: Question) => void; dark?: boolean; initialSeed?: number; count?: number; exclude?: string[] }) {
  // 첫 렌더는 고정 시드 — 서버/클라이언트 마크업이 같아야 hydration 경고가 없다
  const [qs, setQs] = useState<Question[]>(() => pickQuestions(count, exclude, initialSeed));
  const [spin, setSpin] = useState(false);

  function shuffle() {
    setSpin(true);
    setQs(pickQuestions(count, [...exclude, ...qs.map((q) => q.id)]));
    setTimeout(() => setSpin(false), 250);
  }

  // 어두운 면(.surface-900) 위인지에 따라 제목·설명 색만 바뀐다
  const fg = dark ? "var(--n-0)" : "var(--n-900)";
  const sub = dark ? "var(--n-300)" : "var(--n-600)";
  return (
    <div className="text-center">
      <h2 className="t-h2" style={{ color: fg, textWrap: "balance" }}>
        사장님, 어떤 이야기를 들려주시겠습니까?
      </h2>
      <p className="t-body" style={{ marginTop: "var(--s-2)", color: sub }}>
        온스토리 질문 은행 100개 중 4개. 마음에 드는 질문 하나를 고르고 60초만 말씀하세요.
      </p>
      <ul
        className="grid sm:grid-cols-2 lg:grid-cols-4"
        style={{ marginTop: "var(--s-6)", gap: "var(--s-3)", opacity: spin ? 0.6 : 1, transition: "opacity var(--dur-2) var(--ease)" }}
        aria-live="polite"
      >
        {qs.map((q) => {
          const inner = (
            <>
              <span className="t-caption block font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
                {QUESTION_CATEGORIES[q.cat].name}
              </span>
              <span className="t-body block font-semibold" style={{ marginTop: "var(--s-2)", color: "var(--n-900)" }}>{q.text}</span>
            </>
          );
          // 카드 기본 그림자 없음 · hover 에만 (docs/DESIGN.md). 들어올리는 움직임은 MOTION 금지.
          const cls = "card card-hover block h-full text-left";
          const st = { padding: "var(--s-5)" } as const;
          return (
            <li key={q.id}>
              {onPick ? (
                <button type="button" onClick={() => onPick(q)} className={cls + " w-full"} style={st}>{inner}</button>
              ) : (
                <Link href={`/new?q=${encodeURIComponent(q.id)}`} className={cls} style={st}>{inner}</Link>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={shuffle} className="btn btn-primary" style={{ marginTop: "var(--s-6)" }} aria-label="랜덤 질문 바꾸기">
        <span aria-hidden>⇄</span> 랜덤 질문 바꾸기
      </button>
    </div>
  );
}
