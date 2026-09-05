"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RULES } from "@/config/completeness";
import type { SiteDocT, SectionT } from "@/lib/schema";
import { ADDABLE_SECTIONS, sectionDefault, type AddableType } from "@/lib/section-defaults";
import { InboxTab, type InboxRes, type NotifyChannels } from "./inbox-tab";
import { PreviewPane } from "./preview-pane";
import { PayModal, TrialBar } from "@/components/site/pay-modal";
import type { TrialInfo } from "@/lib/trial";
import { StoryLinkButton } from "./story-link";

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
  /** 14일 무료 판정 (2026-09-05 정회원 정책) */
  trial?: TrialInfo;
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
  /** 거부 상태 — 서버가 준 error·signedIn으로 문구와 CTA를 가른다.
   *  notFound(404)에 로그인 CTA를 주면 /login이 세션을 발견해 되돌려보내 같은 화면으로 돈다. */
  const [denied, setDenied] = useState<{ signedIn: boolean; notFound: boolean } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  /** 알림 문자·메일의 링크가 `?tab=inbox` 다. useSearchParams 는 Suspense 경계를 요구해
   *  빌드가 걸리므로 초기값에서 직접 읽는다. 첫 렌더는 data=null 이라 탭이 트리에 없다. */
  const [tab, setTab] = useState<"content" | "story" | "inbox">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "inbox" ? "inbox" : "content");
  /** 문의함 초기 데이터 — 배지 숫자와 알림 채널 상태는 탭을 열기 전에 알아야 한다 */
  const [inbox, setInbox] = useState<InboxRes | null>(null);
  /** 조회가 끝났는지. InboxTab 은 initial 을 마운트 때 한 번만 읽으므로,
   *  ?tab=inbox 로 바로 들어오면 아직 null 인 상태로 마운트돼 실패 화면이 굳는다. */
  const [inboxDone, setInboxDone] = useState(false);
  const [newCount, setNewCount] = useState(0);
  /** 알림 수신처 — draft 가 아니라 sites.settings 라서 doc 이 아니라 여기가 들고 있는다 */
  const [notify, setNotify] = useState({ phone: "", email: "" });

  /** 미리보기 — 편집 중인 섹션(스크롤 위치), 자동저장 상태, PC/폰 판정, 폰 시트 열림 여부.
   *  editor-preview-2026-09-05.md 4장. */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  /** 이 값이 실제로 쓰이는 지점(아래 aside)은 data 로딩이 끝난 뒤에만 그려지므로,
   *  SSR(window 없음)과 첫 클라이언트 렌더 사이에 값이 갈려도 하이드레이션 비교에 걸리지 않는다.
   *  false 인 동안은 미리보기 iframe 을 아예 마운트하지 않는다 — 폰에서 불필요한 로드를 막는다. */
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * "＋N점" 클릭 → 해당 data-tour 앵커로 스크롤·강조 (P3 이월, 투어의 최소 동작형).
   * 앵커가 지금 탭에 없으면 내용 탭으로 바꾼 뒤 다시 찾는다.
   */
  function goToAnchor(anchor: string) {
    const focus = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
      if (!el) return false;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      const ring = ["ring-2", "ring-teal-500", "ring-offset-2", "rounded-xl"];
      el.classList.add(...ring);
      window.setTimeout(() => el.classList.remove(...ring), 1800);
      return true;
    };
    if (focus()) return;
    setTab("content");
    // 탭 전환 렌더 후 재시도. 그래도 없으면 이 사이트에 그 자리가 없는 것이다
    // (예: 영업시간은 VISIT 템플릿에만 있다). 조용히 끝내면 버튼이 고장난 것처럼 보인다.
    window.setTimeout(() => {
      if (!focus()) flash("이 홈페이지에는 아직 그 항목이 없어요 — 아래 '섹션 추가'에서 넣을 수 있어요");
    }, 60);
  }
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/site/get", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anon() }) })
      .then(async (r) => {
        if (r.ok) return { ok: true as const, d: (await r.json()) as GetRes };
        const body = (await r.json().catch(() => ({}))) as { signedIn?: boolean; error?: string };
        return { ok: false as const, signedIn: !!body.signedIn, notFound: body.error !== "forbidden" };
      })
      .then((res) => {
        if (res.ok) {
          setData(res.d); setDoc(res.d.draft);
          const n = (res.d.settings as { notify?: { phone?: string; email?: string } } | null)?.notify;
          setNotify({ phone: n?.phone ?? "", email: n?.email ?? "" });
        }
        else setDenied({ signedIn: res.signedIn, notFound: res.notFound });
      })
      // 네트워크·서버 오류는 권한 문제가 아니므로 로그인으로 유도하지 않는다
      .catch(() => setDenied({ signedIn: false, notFound: true }));
  }, [slug]);

  /** 문의함 — 배지와 알림 채널 상태 때문에 탭을 열기 전에 한 번 받아둔다.
   *  실패해도 에디터 본체는 그대로 뜬다(문의함 탭 안에서 다시 시도한다). */
  useEffect(() => {
    fetch("/api/inquiry/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, anonId: anon() }) })
      .then((r) => (r.ok ? (r.json() as Promise<InboxRes>) : null))
      .then((d) => { if (d) { setInbox(d); setNewCount(d.newCount); } })
      .catch(() => {})
      .finally(() => setInboxDone(true));
  }, [slug]);

  // PC/폰 경계를 넘나드는 리사이즈만 구독한다 — 초기값은 이미 useState 에서 계산했다.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 폰 시트가 열려 있는 동안 뒤 페이지가 같이 스크롤되지 않게
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  function patchSection(idx: number, patch: Partial<SectionT>) {
    setDoc((d) => d && ({ ...d, sections: d.sections.map((s, i) => (i === idx ? ({ ...s, ...patch } as SectionT) : s)) }));
    setDirty(true);
    setFocusIndex(idx);
  }

  /** 실제 저장 POST. silent=true 면 토스트 없이 autoStatus 만 갱신한다(자동저장 전용). */
  async function doSave(opts: { silent?: boolean } = {}): Promise<boolean> {
    if (!doc) return false;
    setBusy("save");
    if (opts.silent) setAutoStatus("saving");
    const r = await fetch("/api/site/update", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, anonId: anon(), draft: doc,
        settings: { phone: phoneOf(doc), address: addressOf(doc), notify: { phone: notify.phone.trim(), email: notify.email.trim() } } }) });
    const d = await r.json();
    setBusy("");
    if (!r.ok) {
      if (opts.silent) setAutoStatus("error"); else flash(`저장 실패: ${d.detail ?? d.error}`);
      return false;
    }
    setData((p) => p && { ...p, score: d.score, rulesDone: d.rulesDone });
    setDirty(false);
    if (opts.silent) setAutoStatus("saved"); else flash("저장했어요 (아직 손님에게는 안 보여요)");
    return true;
  }

  async function save(): Promise<boolean> {
    return doSave();
  }

  /** 자동저장 — 실패하면 3초 뒤 1회만 재시도. 그래도 실패하면 화면에 [지금 저장] 버튼을 남긴다. */
  async function autoSave() {
    const ok = await doSave({ silent: true });
    if (!ok) setTimeout(() => { void doSave({ silent: true }); }, 3000);
  }

  // doc·notify 가 바뀌고 dirty 이면 2초 뒤 조용히 저장. busy 중이면 이번 렌더는 타이머를 걸지 않는다
  // (busy 가 풀리면 이 effect 가 다시 돌아 새 타이머를 건다 — 중복 저장 방지).
  // 첫 로딩 직후엔 dirty 가 false 라 저절로 건너뛴다(patchSection 류를 거쳐야만 dirty 가 켜진다).
  useEffect(() => {
    if (!dirty || busy) return;
    const t = setTimeout(() => { void autoSave(); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, notify, dirty, busy]);

  // 창을 벗어날 때(다른 탭으로 전환·최소화)도 붙잡는다
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden" && dirty && !busy) void autoSave();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy, doc, notify]);

  /** 탭을 옮기기 전에 편집 중이던 내용을 붙잡는다(자동저장 타이머를 기다리지 않는다) */
  function switchTab(next: "content" | "story" | "inbox") {
    if (dirty && !busy) void autoSave();
    setTab(next);
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

  // 로그인한 사람에게 "로그인하세요"라고 하면 /login이 세션을 발견해 곧장 되돌려보내 같은 화면으로 돈다.
  // 이 계정에 안 붙은 사이트라는 사실을 알려주고 연결 경로(처음 만든 기기 / 내 홈페이지)로 보낸다.
  if (denied) return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-bold">{denied.notFound ? "홈페이지를 찾지 못했어요" : "수정 권한이 없어요"}</h1>
      {denied.notFound ? (
        <>
          {/* 주소가 없거나 서버가 응답하지 못한 경우 — 권한 문제가 아니므로 로그인 안내를 하지 않는다 */}
          <p className="mt-2 text-sm text-neutral-500">주소를 다시 확인해주세요. 잠시 후에도 같으면 다시 시도해주세요.</p>
          <Link href="/my" className="mt-6 inline-block rounded-full bg-teal-700 px-6 py-3 text-sm font-semibold text-white">내 홈페이지 보기</Link>
        </>
      ) : denied.signedIn ? (
        <>
          {/* 미claim 사이트일 수도, 다른 계정이 이미 가진 사이트일 수도 있다.
              후자에선 [내 계정에 연결하기] 버튼이 아예 렌더되지 않으므로 계정 전환 경로도 함께 알려준다. */}
          <p className="mt-2 text-sm text-neutral-500">
            이 홈페이지는 지금 로그인한 계정에 연결돼 있지 않아요.<br />
            처음 만든 기기에서 이 화면을 열어 <b>[내 계정에 연결하기]</b>를 누르거나,<br />
            다른 계정으로 로그인했다면 <b>[내 홈페이지 보기]</b>에서 로그아웃한 뒤 처음 쓰던 방법으로 다시 로그인해주세요.
          </p>
          <Link href="/my" className="mt-6 inline-block rounded-full bg-teal-700 px-6 py-3 text-sm font-semibold text-white">내 홈페이지 보기</Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-500">이 홈페이지 주인이라면 로그인 후 수정할 수 있어요.</p>
          <a href={`/login?next=${encodeURIComponent(`/${slug}/edit`)}`} className="mt-6 inline-block rounded-full bg-teal-700 px-6 py-3 text-sm font-semibold text-white">로그인하기</a>
        </>
      )}
      <p className="mt-4 text-xs text-neutral-500">운영자라면 <a className="text-teal-700 underline" href="/admin">운영자 인증</a> 후 다시 시도하세요.</p>
    </main>
  );
  if (!data || !doc) return <main className="px-6 py-24 text-center text-neutral-400">불러오는 중…</main>;

  // 14일 만료 — 운영자가 아니면 차단 화면 + 결제 모달 (기획1 /mainplan #membership)
  if (data.trial?.expired && !data.isAdmin) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[11.5px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>{data.businessName}</p>
        <h1 className="font-display mt-3 text-[26px]" style={{ color: "var(--forest)" }}>14일 무료 기간이 끝났어요</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">
          홈페이지는 지금 비공개 상태입니다. 정회원(49,000원)으로 전환하시면 바로 다시 공개되고, 이야기·영상·발행 기능이 모두 열립니다. 전환하지 않으시면 30일 뒤 삭제됩니다.
        </p>
        <button type="button" onClick={() => setPayOpen(true)} className="btn-lime mt-8 w-full !py-4 !text-[16px]">정회원 이용하기 — 49,000원</button>
        <Link href="/my" className="mt-4 text-[13px] underline text-neutral-500">마이페이지</Link>
        {payOpen && <PayModal slug={slug} trial={data.trial} onClose={() => setPayOpen(false)} />}
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-32 pt-8 lg:flex lg:max-w-6xl lg:items-start lg:gap-8 lg:px-8 lg:pb-8">
    <main className="min-w-0 lg:max-w-xl lg:flex-1">
      {/* 상단: 점수 + 발행 */}
      <header className="sticky top-0 z-10 -mx-5 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div data-tour="score-bar" className="min-w-0">
            <p className="truncate text-sm font-bold">{data.businessName}</p>
            <p className="text-xs text-neutral-500">완성도 <b className="text-teal-700">{data.score}점</b> / 100</p>
            <AutoSaveStatus status={autoStatus} onRetry={() => void autoSave()} />
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

      {/* 무료 기간 바 + 정회원 모달 (2026-09-05) */}
      {data.trial && !data.isAdmin && <TrialBar trial={data.trial} onPay={() => setPayOpen(true)} />}
      {payOpen && <PayModal slug={slug} trial={data.trial} onClose={() => setPayOpen(false)} />}

      {/* 60초 녹화 링크 — 문자로 받기 / 지금 열기 (이야기 엔진 1차, 기획1 #rec) */}
      <StoryLinkButton slug={slug} phone={String(data.settings?.phone ?? "")} />

      {/* 점수 올리기 힌트 */}
      <section className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900">
        {RULES.filter((r) => !data.rulesDone.includes(r.id) && !["logo", "widget_1"].includes(r.id)).slice(0, 3).map((r) => (
          <button key={r.id} type="button" onClick={() => goToAnchor(r.anchor)}
            className="block w-full rounded text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            ＋{r.pts}점 · <b>{r.label}</b> — {r.hint}
          </button>
        ))}
        {data.score >= 75 && <p>잘하고 있어요! 이야기를 계속 쌓으면 홈페이지가 강해져요.</p>}
      </section>

      {/* 탭 */}
      <nav className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => switchTab("content")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "content" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>내용 수정</button>
        <button data-tour="story-new" onClick={() => switchTab("story")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "story" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>
          이야기 쓰기 <span className="opacity-60">({data.storyCount})</span>
        </button>
        <button data-tour="panel-inbox" onClick={() => switchTab("inbox")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "inbox" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>
          문의함
          {newCount > 0 && (
            <span className="ml-1.5 inline-block min-w-[1.25rem] rounded-full bg-teal-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{newCount}</span>
          )}
        </button>
        <a href={`/${slug}`} target="_blank" className="ml-auto self-center text-sm text-teal-700 underline underline-offset-4">내 사이트 보기 ↗</a>
      </nav>

      {tab === "content" ? (
        <ContentTab doc={doc} slug={slug} patchSection={patchSection} setDoc={(d) => { setDoc(d); setDirty(true); }}
          notify={notify} setNotify={(n) => { setNotify(n); setDirty(true); }} channels={inbox?.channels ?? null} />
      ) : tab === "story" ? (
        <StoryTab slug={slug} onDone={(score) => { setData((p) => p && { ...p, score, storyCount: p.storyCount + 1 }); flash("이야기가 올라갔어요! 바로 홈페이지에 보여요"); }} />
      ) : inboxDone ? (
        <InboxTab slug={slug} anonId={anon()} initial={inbox} onNewCount={setNewCount} />
      ) : (
        <p className="mt-8 text-center text-sm text-neutral-400">문의를 불러오는 중…</p>
      )}
    </main>

    {/* PC 미리보기 — 폰 프레임. 투어 앵커는 여기 한 곳에만 붙인다(아래 폰 버튼은 같은 자리를 가리키는 중복이라 안 붙인다) */}
    <aside data-tour="panel-preview" className="hidden lg:sticky lg:top-4 lg:block lg:w-[390px] lg:flex-shrink-0">
      <div className="overflow-hidden rounded-[2rem] border border-neutral-300 bg-white shadow-sm" style={{ height: "calc(100vh - 8rem)" }}>
        {isDesktop && <PreviewPane slug={slug} doc={doc} focusIndex={focusIndex} />}
      </div>
    </aside>

    {/* 폰 하단 고정 바 — 미리보기는 무거우니 기본으로 열지 않는다 */}
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white p-3 lg:hidden">
      <button onClick={() => setSheetOpen(true)} className="mx-auto block w-full max-w-xl rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white">
        미리보기
      </button>
    </div>

    {/* 폰 전체화면 시트 */}
    {sheetOpen && (
      <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-bold">미리보기</p>
          <button onClick={() => setSheetOpen(false)} className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold">닫기</button>
        </div>
        <div className="min-h-0 flex-1">
          <PreviewPane slug={slug} doc={doc} focusIndex={focusIndex} />
        </div>
      </div>
    )}

    {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function AutoSaveStatus({ status, onRetry }: { status: "idle" | "saving" | "saved" | "error"; onRetry: () => void }) {
  if (status === "idle") return null;
  if (status === "saving") return <p className="text-[11px] text-neutral-400">저장 중…</p>;
  if (status === "saved") return <p className="text-[11px] text-neutral-400">저장됨 · 사장님만 보여요</p>;
  return (
    <p className="text-[11px] text-red-500">
      저장 실패 — 다시 시도
      <button onClick={onRetry} className="ml-1.5 rounded-full border border-red-300 px-2 py-0.5 text-[10px] font-semibold text-red-600">지금 저장</button>
    </p>
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

/**
 * 문의 알림 수신처 — docs/specs/inquiry.md 5장. quoteForm 카드 안에 붙는다.
 *
 * 값은 draft 가 아니라 `sites.settings.notify` 라서 저장 버튼(save)이 함께 보낸다.
 * 채널 키(솔라피·Resend)는 서버 env 라 여기서는 켜짐/꺼짐만 안다 — 꺼져 있으면
 * 사장님이 "설정을 잘못했나" 헤매지 않도록 준비 중이라고 밝힌다.
 */
function NotifyBox({ notify, setNotify, channels }: {
  notify: { phone: string; email: string };
  setNotify: (n: { phone: string; email: string }) => void;
  channels: NotifyChannels | null;
}) {
  const pending = !channels || (channels.sms && channels.email)
    ? null
    : !channels.sms && !channels.email
      ? "지금은 알림 발송이 준비 중이에요. 문의는 빠짐없이 문의함에 쌓이니 여기서 확인해 주세요."
      : !channels.sms
        ? "문자 알림은 준비 중이에요. 지금은 이메일로 알려드려요."
        : "이메일 알림은 준비 중이에요. 지금은 문자로 알려드려요.";

  return (
    <div className="space-y-3 rounded-xl bg-neutral-50 p-3.5">
      <p className="text-xs font-bold">문의 알림 받기</p>
      <Field label="문자 받을 번호">
        <input className={inp} value={notify.phone} maxLength={20} inputMode="tel"
          onChange={(e) => setNotify({ ...notify, phone: e.target.value })} />
      </Field>
      <Field label="이메일">
        <input className={inp} type="email" value={notify.email} maxLength={120}
          onChange={(e) => setNotify({ ...notify, email: e.target.value })} />
      </Field>
      <p className="text-[11px] leading-relaxed text-neutral-500">비워두면 위 전화번호와 로그인 이메일로 알려드려요.</p>
      {pending && <p className="text-[11px] leading-relaxed text-amber-700">{pending}</p>}
    </div>
  );
}

function ContentTab({ doc, slug, patchSection, setDoc, notify, setNotify, channels }: {
  doc: SiteDocT; slug: string;
  patchSection: (i: number, p: Partial<SectionT>) => void;
  setDoc: (d: SiteDocT) => void;
  notify: { phone: string; email: string };
  setNotify: (n: { phone: string; email: string }) => void;
  /** null = 아직 못 받았거나 조회 실패 — 채널 상태를 단정하지 않는다 */
  channels: NotifyChannels | null;
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

  /** image 필드를 가진 섹션(hero·about) 공용 — 해당 인덱스의 image를 교체한다 */
  async function uploadSectionImage(idx: number, file: File) {
    const url = await upload(file);
    if (url) patchSection(idx, { image: url } as Partial<SectionT>);
  }

  /**
   * 섹션 삭제(P3 이월). hero 는 애초에 액션 버튼이 없고, quoteForm 은 문의 경로이자
   * 완성도 규칙 cta_form 의 대상이라 지우면 전환 경로와 점수가 함께 사라진다 — 둘 다 막는다.
   */
  function deleteSection(i: number) {
    const t = doc.sections[i]?.type;
    if (t === "hero" || t === "quoteForm") return;
    if (!confirm("이 섹션을 지울까요? 되돌리려면 다시 추가해야 해요.")) return;
    setDoc({ ...doc, sections: doc.sections.filter((_, k) => k !== i) });
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
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSectionImage(i, e.target.files[0])} />
                </label>
              </div>
            </section>
          );
          case "about": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">소개</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              <Field label="내용"><textarea className={inp} rows={5} value={s.body} maxLength={600} onChange={(e) => patchSection(i, { body: e.target.value })} /></Field>
              <div>
                <span className="mb-1 block text-xs font-semibold text-neutral-500">소개 사진 {s.image ? "" : "(없음)"}</span>
                {s.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.image} alt="" className="mb-2 aspect-[3/2] w-40 rounded-lg object-cover" />
                )}
                <label className="inline-block cursor-pointer rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold">
                  {uploading ? "올리는 중…" : s.image ? "사진 교체" : "사진 추가"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSectionImage(i, e.target.files[0])} />
                </label>
              </div>
            </section>
          );
          case "processSteps": return (
            <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-sm font-bold">진행 과정</h2>
              {s.steps.map((st, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input className={`${inp} w-28 flex-shrink-0`} value={st.name} maxLength={20}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, name: e.target.value } : x) })} />
                  <input className={inp} value={st.desc ?? ""} maxLength={80}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, desc: e.target.value } : x) })} />
                  <label className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-neutral-300 text-xs"
                         title={st.image ? "사진 교체" : "사진 추가"}>
                    {st.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={st.image} alt="" className="h-full w-full object-cover" />
                    ) : (uploading ? "…" : "＋")}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, image: url } : x) }); e.target.value = ""; }} />
                  </label>
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
              <NotifyBox notify={notify} setNotify={setNotify} channels={channels} />
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
                {s.type !== "quoteForm" && (
                  <button onClick={() => deleteSection(i)}
                    className="h-6 w-6 rounded border border-neutral-200 bg-white text-xs text-neutral-400 hover:border-red-300 hover:text-red-600" aria-label="섹션 삭제">✕</button>
                )}
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
