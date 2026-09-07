"use client";

import { useCallback, useRef, useState } from "react";

/* ⚠ 순수 함수(parseItems·uid·타입)는 `lib/admin-notes.ts` 에 있다. 여기 두면 안 된다 —
   이 파일은 `"use client"` 라서, 서버 컴포넌트가 여기서 import 해 서버에서 부르면
   **빌드는 통과하고 런타임에 /admin 전체가 500** 이 난다(2026-09-07 프로덕션 사고). */
import { parseItems, noteUid as uid, type NoteItem } from "@/lib/admin-notes";

const nowIso = () => new Date().toISOString();

/**
 * 운영자 메모장 3종 — 대시보드 맨 위 (2026-09-07 회장님).
 *
 *   [온스토리 메모장]  자유 글 · [저장하기]
 *   [할일 메모]        체크박스 · **새 항목이 맨 위로** · 6점 손잡이로 순서 이동
 *   [완료된 메모]      체크로 고르고 하단 [전체선택][삭제]
 *
 * ★ 세 칸의 **높이가 같고 고정**이다(`--memo-h`). 내용이 늘어도 카드가 길어지지 않고
 *   목록 안에서만 스크롤한다 — 회장님 지시. 그래서 목록 칸이 `flex-1 overflow-y-auto` 다.
 *
 * ★ 저장 방식을 일부러 갈랐다: 글 메모는 **버튼**, 할일·완료는 **바꾸는 즉시**.
 *   체크했는데 저장이 안 되면 그 자체가 사고다(구글 Keep 과 같다).
 *
 * ⚠ 드래그는 브라우저 기본 기능(HTML5 draggable)이다. 라이브러리를 넣지 않았다.
 * ⚠ 글씨는 v5 최소 t-caption(13px), 날짜만 t-micro(11px). 버튼·입력칸 높이는 --memo-ctl-h.
 */

/** "9/7" — 올해면 월/일, 지난해면 연도까지 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return thisYear ? `${d.getMonth() + 1}/${d.getDate()}` : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

/* 세 칸이 같은 껍데기를 쓴다 — 높이가 어긋나면 그것만으로 어색해진다 */
function Pad({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="flex flex-col rounded-2xl border border-n-200 bg-n-0 p-4"
      style={{ height: "var(--memo-h)" }}
      aria-label={title}
    >
      <div className="flex items-baseline justify-between" style={{ gap: "var(--s-2)" }}>
        <h2 className="t-small font-bold">{title}</h2>
        <span className="t-micro">{right}</span>
      </div>
      {children}
    </section>
  );
}

/** 6점 손잡이 — 구글 Keep 과 같은 자리(체크박스 왼쪽) */
function Grip() {
  return (
    <span aria-hidden className="t-caption select-none" style={{ color: "var(--text-soft)", cursor: "grab", lineHeight: 1.2 }}>
      ⠿
    </span>
  );
}

export function AdminNotes({
  mainInit, todoInit, doneInit, mainSaved,
}: { mainInit: string; todoInit: NoteItem[]; doneInit: NoteItem[]; mainSaved: boolean }) {
  const [main, setMain] = useState(mainInit);
  const [todo, setTodo] = useState<NoteItem[]>(todoInit);
  const [done, setDone] = useState<NoteItem[]>(doneInit);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [err, setErr] = useState("");
  const drag = useRef<{ list: "todo" | "done"; from: number } | null>(null);

  const put = useCallback(async (id: "main" | "todo" | "done", body: string) => {
    const r = await fetch("/api/admin/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? `저장 실패 (${r.status})`);
  }, []);

  const persist = useCallback(async (nextTodo: NoteItem[], nextDone: NoteItem[]) => {
    setErr("");
    try {
      await Promise.all([put("todo", JSON.stringify(nextTodo)), put("done", JSON.stringify(nextDone))]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [put]);

  async function saveMain() {
    setState("saving"); setErr("");
    try {
      await put("main", main);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setState("idle");
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  /** ★ 새 항목은 **맨 위**로. 최근에 적은 것이 위에 있고 옛것이 아래로 밀린다 (회장님) */
  function addTodo() {
    const t = draft.trim();
    if (!t) return;
    const next = [{ id: uid(), text: t, at: nowIso() }, ...todo];
    setTodo(next); setDraft("");
    void persist(next, done);
  }

  /** 체크하면 완료 목록 맨 위로 옮긴다 (제일 최근에 끝낸 것이 위) */
  function complete(i: number) {
    const item = todo[i];
    const nextTodo = todo.filter((_, k) => k !== i);
    const nextDone = [{ ...item, doneAt: nowIso() }, ...done];
    setTodo(nextTodo); setDone(nextDone);
    void persist(nextTodo, nextDone);
  }

  function removeDone(id: string) {
    const nextDone = done.filter((d) => d.id !== id);
    setDone(nextDone);
    setPicked((p) => { const n = new Set(p); n.delete(id); return n; });
    void persist(todo, nextDone);
  }

  function toggleAll() {
    setPicked((p) => (p.size === done.length ? new Set() : new Set(done.map((d) => d.id))));
  }

  function removePicked() {
    if (picked.size === 0) return;
    const nextDone = done.filter((d) => !picked.has(d.id));
    setDone(nextDone); setPicked(new Set());
    void persist(todo, nextDone);
  }

  function drop(list: "todo" | "done", to: number) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.list !== list || d.from === to) return;
    const move = (arr: NoteItem[]) => {
      const copy = [...arr];
      const [x] = copy.splice(d.from, 1);
      copy.splice(to, 0, x);
      return copy;
    };
    if (list === "todo") { const n = move(todo); setTodo(n); void persist(n, done); }
    else { const n = move(done); setDone(n); void persist(todo, n); }
  }

  const rowProps = (list: "todo" | "done", i: number) => ({
    draggable: true,
    onDragStart: () => { drag.current = { list, from: i }; },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => drop(list, i),
  });

  const listCls = "mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto";
  const rowCls = "flex items-start rounded-lg bg-n-50";
  const rowStyle = { gap: "var(--s-2)", padding: "var(--s-2)" } as const;
  const ctl = { height: "var(--memo-ctl-h)" } as const;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {/* ── 1. 온스토리 메모장 ── */}
      <Pad title="온스토리 메모장" right={mainSaved ? "" : "저장 전(기본 내용)"}>
        <textarea
          value={main}
          onChange={(e) => setMain(e.target.value)}
          spellCheck={false}
          aria-label="온스토리 메모장 내용"
          className="t-caption mt-2 min-h-0 w-full flex-1 rounded-xl border border-n-200 bg-n-50"
          /* ⚠ resize 를 막는다 — 칸 높이가 고정이라 사용자가 늘리면 카드를 뚫고 나간다 */
          style={{ padding: "var(--s-3)", color: "var(--text)", resize: "none" }}
        />
        <div className="mt-2 flex items-center justify-between" style={{ gap: "var(--s-2)" }}>
          <span className="t-micro">{state === "done" ? "저장했습니다" : ""}</span>
          <button type="button" onClick={saveMain} disabled={state === "saving"} className="btn btn-secondary btn-xs t-caption" style={ctl}>
            {state === "saving" ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </Pad>

      {/* ── 2. 할일 메모 ── */}
      <Pad title="할일 메모" right={todo.length ? `${todo.length}건` : ""}>
        <ul className={listCls} style={{ gap: "var(--s-1)" }}>
          {todo.map((it, i) => (
            <li key={it.id} {...rowProps("todo", i)} className={rowCls} style={rowStyle}>
              <Grip />
              <input type="checkbox" checked={false} onChange={() => complete(i)}
                     aria-label={`완료: ${it.text}`} style={{ marginTop: "0.15em" }} />
              <span className="t-caption min-w-0 flex-1" style={{ color: "var(--text)", wordBreak: "break-word" }}>{it.text}</span>
              <span className="t-micro whitespace-nowrap">{shortDate(it.at)}</span>
            </li>
          ))}
          {todo.length === 0 && <li className="t-caption" style={{ padding: "var(--s-2)" }}>할 일이 없습니다.</li>}
        </ul>
        <div className="mt-2 flex items-center" style={{ gap: "var(--s-2)" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
            placeholder="+ 항목 추가"
            aria-label="할일 항목 추가"
            className="t-caption min-w-0 flex-1 rounded-lg border border-n-200 bg-n-0"
            style={{ ...ctl, paddingInline: "var(--s-3)", color: "var(--text)" }}
          />
          <button type="button" onClick={addTodo} className="btn btn-secondary btn-xs t-caption" style={ctl}>추가</button>
        </div>
      </Pad>

      {/* ── 3. 완료된 메모 ── */}
      <Pad title="완료된 메모" right={done.length ? `${done.length}건` : ""}>
        <ul className={listCls} style={{ gap: "var(--s-1)" }}>
          {done.map((it, i) => (
            <li key={it.id} {...rowProps("done", i)} className={rowCls} style={rowStyle}>
              <Grip />
              <input
                type="checkbox"
                checked={picked.has(it.id)}
                onChange={() => setPicked((p) => { const n = new Set(p); n.has(it.id) ? n.delete(it.id) : n.add(it.id); return n; })}
                aria-label={`선택: ${it.text}`}
                style={{ marginTop: "0.15em" }}
              />
              <span className="t-caption min-w-0 flex-1"
                    style={{ color: "var(--text-soft)", textDecoration: "line-through", wordBreak: "break-word" }}>{it.text}</span>
              <span className="t-micro whitespace-nowrap">{shortDate(it.doneAt ?? it.at)}</span>
              <button type="button" onClick={() => removeDone(it.id)} aria-label={`삭제: ${it.text}`}
                      className="t-caption" style={{ color: "var(--text-soft)", lineHeight: 1 }}>×</button>
            </li>
          ))}
          {done.length === 0 && <li className="t-caption" style={{ padding: "var(--s-2)" }}>완료한 일이 없습니다.</li>}
        </ul>
        <div className="mt-2 flex items-center justify-end" style={{ gap: "var(--s-2)" }}>
          <button type="button" onClick={toggleAll} disabled={done.length === 0}
                  className="btn btn-secondary btn-xs t-caption" style={ctl}>
            {picked.size === done.length && done.length > 0 ? "선택 해제" : "전체선택"}
          </button>
          <button type="button" onClick={removePicked} disabled={picked.size === 0}
                  className="btn btn-secondary btn-xs t-caption" style={ctl}>
            삭제{picked.size ? ` ${picked.size}` : ""}
          </button>
        </div>
      </Pad>

      {err && <p className="t-caption lg:col-span-3" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

export { parseItems };
export type { NoteItem };
