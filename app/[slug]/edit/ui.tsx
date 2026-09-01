"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RULES } from "@/config/completeness";
import type { SiteDocT, SectionT } from "@/lib/schema";
import { ADDABLE_SECTIONS, sectionDefault, type AddableType } from "@/lib/section-defaults";

/**
 * 에디터 v1 (클라이언트) — 섹션 12종 편집·이야기. data-tour 앵커 규약 준수 (CLAUDE.md 규칙 3).
 * 저장(draft)과 사이트 반영(발행)은 분리 — 반영해야 손님에게 보인다.
 */

const MOODS = [
  { id: "clean", name: "깔끔한" }, { id: "warm", name: "따뜻한" },
  { id: "premium", name: "프리미엄" }, { id: "lively", name: "활기찬" },
] as const;

const STORY_TYPES = [
  { id: "work", name: "작업 기록" }, { id: "news", name: "소식" },
  { id: "milestone", name: "이정표" }, { id: "guest", name: "손님 이야기" },
] as const;

type GetRes = {
  slug: string; businessName: string; status: string;
  draft: SiteDocT; settings: Record<string, unknown>;
  score: number; rulesDone: string[]; storyCount: number; isAdmin: boolean;
  /** 소유 상태 — 서버가 판정한 값(규칙 4). anon* = 이 브라우저 anonId로만 접근 중 */
  ownership: "admin" | "account" | "anon" | "anon-signedin";
};

function anon(): string {
  try {
    const v = localStorage.getItem("onstori:anonId") ?? crypto.randomUUID();
    localStorage.setItem("onstori:anonId", v);
    return v;
  } catch { return ""; }
}

export function EditUi({ slug }: { slug: string }) {
  const router = useRouter();
  const [data, setData] = useState<GetRes | null>(null);
  const [doc, setDoc] = useState<SiteDocT | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<"content" | "story">("content");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/site/get", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anon() }) })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: GetRes) => { setData(d); setDoc(d.draft); })
      .catch(() => setDenied(true));
  }, [slug]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  function patchSection(idx: number, patch: Partial<SectionT>) {
    setDoc((d) => d && ({ ...d, sections: d.sections.map((s, i) => (i === idx ? ({ ...s, ...patch } as SectionT) : s)) }));
    setDirty(true);
  }

  async function save(): Promise<boolean> {
    if (!doc) return false;
    setBusy("save");
    const r = await fetch("/api/site/update", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, anonId: anon(), draft: doc, settings: { phone: phoneOf(doc), address: addressOf(doc) } }) });
    const d = await r.json();
    setBusy("");
    if (!r.ok) { flash(`저장 실패: ${d.detail ?? d.error}`); return false; }
    setData((p) => p && { ...p, score: d.score, rulesDone: d.rulesDone });
    setDirty(false);
    flash("저장했어요 (아직 손님에게는 안 보여요)");
    return true;
  }

  async function publish() {
    if (dirty && !(await save())) return;
    setBusy("publish");
    const r = await fetch("/api/site/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anon() }) });
    const d = await r.json();
    setBusy("");
    if (!r.ok) { flash(`반영 실패: ${d.error}`); return; }
    setData((p) => p && { ...p, score: d.score });
    flash("사이트에 반영됐어요! 손님에게 보입니다 🎉");
  }

  /** 로그인은 했는데 사이트가 아직 계정에 안 붙은 경우 — 로그인 왕복 없이 기존 claim으로 귀속.
   *  귀속 여부는 서버 재조회 값으로만 갱신한다(규칙 4). 편집 중인 draft는 건드리지 않는다. */
  async function claimSite() {
    setBusy("claim");
    const fail = () => flash("연결하지 못했어요. 잠시 후 다시 시도해주세요");
    try {
      const c = await fetch("/api/auth/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonId: anon() }) });
      // 401 = 세션 만료·다른 탭 로그아웃. 재시도로는 안 풀리므로 배너를 로그인 유도로 되돌린다(서버가 준 사실만 반영)
      if (c.status === 401) {
        setData((p) => p && { ...p, ownership: "anon" });
        flash("로그인이 풀렸어요. 다시 로그인해주세요");
        return;
      }
      if (!c.ok) { fail(); return; }
      const { claimed = [] } = (await c.json()) as { claimed?: string[] };
      const g = await fetch("/api/site/get", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anon() }) });
      if (!g.ok) { fail(); return; }
      const d: GetRes = await g.json();
      setData((p) => p && { ...p, ownership: d.ownership });
      // claim은 slug가 아니라 브라우저 anonId 단위라 여러 개가 함께 붙는다 — 문구를 실제 동작에 맞춘다
      if (d.ownership === "account") {
        flash(claimed.length > 1
          ? `이 브라우저에서 만든 홈페이지 ${claimed.length}개를 계정에 연결했어요`
          : "계정에 연결했어요. 다른 기기에서도 수정할 수 있어요");
      } else fail();
    } catch { fail(); } finally { setBusy(""); }
  }

  /** 로그인 페이지로 이동 — 저장 안 한 편집분이 있으면 먼저 저장한다(실패하면 이동하지 않는다).
   *  배너가 전체 페이지 이동이라 가드가 없으면 수정 중이던 draft가 그대로 사라진다. */
  async function goLogin() {
    if (dirty && !(await save())) return;
    router.push(`/login?next=${encodeURIComponent(`/${slug}/edit`)}`);
  }

  if (denied) return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-bold">수정 권한이 없어요</h1>
      <p className="mt-2 text-sm text-neutral-500">이 홈페이지 주인이라면 로그인 후 수정할 수 있어요.<br />운영자라면 <a className="text-teal-700 underline" href="/admin">운영자 인증</a> 후 다시 시도하세요.</p>
      <a href={`/login?next=${encodeURIComponent(`/${slug}/edit`)}`} className="mt-6 inline-block rounded-full bg-teal-700 px-6 py-3 text-sm font-semibold text-white">로그인하기</a>
    </main>
  );
  if (!data || !doc) return <main className="px-6 py-24 text-center text-neutral-400">불러오는 중…</main>;

  return (
    <main className="mx-auto max-w-xl px-5 pb-32 pt-8">
      {/* 상단: 점수 + 발행 */}
      <header className="sticky top-0 z-10 -mx-5 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div data-tour="score-bar" className="min-w-0">
            <p className="truncate text-sm font-bold">{data.businessName}</p>
            <p className="text-xs text-neutral-500">완성도 <b className="text-teal-700">{data.score}점</b> / 100</p>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!!busy} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
              {busy === "save" ? "저장 중…" : "저장"}
            </button>
            <button data-tour="btn-publish" onClick={publish} disabled={!!busy} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy === "publish" ? "반영 중…" : "사이트 반영"}
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${data.score}%` }} />
        </div>
      </header>

      {/* 로그인/계정 연결 유도 — 이 브라우저 anonId로만 접근 중일 때만. 조건은 서버 판정값 하나로만 본다(규칙 4).
          투어 앵커 목록(config/tours.ts·completeness.ts)에 없는 요소라 data-tour는 붙이지 않는다(규칙 3). */}
      {(data.ownership === "anon" || data.ownership === "anon-signedin") && (
        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-white p-3">
          <div className="min-w-0">
            <p className="text-xs font-bold">
              {data.ownership === "anon" ? "지금은 이 기기에서만 수정할 수 있어요" : "이 홈페이지가 아직 계정에 연결되지 않았어요"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              {data.ownership === "anon"
                ? "로그인하면 휴대폰·컴퓨터 어디서든 이어서 고칠 수 있어요."
                : "내 계정에 연결하면 다른 기기에서도 이어서 고칠 수 있어요."}
            </p>
          </div>
          {data.ownership === "anon" ? (
            <button onClick={goLogin} disabled={!!busy} className="shrink-0 rounded-full bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              {busy === "save" ? "저장 중…" : "로그인하기"}
            </button>
          ) : (
            <button onClick={claimSite} disabled={!!busy} className="shrink-0 rounded-full bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
              {busy === "claim" ? "연결 중…" : "내 계정에 연결하기"}
            </button>
          )}
        </section>
      )}

      {/* 점수 올리기 힌트 */}
      <section className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900">
        {RULES.filter((r) => !data.rulesDone.includes(r.id) && !["logo", "widget_1"].includes(r.id)).slice(0, 3).map((r) => (
          <p key={r.id}>＋{r.pts}점 · <b>{r.label}</b> — {r.hint}</p>
        ))}
        {data.score >= 75 && <p>잘하고 있어요! 이야기를 계속 쌓으면 홈페이지가 강해져요.</p>}
      </section>

      {/* 탭 */}
      <nav className="mt-5 flex gap-2">
        <button onClick={() => setTab("content")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "content" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>내용 수정</button>
        <button data-tour="story-new" onClick={() => setTab("story")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "story" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>
          이야기 쓰기 <span className="opacity-60">({data.storyCount})</span>
        </button>
        <a href={`/${slug}`} target="_blank" className="ml-auto self-center text-sm text-teal-700 underline underline-offset-4">내 사이트 보기 ↗</a>
      </nav>

      {tab === "content" ? (
        <ContentTab doc={doc} slug={slug} patchSection={patchSection} setDoc={(d) => { setDoc(d); setDirty(true); }} />
      ) : (
        <StoryTab slug={slug} onDone={(score) => { setData((p) => p && { ...p, score, storyCount: p.storyCount + 1 }); flash("이야기가 올라갔어요! 바로 홈페이지에 보여요"); }} />
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </main>
  );
}

/* ── 내용 수정 탭 ── */

function phoneOf(doc: SiteDocT): string {
  const q = doc.sections.find((s) => s.type === "quoteForm");
  return q && "phone" in q ? q.phone : "";
}
function addressOf(doc: SiteDocT): string | null {
  const m = doc.sections.find((s) => s.type === "map");
  return m && "address" in m ? m.address : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>{children}</label>;
}
const inp = "w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-teal-600";

function ContentTab({ doc, slug, patchSection, setDoc }: {
  doc: SiteDocT; slug: string;
  patchSection: (i: number, p: Partial<SectionT>) => void;
  setDoc: (d: SiteDocT) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    const fd = new FormData();
    fd.set("slug", slug); fd.set("anonId", anon()); fd.set("file", file);
    const r = await fetch("/api/site/upload", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (!r.ok) { alert(d.error ?? "업로드 실패"); return null; }
    return d.url as string;
  }

  async function uploadHero(idx: number, file: File) {
    const url = await upload(file);
    if (url) patchSection(idx, { image: url } as Partial<SectionT>);
  }

  function moveSection(i: number, d: -1 | 1) {
    const a = [...doc.sections];
    const [x] = a.splice(i, 1);
    a.splice(i + d, 0, x);
    setDoc({ ...doc, sections: a });
  }

  function addSection(type: AddableType, photoUrl?: string) {
    setDoc({ ...doc, sections: [...doc.sections, sectionDefault(type, photoUrl)] });
  }

  const missing = ADDABLE_SECTIONS.filter((m) => !doc.sections.some((s) => s.type === m.type));

  return (
    <div data-tour="panel-sections" className="mt-5 space-y-6">
      {/* 분위기 */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="text-sm font-bold">분위기</h2>
        <div className="mt-2 flex gap-2">
          {MOODS.map((m) => (
            <button key={m.id} onClick={() => setDoc({ ...doc, theme: { ...doc.theme, palette: m.id } })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${doc.theme.palette === m.id ? "bg-teal-700 text-white" : "border border-neutral-300"}`}>
              {m.name}
            </button>
          ))}
        </div>
      </section>

      {doc.sections.map((s, i) => {
        const card = (() => {
        switch (s.type) {
          case "hero": return (
            <section data-tour="sec-hero" className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">첫 화면</h2>
              <Field label="작은 소개 (한 줄)"><input className={inp} value={s.eyebrow ?? ""} maxLength={40} onChange={(e) => patchSection(i, { eyebrow: e.target.value })} /></Field>
              <Field label="큰 제목"><textarea className={inp} rows={2} value={s.headline} maxLength={60} onChange={(e) => patchSection(i, { headline: e.target.value })} /></Field>
              <Field label="설명 문장"><textarea className={inp} rows={2} value={s.sub ?? ""} maxLength={160} onChange={(e) => patchSection(i, { sub: e.target.value })} /></Field>
              <div data-tour="panel-photos">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">첫 화면 사진 {s.image ? "" : "(없음)"}</span>
                {s.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}
                <label className="inline-block cursor-pointer rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold">
                  {uploading ? "올리는 중…" : "내 사진으로 교체 (+15점 항목)"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadHero(i, e.target.files[0])} />
                </label>
              </div>
            </section>
          );
          case "about": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">소개</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              <Field label="내용"><textarea className={inp} rows={5} value={s.body} maxLength={600} onChange={(e) => patchSection(i, { body: e.target.value })} /></Field>
            </section>
          );
          case "processSteps": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">진행 과정</h2>
              {s.steps.map((st, j) => (
                <div key={j} className="flex gap-2">
                  <input className={`${inp} w-28 flex-shrink-0`} value={st.name} maxLength={20}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, name: e.target.value } : x) })} />
                  <input className={inp} value={st.desc ?? ""} maxLength={80}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, desc: e.target.value } : x) })} />
                </div>
              ))}
            </section>
          );
          case "quoteForm": return (
            <section data-tour="sec-form" className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">문의 받기</h2>
              <Field label="안내 문장"><input className={inp} value={s.sub ?? ""} maxLength={120} onChange={(e) => patchSection(i, { sub: e.target.value })} /></Field>
              <div data-tour="set-contact">
                <Field label="전화번호 (문의 버튼 연결)"><input className={inp} value={s.phone} maxLength={20} onChange={(e) => patchSection(i, { phone: e.target.value })} /></Field>
              </div>
            </section>
          );
          case "map": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">오시는 길</h2>
              <Field label="주소"><input className={inp} value={s.address} maxLength={120} onChange={(e) => patchSection(i, { address: e.target.value })} /></Field>
              <Field label="안내 (선택)"><input className={inp} value={s.note ?? ""} maxLength={120} onChange={(e) => patchSection(i, { note: e.target.value })} /></Field>
            </section>
          );
          case "hoursCard": return (
            <section data-tour="set-hours" className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">영업시간</h2>
              <Field label="영업시간 (줄바꿈 가능)"><textarea className={inp} rows={3} value={s.hours} maxLength={200} onChange={(e) => patchSection(i, { hours: e.target.value })} /></Field>
            </section>
          );
          case "storyFeed": return (
            <section className="rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">이야기 코너</h2>
              <Field label="코너 제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
            </section>
          );
          case "gallery": {
            const mv = (j: number, d: number) => {
              const a = [...s.photos]; const [x] = a.splice(j, 1); a.splice(j + d, 0, x);
              patchSection(i, { photos: a });
            };
            return (
              <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
                <h2 className="text-sm font-bold">사진 갤러리</h2>
                <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-2">
                  {s.photos.map((p, j) => (
                    <div key={`${p}-${j}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="h-24 w-28 rounded-lg object-cover" />
                      <div className="mt-1 flex justify-center gap-1 text-xs">
                        <button disabled={j === 0} onClick={() => mv(j, -1)} className="rounded border border-neutral-200 px-1.5 disabled:opacity-30" aria-label="앞으로">←</button>
                        <button disabled={j === s.photos.length - 1} onClick={() => mv(j, 1)} className="rounded border border-neutral-200 px-1.5 disabled:opacity-30" aria-label="뒤로">→</button>
                        <button disabled={s.photos.length <= 1} onClick={() => patchSection(i, { photos: s.photos.filter((_, k) => k !== j) })}
                          className="rounded border border-neutral-200 px-1.5 text-red-500 disabled:opacity-30" aria-label="삭제">✕</button>
                      </div>
                    </div>
                  ))}
                  {s.photos.length < 30 && (
                    <label className="flex h-24 w-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-2xl text-neutral-300">
                      {uploading ? "…" : "＋"}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { photos: [...s.photos, url] }); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-neutral-400">사진은 최소 1장 필요해요. 최대 30장.</p>
              </section>
            );
          }
          case "reviews": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">고객 이야기</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-neutral-50 p-3">
                  <div className="flex gap-2">
                    <input className={inp} value={it.title} maxLength={60} placeholder="한 줄 요약 (예: 꼼꼼한 시공 감사해요)"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, title: e.target.value } : x) })} />
                    <button disabled={s.items.length <= 1} onClick={() => patchSection(i, { items: s.items.filter((_, k) => k !== j) })}
                      className="flex-shrink-0 rounded-full border border-neutral-200 px-2.5 text-xs text-red-500 disabled:opacity-30" aria-label="후기 삭제">✕</button>
                  </div>
                  <textarea className={inp} rows={2} value={it.body} maxLength={300} placeholder="손님이 남긴 말"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, body: e.target.value } : x) })} />
                  <input className={inp} value={it.source ?? ""} maxLength={30} placeholder="출처 (선택, 예: 네이버 영수증 리뷰)"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, source: e.target.value } : x) })} />
                </div>
              ))}
              {s.items.length < 20 && (
                <button onClick={() => patchSection(i, { items: [...s.items, { title: "", body: "" }] })}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold">＋ 후기 추가</button>
              )}
            </section>
          );
          case "banner": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">띠 배너</h2>
              <Field label="문구"><input className={inp} value={s.text} maxLength={80} onChange={(e) => patchSection(i, { text: e.target.value })} /></Field>
              <Field label="연결 주소 (선택)"><input className={inp} value={s.link ?? ""} placeholder="https://…" inputMode="url"
                onChange={(e) => patchSection(i, { link: e.target.value.trim() || undefined })} /></Field>
            </section>
          );
          case "portfolioGallery": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">시공 사례</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-neutral-50 p-3">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image} alt="" className="h-20 w-24 flex-shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <input className={inp} value={it.title} maxLength={60} placeholder="사례 이름 (예: 강동구 34평 전체 조명)"
                        onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, title: e.target.value } : x) })} />
                      <div className="flex gap-2">
                        <input className={inp} value={it.date ?? ""} maxLength={20} placeholder="날짜 (선택)"
                          onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, date: e.target.value } : x) })} />
                        <input className={inp} value={it.tag ?? ""} maxLength={20} placeholder="태그 (선택)"
                          onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, tag: e.target.value } : x) })} />
                      </div>
                    </div>
                    <button disabled={s.items.length <= 1} onClick={() => patchSection(i, { items: s.items.filter((_, k) => k !== j) })}
                      className="flex-shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-red-500 disabled:opacity-30" aria-label="사례 삭제">✕</button>
                  </div>
                  <label className="inline-block cursor-pointer rounded-full border border-neutral-300 px-3.5 py-1 text-xs font-semibold">
                    {uploading ? "올리는 중…" : "사진 교체"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, image: url } : x) }); e.target.value = ""; }} />
                  </label>
                </div>
              ))}
              {s.items.length < 30 && (
                <label className="inline-block cursor-pointer rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold">
                  {uploading ? "올리는 중…" : "＋ 사례 추가 (사진 선택)"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { items: [...s.items, { title: "", image: url }] }); e.target.value = ""; }} />
                </label>
              )}
            </section>
          );
          case "menuPrice": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">메뉴판</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-neutral-50 p-3">
                  <div className="flex gap-2">
                    <input className={inp} value={it.name} maxLength={40} placeholder="메뉴 이름"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, name: e.target.value } : x) })} />
                    <input className={`${inp} w-28 flex-shrink-0`} value={it.price} maxLength={20} placeholder="가격"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, price: e.target.value } : x) })} />
                    <button disabled={s.items.length <= 1} onClick={() => patchSection(i, { items: s.items.filter((_, k) => k !== j) })}
                      className="flex-shrink-0 rounded-full border border-neutral-200 px-2.5 text-xs text-red-500 disabled:opacity-30" aria-label="메뉴 삭제">✕</button>
                  </div>
                  <input className={inp} value={it.desc ?? ""} maxLength={80} placeholder="설명 (선택)"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, desc: e.target.value } : x) })} />
                </div>
              ))}
              {s.items.length < 40 && (
                <button onClick={() => patchSection(i, { items: [...s.items, { name: "", price: "" }] })}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold">＋ 메뉴 추가</button>
              )}
            </section>
          );
          default: return (
            // 모르는 타입도 숨기지 않는다 — 숨기면 저장 실패(zod 검증)의 원인을 화면에서 찾을 수 없음
            <section className="rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">알 수 없는 섹션</h2>
              <p className="mt-1 text-xs text-neutral-400">
                이 에디터가 지원하지 않는 섹션이에요 (타입: {(s as { type?: string }).type ?? "없음"}). 저장이 실패하면 이 섹션이 원인일 수 있어요.
              </p>
            </section>
          );
        }
        })();
        return (
          <div key={i} className="relative">
            {s.type !== "hero" && (
              <div className="absolute right-3 top-3 flex gap-1">
                <button disabled={i === 0 || doc.sections[i - 1].type === "hero"} onClick={() => moveSection(i, -1)}
                  className="h-6 w-6 rounded border border-neutral-200 bg-white text-xs text-neutral-500 disabled:opacity-30" aria-label="위로 이동">↑</button>
                <button disabled={i === doc.sections.length - 1} onClick={() => moveSection(i, 1)}
                  className="h-6 w-6 rounded border border-neutral-200 bg-white text-xs text-neutral-500 disabled:opacity-30" aria-label="아래로 이동">↓</button>
              </div>
            )}
            {card}
          </div>
        );
      })}

      {/* 섹션 추가 — 없는 타입만. gallery·portfolioGallery는 zod min(1) 제약 때문에 첫 사진과 함께 삽입 */}
      <section className="rounded-2xl border-2 border-dashed border-neutral-300 p-4">
        <h2 className="text-sm font-bold">섹션 추가</h2>
        {missing.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-400">추가할 수 있는 섹션이 모두 들어가 있어요.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-400">맨 아래에 추가돼요 — ↑ 버튼으로 원하는 위치로 옮기세요. 사진 갤러리·시공 사례는 첫 사진을 고르면 추가돼요.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missing.map((m) => m.needsPhoto ? (
                <label key={m.type} className="cursor-pointer rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold">
                  {uploading ? "올리는 중…" : `＋ ${m.name}`}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) addSection(m.type, url); e.target.value = ""; }} />
                </label>
              ) : (
                <button key={m.type} onClick={() => addSection(m.type)}
                  className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold">＋ {m.name}</button>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="text-center text-xs text-neutral-400">섹션 삭제는 곧 열려요.</p>
    </div>
  );
}

/* ── 이야기 쓰기 탭 ── */

function StoryTab({ slug, onDone }: { slug: string; onDone: (score: number) => void }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [type, setType] = useState<(typeof STORY_TYPES)[number]["id"]>("work");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(today);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function addPhoto(file: File) {
    if (photos.length >= 4) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("slug", slug); fd.set("anonId", anon()); fd.set("file", file);
    const r = await fetch("/api/site/upload", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (r.ok) setPhotos((p) => [...p, d.url]);
    else alert(d.error ?? "업로드 실패");
  }

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/site/story", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, anonId: anon(), entryType: type, title, body, entryDate: date, photos }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { alert(d.error ?? "실패했어요"); return; }
    setTitle(""); setBody(""); setPhotos([]); setDate(today);
    onDone(d.score);
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
        오늘 현장 사진 한 장과 두 줄이면 충분해요. 쓴 이야기는 <b>바로 홈페이지에 쌓입니다</b> — 기록이 많아질수록 견적 문의가 늘어요.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {STORY_TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${type === t.id ? "bg-teal-700 text-white" : "border border-neutral-300"}`}>{t.name}</button>
        ))}
      </div>
      <Field label="제목"><input className={inp} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="예: 강동구 34평 입주청소" /></Field>
      <Field label="내용"><textarea className={inp} rows={4} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="두세 문장이면 충분해요" /></Field>
      <Field label="날짜"><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div>
        <span className="mb-1 block text-xs font-semibold text-neutral-500">사진 ({photos.length}/4)</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => /* eslint-disable-next-line @next/next/no-img-element */ (
            <img key={p} src={p} alt="" className="h-20 w-24 rounded-lg object-cover" />
          ))}
          {photos.length < 4 && (
            <label className="flex h-20 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-2xl text-neutral-300">
              ＋<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
      <button onClick={submit} disabled={busy || !title}
        className="w-full rounded-full bg-teal-700 py-3.5 font-semibold text-white disabled:opacity-40">
        {busy ? "올리는 중…" : "이야기 올리기 (+15점)"}
      </button>
    </div>
  );
}
