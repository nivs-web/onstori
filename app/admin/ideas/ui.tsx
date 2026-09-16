"use client";

import { useMemo, useState } from "react";
import {
  IDEAS,
  IDEA_STATUS,
  IDEA_STATUS_ORDER,
  countByStatus,
  matchIdea,
  type Idea,
  type IdeaStatus,
} from "@/config/ideas";

/**
 * 아이디어 뱅크의 **검색·필터·목록**. (2026-09-16 대표님 지시)
 *
 * ★ 왜 클라이언트 컴포넌트인가: 대표님이 글자를 치는 «그 순간» 목록이 줄어야 하기 때문이다.
 *   서버로 왕복하면 한 글자마다 깜빡인다. 데이터는 config/ideas.ts 에 박혀 있어
 *   통째로 들고 있어도 무겁지 않다(카드 수십 장 수준).
 *
 * ⚠ 숫자 카드(맨 위)는 **서버가 그린다**(page.tsx). 그쪽은 «전체 현황»이라 검색과 무관하게
 *   언제나 같은 숫자여야 한다 — 검색하면 숫자까지 줄어드는 화면은 현황판 구실을 못한다.
 */

/** 상태 표시등 + 글자. 🔴 색만으로 뜻을 나르지 않는다 — 점 옆에 «언제나» 글자가 붙는다 */
export function StatusBadge({ status }: { status: IdeaStatus }) {
  const m = IDEA_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 t-caption font-bold ${m.badge}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}

export function IdeaBoard() {
  const [q, setQ] = useState("");
  /** null = 전체 */
  const [only, setOnly] = useState<IdeaStatus | null>(null);

  const counts = useMemo(() => countByStatus(IDEAS), []);
  const list = useMemo(
    () => IDEAS.filter((i) => (only ? i.status === only : true)).filter((i) => matchIdea(i, q)),
    [q, only],
  );

  return (
    <>
      {/* ── 검색창 — 대표님 지시: 「카드가 많아지면 찾기 어려우니 상단에 검색창」 ── */}
      <div className="mt-6">
        <label htmlFor="idea-q" className="t-caption font-bold text-[var(--text-soft)]">
          아이디어 찾기
        </label>
        <input
          id="idea-q"
          className="field mt-1.5"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목·내용·번호로 찾기 — 예: 사진 / SEO / 3"
        />
        <p className="mt-1.5 t-caption text-[var(--text-soft)]">
          {/* ★ 숫자만 쳐도 찾아진다는 것을 **말해 준다.** 안 적으면 아무도 모른다 */}
          번호만 쳐도 됩니다 — <b>3</b> 이라고 치면 idea-00003 이 나옵니다.
        </p>
      </div>

      {/* ── 상태 필터 칩 ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip on={only === null} onClick={() => setOnly(null)}>
          전체 {IDEAS.length}
        </Chip>
        {IDEA_STATUS_ORDER.map((s) => (
          <Chip key={s} on={only === s} onClick={() => setOnly(only === s ? null : s)}>
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${IDEA_STATUS[s].dot}`} aria-hidden />
            {IDEA_STATUS[s].label} {counts[s]}
          </Chip>
        ))}
      </div>

      {/* ── 목록 ── */}
      <p className="mt-5 t-caption text-[var(--text-soft)]">
        {list.length}장 보임 {list.length !== IDEAS.length && `(전체 ${IDEAS.length}장)`}
      </p>

      {list.length === 0 ? (
        <p className="mt-3 rounded-xl px-4 py-5 t-small" style={{ background: "var(--n-50)" }}>
          찾으시는 아이디어가 없습니다. 검색어를 지우거나 <b>전체</b>를 눌러 보세요.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {list.map((i) => (
            <IdeaCard key={i.code} idea={i} />
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 t-caption font-medium ${on ? "bg-green-700 text-white" : "border border-n-300"}`}
    >
      {children}
    </button>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  const m = IDEA_STATUS[idea.status];
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* ★ 코드 번호를 **제일 앞에** 둔다 — 대표님이 번호로 부르시려고 만든 것이다 */}
        <span className="t-caption font-bold text-[var(--text-soft)]">{idea.code}</span>
        <StatusBadge status={idea.status} />
      </div>
      <h2 className={`mt-2 t-h3 font-bold ${m.strike ? "line-through text-[var(--text-soft)]" : ""}`}>
        {idea.title}
      </h2>
      <p className="mt-2 t-small">{idea.summary}</p>

      {/* ── 예상 토큰비 — 대표님이 «꼭 올리라»고 하신 항목이라 눈에 띄게 따로 뺀다 ── */}
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "var(--n-50)" }}>
        <p className="t-caption font-bold text-[var(--text-soft)]">예상 토큰비</p>
        <p className="mt-1 t-small">{idea.tokenCost}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Points title="장점" mark="＋" items={idea.pros} />
        <Points title="단점 · 걱정되는 점" mark="－" items={idea.cons} />
      </div>

      <div className="mt-4">
        <p className="t-caption font-bold text-[var(--text-soft)]">구체적인 계획</p>
        {/* 계획은 줄바꿈으로 단계를 나눠 적는다 — `whitespace-pre-line` 이 그 줄바꿈을 살린다 */}
        <p className="mt-1 whitespace-pre-line t-small">{idea.plan}</p>
      </div>

      {idea.decidedAt && (
        <p className="mt-4 t-caption text-[var(--text-soft)]">
          {m.label} 확정: {idea.decidedAt}
        </p>
      )}
    </article>
  );
}

/** 장점·단점 목록. 🔴 기호(＋ －)만으로 뜻을 나르지 않는다 — 제목 글자가 같이 있다 */
function Points({ title, mark, items }: { title: string; mark: string; items: string[] }) {
  return (
    <div>
      <p className="t-caption font-bold text-[var(--text-soft)]">{title}</p>
      <ul className="mt-1 space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex gap-2 t-small">
            <span className="shrink-0 text-[var(--text-soft)]" aria-hidden>{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
