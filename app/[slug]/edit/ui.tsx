"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RULES } from "@/config/completeness";
import type { SiteDocT, SectionT } from "@/lib/schema";
import { ADDABLE_SECTIONS, sectionDefault, type AddableType } from "@/lib/section-defaults";
import { InboxTab, type InboxRes, type NotifyChannels } from "./inbox-tab";
import { PreviewPane } from "./preview-pane";
import dynamic from "next/dynamic";
import { TrialBar } from "@/components/site/pay-modal";

/* 결제 모달은 사장님이 [정회원 이용하기]를 눌러야 열린다 —
   에디터 첫 화면 번들에 넣을 이유가 없다 (docs/PERFORMANCE.md §2). */
const PayModal = dynamic(() => import("@/components/site/pay-modal").then((m) => m.PayModal), { ssr: false });
import { MEMBERSHIP_PRICE, type TrialInfo } from "@/lib/trial";
import { isValidPhone } from "@/lib/phone";
import { StoryLinkButton } from "./story-link";
import { WidgetsPanel } from "./widgets-panel";
import { VideosPanel } from "./videos-panel";
import { LogoutButton } from "@/app/my/ui";
import { EditorShell } from "./shell";
import { DEFAULT_EDITOR_MENU, isEditorMenu, type EditorMenuId } from "@/config/editor-menu";
import { highlightAnchor, highlightId, menuOfAnchor } from "@/lib/editor/anchors";

/**
 * 에디터 v1 (클라이언트) — 섹션 12종 편집·이야기. data-tour 앵커 규약 준수 (CLAUDE.md 규칙 3).
 * 저장(draft)과 사이트 반영(발행)은 분리 — 반영해야 손님에게 보인다.
 */

const MOODS = [
  { id: "clean", name: "깔끔한" }, { id: "warm", name: "따뜻한" },
  { id: "premium", name: "프리미엄" }, { id: "lively", name: "활기찬" },
] as const;

/** 앵커를 못 찾았을 때의 안내 — 두 자리에서 같은 말을 쓴다 */
const ANCHOR_MISSING = "이 홈페이지에는 아직 그 항목이 없어요 — '홈페이지' 메뉴의 '섹션 추가'에서 넣을 수 있어요";

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
  /** 무료 기간·정지·삭제 판정 (단일 출처 lib/trial.ts) */
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
   *  빌드가 걸리므로 초기값에서 직접 읽는다. 첫 렌더는 data=null 이라 화면이 트리에 없다.
   *  ★ 2026-09-09 — 탭 3개가 **상단 메뉴**로 바뀌었다(S2⑥). 옛 `?tab=inbox` 링크는
   *    그대로 동작한다 — 이미 나간 알림 문자가 전부 그 주소다(lib/notify.ts). */
  const [menu, setMenu] = useState<EditorMenuId>(() => {
    if (typeof window === "undefined") return DEFAULT_EDITOR_MENU;
    const t = new URLSearchParams(window.location.search).get("tab");
    return isEditorMenu(t) ? t : DEFAULT_EDITOR_MENU;
  });
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
   *
   * ★ 스크롤·강조 자체는 `lib/editor/anchors.ts` 하나가 한다 — 전에는 이 함수와
   *   `widgets-panel.tsx` 의 `scrollToAnchor` 가 **글자까지 같은 사본 둘**이었다.
   * ★ 앵커가 지금 메뉴에 없으면 **그 앵커가 사는 메뉴로 먼저 옮긴 뒤** 다시 찾는다.
   *   표는 `ANCHOR_MENU` 다. 조용히 끝내면 버튼이 고장난 것처럼 보인다.
   */
  function goToAnchor(anchor: string) {
    const home = menuOfAnchor(anchor);
    /* ★ 표에 «다른 메뉴» 라고 적혀 있으면 **찾기 전에 메뉴부터 바꾼다.**
       ⚠ 순서를 뒤집으면 안 된다. story-new·panel-inbox 는 앵커가 «메뉴 버튼» 위에 붙어
         있어서 어느 메뉴에서든 늘 찾힌다. 먼저 찾으면 버튼만 1.8초 반짝이고 화면은
         그대로다 — 배점 최고(15점) 「첫 스토리 작성」 힌트가 실제로 그랬다
         (2026-09-09 반증 검사). */
    if (home && home !== menu) {
      setMenu(home);
      window.setTimeout(() => { if (!highlightAnchor(anchor)) flash(ANCHOR_MISSING); }, 60);
      return;
    }
    if (highlightAnchor(anchor)) return;
    // 표에 없는 앵커(껍데기에 늘 있는 것)인데 못 찾았다면 이 사이트에 그 자리가 없는 것이다
    // (예: 영업시간은 VISIT 템플릿에만 있다).
    setMenu(home ?? DEFAULT_EDITOR_MENU);
    window.setTimeout(() => { if (!highlightAnchor(anchor)) flash(ANCHOR_MISSING); }, 60);
  }
  /**
   * 왼쪽 칸의 «섹션 목록» → 그 칸으로 데려간다.
   * ⚠ 섹션 카드 대부분은 앵커가 없다(규칙 3 — 이름을 새로 지을 수 없다). 그래서 id 로 찾는다.
   * ★ 미리보기도 같이 그 자리로 스크롤한다 — 고칠 칸과 보이는 칸을 맞춘다.
   */
  function goToSection(i: number) {
    const go = () => { if (!highlightId(`edit-sec-${i}`)) return false; setFocusIndex(i); return true; };
    if (go()) return;
    setMenu("home");
    window.setTimeout(go, 60);
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

  /* 공용 .toast 애니메이션이 2320ms(120 fade-in + 2초 유지 + 200 fade-out)다 —
     지우는 시각을 거기 맞춘다. 어긋나면 사라지다 말고 툭 끊긴다. (docs/MOTION.md) */
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2320); };

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
        settings: { phone: phoneOf(doc), address: addressOf(doc), hours: hoursOf(doc), notify: { phone: notify.phone.trim(), email: notify.email.trim() } } }) });
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

  /** 메뉴를 옮기기 전에 편집 중이던 내용을 붙잡는다(자동저장 타이머를 기다리지 않는다) */
  function switchMenu(next: EditorMenuId) {
    if (dirty && !busy) void autoSave();
    setMenu(next);
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
    /* ⚠ 이 화면들도 `.editor-shell` 안에 둔다 — 밖에 두면 어두운 설정에서
       배경만 밝게 남아 «반쯤 어두운» 화면이 된다(2026-09-09 S2⑥). */
    <div className="editor-shell">
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="t-h3 font-bold">{denied.notFound ? "홈페이지를 찾지 못했어요" : "수정 권한이 없어요"}</h1>
      {denied.notFound ? (
        <>
          {/* 주소가 없거나 서버가 응답하지 못한 경우 — 권한 문제가 아니므로 로그인 안내를 하지 않는다 */}
          <p className="mt-2 t-small text-[var(--text-soft)]">주소를 다시 확인해주세요. 잠시 후에도 같으면 다시 시도해주세요.</p>
          <Link href="/my" className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 t-small font-semibold text-white">내 홈페이지 보기</Link>
        </>
      ) : denied.signedIn ? (
        <>
          {/* 미claim 사이트일 수도, 다른 계정이 이미 가진 사이트일 수도 있다.
              후자에선 [내 계정에 연결하기] 버튼이 아예 렌더되지 않으므로 계정 전환 경로도 함께 알려준다. */}
          <p className="mt-2 t-small text-[var(--text-soft)]">
            이 홈페이지는 지금 로그인한 계정에 연결돼 있지 않아요.<br />
            처음 만든 기기에서 이 화면을 열어 <b>[내 계정에 연결하기]</b>를 누르거나,<br />
            다른 계정으로 로그인했다면 <b>[내 홈페이지 보기]</b>에서 로그아웃한 뒤 처음 쓰던 방법으로 다시 로그인해주세요.
          </p>
          <Link href="/my" className="mt-6 inline-block rounded-full bg-green-700 px-6 py-3 t-small font-semibold text-white">내 홈페이지 보기</Link>
        </>
      ) : (
        <>
          <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text-soft)" }}>이 홈페이지 주인이라면 로그인 후 수정할 수 있어요.</p>
          <a href={`/login?next=${encodeURIComponent(`/${slug}/edit`)}`} className="btn btn-primary" style={{ marginTop: "var(--s-5)" }}>로그인하기</a>
        </>
      )}
      <p className="mt-4 t-caption text-[var(--text-soft)]">운영자라면 <a className="text-green-700 underline" href="/admin">운영자 인증</a> 후 다시 시도하세요.</p>
    </main>
    </div>
  );
  if (!data || !doc) return (
    <div className="editor-shell">
      <main className="px-6 py-24 text-center text-[var(--text-soft)]">불러오는 중…</main>
    </div>
  );

  // 무료 종료(정지) — 운영자가 아니면 차단 화면 + 결제 모달 (단일 출처 lib/trial.ts)
  //
  // ⚠ 문의함은 잠그지 않는다. 무료 기간에 이미 받아둔 손님 문의(이름·연락처·내용·사진)는
  //   사장님 것이지 결제로 인질 잡을 대상이 아니다. 알림 문자가 심는 링크가 바로
  //   `?tab=inbox` 라(lib/notify.ts) 여기를 막으면 문자를 받고도 열 곳이 없어진다.
  //   페이월이 잠그는 것은 편집·저장·발행·미리보기까지다 — 차단 화면 문구가 약속한 범위와 같다.
  if (data.trial?.expired && !data.isAdmin) {
    if (menu === "inbox") {
      return (
        <div className="editor-shell">
        <main className="mx-auto max-w-xl px-5 pb-24 pt-8">
          <section className="rounded-2xl border border-accent bg-accent-soft p-4">
            <p className="t-small font-bold">무료 기간이 끝나 홈페이지는 비공개예요</p>
            <p className="mt-1 t-caption leading-relaxed text-[var(--text)]">
              받아두신 문의는 그대로 보실 수 있어요. 손님에게 연락도 지금 하실 수 있습니다.
              내용 수정·사이트 반영은 정기결제를 시작하시면 다시 열려요. 자료는 그대로 보관돼 있습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPayOpen(true)}
                className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white">
                정기결제 시작 — 월 {MEMBERSHIP_PRICE.toLocaleString()}원
              </button>
              <button type="button" onClick={() => setMenu("home")}
                className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">
                돌아가기
              </button>
            </div>
          </section>
          {inboxDone ? (
            <InboxTab slug={slug} anonId={anon()} initial={inbox} onNewCount={setNewCount} />
          ) : (
            <p className="mt-8 text-center t-small text-[var(--text-soft)]">문의를 불러오는 중…</p>
          )}
          {payOpen && <PayModal slug={slug} trial={data.trial} onClose={() => setPayOpen(false)} />}
          {toast && <div className="toast" role="status">{toast}</div>}
        </main>
        </div>
      );
    }
    return (
      <div className="editor-shell">
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[11.5px] font-bold" style={{ color: "var(--teal)" }}>{data.businessName}</p>
        <h1 className="font-display mt-3 text-[26px]" style={{ color: "var(--forest)" }}>홈페이지가 정지됐어요</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--text-soft)]">
          손님에게는 보이지 않지만 <b>자료는 그대로 보관돼 있어요.</b><br />
          매달 {MEMBERSHIP_PRICE.toLocaleString()}원 정기결제를 시작하시면 <b>바로 다시 켜지고</b>, 이야기·영상·발행 기능이 모두 열립니다.
        </p>
        <button type="button" onClick={() => setPayOpen(true)} className="btn-lime mt-8 w-full !py-4 !text-[16px]">정기결제 시작 — 월 {MEMBERSHIP_PRICE.toLocaleString()}원</button>
        <button type="button" onClick={() => setMenu("inbox")} className="mt-3 text-[13.5px] font-semibold underline underline-offset-4" style={{ color: "var(--forest)" }}>
          받아둔 문의 보기{newCount > 0 ? ` (${newCount})` : ""}
        </button>
        <div className="mt-4 flex items-center gap-4">
          <Link href="/my" className="text-[13px] underline text-[var(--text-soft)]">마이페이지</Link>
          {/* 다른 계정으로 잘못 로그인한 사장님의 유일한 탈출구 — 차단 화면에도 남긴다 */}
          <LogoutButton next="/login" />
        </div>
        {payOpen && <PayModal slug={slug} trial={data.trial} onClose={() => setPayOpen(false)} />}
      </main>
      </div>
    );
  }

  /* ── 왼쪽 칸 — 완성도 막대 · 점수 힌트 · 섹션 목록 (S2⑥) ──
     ⚠ 완성도 막대와 힌트는 **없어진 게 아니라 자리를 옮겼다.** 전에는 상단 헤더와
       본문 위에 있었다. 앵커 score-bar 는 상단바로 갔다(shell.tsx). */
  const rail = (
    <div className="space-y-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-n-100">
        <div className="h-full rounded-full bg-green-700 transition-all" style={{ width: `${data.score}%` }} />
      </div>

      {/* 점수 올리기 힌트 — ⚠ logo(panel-brand)는 P6 라 갈 곳이 없다. 이 제외를 빼면 먹통 힌트가 된다 */}
      <section className="rounded-xl bg-green-50 p-3 t-caption leading-relaxed text-green-900">
        {/* ★ 2026-09-10 — `logo` 제외를 뗐다. 전에는 앵커(panel-brand)가 화면에 없어서
            누르면 먹통이라 숨겨 뒀다. 이제 「디자인」 메뉴에 로고 칸이 실재한다. */}
        {RULES.filter((r) => !data.rulesDone.includes(r.id)).slice(0, 3).map((r) => (
          <button key={r.id} type="button" onClick={() => goToAnchor(r.anchor)}
            className="block w-full rounded text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700">
            ＋{r.pts}점 · <b>{r.label}</b> — {r.hint}
          </button>
        ))}
        {data.score >= 75 && <p>잘하고 있어요! 이야기를 계속 쌓으면 홈페이지가 강해져요.</p>}
      </section>

      {/* 섹션 목록 — 누르면 그 칸으로 데려간다. 이름은 lib/section-defaults.ts 하나에서 온다 */}
      <nav aria-label="섹션 목록" className="space-y-1">
        <p className="t-caption font-semibold" style={{ color: "var(--text)" }}>내 홈페이지 칸</p>
        {doc.sections.map((sec, i) => (
          <button
            key={i} type="button" onClick={() => goToSection(i)}
            className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left t-caption hover:bg-n-50"
          >
            {sectionLabel(sec.type)}
          </button>
        ))}
      </nav>
    </div>
  );

  /* ── 상단 바 아래 늘 보이는 알림 ── */
  const banners = (
    <>
      {/* 로그인/계정 연결 유도 — 이 브라우저 anonId로만 접근 중일 때만. 조건은 서버 판정값 하나로만 본다(규칙 4).
          투어 앵커 목록(config/tours.ts·completeness.ts)에 없는 요소라 data-tour는 붙이지 않는다(규칙 3). */}
      {(data.ownership === "anon" || data.ownership === "anon-signedin") && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-n-0 p-3">
          <div className="min-w-0">
            <p className="t-caption font-bold">
              {data.ownership === "anon" ? "지금은 이 기기에서만 수정할 수 있어요" : "이 홈페이지가 아직 계정에 연결되지 않았어요"}
            </p>
            <p className="mt-0.5 t-caption leading-relaxed text-[var(--text-soft)]">
              {data.ownership === "anon"
                ? "로그인하면 휴대폰·컴퓨터 어디서든 이어서 고칠 수 있어요."
                : "내 계정에 연결하면 다른 기기에서도 이어서 고칠 수 있어요."}
            </p>
          </div>
          {data.ownership === "anon" ? (
            <button onClick={goLogin} disabled={!!busy} className="shrink-0 rounded-full bg-green-700 px-3.5 py-1.5 t-caption font-semibold text-white disabled:opacity-40">
              {busy === "save" ? "저장 중…" : "로그인하기"}
            </button>
          ) : (
            <button onClick={claimSite} disabled={!!busy} className="shrink-0 rounded-full bg-green-700 px-3.5 py-1.5 t-caption font-semibold text-white disabled:opacity-40">
              {busy === "claim" ? "연결 중…" : "내 계정에 연결하기"}
            </button>
          )}
        </section>
      )}

      {/* 무료 기간 바 (2026-09-05) */}
      {data.trial && !data.isAdmin && <TrialBar trial={data.trial} onPay={() => setPayOpen(true)} />}
    </>
  );

  return (
    <EditorShell
      slug={slug}
      businessName={data.businessName}
      score={data.score}
      menu={menu}
      onMenu={switchMenu}
      newCount={newCount}
      storyCount={data.storyCount}
      busy={busy}
      onSave={save}
      onPublish={publish}
      status={<AutoSaveStatus status={autoStatus} onRetry={() => void autoSave()} />}
      /* 로그아웃 — /my 의 컴포넌트를 그대로 쓴다. data-tour 앵커를 새로 만들지 않는다(규칙 3). */
      logout={<LogoutButton next="/login" />}
      banners={banners}
      rail={rail}
      preview={
        /* 미리보기 — 폰 프레임. 1024px 미만에서는 아예 마운트하지 않는다(폰에서 불필요한 로드를 막는다) */
        <div className="overflow-hidden border border-n-300 bg-n-0" style={{ height: "calc(100vh - 8rem)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-1)" }}>
          {isDesktop && <PreviewPane slug={slug} doc={doc} focusIndex={focusIndex} />}
        </div>
      }
      overlays={
        <>
          {payOpen && <PayModal slug={slug} trial={data.trial} onClose={() => setPayOpen(false)} />}

          {/* 폰 하단 고정 바 — 미리보기는 무거우니 기본으로 열지 않는다 */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-n-200 bg-n-0 p-3 lg:hidden">
            <button onClick={() => setSheetOpen(true)} className="mx-auto block w-full max-w-xl rounded-full bg-n-900 py-3 t-small font-semibold text-white">
              미리보기
            </button>
          </div>

          {/* 폰 전체화면 시트 */}
          {sheetOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-n-0 lg:hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-n-200 px-4 py-3">
                <p className="t-small font-bold">미리보기</p>
                <button onClick={() => setSheetOpen(false)} className="rounded-full border border-n-300 px-3.5 py-1.5 t-caption font-semibold">닫기</button>
              </div>
              <div className="min-h-0 flex-1">
                <PreviewPane slug={slug} doc={doc} focusIndex={focusIndex} />
              </div>
            </div>
          )}

          {toast && <div className="toast" role="status">{toast}</div>}
        </>
      }
    >
      {/* ── 메뉴별 화면 ── */}
      {menu === "home" ? (
        <ContentTab doc={doc} slug={slug} patchSection={patchSection} setDoc={(d) => { setDoc(d); setDirty(true); }}
          notify={notify} setNotify={(n) => { setNotify(n); setDirty(true); }} channels={inbox?.channels ?? null} />
      ) : menu === "design" ? (
        <DesignPanel
          doc={doc} setDoc={(d) => { setDoc(d); setDirty(true); }}
          slug={slug}
          logo={typeof data.settings?.logo === "string" ? data.settings.logo : ""}
          onLogo={(url, score, rulesDone) =>
            setData((prev) => prev && {
              ...prev,
              settings: { ...prev.settings, logo: url },
              score: score ?? prev.score,
              rulesDone: rulesDone ?? prev.rulesDone,
            })}
        />
      ) : menu === "story" ? (
        <div className="space-y-4">
          {/* 60초 녹화 링크 — 문자로 받기 / 지금 열기 (이야기 엔진 1차, 기획1 #rec) */}
          <StoryLinkButton slug={slug} phone={String(data.settings?.phone ?? "")} />
          <StoryTab slug={slug} onDone={(score) => { setData((p) => p && { ...p, score, storyCount: p.storyCount + 1 }); flash("이야기가 올라갔어요! 바로 홈페이지에 보여요"); }} />
        </div>
      ) : menu === "video" ? (
        <VideosPanel
          slug={slug} doc={doc}
          phone={String(data.settings?.phone ?? "")}
          onAttach={(section) => { setDoc(attachVideo(doc, section)); setDirty(true); flash("홈페이지에 걸었어요 — 손님에게 보이려면 [사이트 반영]을 눌러 주세요"); }}
          onDetach={() => { setDoc({ ...doc, sections: doc.sections.filter((s) => s.type !== "video") }); setDirty(true); flash("홈페이지에서 내렸어요 (영상은 지워지지 않았어요)"); }}
        />
      ) : menu === "link" ? (
        <WidgetsPanel doc={doc} setDoc={(d) => { setDoc(d); setDirty(true); }} onGoToAnchor={goToAnchor} />
      ) : inboxDone ? (
        <InboxTab slug={slug} anonId={anon()} initial={inbox} onNewCount={setNewCount} />
      ) : (
        <p className="mt-8 text-center t-small text-[var(--text-soft)]">문의를 불러오는 중…</p>
      )}
    </EditorShell>
  );
}

/**
 * 영상 섹션을 doc 에 끼운다 — **히어로 바로 다음** 자리다(회장님 지시).
 * ⚠ 이미 걸린 영상이 있으면 **바꾼다**(V-1 은 한 편만). 두 개가 쌓이지 않게 먼저 걷어낸다.
 */
function attachVideo(doc: SiteDocT, section: SectionT): SiteDocT {
  const rest = doc.sections.filter((s) => s.type !== "video");
  const heroAt = rest.findIndex((s) => s.type === "hero");
  const at = heroAt >= 0 ? heroAt + 1 : 0;
  return { ...doc, sections: [...rest.slice(0, at), section, ...rest.slice(at)] };
}

/** 섹션 이름 — 목록은 lib/section-defaults.ts 하나에서 온다. hero 만 거기 없다(더할 수 없는 칸이라) */
function sectionLabel(type: string): string {
  if (type === "hero") return "첫 화면";
  // 영상은 「섹션 추가」로 못 넣어서 ADDABLE_SECTIONS 에 없다(2026-09-10) — 이름을 여기서 준다
  if (type === "video") return "영상";
  return ADDABLE_SECTIONS.find((a) => a.type === type)?.name ?? type;
}

/**
 * 「디자인」 메뉴 — 지금은 분위기 넷뿐이다(내용 수정 탭에서 옮겨 왔다).
 * ⚠ S3 에서 **분위기 카드 40장**으로 바뀐다. 색·글씨체도 그때 여기 들어온다.
 */
function DesignPanel({ doc, setDoc, slug, logo, onLogo }: {
  doc: SiteDocT; setDoc: (d: SiteDocT) => void;
  slug: string;
  /** 지금 저장된 로고 주소. 빈 문자열이면 아직 없다 */
  logo: string;
  onLogo: (url: string, score?: number, rulesDone?: string[]) => void;
}) {
  return (
    <div className="space-y-6">
    <LogoBox slug={slug} logo={logo} onLogo={onLogo} />
    <section className="rounded-2xl border border-n-200 p-4">
      <h2 className="t-small font-bold">분위기</h2>
      <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">고르면 홈페이지 색과 느낌이 바뀌어요. 오른쪽 미리보기에서 바로 확인하세요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button key={m.id} onClick={() => setDoc({ ...doc, theme: { ...doc.theme, palette: m.id } })}
            className={`rounded-full px-3.5 py-1.5 t-caption font-semibold ${doc.theme.palette === m.id ? "bg-green-700 text-white" : "border border-n-300"}`}>
            {m.name}
          </button>
        ))}
      </div>
    </section>
    </div>
  );
}

/**
 * 로고 칸 — 「디자인」 메뉴 (2026-09-10).
 *
 * ★ 왜 지금 만들었나: 완성도 규칙 `logo`(5점)의 판정을 켰는데(lib/score.ts),
 *   **사장님이 편집화면에서 로고를 넣을 자리가 없으면** 그 5점은 온보딩 때
 *   넣은 사람만 받는 «닫힌 점수»가 된다. 그러면 만점 100점이 또 거짓말이 된다.
 *
 * ★ 앵커 `panel-brand` 가 여기 산다. 전에는 FUTURE_ANCHORS(P6)였고 화면에 없어서
 *   힌트가 먹통이었다 — 그래서 힌트 목록에서 아예 빼 두고 있었다.
 *
 * ⚠ 로고는 `draft` 가 아니라 `sites.settings.logo` 에 산다(섹션 스키마를 안 건드린다).
 *   그래서 자동저장이 아니라 **올리는 즉시** 서버가 저장하고 점수를 다시 계산한다.
 */
function LogoBox({ slug, logo, onLogo }: {
  slug: string; logo: string;
  onLogo: (url: string, score?: number, rulesDone?: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.set("slug", slug); fd.set("anonId", anon()); fd.set("file", file);
    const r = await fetch("/api/site/logo", { method: "POST", body: fd });
    const d = (await r.json().catch(() => ({}))) as { url?: string; score?: number; rulesDone?: string[]; error?: string };
    setBusy(false);
    // ⚠ 조용히 실패하지 않는다 — 올렸는데 아무 일도 안 일어나면 파일이 나쁜 건지 우리가 나쁜 건지 모른다
    if (!r.ok || !d.url) { setErr(d.error ?? "로고를 올리지 못했어요. 잠시 후 다시 시도해 주세요."); return; }
    onLogo(d.url, d.score, d.rulesDone);
  }

  return (
    <section data-tour="panel-brand" className="space-y-3 rounded-2xl border border-n-200 p-4">
      <h2 className="t-small font-bold">로고 <span className="font-normal text-[var(--text-soft)]">(+5점)</span></h2>
      <p className="t-caption leading-relaxed text-[var(--text-soft)]">
        가게 로고가 있으면 홈페이지·명함·도장까지 같은 얼굴로 이어져요. PNG·JPG·SVG, 2MB 까지.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logo} alt="지금 로고" className="h-16 w-16 rounded-lg border border-n-200 bg-n-0 object-contain p-1" />
        )}
        <label className="inline-block cursor-pointer rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">
          {busy ? "올리는 중…" : logo ? "로고 교체" : "로고 올리기"}
          <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </label>
      </div>
      {err && <p className="t-caption text-danger">{err}</p>}
    </section>
  );
}

function AutoSaveStatus({ status, onRetry }: { status: "idle" | "saving" | "saved" | "error"; onRetry: () => void }) {
  if (status === "idle") return null;
  if (status === "saving") return <p className="text-[11px] text-[var(--text-soft)]">저장 중…</p>;
  if (status === "saved") return <p className="text-[11px] text-[var(--text-soft)]">저장됨 · 사장님만 보여요</p>;
  return (
    <p className="text-[11px] text-danger">
      저장 실패 — 다시 시도
      <button onClick={onRetry} className="ml-1.5 rounded-full border border-danger px-2 py-0.5 text-[10px] font-semibold text-danger">지금 저장</button>
    </p>
  );
}

/* ── 내용 수정 탭 ── */

function phoneOf(doc: SiteDocT): string {
  const q = doc.sections.find((s) => s.type === "quoteForm");
  return q && "phone" in q ? q.phone : "";
}
/**
 * 영업시간을 섹션에서 뽑아 `sites.settings.hours` 로 옮긴다 (2026-09-10).
 *
 * ★ 왜 필요한가: 완성도 규칙 `hours`(10점)의 판정은 `settings.hours` 를 보는데
 *   (lib/score.ts), 화면은 `doc.sections[hoursCard].hours` 에만 쓴다. 그래서
 *   **사장님이 영업시간을 아무리 정성껏 채워도 10점이 영원히 안 붙었다.**
 *   저장소 전체에 settings.hours 를 채우는 코드가 한 곳도 없었다(2026-09-10 실측).
 *
 * ★ 점수 규칙·배점은 건드리지 않았다(회장님 지시). 화면이 그 칸을 채우게만 했다 —
 *   `phoneOf`·`addressOf` 와 똑같은 방식이다.
 *
 * ⚠ 영업시간 칸이 없는 사이트(QUOTE 템플릿)는 `null` 이다. 그 사이트에서는
 *   원래 이 10점을 받을 자리가 없다 — 앵커도 CONDITIONAL_ANCHORS 로 빠져 있다.
 */
function hoursOf(doc: SiteDocT): string | null {
  const h = doc.sections.find((s) => s.type === "hoursCard");
  return h && "hours" in h ? h.hours : null;
}
function addressOf(doc: SiteDocT): string | null {
  const m = doc.sections.find((s) => s.type === "map");
  return m && "address" in m ? m.address : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block t-caption font-semibold text-[var(--text-soft)]">{label}</span>{children}</label>;
}
/**
 * 입력칸 공통 — **폭은 여기 넣지 않는다.**
 *
 * ⚠ 전에는 `w-full` 이 이 문자열 안에 있었다. 그래서 폭을 좁히려던 두 자리
 *   (진행 과정의 «단계 이름», 메뉴판의 «가격»)가 `${inp} w-28` 로 적어 놓고도
 *   **w-28 이 못 이겼다** — Tailwind 는 class 를 쓴 순서가 아니라 CSS 파일 순서로 이긴다.
 *   결과: 그 칸이 줄 전체를 차지하고 옆 칸과 사진 버튼이 화면 밖으로 밀려났다
 *   (768px 에서 39px 가로넘침 — 2026-09-09 S2⑦ 실측).
 *   옛 배치는 본문이 576px 로 좁고 가운데 정렬이라 우연히 안 보였을 뿐, 결함은 같았다.
 */
const inpBase = "rounded-xl border border-n-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-green-700";
const inp = `w-full ${inpBase}`;
/** 좁은 칸 — 폭을 쓰는 자리에서 정한다 */
const inpNarrow = `${inpBase} w-28 flex-shrink-0`;

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
    <div className="space-y-3 rounded-xl bg-n-50 p-3.5">
      <p className="t-caption font-bold">문의 알림 받기</p>
      <Field label="문자 받을 번호">
        <input className={inp} value={notify.phone} maxLength={20} inputMode="tel"
          onChange={(e) => setNotify({ ...notify, phone: e.target.value })} />
      </Field>
      <Field label="이메일">
        <input className={inp} type="email" value={notify.email} maxLength={120}
          onChange={(e) => setNotify({ ...notify, email: e.target.value })} />
      </Field>
      <p className="text-[11px] leading-relaxed text-[var(--text-soft)]">비워두면 위 전화번호와 로그인 이메일로 알려드려요.</p>
      {pending && <p className="text-[11px] leading-relaxed text-accent-ink">{pending}</p>}
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
    /* ★ 2026-09-09 (S2⑥) — 여기 있던 둘이 **없어진 게 아니라 옮겨 갔다.**
       · 분위기 4칩 → 「디자인」 메뉴 (DesignPanel)
       · 연결 버튼 패널 → 「연결」 메뉴 (WidgetsPanel)
       앵커 panel-widgets 도 같이 옮겨 갔다. goToAnchor 가 ANCHOR_MENU 를 보고 메뉴를 바꾼다. */
    <div data-tour="panel-sections" className="space-y-6">
      {doc.sections.map((s, i) => {
        const card = (() => {
        switch (s.type) {
          case "hero": return (
            <section data-tour="sec-hero" className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">첫 화면</h2>
              <Field label="작은 소개 (한 줄)"><input className={inp} value={s.eyebrow ?? ""} maxLength={40} onChange={(e) => patchSection(i, { eyebrow: e.target.value })} /></Field>
              <Field label="큰 제목"><textarea className={inp} rows={2} value={s.headline} maxLength={60} onChange={(e) => patchSection(i, { headline: e.target.value })} /></Field>
              <Field label="설명 문장"><textarea className={inp} rows={2} value={s.sub ?? ""} maxLength={160} onChange={(e) => patchSection(i, { sub: e.target.value })} /></Field>
              <div data-tour="panel-photos">
                <span className="mb-1 block t-caption font-semibold text-[var(--text-soft)]">첫 화면 사진 {s.image ? "" : "(없음)"}</span>
                {s.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}
                <label className="inline-block cursor-pointer rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">
                  {uploading ? "올리는 중…" : "내 사진으로 교체 (+15점 항목)"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSectionImage(i, e.target.files[0])} />
                </label>
              </div>
            </section>
          );
          case "about": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">소개</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              <Field label="내용"><textarea className={inp} rows={5} value={s.body} maxLength={600} onChange={(e) => patchSection(i, { body: e.target.value })} /></Field>
              <div>
                <span className="mb-1 block t-caption font-semibold text-[var(--text-soft)]">소개 사진 {s.image ? "" : "(없음)"}</span>
                {s.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.image} alt="" className="mb-2 aspect-[3/2] w-40 rounded-lg object-cover" />
                )}
                <label className="inline-block cursor-pointer rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">
                  {uploading ? "올리는 중…" : s.image ? "사진 교체" : "사진 추가"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSectionImage(i, e.target.files[0])} />
                </label>
              </div>
            </section>
          );
          case "processSteps": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">진행 과정</h2>
              {s.steps.map((st, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input className={inpNarrow} value={st.name} maxLength={20}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, name: e.target.value } : x) })} />
                  <input className={inp} value={st.desc ?? ""} maxLength={80}
                    onChange={(e) => patchSection(i, { steps: s.steps.map((x, k) => k === j ? { ...x, desc: e.target.value } : x) })} />
                  <label className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-n-300 t-caption"
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
            <section data-tour="sec-form" className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">문의 받기</h2>
              <Field label="안내 문장"><input className={inp} value={s.sub ?? ""} maxLength={120} onChange={(e) => patchSection(i, { sub: e.target.value })} /></Field>
              <div data-tour="set-contact">
                <Field label="전화번호 (문의 버튼 연결)">
                  <input className={inp} value={s.phone} maxLength={20} onChange={(e) => patchSection(i, { phone: e.target.value })} aria-invalid={!isValidPhone(s.phone)} />
                  {/* 온보딩에서 막아도 여기서 지울 수 있다 — 그때 CTA 가 조용히 문의 폼으로 바뀌는 이유를 알려준다 */}
                  {!isValidPhone(s.phone) && (
                    <p className="mt-1.5 text-[12px] text-danger">전화번호를 정확히 입력해 주세요 — 숫자 9자리 이상. 이대로 두면 문의 버튼이 전화 걸기 대신 문의 폼으로 연결됩니다.</p>
                  )}
                </Field>
              </div>
              <NotifyBox notify={notify} setNotify={setNotify} channels={channels} />
            </section>
          );
          case "map": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">오시는 길</h2>
              <Field label="주소"><input className={inp} value={s.address} maxLength={120} onChange={(e) => patchSection(i, { address: e.target.value })} /></Field>
              <Field label="안내 (선택)"><input className={inp} value={s.note ?? ""} maxLength={120} onChange={(e) => patchSection(i, { note: e.target.value })} /></Field>
            </section>
          );
          case "hoursCard": return (
            <section data-tour="set-hours" className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">영업시간</h2>
              <Field label="영업시간 (줄바꿈 가능)"><textarea className={inp} rows={3} value={s.hours} maxLength={200} onChange={(e) => patchSection(i, { hours: e.target.value })} /></Field>
            </section>
          );
          case "storyFeed": return (
            <section className="rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">이야기 코너</h2>
              <Field label="코너 제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
            </section>
          );
          case "gallery": {
            const mv = (j: number, d: number) => {
              const a = [...s.photos]; const [x] = a.splice(j, 1); a.splice(j + d, 0, x);
              patchSection(i, { photos: a });
            };
            return (
              <section className="space-y-3 rounded-2xl border border-n-200 p-4">
                <h2 className="t-small font-bold">사진 갤러리</h2>
                <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-2">
                  {s.photos.map((p, j) => (
                    <div key={`${p}-${j}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="h-24 w-28 rounded-lg object-cover" />
                      <div className="mt-1 flex justify-center gap-1 t-caption">
                        <button disabled={j === 0} onClick={() => mv(j, -1)} className="rounded border border-n-200 px-1.5 disabled:opacity-30" aria-label="앞으로">←</button>
                        <button disabled={j === s.photos.length - 1} onClick={() => mv(j, 1)} className="rounded border border-n-200 px-1.5 disabled:opacity-30" aria-label="뒤로">→</button>
                        <button disabled={s.photos.length <= 1} onClick={() => patchSection(i, { photos: s.photos.filter((_, k) => k !== j) })}
                          className="rounded border border-n-200 px-1.5 text-danger disabled:opacity-30" aria-label="삭제">✕</button>
                      </div>
                    </div>
                  ))}
                  {s.photos.length < 30 && (
                    <label className="flex h-24 w-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-n-300 t-h2 text-n-300">
                      {uploading ? "…" : "＋"}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { photos: [...s.photos, url] }); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <p className="t-caption text-[var(--text-soft)]">사진은 최소 1장 필요해요. 최대 30장.</p>
              </section>
            );
          }
          case "reviews": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">고객 이야기</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-n-50 p-3">
                  <div className="flex gap-2">
                    <input className={inp} value={it.title} maxLength={60} placeholder="한 줄 요약 (예: 꼼꼼한 시공 감사해요)"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, title: e.target.value } : x) })} />
                    <button disabled={s.items.length <= 1} onClick={() => patchSection(i, { items: s.items.filter((_, k) => k !== j) })}
                      className="flex-shrink-0 rounded-full border border-n-200 px-2.5 t-caption text-danger disabled:opacity-30" aria-label="후기 삭제">✕</button>
                  </div>
                  <textarea className={inp} rows={2} value={it.body} maxLength={300} placeholder="손님이 남긴 말"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, body: e.target.value } : x) })} />
                  <input className={inp} value={it.source ?? ""} maxLength={30} placeholder="출처 (선택, 예: 네이버 영수증 리뷰)"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, source: e.target.value } : x) })} />
                </div>
              ))}
              {s.items.length < 20 && (
                <button onClick={() => patchSection(i, { items: [...s.items, { title: "", body: "" }] })}
                  className="rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">＋ 후기 추가</button>
              )}
            </section>
          );
          case "banner": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">띠 배너</h2>
              <Field label="문구"><input className={inp} value={s.text} maxLength={80} onChange={(e) => patchSection(i, { text: e.target.value })} /></Field>
              <Field label="연결 주소 (선택)"><input className={inp} value={s.link ?? ""} placeholder="https://…" inputMode="url"
                onChange={(e) => patchSection(i, { link: e.target.value.trim() || undefined })} /></Field>
            </section>
          );
          case "portfolioGallery": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">시공 사례</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-n-50 p-3">
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
                      className="flex-shrink-0 rounded-full border border-n-200 px-2.5 py-1 t-caption text-danger disabled:opacity-30" aria-label="사례 삭제">✕</button>
                  </div>
                  <label className="inline-block cursor-pointer rounded-full border border-n-300 px-3.5 py-1 t-caption font-semibold">
                    {uploading ? "올리는 중…" : "사진 교체"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, image: url } : x) }); e.target.value = ""; }} />
                  </label>
                </div>
              ))}
              {s.items.length < 30 && (
                <label className="inline-block cursor-pointer rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">
                  {uploading ? "올리는 중…" : "＋ 사례 추가 (사진 선택)"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) patchSection(i, { items: [...s.items, { title: "", image: url }] }); e.target.value = ""; }} />
                </label>
              )}
            </section>
          );
          case "menuPrice": return (
            <section className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">메뉴판</h2>
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              {s.items.map((it, j) => (
                <div key={j} className="space-y-2 rounded-xl bg-n-50 p-3">
                  <div className="flex gap-2">
                    <input className={inp} value={it.name} maxLength={40} placeholder="메뉴 이름"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, name: e.target.value } : x) })} />
                    <input className={inpNarrow} value={it.price} maxLength={20} placeholder="가격"
                      onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, price: e.target.value } : x) })} />
                    <button disabled={s.items.length <= 1} onClick={() => patchSection(i, { items: s.items.filter((_, k) => k !== j) })}
                      className="flex-shrink-0 rounded-full border border-n-200 px-2.5 t-caption text-danger disabled:opacity-30" aria-label="메뉴 삭제">✕</button>
                  </div>
                  <input className={inp} value={it.desc ?? ""} maxLength={80} placeholder="설명 (선택)"
                    onChange={(e) => patchSection(i, { items: s.items.map((x, k) => k === j ? { ...x, desc: e.target.value } : x) })} />
                </div>
              ))}
              {s.items.length < 40 && (
                <button onClick={() => patchSection(i, { items: [...s.items, { name: "", price: "" }] })}
                  className="rounded-full border border-n-300 px-4 py-1.5 t-caption font-semibold">＋ 메뉴 추가</button>
              )}
            </section>
          );
          case "video": return (
            /* 60초 영상 (2026-09-10, V-1).
               ★ 사장님이 «주소»를 고칠 수는 없다. 고칠 수 있는 것은 제목과 한 줄뿐이고,
                 영상 자체를 바꾸거나 내리는 것은 「영상」 메뉴에서 한다.
               ⚠ 여기서 소리를 내지 않는다 — 편집 중에 갑자기 사장님 목소리가 나면 놀란다.
                 `controls` 만 두고 자동재생을 넣지 않는다(손님 화면과 같은 규칙). */
            <section data-tour="sec-video" className="space-y-3 rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">영상</h2>
              <div className="overflow-hidden rounded-xl bg-n-900" style={{ maxHeight: 220 }}>
                <video src={s.url} poster={s.poster} controls playsInline preload="metadata"
                  className="mx-auto block" style={{ maxHeight: 220, maxWidth: "100%" }} />
              </div>
              {!s.poster && (
                <p className="t-caption leading-relaxed text-[var(--text-soft)]">
                  표지 사진이 없어요. 손님에게는 영상의 첫 장면이 먼저 보입니다.
                </p>
              )}
              <Field label="제목"><input className={inp} value={s.title} maxLength={40} onChange={(e) => patchSection(i, { title: e.target.value })} /></Field>
              <Field label="영상 아래 한 줄 (선택)"><input className={inp} value={s.caption ?? ""} maxLength={120} placeholder="예: 20년째 같은 자리에서 합니다"
                onChange={(e) => patchSection(i, { caption: e.target.value || undefined })} /></Field>
              <p className="t-caption leading-relaxed text-[var(--text-soft)]">
                다른 영상으로 바꾸거나 내리려면 위 <b>「영상」</b> 메뉴에서 하세요. 여기서 ✕ 를 눌러도 홈페이지에서만 내려가고 영상은 그대로 남아 있어요.
              </p>
            </section>
          );
          default: return (
            // 모르는 타입도 숨기지 않는다 — 숨기면 저장 실패(zod 검증)의 원인을 화면에서 찾을 수 없음
            <section className="rounded-2xl border border-n-200 p-4">
              <h2 className="t-small font-bold">알 수 없는 섹션</h2>
              <p className="mt-1 t-caption text-[var(--text-soft)]">
                이 에디터가 지원하지 않는 섹션이에요 (타입: {(s as { type?: string }).type ?? "없음"}). 저장이 실패하면 이 섹션이 원인일 수 있어요.
              </p>
            </section>
          );
        }
        })();
        return (
          /* id 는 왼쪽 칸의 «섹션 목록» 이 찾는 자리다(lib/editor/anchors.ts 의 highlightId).
             data-tour 앵커가 아니다 — 앵커 이름은 config 에서만 온다(규칙 3). */
          <div key={i} id={`edit-sec-${i}`} className="relative">
            {s.type !== "hero" && (
              <div className="absolute right-3 top-3 flex gap-1">
                <button disabled={i === 0 || doc.sections[i - 1].type === "hero"} onClick={() => moveSection(i, -1)}
                  className="h-6 w-6 rounded border border-n-200 bg-n-0 t-caption text-[var(--text-soft)] disabled:opacity-30" aria-label="위로 이동">↑</button>
                <button disabled={i === doc.sections.length - 1} onClick={() => moveSection(i, 1)}
                  className="h-6 w-6 rounded border border-n-200 bg-n-0 t-caption text-[var(--text-soft)] disabled:opacity-30" aria-label="아래로 이동">↓</button>
                {s.type !== "quoteForm" && (
                  <button onClick={() => deleteSection(i)}
                    className="h-6 w-6 rounded border border-n-200 bg-n-0 t-caption text-[var(--text-soft)] hover:border-danger hover:text-danger" aria-label="섹션 삭제">✕</button>
                )}
              </div>
            )}
            {card}
          </div>
        );
      })}

      {/* 섹션 추가 — 없는 타입만. gallery·portfolioGallery는 zod min(1) 제약 때문에 첫 사진과 함께 삽입 */}
      <section className="rounded-2xl border-2 border-dashed border-n-300 p-4">
        <h2 className="t-small font-bold">섹션 추가</h2>
        {missing.length === 0 ? (
          <p className="mt-1 t-caption text-[var(--text-soft)]">추가할 수 있는 섹션이 모두 들어가 있어요.</p>
        ) : (
          <>
            <p className="mt-1 t-caption text-[var(--text-soft)]">맨 아래에 추가돼요 — ↑ 버튼으로 원하는 위치로 옮기세요. 사진 갤러리·시공 사례는 첫 사진을 고르면 추가돼요.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missing.map((m) => m.needsPhoto ? (
                <label key={m.type} className="cursor-pointer rounded-full border border-n-300 px-3.5 py-1.5 t-caption font-semibold">
                  {uploading ? "올리는 중…" : `＋ ${m.name}`}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f); if (url) addSection(m.type, url); e.target.value = ""; }} />
                </label>
              ) : (
                <button key={m.type} onClick={() => addSection(m.type)}
                  className="rounded-full border border-n-300 px-3.5 py-1.5 t-caption font-semibold">＋ {m.name}</button>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="text-center t-caption text-[var(--text-soft)]">섹션 삭제는 곧 열려요.</p>
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
      <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed text-[var(--text-soft)]">
        오늘 현장 사진 한 장과 두 줄이면 충분해요. 쓴 이야기는 <b>바로 홈페이지에 쌓입니다</b> — 기록이 많아질수록 견적 문의가 늘어요.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {STORY_TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)}
            className={`rounded-full px-3.5 py-1.5 t-caption font-semibold ${type === t.id ? "bg-green-700 text-white" : "border border-n-300"}`}>{t.name}</button>
        ))}
      </div>
      <Field label="제목"><input className={inp} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="예: 강동구 34평 입주청소" /></Field>
      <Field label="내용"><textarea className={inp} rows={4} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="두세 문장이면 충분해요" /></Field>
      <Field label="날짜"><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div>
        <span className="mb-1 block t-caption font-semibold text-[var(--text-soft)]">사진 ({photos.length}/4)</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => /* eslint-disable-next-line @next/next/no-img-element */ (
            <img key={p} src={p} alt="" className="h-20 w-24 rounded-lg object-cover" />
          ))}
          {photos.length < 4 && (
            <label className="flex h-20 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-n-300 t-h2 text-n-300">
              ＋<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
      <button onClick={submit} disabled={busy || !title}
        className="w-full rounded-full bg-green-700 py-3.5 font-semibold text-white disabled:opacity-40">
        {busy ? "올리는 중…" : "이야기 올리기 (+15점)"}
      </button>
    </div>
  );
}
