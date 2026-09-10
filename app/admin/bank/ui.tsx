"use client";

import { useEffect, useMemo, useState } from "react";
import { FastReview } from "./fast-review";
import { adminError } from "@/lib/admin-error";

export type BankRow = {
  id: string; industry: string; mood: string; role: string;
  url: string; quality_ok: boolean | null; quality_score: number;
  used_count: number; prompt: string | null; tags: string[] | null;
  width: number | null; height: number | null;
  /** 휴지통 — 파일은 지우지 않는다. deleted=true 는 표시만 내린 상태다 */
  deleted?: boolean; deletedAt?: string | null; deletedReason?: string | null;
  /** 지금 이 이미지를 쓰고 있는 발행 사이트들 (lib/image-usage) */
  usedBy: { slug: string; businessName: string; role: string }[];
};

/**
 * ★ 2026-09-10 — 전에는 `return r.ok` 로 **실패 이유를 버렸다.**
 *   승인·거부·점수·태그·휴지통이 전부 조용히 실패했다. 이제 이유를 돌려준다.
 */
async function patch(id: string, p: Record<string, unknown>, what: string): Promise<string | null> {
  const r = await fetch("/api/admin/bank", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...p }),
  });
  return r.ok ? null : await adminError(r, what);
}

/** 사용 중 배지 — 1곳이면 사이트명, 여러 곳이면 개수 */
function UsedBadge({ usedBy }: { usedBy: BankRow["usedBy"] }) {
  if (usedBy.length === 0) return null;
  const label = usedBy.length === 1
    ? `${usedBy[0].businessName}에서 사용 중`
    : `${usedBy.length}곳에서 사용 중`;
  const asHero = usedBy.some((u) => u.role === "hero");
  return (
    <span
      title={usedBy.map((u) => `${u.businessName} (${u.role})`).join("\n")}
      className={`rounded px-1.5 py-0.5 t-caption font-medium ${asHero ? "bg-green-100 text-green-800" : "bg-n-100 text-[var(--text)]"}`}
    >
      {label}{asHero && " · 히어로"}
    </span>
  );
}

function TagEditor({ id, initial }: { id: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(next: string[]) {
    setBusy(true); setErr("");
    const e = await patch(id, { tags: next }, "태그 저장");
    if (e) setErr(e); else setTags(next);
    setBusy(false);
  }
  function add() {
    const v = draft.trim().slice(0, 20);
    if (!v || tags.includes(v)) { setDraft(""); return; }
    void save([...tags, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <button key={t} disabled={busy} onClick={() => save(tags.filter((x) => x !== t))}
          title="클릭하면 삭제" className="rounded bg-green-50 px-1.5 py-0.5 t-caption text-green-800 disabled:opacity-50">
          {t} ×
        </button>
      ))}
      <input
        value={draft} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="태그 추가"
        className="w-20 rounded border border-n-200 px-1.5 py-0.5 t-caption outline-none focus:border-green-700"
      />
      {err && <span className="w-full t-caption text-danger">{err}</span>}
    </div>
  );
}

function Card({ r, checked, onToggle, bulkApproved, pendingTab }: {
  r: BankRow; checked: boolean; onToggle: () => void; bulkApproved: boolean;
  /** 「검수 대기」 탭인가 — 그 탭에서는 처리한 사진이 목록에서 빠져야 한다 */
  pendingTab: boolean;
}) {
  const [state, setState] = useState<{ ok: boolean | null; score: number; gone: boolean }>(
    { ok: r.quality_ok, score: r.quality_score, gone: false },
  );
  const [busy, setBusy] = useState(false);
  /** ★ 실패를 말하는 자리. 없으면 눌러도 아무 일도 안 일어난 것처럼 보인다(2026-09-10) */
  const [err, setErr] = useState("");
  // 일괄 승인은 부모가 알려준다 — 카드 내부 state는 개별 클릭만 반영하므로 표시에서 합친다
  const ok = bulkApproved ? true : state.ok;
  async function act(p: Record<string, unknown>) {
    setBusy(true); setErr("");
    const e = await patch(r.id, p, "저장");
    if (e) setErr(e); else setState((s) => ({ ...s, ...(p as Partial<typeof s>) }));
    setBusy(false);
  }
  /* ★ 「검수 대기」 탭은 «아직 안 본 사진»만 모아 놓은 자리다. 처리한 사진이 그대로 남으면
     몇 장이 남았는지 셀 수 없다. 다른 탭(전체·승인됨)에서는 그대로 둔다 — 거기서는
     딱지만 바뀌는 게 맞다(2026-09-10 회장님 확인). */
  if (state.gone || (pendingTab && ok !== null)) return null;

  return (
    <figure className={`overflow-hidden rounded-xl border ${checked ? "border-green-700 ring-1 ring-green-700" : "border-n-200"}`}>
      <div className="relative">
        <a href={r.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </a>
        <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1 rounded bg-n-0/90 px-1.5 py-1 backdrop-blur">
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-3.5 w-3.5 accent-green-700" />
          <span className="t-caption text-[var(--text)]">선택</span>
        </label>
      </div>
      <figcaption className="space-y-1.5 p-2.5">
        <p className="flex flex-wrap items-center gap-1 t-caption text-[var(--text-soft)]">
          <span>{r.industry} · {r.mood} · <b>{r.role}</b> · {r.width}×{r.height}</span>
          {ok === null && <span className="rounded bg-accent-soft px-1 text-accent-ink">대기</span>}
          {ok === true && <span className="rounded bg-green-100 px-1 text-green-700">승인</span>}
          {ok === false && <span className="rounded bg-danger-soft px-1 text-danger">거부</span>}
          <UsedBadge usedBy={r.usedBy} />
        </p>
        {r.deleted && (
          <p className="rounded bg-n-100 px-1.5 py-1 t-caption text-[var(--text-soft)]">
            휴지통 · {r.deletedAt ? new Date(r.deletedAt).toLocaleDateString("ko-KR") : "시각 없음"}
            {r.deletedReason ? ` · ${r.deletedReason}` : ""}
            <span className="block text-[var(--text-soft)]">파일은 지우지 않았습니다 — 복구하면 그대로 돌아옵니다</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 t-caption">
          <button disabled={busy} onClick={() => act({ quality_ok: true })}
            className={`rounded-full px-2.5 py-1 font-semibold ${ok === true ? "bg-green-700 text-white" : "border border-n-300"}`}>승인</button>
          <button disabled={busy} onClick={() => act({ quality_ok: false })}
            className={`rounded-full px-2.5 py-1 font-semibold ${ok === false ? "bg-danger text-white" : "border border-n-300"}`}>거부</button>
          <select disabled={busy} value={state.score} onChange={(e) => act({ quality_score: Number(e.target.value) })}
            className="rounded-full border border-n-300 px-2 py-1">
            {[90, 70, 50, 30].map((v) => <option key={v} value={v}>{v}점</option>)}
          </select>
          {r.deleted ? (
            <button disabled={busy}
              onClick={async () => {
                setBusy(true); setErr("");
                // 복구 = 표시를 되돌리는 것뿐. 파일은 애초에 지운 적이 없다
                const e = await patch(r.id, { deleted: false }, "복구");
                if (e) setErr(e); else setState((s) => ({ ...s, gone: true }));
                setBusy(false);
              }}
              className="rounded-full bg-green-700 px-2.5 py-1 font-semibold text-white">↩ 복구</button>
          ) : (
            <button disabled={busy}
              onClick={async () => {
                // ★ 파일은 지우지 않는다. 목록에서만 내린다(휴지통) — 언제든 복구할 수 있다.
                const reason = prompt("휴지통으로 내립니다. 파일은 지우지 않아 언제든 복구할 수 있어요. 사유(선택):", "");
                if (reason === null) return;
                setBusy(true); setErr("");
                const e = await patch(r.id, { deleted: true, reason }, "휴지통으로 내리기");
                if (e) setErr(e); else setState((s) => ({ ...s, gone: true }));
                setBusy(false);
              }}
              className="rounded-full border border-n-300 px-2.5 py-1 text-[var(--text-soft)]">🗑 휴지통</button>
          )}
        </div>

        {err && <p className="rounded bg-danger-soft px-1.5 py-1 t-caption text-danger">{err}</p>}

        <TagEditor id={r.id} initial={r.tags ?? []} />

        <details className="t-caption text-[var(--text-soft)]">
          <summary className="cursor-pointer">프롬프트</summary>
          <p className="mt-1 leading-4">{r.prompt}</p>
        </details>
      </figcaption>
    </figure>
  );
}

export function BankGrid({ rows, pendingTab = false }: { rows: BankRow[]; pendingTab?: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [fast, setFast] = useState(false);

  /* ★ 성공 문구는 **스스로 사라진다.** 안 지우면 「선택 0장」 옆에 「120장 승인했어요」가
     나란히 남아, 방금 한 일인지 아까 한 일인지 알 수 없다(2026-09-10 회장님).
     ⚠ 실패 문구는 지우지 않는다 — 놓치면 안 되는 말이다. */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const pendingIds = useMemo(() => rows.filter((r) => r.quality_ok === null).map((r) => r.id), [rows]);
  const allSelected = sel.size > 0 && sel.size === rows.length;

  function toggle(id: string) {
    setMsg("");
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function bulkApprove() {
    if (sel.size === 0) return;
    setBusy(true); setMsg(""); setErr("");
    const ids = [...sel];
    const r = await fetch("/api/admin/bank", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    });
    setBusy(false);
    /* ★ 0건도 여기로 온다(409) — 서버가 「처리된 사진이 없습니다」를 준다.
       전에는 0건이 성공이라 「0장 승인했어요」가 떴다. */
    if (!r.ok) { setErr(await adminError(r, "일괄 승인")); return; }
    const d = (await r.json()) as { approved: number; trashed: number };
    setApproved((a) => new Set([...a, ...ids]));
    setSel(new Set());
    /* 휴지통에 있어 빠진 장수는 «조용히» 빼면 안 된다 — 고른 수와 승인 수가 안 맞는 이유다 */
    setMsg(`${d.approved}장 승인했어요` + (d.trashed ? ` · ${d.trashed}장은 휴지통에 있어 제외했습니다` : ""));
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 mt-6 flex flex-wrap items-center gap-2 bg-n-0/95 px-2 py-2 backdrop-blur">
        <button onClick={() => { setMsg(""); setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id))); }}
          className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-medium">
          {allSelected ? "선택 해제" : "전체 선택"}
        </button>
        <button onClick={() => { setMsg(""); setSel(new Set(pendingIds)); }} disabled={pendingIds.length === 0}
          className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-medium disabled:opacity-40">
          검수 대기만 선택 ({pendingIds.length})
        </button>
        <button onClick={() => setFast(true)} disabled={rows.length === 0}
          className="rounded-full bg-n-900 px-4 py-1.5 t-caption font-semibold text-white disabled:opacity-40"
          title="한 장씩 크게 보고 키 하나로 점수를 매깁니다 (1·2·3·0)">
          ⚡ 빠른 검수 {pendingIds.length > 0 ? `(대기 ${pendingIds.length}장)` : `(${rows.length}장)`}
        </button>
        <button onClick={bulkApprove} disabled={busy || sel.size === 0}
          className="rounded-full bg-green-700 px-4 py-1.5 t-caption font-semibold text-white disabled:opacity-40">
          {busy ? "승인 중…" : `선택 ${sel.size}장 일괄 승인`}
        </button>
        {msg && <span className="t-caption text-green-700">{msg}</span>}
        {err && <span className="t-caption font-semibold text-danger">{err}</span>}
        <span className="ml-auto t-caption text-[var(--text-soft)]">거부·삭제는 오판 위험이 커서 한 장씩</span>
      </div>

      {fast && (
        <FastReview
          rows={pendingIds.length > 0 ? rows.filter((r) => r.quality_ok === null) : rows}
          onClose={() => { setFast(false); location.reload(); }}
        />
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <Card
            key={r.id}
            pendingTab={pendingTab}
            r={r}
            checked={sel.has(r.id)}
            onToggle={() => toggle(r.id)}
            bulkApproved={approved.has(r.id)}
          />
        ))}
      </div>
    </>
  );
}
