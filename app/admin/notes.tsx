"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 운영자 메모장 3종 — 대시보드 맨 위 (2026-09-07 회장님 지시).
 *
 *   [온스토리 메모장]  자유 글. 저장하기 버튼으로 저장한다
 *   [할일 메모]        체크박스. 체크하면 **완료로 자동 이동**한다
 *   [완료된 메모]      순서 바꾸기 + 삭제 + 작성 날짜
 *
 * ★ 표를 늘리지 않았다. `admin_notes` 의 body 가 text 라 할일·완료는 **JSON 배열을 문자열로**
 *   담는다. 항목 구조가 바뀌어도 마이그레이션이 필요 없다.
 *
 * ⚠ 저장 방식이 둘로 갈린다 — 일부러 그렇다:
 *   · 글 메모는 **버튼**으로. 타이핑 중에 매번 저장하면 왕복이 쌓인다
 *   · 할일·완료는 **바꾸는 즉시**. 체크했는데 저장이 안 되면 그 자체가 사고다(구글 Keep 과 같다)
 *
 * ⚠ 드래그는 브라우저 기본 기능(HTML5 draggable)으로 한다. 라이브러리를 넣지 않았다 —
 *   운영자 화면 하나 때문에 첫 화면 번들이 커지면 안 된다.
 * ⚠ 글씨는 v5 최소인 `t-caption`(13px), 날짜만 `t-micro`(11px). 토큰 밖 크기를 적지 않는다.
 */

/* ⚠ 순수 함수(parseItems·uid·타입)는 `lib/admin-notes.ts` 에 있다. 여기 두면 안 된다 —
   이 파일은 `"use client"` 라서, 서버 컴포넌트가 여기서 import 해 서버에서 부르면
   **빌드는 통과하고 런타임에 /admin 전체가 500** 이 난다(2026-09-07 프로덕션 사고). */
import { parseItems, noteUid as uid, type NoteItem } from "@/lib/admin-notes";

const nowIso = () => new Date().toISOString();

/** "9/7" — 올해면 월/일, 지난해면 연도까지 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return thisYear ? `${d.getMonth() + 1}/${d.getDate()}` : `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

/* ── 공통 껍데기 ── */
function Pad({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-n-200 bg-n-0 p-4" aria-label={title}>
      <div className="flex items-baseline justify-between" style={{ gap: "var(--s-2)" }}>
        <h2 className="t-small font-bold">{title}</h2>
        <span className="t-micro">{right}</span>
      </div>
      {children}
    </section>
  );
}

export function AdminNotes({
  mainInit, todoInit, doneInit, mainSaved,
}: { mainInit: string; todoInit: NoteItem[]; doneInit: NoteItem[]; mainSaved: boolean }) {
  const [main, setMain] = useState(mainInit);
  const [todo, setTodo] = useState<NoteItem[]>(todoInit);
  const [done, setDone] = useState<NoteItem[]>(doneInit);
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

  /** 할일·완료는 바꾸는 즉시 저장한다. 실패하면 화면에 그대로 띄운다 */
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

  function addTodo() {
    const t = draft.trim();
    if (!t) return;
    const next = [...todo, { id: uid(), text: t, at: nowIso() }];
    setTodo(next); setDraft("");
    void persist(next, done);
  }

  /** ★ 체크하면 완료 목록 **맨 위**로 옮긴다 (제일 최근에 끝낸 것이 위) */
  function complete(i: number) {
    const item = todo[i];
    const nextTodo = todo.filter((_, k) => k !== i);
    const nextDone = [{ ...item, doneAt: nowIso() }, ...done];
    setTodo(nextTodo); setDone(nextDone);
    void persist(nextTodo, nextDone);
  }

  /** 완료에서 체크를 풀면 할일로 되돌린다 — 잘못 눌렀을 때 되돌릴 길이 있어야 한다 */
  function uncomplete(i: number) {
    const item = done[i];
    const nextDone = done.filter((_, k) => k !== i);
    const nextTodo = [...todo, { ...item, doneAt: undefined }];
    setTodo(nextTodo); setDone(nextDone);
    void persist(nextTodo, nextDone);
  }

  function removeDone(i: number) {
    const nextDone = done.filter((_, k) => k !== i);
    setDone(nextDone);
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

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {/* ── 1. 온스토리 메모장 ── */}
      <Pad title="온스토리 메모장" right={mainSaved ? "" : "저장 전(기본 내용)"}>
        <textarea
          value={main}
          onChange={(e) => setMain(e.target.value)}
          rows={10}
          spellCheck={false}
          aria-label="온스토리 메모장 내용"
          className="t-caption mt-2 w-full rounded-xl border border-n-200 bg-n-50"
          style={{ padding: "var(--s-3)", color: "var(--text)", resize: "vertical" }}
        />
        <div className="mt-2 flex items-center justify-between" style={{ gap: "var(--s-2)" }}>
          <span className="t-micro">{state === "done" ? "저장했습니다" : ""}</span>
          <button type="button" onClick={saveMain} disabled={state === "saving"} className="btn btn-secondary t-caption">
            {state === "saving" ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </Pad>

      {/* ── 2. 할일 메모 ── */}
      <Pad title="할일 메모" right={todo.length ? `${todo.length}건` : ""}>
        <ul className="mt-2 flex flex-col" style={{ gap: "var(--s-1)", minHeight: "13.5rem" }}>
          {todo.map((it, i) => (
            <li key={it.id} {...rowProps("todo", i)}
                className="flex items-start rounded-lg border border-transparent bg-n-50"
                style={{ gap: "var(--s-2)", padding: "var(--s-2)", cursor: "grab" }}>
              <input type="checkbox" checked={false} onChange={() => complete(i)}
                     aria-label={`완료: ${it.text}`} style={{ marginTop: "0.15em" }} />
              <span className="t-caption min-w-0 flex-1" style={{ color: "var(--text)", wordBreak: "break-word" }}>{it.text}</span>
              <span className="t-micro whitespace-nowrap">{shortDate(it.at)}</span>
            </li>
          ))}
          {todo.length === 0 && <li className="t-caption" style={{ padding: "var(--s-2)" }}>할 일이 없습니다.</li>}
        </ul>
        <div className="mt-2 flex items-center" style={{ gap: "var(--s-2)" }}>
          <span aria-hidden className="t-caption">+</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
            placeholder="항목 추가"
            aria-label="할일 항목 추가"
            className="t-caption min-w-0 flex-1 rounded-lg border border-n-200 bg-n-0"
            style={{ padding: "var(--s-2)", color: "var(--text)" }}
          />
          <button type="button" onClick={addTodo} className="btn btn-secondary t-caption">추가</button>
        </div>
      </Pad>

      {/* ── 3. 완료된 메모 ── */}
      <Pad title="완료된 메모" right={done.length ? `${done.length}건` : ""}>
        <ul className="mt-2 flex flex-col" style={{ gap: "var(--s-1)", minHeight: "13.5rem" }}>
          {done.map((it, i) => (
            <li key={it.id} {...rowProps("done", i)}
                className="flex items-start rounded-lg border border-transparent bg-n-50"
                style={{ gap: "var(--s-2)", padding: "var(--s-2)", cursor: "grab" }}>
              <input type="checkbox" checked readOnly onClick={() => uncomplete(i)}
                     aria-label={`할일로 되돌리기: ${it.text}`} style={{ marginTop: "0.15em" }} />
              <span className="t-caption min-w-0 flex-1"
                    style={{ color: "var(--text-soft)", textDecoration: "line-through", wordBreak: "break-word" }}>{it.text}</span>
              <span className="t-micro whitespace-nowrap">{shortDate(it.doneAt ?? it.at)}</span>
              <button type="button" onClick={() => removeDone(i)} aria-label={`삭제: ${it.text}`}
                      className="t-caption" style={{ color: "var(--text-soft)", lineHeight: 1 }}>×</button>
            </li>
          ))}
          {done.length === 0 && <li className="t-caption" style={{ padding: "var(--s-2)" }}>완료한 일이 없습니다.</li>}
        </ul>
      </Pad>

      {err && <p className="t-caption lg:col-span-3" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
