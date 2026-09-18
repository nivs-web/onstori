"use client";

import { useState } from "react";
import {
  SHORTS_STYLES, SHORTS_ORDERS, STAGE_N_CHOICES, CARDS_N_CHOICES,
  type ShortsStyle, type ShortsOrder,
} from "@/config/shorts";

export type SiteRow = {
  slug: string;
  name: string;
  status: string;
  videos: number;
  style: ShortsStyle;
  stageN: number;
  /** 🔴 카드형태가 늘어놓는 편수 — 10~40 (2026-09-18 B-17) */
  cardsN: number;
  order: ShortsOrder;
  /** 사장님이 직접 고른 적이 있나 — 없으면 기본값으로 도는 중 */
  chosen: boolean;
  /** 🔴 실제 저장량(바이트). **`null` 은 「못 쟀다」이지 「0」이 아니다**(지시 [47]①) */
  bytes: number | null;
};

/** 사람이 읽는 용량. ⚠ 못 쟀으면 **「못 쟀어요」**라고 쓴다 — 0 이라고 쓰면 거짓말이다 */
function saySize(bytes: number | null): string {
  if (bytes === null) return "용량 못 쟀어요";
  /* ⚠ **0 을 「1KB」로 쓰지 않는다.** 아무것도 없는데 1KB 라고 적으면 그것도 거짓말이다 */
  if (bytes === 0) return "0";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

/**
 * 🔴 **전체 홈페이지의 「숏폼 스타일」 표.** (2026-09-17 지시 [42] §4-②)
 *
 * ⚠ **바꾸는 창구는 사장님 화면과 «같은 것»**(`/api/site/shorts-style`)을 쓴다.
 *   그 창구가 **주인인지 운영자인지**를 스스로 가린다(`loadOwnedSite`).
 *   🔴 어드민 전용 창구를 따로 만들면 «얹어 쓰기»·«모르는 값 거절» 규칙이 두 벌이 되고,
 *     한쪽만 고쳐져 어긋난다.
 *
 * ⚠ **먼저 화면을 바꾸고** 서버에 보낸다 — 누르자마자 반응이 있어야 한다.
 *   실패하면 **되돌리고 그 줄에 사실대로** 적는다(조용히 삼키면 바뀐 줄 안다).
 */
export function VideosStyleTable({ rows, warnAt }: { rows: SiteRow[]; warnAt: number }) {
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function change(slug: string, patch: { style?: ShortsStyle; order?: ShortsOrder; stageN?: number; cardsN?: number }) {
    if (busy) return;
    const before = list.find((r) => r.slug === slug);
    if (!before) return;
    setBusy(slug);
    setMsg((m) => ({ ...m, [slug]: "" }));
    setList((l) => l.map((r) => (r.slug === slug ? { ...r, ...patch, chosen: true } : r)));
    try {
      const res = await fetch("/api/site/shorts-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...patch }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setList((l) => l.map((r) => (r.slug === slug ? before : r)));
        setMsg((m) => ({ ...m, [slug]: d.error ?? "바꾸지 못했어요" }));
        return;
      }
      setMsg((m) => ({ ...m, [slug]: "바꿨습니다" }));
    } catch {
      setList((l) => l.map((r) => (r.slug === slug ? before : r)));
      setMsg((m) => ({ ...m, [slug]: "연결이 끊겼어요" }));
    } finally {
      setBusy(null);
    }
  }

  if (!list.length) return <p className="t-caption text-[var(--text-soft)]">홈페이지가 없습니다.</p>;

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <section key={r.slug} className="rounded-2xl border border-n-200 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <b className="t-body">{r.name || r.slug}</b>
            <a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="t-caption underline underline-offset-2">
              /{r.slug}
            </a>
            <span className="t-caption text-[var(--text-soft)]">{r.status}</span>
            {/* 🔴 영상이 없으면 어느 모양을 골라도 화면에 아무 변화가 없다 — 먼저 말해 준다 */}
            <span className="t-caption text-[var(--text-soft)]">
              {r.videos > 0 ? `걸린 영상 ${r.videos}편` : "걸린 영상 없음 — 골라도 화면에 안 보입니다"}
            </span>
            {/* 🔴 실제 저장량 — **막지 않고 보이기만** 한다(지시 [47]①②).
                   기준을 넘으면 «눈에 띄게». 그래도 아무것도 막지 않는다 */}
            <span className={`t-caption ${r.videos > warnAt ? "font-bold text-danger" : "text-[var(--text-soft)]"}`}>
              · {saySize(r.bytes)}
              {r.videos > warnAt && ` · 🔴 ${warnAt}편 넘음`}
            </span>
            {!r.chosen && (
              <span className="t-caption text-[var(--text-soft)]">· 사장님이 고른 적 없음(기본값)</span>
            )}
            {msg[r.slug] && <span className="t-caption font-semibold">· {msg[r.slug]}</span>}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {/* 모양 */}
            <div>
              <p className="t-caption font-bold">모양</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {SHORTS_STYLES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={busy === r.slug}
                    aria-pressed={r.style === o.key}
                    onClick={() => change(r.slug, { style: o.key })}
                    className={`rounded-xl border px-3 py-1.5 t-caption font-semibold disabled:opacity-60 ${
                      r.style === o.key ? "border-green-700 bg-n-50" : "border-n-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 가두는 편수 — 숏폼형태일 때만 뜻이 있다 */}
            <div>
              <p className="t-caption font-bold">
                가두는 편수
                {r.style !== "shorts" && <span className="font-normal text-[var(--text-soft)]"> (카드형태는 해당 없음)</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {STAGE_N_CHOICES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy === r.slug || r.style !== "shorts"}
                    aria-pressed={r.stageN === n}
                    onClick={() => change(r.slug, { stageN: n })}
                    className={`rounded-xl border px-2.5 py-1.5 t-caption font-semibold disabled:opacity-40 ${
                      r.stageN === n && r.style === "shorts" ? "border-green-700 bg-n-50" : "border-n-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 🔴 늘어놓는 편수 — 카드형태일 때만 뜻이 있다 (2026-09-18 B-17) */}
            <div>
              <p className="t-caption font-bold">
                늘어놓는 편수
                {r.style !== "cards" && <span className="font-normal text-[var(--text-soft)]"> (숏폼형태는 해당 없음)</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CARDS_N_CHOICES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy === r.slug || r.style !== "cards"}
                    aria-pressed={r.cardsN === n}
                    onClick={() => change(r.slug, { cardsN: n })}
                    className={`rounded-xl border px-2.5 py-1.5 t-caption font-semibold disabled:opacity-40 ${
                      r.cardsN === n && r.style === "cards" ? "border-green-700 bg-n-50" : "border-n-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 재생 순서 */}
            <div>
              <p className="t-caption font-bold">재생 순서</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {SHORTS_ORDERS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={busy === r.slug}
                    aria-pressed={r.order === o.key}
                    onClick={() => change(r.slug, { order: o.key })}
                    className={`rounded-xl border px-3 py-1.5 t-caption font-semibold disabled:opacity-60 ${
                      r.order === o.key ? "border-green-700 bg-n-50" : "border-n-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
