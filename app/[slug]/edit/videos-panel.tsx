"use client";

import { useCallback, useEffect, useState } from "react";
import type { SectionT, SiteDocT } from "@/lib/schema";
import { StoryLinkButton } from "./story-link";

/**
 * 「영상」 메뉴 — 찍어 올린 60초 영상을 **홈페이지에 걸고 내린다** (2026-09-11, V-1 C).
 *
 * ★ 이 파일이 따로 있는 이유: `ui.tsx` 가 이미 1,000줄이 넘는다. 화면을 하나 더 넣으면
 *   그 파일을 다시 읽기 어려워진다. 상태는 부모(ui.tsx)가 들고, 여기는 화면만 그린다.
 *
 * ★ **doc 을 여기서 저장하지 않는다.** 걸기가 성공하면 부모에게 «이 섹션을 넣어라»만 알린다.
 *   부모의 평소 자동저장이 그걸 저장한다 — 서버가 draft 를 직접 고치면 사장님 화면의
 *   낡은 doc 이 곧 덮어쓴다.
 *
 * ⚠ **조용히 실패하지 않는다**(회장님 지시 1). 걸기가 실패하면 그 카드 안에 이유를 띄운다.
 * ⚠ V-1 은 **한 편만** 걸린다. 이미 걸린 게 있으면 「바꾸시겠습니까」로 묻는다(지시 5).
 */

type Item = {
  id: string;
  title: string;
  question: string;
  date: string;
  poster: string | null;
  preview: string | null;
  publicUrl: string | null;
};

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;

export function VideosPanel({ slug, doc, phone, onAttach, onDetach }: {
  slug: string;
  doc: SiteDocT;
  /** 녹화 링크 버튼이 쓴다 — 문자로 보낼 번호 */
  phone: string;
  /** 걸기 성공 — 부모가 이 섹션을 doc 에 끼운다 */
  onAttach: (section: SectionT) => void;
  /** 내리기 — 부모가 doc 에서 영상 섹션을 뺀다 */
  onDetach: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);
  const [dur, setDur] = useState<Record<string, number>>({});

  /** 지금 홈페이지에 걸려 있는 영상 주소 — doc 이 진실이다 */
  const attachedUrl = (() => {
    const v = doc.sections.find((s) => s.type === "video");
    return v && "url" in v ? v.url : "";
  })();

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
      const r = await fetch("/api/site/videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setLoadErr(d.error ?? "영상 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        return;
      }
      setItems(((await r.json()) as { items: Item[] }).items);
    } catch {
      setLoadErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
      setItems([]);
    }
  }, [slug]);

  /* ⚠ 이펙트 «본문»에서 곧바로 setState 하면 렌더가 연쇄로 돈다(load 의 첫 줄이 setLoadErr 다).
     한 틱 뒤에 부른다 — 그동안은 「불러오는 중…」이 떠 있다. */
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function attach(it: Item) {
    // ⚠ V-1 은 한 편만 — 이미 걸린 게 있으면 반드시 묻는다
    if (attachedUrl && attachedUrl !== it.publicUrl) {
      if (!confirm("지금 걸려 있는 영상을 이 영상으로 바꿀까요?\n(이전 영상은 지워지지 않고 목록에 그대로 남아요)")) return;
    }
    setBusyId(it.id); setErr(null);
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 무시 */ }
      const r = await fetch("/api/site/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId: it.id }),
      });
      const d = (await r.json().catch(() => ({}))) as { section?: SectionT; error?: string };
      if (!r.ok || !d.section) {
        setErr({ id: it.id, msg: r.status === 403 ? "로그인이 풀렸어요 — 다시 로그인해 주세요" : (d.error ?? `걸지 못했어요 (${r.status})`) });
        return;
      }
      onAttach(d.section);
    } catch {
      setErr({ id: it.id, msg: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) return <p className="mt-8 text-center t-small text-[var(--text-soft)]">영상을 불러오는 중…</p>;

  return (
    <div className="space-y-4">
      {loadErr && <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold text-danger">{loadErr}</p>}

      {items.length === 0 ? (
        /* ★ 빈 화면 — 여기서 «찍으러 가는 길»을 준다(회장님 지시 3).
           안내만 하고 갈 곳이 없으면 사장님은 여기서 멈춘다. */
        <section className="rounded-2xl border border-n-200 p-5 text-center">
          <p className="t-h3 font-bold">아직 찍은 영상이 없어요</p>
          <p className="mx-auto mt-2 max-w-sm t-caption leading-relaxed text-[var(--text-soft)]">
            <b>60초만 찍어 보세요.</b> 얼굴이 안 나와도 됩니다 — 매장이나 손만 찍으셔도 돼요.
            찍은 영상은 여기서 홈페이지에 걸 수 있습니다.
          </p>
          <div className="mt-4 text-left">
            <StoryLinkButton slug={slug} phone={phone} />
          </div>
        </section>
      ) : (
        <>
          <p className="t-caption leading-relaxed text-[var(--text-soft)]">
            홈페이지에는 <b>한 편만</b> 걸 수 있어요. 다른 영상을 걸면 지금 걸린 것과 바뀝니다.
          </p>
          {items.map((it) => {
            const on = !!it.publicUrl && it.publicUrl === attachedUrl;
            const d = dur[it.id];
            return (
              <section key={it.id} className={`space-y-3 rounded-2xl border p-4 ${on ? "border-green-700" : "border-n-200"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="w-40 shrink-0 overflow-hidden rounded-xl bg-n-900">
                    {it.preview ? (
                      <video
                        src={it.preview} poster={it.poster ?? undefined}
                        controls playsInline preload="metadata"
                        className="block w-full" style={{ maxHeight: 160 }}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget.duration;
                          if (Number.isFinite(v) && v > 0) setDur((p) => ({ ...p, [it.id]: v }));
                        }}
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center t-caption text-white">미리보기 없음</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="t-small font-bold">{it.question || it.title || "제목 없음"}</p>
                    <p className="mt-1 t-caption text-[var(--text-soft)]">
                      {it.date}
                      {d ? ` · ${mmss(d)}` : ""}
                      {!it.poster && " · 표지 없음"}
                    </p>
                    {on && <p className="mt-1.5 t-caption font-semibold text-green-700">홈페이지에 걸려 있어요</p>}
                  </div>
                </div>

                {err?.id === it.id && (
                  <p className="rounded-lg bg-danger-soft p-2.5 t-caption font-semibold text-danger">{err.msg}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {on ? (
                    /* ★ 내리는 길 — 걸기만 되고 못 내리면 사장님이 갇힌다(회장님 지시 2) */
                    <button type="button" onClick={onDetach}
                      className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">
                      홈페이지에서 내리기
                    </button>
                  ) : (
                    <button type="button" disabled={busyId === it.id} onClick={() => void attach(it)}
                      className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                      {busyId === it.id ? "거는 중…" : "홈페이지에 걸기"}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          <div className="rounded-2xl border border-n-200 p-4">
            <p className="t-small font-bold">하나 더 찍기</p>
            <div className="mt-2"><StoryLinkButton slug={slug} phone={phone} /></div>
          </div>
        </>
      )}
    </div>
  );
}
