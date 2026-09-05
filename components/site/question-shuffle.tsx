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

  const fg = dark ? "var(--cream)" : "var(--forest)";
  return (
    <div className="text-center">
      <h2 className="font-display text-[26px] sm:text-[34px]" style={{ color: fg, textWrap: "balance" }}>
        사장님, 어떤 이야기를 들려주시겠습니까?
      </h2>
      <p className="mt-2 text-[14px]" style={{ color: fg, opacity: 0.75 }}>
        온스토리 질문 은행 100개 중 4개. 마음에 드는 질문 하나를 고르고 60초만 말씀하세요.
      </p>
      <ul className={`mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${spin ? "opacity-60" : ""}`} style={{ transition: "opacity .2s" }} aria-live="polite">
        {qs.map((q) => {
          const inner = (
            <>
              <span className="block text-[11px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>{QUESTION_CATEGORIES[q.cat].name}</span>
              <span className="mt-2 block text-[15px] font-semibold leading-snug" style={{ color: "var(--forest)" }}>{q.text}</span>
            </>
          );
          const cls = "block h-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
          return (
            <li key={q.id}>
              {onPick ? (
                <button type="button" onClick={() => onPick(q)} className={cls + " w-full"} style={{ borderColor: "var(--line)" }}>{inner}</button>
              ) : (
                <Link href={`/new?q=${encodeURIComponent(q.id)}`} className={cls} style={{ borderColor: "var(--line)" }}>{inner}</Link>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={shuffle} className="btn-lime mt-7" aria-label="랜덤 질문 바꾸기">
        <span aria-hidden>⇄</span> 랜덤 질문 바꾸기
      </button>
    </div>
  );
}
