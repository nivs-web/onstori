"use client";

import { useCallback, useEffect, useState } from "react";
import type { SectionT, SiteDocT } from "@/lib/schema";
import { StoryLinkButton } from "./story-link";
import { SnsPanel } from "./sns-panel";

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
  /** 영상 메뉴 안의 두 갈래 — 「내 영상」과 「SNS 연결」 */
  const [view, setView] = useState<"list" | "sns">("list");
  /** 올릴 곳으로 고른 SNS. ④ 올리기가 이 값을 쓴다 */
  const [snsPicked, setSnsPicked] = useState<string[]>([]);

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

  /* ── SNS 올리기 ────────────────
     ★ 인스타는 한 번에 안 끝난다. `processing` 이면 **1분에 한 번, 최대 5분** 이어 간다
       (회장님 지시 4). 기다림을 서버에 맡기면 시간 초과로 끊기고, 그 끊김이 곧
       «같은 영상 두 번 올리기»가 된다. 그래서 화면이 기다린다. */
  type PubRow = { provider: string; name: string; state: string; msg: string; url?: string | null; kind?: string };
  const [pub, setPub] = useState<Record<string, PubRow[]>>({});
  const [pubBusy, setPubBusy] = useState<string | null>(null);

  async function publish(entryId: string) {
    setPubBusy(entryId);
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
      const r = await fetch("/api/sns/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId, providers: snsPicked }),
      });
      const d = (await r.json().catch(() => ({}))) as { results?: PubRow[]; error?: string };
      if (!r.ok) {
        setPub((p) => ({ ...p, [entryId]: [{ provider: "-", name: "올리기", state: "failed", msg: d.error ?? `실패했어요 (${r.status})` }] }));
        return;
      }
      const rows = d.results ?? [];
      setPub((p) => ({ ...p, [entryId]: rows }));
      /* 아직 받는 중인 곳만 이어 간다 */
      for (const row of rows.filter((x) => x.state === "processing")) void followUp(entryId, row.provider, anonId);
    } catch {
      setPub((p) => ({ ...p, [entryId]: [{ provider: "-", name: "올리기", state: "failed", msg: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요." }] }));
    } finally { setPubBusy(null); }
  }

  /** 1분 간격 · 최대 5번 — 그래도 안 끝나면 「아직 받는 중」으로 남겨 둔다 */
  async function followUp(entryId: string, provider: string, anonId: string) {
    for (let i = 0; i < 5; i++) {
      await new Promise((res) => setTimeout(res, 60_000));
      try {
        const r = await fetch("/api/sns/publish/poll", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, anonId, entryId, provider }),
        });
        const d = (await r.json().catch(() => ({}))) as { state?: string; msg?: string; url?: string | null };
        if (!r.ok || !d.state) continue;
        setPub((p) => ({
          ...p,
          [entryId]: (p[entryId] ?? []).map((x) => x.provider === provider ? { ...x, state: d.state!, msg: d.msg ?? x.msg, url: d.url ?? x.url } : x),
        }));
        if (d.state === "published" || d.state === "failed") return;
      } catch { /* 다음 차례에 다시 */ }
    }
  }

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

  /* ★ 두 갈래를 **early return 위에** 그린다. 목록을 불러오는 동안에도
       [SNS 연결]로 넘어갈 수 있어야 한다 — 영상이 없어도 연결은 먼저 해 둘 수 있다. */
  const tabs = (
    /* ⚠ `data-tour` 를 붙이지 않았다. 불변 규칙 3 은 앵커 이름을 `config/tours.ts` 에
       등록된 것만 쓰라고 한다. 「SNS 연결」로 데려가는 힌트가 필요해지면 그때 먼저 등록한다. */
    <div className="flex gap-2">
      {([["list", "내 영상"], ["sns", "SNS 연결"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setView(id)}
          className={`rounded-full px-4 py-2 t-caption font-semibold ${
            view === id ? "bg-green-700 text-white" : "border border-n-300"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  if (view === "sns") {
    return (
      <div className="space-y-4">
        {tabs}
        <SnsPanel slug={slug} selected={snsPicked} onSelected={setSnsPicked} />
      </div>
    );
  }

  if (items === null) {
    return <div className="space-y-4">{tabs}<p className="mt-8 text-center t-small text-[var(--text-soft)]">영상을 불러오는 중…</p></div>;
  }

  return (
    <div className="space-y-4">
      {tabs}
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
                  {/* ⚠ `preload="none"` 이다. `metadata` 로 두면 목록을 여는 것만으로
                      **사장님 폰 데이터가 수십~수백 MB** 나간다 — 녹화기가 만든 mp4 는 조각형이라
                      브라우저가 길이를 알려면 파일을 거의 다 받아야 한다.
                      표지 사진만 먼저 보이고, 사장님이 재생을 눌러야 영상이 흐른다. */}
                  <div className="w-40 shrink-0 overflow-hidden rounded-xl bg-n-900">
                    {it.preview ? (
                      <video
                        src={it.preview} poster={it.poster ?? undefined}
                        controls playsInline preload="none"
                        className="block w-full" style={{ maxHeight: 160 }}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget.duration;
                          setDur((p) => ({ ...p, [it.id]: Number.isFinite(v) && v > 0 ? v : -1 }));
                        }}
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center t-caption text-white">미리보기 없음</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="t-small font-bold">{it.question || it.title || "제목 없음"}</p>
                    {/* ⚠ 길이를 «조용히 빼지» 않는다. 못 잰 것과 안 재 본 것을 구분해 말한다 —
                        녹화기가 만든 mp4 는 길이가 안 적혀 있는 경우가 실제로 흔하다. */}
                    <p className="mt-1 t-caption text-[var(--text-soft)]">
                      {it.date}
                      {d === undefined ? " · 길이는 ▶ 를 누르면 나와요" : d > 0 ? ` · ${mmss(d)}` : " · 길이 모름"}
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

                {/* ★ SNS 올리기 — [SNS 연결]에서 고른 곳에만 올린다.
                    ⚠ 고른 곳이 없으면 이 칸 자체가 안 보인다. 눌러도 아무 일이 안 나는
                      버튼을 두지 않는다. */}
                {snsPicked.length > 0 && (
                  <div className="rounded-xl border border-n-200 p-3">
                    <p className="t-caption font-semibold">SNS {snsPicked.length}곳에 올리기</p>
                    <button type="button" disabled={pubBusy === it.id}
                      onClick={() => void publish(it.id)}
                      className="mt-2 rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                      {pubBusy === it.id ? "올리는 중…" : "고른 곳에 올리기"}
                    </button>
                    {(pub[it.id] ?? []).map((r) => (
                      <p key={r.provider} className={`mt-1.5 t-caption leading-relaxed ${
                        r.state === "failed" ? "font-semibold text-danger" : "text-[var(--text-soft)]"}`}>
                        {r.name} · {r.msg}
                        {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer" className="underline">보기</a></>}
                      </p>
                    ))}
                  </div>
                )}
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
