"use client";

import { useMemo, useState } from "react";

export type BankRow = {
  id: string; industry: string; mood: string; role: string;
  url: string; quality_ok: boolean | null; quality_score: number;
  used_count: number; prompt: string | null; tags: string[] | null;
  width: number | null; height: number | null;
  /** 지금 이 이미지를 쓰고 있는 발행 사이트들 (lib/image-usage) */
  usedBy: { slug: string; businessName: string; role: string }[];
};

async function patch(id: string, p: Record<string, unknown>) {
  const r = await fetch("/api/admin/bank", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...p }),
  });
  return r.ok;
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
      className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${asHero ? "bg-teal-100 text-teal-800" : "bg-neutral-100 text-neutral-600"}`}
    >
      {label}{asHero && " · 히어로"}
    </span>
  );
}

function TagEditor({ id, initial }: { id: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string[]) {
    setBusy(true);
    const ok = await patch(id, { tags: next });
    if (ok) setTags(next);
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
          title="클릭하면 삭제" className="rounded bg-teal-50 px-1.5 py-0.5 text-[10.5px] text-teal-800 disabled:opacity-50">
          {t} ×
        </button>
      ))}
      <input
        value={draft} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="태그 추가"
        className="w-20 rounded border border-neutral-200 px-1.5 py-0.5 text-[10.5px] outline-none focus:border-teal-600"
      />
    </div>
  );
}

function Card({ r, checked, onToggle, bulkApproved }: {
  r: BankRow; checked: boolean; onToggle: () => void; bulkApproved: boolean;
}) {
  const [state, setState] = useState<{ ok: boolean | null; score: number; gone: boolean }>(
    { ok: r.quality_ok, score: r.quality_score, gone: false },
  );
  const [busy, setBusy] = useState(false);
  // 일괄 승인은 부모가 알려준다 — 카드 내부 state는 개별 클릭만 반영하므로 표시에서 합친다
  const ok = bulkApproved ? true : state.ok;
  async function act(p: Record<string, unknown>) {
    setBusy(true);
    if (await patch(r.id, p)) setState((s) => ({ ...s, ...(p as Partial<typeof s>) }));
    setBusy(false);
  }
  if (state.gone) return null;

  return (
    <figure className={`overflow-hidden rounded-xl border ${checked ? "border-teal-600 ring-1 ring-teal-600" : "border-neutral-200"}`}>
      <div className="relative">
        <a href={r.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </a>
        <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1 rounded bg-white/90 px-1.5 py-1 backdrop-blur">
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-3.5 w-3.5 accent-teal-700" />
          <span className="text-[10px] text-neutral-600">선택</span>
        </label>
      </div>
      <figcaption className="space-y-1.5 p-2.5">
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <span>{r.industry} · {r.mood} · <b>{r.role}</b> · {r.width}×{r.height}</span>
          {ok === null && <span className="rounded bg-amber-100 px-1 text-amber-700">대기</span>}
          {ok === true && <span className="rounded bg-green-100 px-1 text-green-700">승인</span>}
          {ok === false && <span className="rounded bg-red-100 px-1 text-red-600">거부</span>}
          <UsedBadge usedBy={r.usedBy} />
        </p>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button disabled={busy} onClick={() => act({ quality_ok: true })}
            className={`rounded-full px-2.5 py-1 font-semibold ${ok === true ? "bg-green-600 text-white" : "border border-neutral-300"}`}>승인</button>
          <button disabled={busy} onClick={() => act({ quality_ok: false })}
            className={`rounded-full px-2.5 py-1 font-semibold ${ok === false ? "bg-red-500 text-white" : "border border-neutral-300"}`}>거부</button>
          <select disabled={busy} value={state.score} onChange={(e) => act({ quality_score: Number(e.target.value) })}
            className="rounded-full border border-neutral-300 px-2 py-1">
            {[90, 70, 50, 30].map((v) => <option key={v} value={v}>{v}점</option>)}
          </select>
          <button disabled={busy}
            onClick={async () => {
              if (!confirm("이미지를 목록에서 제거할까요?")) return;
              setBusy(true);
              if (await patch(r.id, { deleted: true, quality_ok: false })) setState((s) => ({ ...s, gone: true }));
              setBusy(false);
            }}
            className="rounded-full border border-neutral-300 px-2.5 py-1 text-neutral-400">삭제</button>
        </div>

        <TagEditor id={r.id} initial={r.tags ?? []} />

        <details className="text-[10.5px] text-neutral-400">
          <summary className="cursor-pointer">프롬프트</summary>
          <p className="mt-1 leading-4">{r.prompt}</p>
        </details>
      </figcaption>
    </figure>
  );
}

export function BankGrid({ rows }: { rows: BankRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [approved, setApproved] = useState<Set<string>>(new Set());

  const pendingIds = useMemo(() => rows.filter((r) => r.quality_ok === null).map((r) => r.id), [rows]);
  const allSelected = sel.size > 0 && sel.size === rows.length;

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function bulkApprove() {
    if (sel.size === 0) return;
    setBusy(true); setMsg("");
    const ids = [...sel];
    const r = await fetch("/api/admin/bank", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(`실패: ${d.error ?? r.status}`); return; }
    setApproved((a) => new Set([...a, ...ids]));
    setSel(new Set());
    setMsg(`${d.approved}장 승인했어요`);
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 mt-6 flex flex-wrap items-center gap-2 bg-white/95 px-2 py-2 backdrop-blur">
        <button onClick={() => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium">
          {allSelected ? "선택 해제" : "전체 선택"}
        </button>
        <button onClick={() => setSel(new Set(pendingIds))} disabled={pendingIds.length === 0}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          검수 대기만 선택 ({pendingIds.length})
        </button>
        <button onClick={bulkApprove} disabled={busy || sel.size === 0}
          className="rounded-full bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? "승인 중…" : `선택 ${sel.size}장 일괄 승인`}
        </button>
        {msg && <span className="text-xs text-teal-700">{msg}</span>}
        <span className="ml-auto text-[11px] text-neutral-400">거부·삭제는 오판 위험이 커서 한 장씩</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <Card
            key={r.id}
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
