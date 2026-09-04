"use client";

import { useRef, useState } from "react";

/**
 * 문의함 탭 — docs/specs/inquiry.md 5장.
 *
 * 사장님이 폰에서 문의를 확인하고 바로 전화를 거는 화면이다. 그래서 목록은
 * "누가·언제·뭘 원하는지"만 보이고, 펼치면 사진과 전화 버튼이 나온다.
 *
 * 설계 메모 셋:
 *  1) **필터는 클라이언트에서** 건다. `/api/inquiry/list` 에 status 파라미터가 있지만
 *     서버로 거르면 칩마다 개수를 알 수 없다. 최신 50건을 한 번 받아 나눈다.
 *  2) 배지 숫자는 **서버 newCount** 로 시작한다 — 50건 밖의 새 문의까지 세야 정확하다.
 *     상태를 바꿀 때는 목록을 다시 부르지 않고 ±1 만 반영한다(사진 URL 재발급·깜빡임 방지).
 *  3) 사진은 10분짜리 signed URL 이라 탭을 오래 열어두면 만료된다. 타이머를 두는 대신
 *     이미지 로드 실패를 잡아 "다시 불러오기" 를 띄운다.
 */

export type Inquiry = {
  id: string;
  kind: string;
  name: string;
  phone: string;
  message: string | null;
  photos: string[];
  status: "new" | "contacted" | "done" | "spam";
  memo: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotifyChannels = { sms: boolean; email: boolean };
export type InboxRes = { items: Inquiry[]; newCount: number; channels: NotifyChannels };

type Status = Inquiry["status"];

const STATUS: Record<Status, { label: string; chip: string }> = {
  new: { label: "새 문의", chip: "bg-teal-600 text-white" },
  contacted: { label: "연락함", chip: "bg-amber-100 text-amber-900" },
  done: { label: "완료", chip: "bg-neutral-200 text-neutral-600" },
  spam: { label: "스팸", chip: "bg-neutral-100 text-neutral-400" },
};

const FILTERS: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "new", label: "새 문의" },
  { id: "contacted", label: "연락함" },
  { id: "done", label: "완료" },
  { id: "spam", label: "스팸" },
];

const COPY = {
  empty: "아직 문의가 없어요. 홈페이지 주소를 카톡 프로필·명함·플레이스에 걸어두면 여기 쌓여요.",
  emptyFiltered: "이 칸에는 아직 문의가 없어요.",
  loadFail: "문의를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
  photoFail: "사진 주소가 만료됐어요",
  spamConfirm: "스팸으로 표시하면 이 번호는 30일간 문의를 보낼 수 없어요. 계속할까요?",
};

/** G1 접수 API가 이름 없는 문의에 넣는 기본값 — 전화 버튼 문구에서 걸러낸다 */
const NO_NAME = "이름 미기재";

function when(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function InboxTab({ slug, anonId, initial, onNewCount }: {
  slug: string;
  anonId: string;
  initial: InboxRes | null;
  /** 탭 배지와 값을 맞추기 위해 부모에게 되돌려준다 */
  onNewCount: (n: number) => void;
}) {
  const [items, setItems] = useState<Inquiry[]>(initial?.items ?? []);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(!initial);
  const [reloading, setReloading] = useState(false);

  /** 배지의 현재값. state 로 두면 patch 안에서 이전 렌더의 값을 읽어 어긋난다. */
  const badge = useRef(initial?.newCount ?? 0);

  async function reload() {
    setReloading(true);
    try {
      const r = await fetch("/api/inquiry/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId }),
      });
      if (!r.ok) { setFailed(true); return; }
      const d = (await r.json()) as InboxRes;
      setItems(d.items);
      setFailed(false);
      badge.current = d.newCount;
      onNewCount(d.newCount);
    } catch {
      setFailed(true);
    } finally {
      setReloading(false);
    }
  }

  /** 상태·메모·읽음 변경. 실패하면 화면을 되돌리지 않고 목록을 다시 불러 서버 값에 맞춘다. */
  async function patch(id: string, body: { status?: Status; memo?: string; read?: boolean }) {
    const before = items.find((x) => x.id === id)?.status;
    setBusyId(id);
    try {
      const r = await fetch("/api/inquiry/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, id, ...body }),
      });
      if (!r.ok) { await reload(); return; }

      // 배지는 status==="new" 의 개수다. new 에서 빠져나갈 때만 하나 줄어든다.
      if (body.status && before === "new" && body.status !== "new") {
        badge.current = Math.max(0, badge.current - 1);
        onNewCount(badge.current);
      }

      setItems((prev) => prev.map((x) => (x.id === id ? {
        ...x,
        ...(body.status ? { status: body.status } : {}),
        ...(body.memo !== undefined ? { memo: body.memo } : {}),
        ...(body.read ? { read_at: x.read_at ?? new Date().toISOString() } : {}),
      } : x)));
    } finally {
      setBusyId(null);
    }
  }

  function toggle(row: Inquiry) {
    const next = openId === row.id ? null : row.id;
    setOpenId(next);
    // 펼치면 읽음 처리. read_at 은 배지(status)와 무관하므로 숫자는 그대로다.
    if (next && !row.read_at) void patch(row.id, { read: true });
  }

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.id] = f.id === "all" ? items.length : items.filter((x) => x.status === f.id).length;
    return acc;
  }, {});
  const shown = filter === "all" ? items : items.filter((x) => x.status === filter);

  if (failed) {
    return (
      <div className="mt-5 rounded-2xl border border-neutral-200 p-6 text-center">
        <p className="text-sm text-neutral-500">{COPY.loadFail}</p>
        <button onClick={reload} disabled={reloading}
          className="mt-3 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
          {reloading ? "불러오는 중…" : "다시 불러오기"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f.id ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"
            }`}>
            {f.label}{counts[f.id] ? <span className="ml-1 opacity-70">{counts[f.id]}</span> : null}
          </button>
        ))}
        <button onClick={reload} disabled={reloading}
          className="ml-auto self-center text-xs text-neutral-500 underline underline-offset-4 disabled:opacity-40">
          {reloading ? "새로고침 중…" : "새로고침"}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-neutral-50 p-6 text-center text-sm leading-relaxed text-neutral-500">
          {items.length === 0 ? COPY.empty : COPY.emptyFiltered}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((row) => (
            <Card key={row.id} row={row} open={openId === row.id} busy={busyId === row.id}
              onToggle={() => toggle(row)} onPatch={(b) => patch(row.id, b)} onReload={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ row, open, busy, onToggle, onPatch, onReload }: {
  row: Inquiry;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onPatch: (b: { status?: Status; memo?: string }) => void;
  onReload: () => void;
}) {
  const [memo, setMemo] = useState(row.memo ?? "");
  const [photoBroken, setPhotoBroken] = useState(false);
  const s = STATUS[row.status];
  const named = !!row.name && row.name !== NO_NAME;

  function setStatus(next: Status) {
    // 스팸은 이 번호를 30일간 막는다 — 실수로 진짜 손님을 막지 않도록 한 번 묻는다.
    if (next === "spam" && !window.confirm(COPY.spamConfirm)) return;
    onPatch({ status: next });
  }

  return (
    <li className={`overflow-hidden rounded-2xl border ${row.read_at ? "border-neutral-200" : "border-teal-300 bg-teal-50/40"}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.chip}`}>{s.label}</span>
            <span className="text-xs text-neutral-400">{when(row.created_at)}</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-bold">
            {row.name} <span className="font-normal text-neutral-500">{row.phone}</span>
          </p>
          {row.message && <p className="mt-0.5 truncate text-xs text-neutral-500">{row.message}</p>}
        </div>
        {row.photos.length > 0 && !open && (
          <div className="flex shrink-0 gap-1">
            {row.photos.slice(0, 3).map((u, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={u} alt="" onError={() => setPhotoBroken(true)}
                className="h-11 w-11 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-neutral-200 px-4 pb-4 pt-3">
          {row.photos.length > 0 && (
            photoBroken ? (
              <div className="rounded-xl bg-neutral-50 p-4 text-center text-xs text-neutral-500">
                {COPY.photoFail}
                <button onClick={onReload} className="ml-2 font-semibold text-teal-700 underline underline-offset-2">
                  다시 불러오기
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {row.photos.map((u, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={u} alt={`문의 사진 ${i + 1}`} onError={() => setPhotoBroken(true)}
                    className="w-full rounded-xl object-cover" />
                ))}
              </div>
            )
          )}

          {row.message && <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.message}</p>}

          <a href={`tel:${row.phone.replace(/[^0-9+]/g, "")}`}
            className="block rounded-xl bg-teal-700 py-3 text-center text-sm font-bold text-white">
            📞 {named ? `${row.name}님께 전화하기` : "전화하기"}
          </a>

          <div className="flex gap-2">
            {(["contacted", "done", "spam"] as const)
              .filter((v) => v !== row.status)
              .map((v) => (
                <button key={v} onClick={() => setStatus(v)} disabled={busy}
                  className="flex-1 rounded-xl border border-neutral-300 py-2 text-xs font-semibold disabled:opacity-40">
                  {v === "contacted" ? "연락함으로" : v === "done" ? "완료" : "스팸"}
                </button>
              ))}
          </div>

          <input value={memo} maxLength={300} placeholder="메모 (나만 봐요)"
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => { if (memo !== (row.memo ?? "")) onPatch({ memo }); }}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600" />
        </div>
      )}
    </li>
  );
}
