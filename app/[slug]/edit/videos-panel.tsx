"use client";

import { useCallback, useEffect, useState } from "react";
import type { SectionT, SiteDocT } from "@/lib/schema";
import { StoryLinkButton } from "./story-link";
import { SnsPanel } from "./sns-panel";
import { ReviewSheet } from "./review-sheet";
import { sayPost, providerName } from "@/lib/sns/status-say";
import { SNS_EDIT_NOTICE, SNS_GROWTH_NOTE, SNS_DELETE_SCOPE, SNS_DELETE_BUTTON } from "@/lib/sns/copy";
import { TextMeter } from "./text-meter";
import type { SnsProvider } from "@/lib/sns/types";

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
  /** ★ 누르기 «전»에 잰 인스타 가능 여부 (2026-09-12). 서버가 준다 */
  ig?: { ok: boolean; why: string };
  /** 홈페이지에 보이나 — 「숨기기」의 값 (2026-09-12 지시 D2) */
  visible?: boolean;
  sort?: number;
  /** ★ 이 영상을 어디에 올렸나 — **기록에서** 온다. 새로고침해도 남는다 (2026-09-12)
   *  ⚠ `errorKind` 는 영어다. **화면에 그대로 찍지 마라** — sayPost() 를 거쳐야 한다(지시 D4). */
  posted?: {
    provider: string; status: string; url: string | null; publishedAt: string | null;
    deletedAt: string | null; errorKind?: string | null; attempts?: number | null;
  }[];
};

/** 틱톡 공개범위 값 → 사장님 말. **틱톡이 준 값만 쓰되 «읽을 수 있게»만 바꾼다.**
    ⚠ 여기 없는 값이 오면 그 값을 그대로 보여 준다 — 우리가 지어내지 않는다. */
/** ★ 「브랜디드 콘텐츠」와 함께 쓸 수 없는 공개범위 — 틱톡이 거절한다 */
const TT_PRIVATE = "SELF_ONLY";

const TT_PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "모두에게 공개",
  MUTUAL_FOLLOW_FRIENDS: "서로 팔로우한 친구만",
  FOLLOWER_OF_CREATOR: "내 팔로워만",
  SELF_ONLY: "나만 보기",
};

/* ⚠ SNS 이름표를 여기서 다시 적지 않는다 — lib/sns/status-say.ts 의 providerName() 이
   PROVIDER_NAME(lib/sns/types.ts) 한 곳에서 가져온다. 두 벌을 두면 한쪽만 고쳐진다.
   (2026-09-12: 실제로 여기 이름표가 「인스타그램」이고 저쪽이 「인스타그램 릴스」로 어긋나 있었다) */

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
  /** ⚠ 로그인 안 한 사장님의 소유 증명. 사생활 보호 모드에서는 읽기가 «던지므로» 감싼다 */
  const anonId = (() => { try { return localStorage.getItem("onstori:anonId") ?? ""; } catch { return ""; } })();
  const [snsPicked, setSnsPicked] = useState<string[]>([]);
  /** ★ 검토 화면이 쓸 «전체» 판정. igReady·ttReady 는 카드의 한 걸음 버튼용이라 따로 둔다 */
  const [snsAll, setSnsAll] = useState<{ provider: SnsProvider; name: string; ok: boolean; why: string }[]>([]);
  /** 지금 「다듬어서 등록」을 열어 둔 영상 (한 번에 하나만 연다) */
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  /** ⚠ 「지우기」는 마이그레이션(20260912200000) 뒤에 열린다. 그전에는 **버튼을 안 그린다** */
  const [canDelete, setCanDelete] = useState(true);
  /** 지금 [관리]를 펼친 영상 */
  const [manageFor, setManageFor] = useState<string | null>(null);
  /** 지우기 확인창을 띄운 영상 */
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [manageMsg, setManageMsg] = useState("");

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
      const got = (await r.json()) as { items: Item[]; softDeleteReady?: boolean };
      setItems(got.items);
      /* ⚠ 「지우기」 칸이 아직 없으면 그 버튼을 안 그린다 */
      if (got.softDeleteReady === false) setCanDelete(false);
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
  type PubRow = {
    provider: string; name: string; state: string; msg: string;
    url?: string | null; kind?: string;
    /** ★ 그쪽이 준 원문 — 첫 실제 게시에서 「왜 거절당했는지」를 봐야 한다 (2026-09-12 지시 3) */
    detail?: string;
    /** 인스타 규격 실측 — null 은 «못 잰 것»이지 0 이 아니다 */
    spec?: { bytes: number | null; width: number | null; moovFirst: boolean | null; container?: string | null } | null;
  };
  const [pub, setPub] = useState<Record<string, PubRow[]>>({});
  const [pubBusy, setPubBusy] = useState<string | null>(null);
  /** 사장님이 직접 쓴 글. 비어 있으면 서버가 질문·제목을 쓴다 */
  const [cap, setCap] = useState<Record<string, string>>({});
  /** 인스타가 «지금 올릴 수 있는» 상태인가 — SNS 연결 탭에 들어가지 않아도 알아야 한다 */
  const [igReady, setIgReady] = useState<{ ok: boolean; why: string } | null>(null);
  /** 틱톡도 같은 판정 — 다만 올리는 길은 «시트»를 거친다(심사 요건) */
  const [ttReady, setTtReady] = useState<{ ok: boolean; why: string } | null>(null);

  /* ★★ 틱톡 시트 — 사장님이 **매번** 제목·공개범위·댓글을 고른다 (2026-09-12 지시 8).
     ⚠ 「지난번에는 이렇게 하셨어요」 같은 기본값 유도는 **심사 전에는 넣지 않는다**(회장님 지시).
       틱톡은 「사장님이 매번 스스로 골랐는가」를 본다. */
  type TtOptions = {
    nickname: string; privacyOptions: string[];
    commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean; maxSec: number | null;
  };
  const [ttSheet, setTtSheet] = useState<
    | null
    | { entryId: string; state: "loading" }
    | { entryId: string; state: "error"; why: string }
    | { entryId: string; state: "ready"; opt: TtOptions; privacy: string; title: string; okComment: boolean; okDuet: boolean; okStitch: boolean;
        /* ★ 상업용 콘텐츠 — 셋 다 기본 꺼짐 (2026-09-12 틱톡 규격서 C) */
        commercial: boolean; brandOrganic: boolean; brandedContent: boolean }
  >(null);

  async function openTiktokSheet(it: Item) {
    setTtSheet({ entryId: it.id, state: "loading" });
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
      const r = await fetch("/api/sns/tiktok/options", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, provider: "tiktok" }),
      });
      const d = (await r.json().catch(() => ({}))) as { options?: TtOptions; error?: string };
      if (!r.ok || !d.options) {
        setTtSheet({ entryId: it.id, state: "error", why: d.error ?? `틱톡에 물어보지 못했어요 (${r.status})` });
        return;
      }
      setTtSheet({
        entryId: it.id, state: "ready", opt: d.options,
        /* ★ 공개범위는 **미리 고르지 않는다.** 사장님이 직접 눌러야 한다 */
        privacy: "",
        title: it.question || it.title || "",
        /* ★ 기본은 **전부 꺼짐** — 틱톡이 그렇게 요구한다(규격서 D) */
        okComment: false, okDuet: false, okStitch: false,
        commercial: false, brandOrganic: false, brandedContent: false,
      });
    } catch {
      setTtSheet({ entryId: it.id, state: "error", why: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요." });
    }
  }

  /* ★ 연결 현황을 여기서도 한 번 읽는다 (2026-09-12).
     전에는 [SNS 연결] 탭에서 체크를 해야만 올리기 버튼이 나왔다 — 다섯 걸음이었고,
     새로고침하면 체크가 풀려 처음부터 다시였다. 인스타는 **한 걸음**으로 올릴 수 있어야 한다. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let anonId = "";
        try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
        const r = await fetch("/api/sns/status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, anonId }),
        });
        if (!r.ok) { if (alive) setIgReady({ ok: false, why: "" }); return; }
        type Row = { provider: string; name: string; available: { ok: boolean; why?: string }; connection: { status: string; disclaimerAgreedAt: string | null } | null };
        const d = (await r.json()) as { items?: Row[] };
        if (!alive) return;
        /* 인스타·틱톡을 **같은 규칙**으로 판정한다 — 한쪽만 고치면 다른 쪽이 조용히 어긋난다 */
        const verdict = (p: string, label: string): { ok: boolean; why: string } => {
          const row = d.items?.find((x) => x.provider === p);
          if (!row) return { ok: false, why: "" };
          if (!row.available.ok) return { ok: false, why: row.available.why ?? "" };
          if (!row.connection || row.connection.status !== "active") {
            return { ok: false, why: `[SNS 연결] 에서 ${label}을 먼저 연결해 주세요.` };
          }
          if (!row.connection.disclaimerAgreedAt) {
            return { ok: false, why: "[SNS 연결] 에서 [올려도 좋아요]를 먼저 눌러 주세요." };
          }
          return { ok: true, why: "" };
        };
        setIgReady(verdict("instagram", "인스타그램"));
        setTtReady(verdict("tiktok", "틱톡"));
        /* ★★ 검토 화면은 **모든 곳**을 보여 준다 — 못 고르는 곳도 «왜»와 함께 보여야
           사장님이 「고장인가」 하지 않는다. 단 **틱톡은 뺀다**(아래 이유). */
        setSnsAll(
          (d.items ?? [])
            .filter((x) => x.provider !== "tiktok")
            .map((x) => {
              const v = verdict(x.provider, x.name);
              return { provider: x.provider as SnsProvider, name: x.name, ok: v.ok, why: v.why };
            }),
        );
      } catch { if (alive) { setIgReady({ ok: false, why: "" }); setTtReady({ ok: false, why: "" }); } }
    })();
    return () => { alive = false; };
  }, [slug]);

  type TtChoice = { title: string; privacyLevel: string; disableComment: boolean; disableDuet: boolean; disableStitch: boolean; brandOrganic: boolean; brandedContent: boolean };

  /**
   * @param captionOverride 검토 화면이 만든 «최종 글»(해시태그까지 붙은 것).
   *   ⚠ `cap` 상태를 거치지 않고 곧바로 넘긴다 — setState 는 다음 렌더에나 반영돼서,
   *     여기서 `cap[entryId]` 를 읽으면 **방금 고친 글이 아니라 이전 글**이 나간다.
   */
  /**
   * 영상관리 — 고치기·숨기기·순서·지우기. (2026-09-12 지시 D2)
   * ⚠ 결과를 «화면 상태»로만 바꾸지 않고 목록을 **다시 읽는다** — 순서 바꾸기는 옆 줄도 함께 바뀐다.
   */
  async function manage(entryId: string, body: Record<string, unknown>) {
    setManageMsg("");
    try {
      const r = await fetch("/api/site/video/manage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId, ...body }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; why?: string; notReady?: boolean };
      if (!r.ok) {
        if (d.notReady) setCanDelete(false);
        setManageMsg(d.error ?? `하지 못했어요 (${r.status})`);
        return;
      }
      if (d.why) { setManageMsg(d.why); return; }
      setAskDelete(null);
      await load();
    } catch { setManageMsg("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
  }

  async function publish(entryId: string, providers: string[] = snsPicked, tiktok?: TtChoice, captionOverride?: string) {
    /* ★★ **[간단 등록]에서는 틱톡을 뺀다** (2026-09-12 지시 8).
       틱톡은 올릴 때마다 공개범위를 직접 골라야 해서 «5초 흐름»에 들어갈 수 없다.
       ⚠ 조용히 빼지 않는다 — 아래 결과 줄에 왜 빠졌는지 적는다. 서버도 같은 규칙으로 막는다. */
    const skipTiktok = !tiktok && providers.includes("tiktok");
    const send = skipTiktok ? providers.filter((p) => p !== "tiktok") : providers;
    if (!send.length) {
      setPub((p) => ({ ...p, [entryId]: [{ provider: "tiktok", name: "틱톡", state: "skipped", msg: "위 [틱톡에 올리기]를 눌러 제목·공개범위를 골라 주세요." }] }));
      return;
    }
    setPubBusy(entryId);
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
      const r = await fetch("/api/sns/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId, providers: send, caption: captionOverride?.trim() || cap[entryId]?.trim() || undefined, tiktok }),
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
        const d = (await r.json().catch(() => ({}))) as { state?: string; msg?: string; url?: string | null; detail?: string };
        if (!r.ok || !d.state) continue;
        setPub((p) => ({
          ...p,
          [entryId]: (p[entryId] ?? []).map((x) => x.provider === provider
            ? { ...x, state: d.state!, msg: d.msg ?? x.msg, url: d.url ?? x.url, detail: d.detail ?? x.detail }
            : x),
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
    /* ★ 2026-09-12 — `panel-video` 를 `config/tours.ts` 에 **먼저 등록하고** 여기 붙였다.
       완성도 「첫 영상 찍기」 힌트가 이 자리로 데려온다(규칙 3·12). */
    <div className="flex gap-2" data-tour="panel-video">
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
          {/* ★★ 일곱 자리 중 ① — 목록 맨 위, **항상** (2026-09-12 지시 D3).
              글자는 lib/sns/copy.ts 한 곳에서 온다. 일곱 번 복사하면 한 번 고칠 때 여섯이 옛말로 남는다. */}
          <div className="rounded-xl bg-n-50 p-3">
            <p className="t-caption font-semibold text-danger">⚠ {SNS_EDIT_NOTICE}</p>
            <p className="mt-1.5 t-caption leading-relaxed text-[var(--text-soft)]">{SNS_GROWTH_NOTE}</p>
          </div>
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
                  {/* ★★ 「다듬어서 등록」 (2026-09-12 지시 C2).
                      ⚠ 한 걸음 [인스타그램에 올리기] 는 **그대로 둔다** — 메타 심사의
                        「성공한 호출 1회」가 그 길로 나오기 때문이다. 이 버튼은 그 옆의 «다른 길»이다. */}
                  <button type="button"
                    onClick={() => setReviewFor((x) => (x === it.id ? null : it.id))}
                    className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">
                    {reviewFor === it.id ? "덮기" : "다듬어서 등록"}
                  </button>
                  <button type="button"
                    onClick={() => { setManageFor((x) => (x === it.id ? null : it.id)); setManageMsg(""); }}
                    className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">
                    {manageFor === it.id ? "관리 덮기" : "관리"}
                  </button>
                </div>

                {/* ── 관리 (2026-09-12 지시 D2) ─────────────── */}
                {manageFor === it.id && (
                  <div className="rounded-xl border border-n-200 p-3">
                    {/* ★ 고치는 칸 «바로 위»에 범위를 적는다 — 일곱 자리 중 ④ */}
                    <label className="block">
                      <span className="t-caption text-[var(--text-soft)]">제목</span>
                      <input
                        defaultValue={it.title}
                        onBlur={(e) => { if (e.target.value !== it.title) void manage(it.id, { action: "rename", title: e.target.value }); }}
                        placeholder="영상 제목"
                        className="mt-1 w-full rounded-lg border border-n-300 px-2 py-1.5 t-caption"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button"
                        onClick={() => void manage(it.id, { action: "visible", visible: !it.visible })}
                        className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-semibold">
                        {it.visible ? "숨기기" : "보이기"}
                      </button>
                      <button type="button" onClick={() => void manage(it.id, { action: "move", dir: "up" })}
                        className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-semibold">↑ 위로</button>
                      <button type="button" onClick={() => void manage(it.id, { action: "move", dir: "down" })}
                        className="rounded-full border border-n-300 px-3 py-1.5 t-caption font-semibold">↓ 아래로</button>
                      {/* ⚠ 지우기가 아직 준비 안 됐으면 **버튼을 아예 안 그린다.**
                          눌러도 아무 일이 안 나는 버튼이 가장 나쁘다. */}
                      {canDelete && (
                        <button type="button" onClick={() => setAskDelete(it.id)}
                          className="rounded-full border border-danger px-3 py-1.5 t-caption font-semibold text-danger">
                          지우기
                        </button>
                      )}
                    </div>

                    {!it.visible && (
                      <p className="mt-2 t-caption text-[var(--text-soft)]">
                        지금은 <b>숨겨져</b> 있어요. 목록에는 남지만 홈페이지에는 안 나옵니다.
                      </p>
                    )}

                    {/* ★★ 지우기 확인 — 일곱 자리 중 ⑤. **버튼 글자 자체가 «어디까지 지우는지»를 말한다** */}
                    {askDelete === it.id && (
                      <div className="mt-3 rounded-xl border border-danger p-3">
                        <p className="t-caption font-bold text-danger">이 영상을 지울까요?</p>
                        <p className="mt-1 whitespace-pre-line t-caption leading-relaxed text-[var(--text-soft)]">
                          {SNS_DELETE_SCOPE}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void manage(it.id, { action: "delete" })}
                            className="rounded-full bg-danger px-4 py-2 t-caption font-semibold text-white">
                            {SNS_DELETE_BUTTON}
                          </button>
                          <button type="button" onClick={() => setAskDelete(null)}
                            className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">취소</button>
                        </div>
                      </div>
                    )}
                    {manageMsg && <p className="mt-2 t-caption font-semibold text-danger">{manageMsg}</p>}
                  </div>
                )}

                {reviewFor === it.id && (
                  <ReviewSheet
                    slug={slug}
                    anonId={anonId}
                    entryId={it.id}
                    ready={snsAll}
                    busy={pubBusy === it.id}
                    onCancel={() => setReviewFor(null)}
                    onSubmit={(text, providers) => { void publish(it.id, providers, undefined, text); }}
                  />
                )}

                {/* ★★ 인스타그램 한 걸음 올리기 (2026-09-12 회장님 지시).
                    메타 심사는 «성공한 호출 1회»가 있어야 시작되고, 그 기록이 잡히는 데 **이틀**이 걸린다.
                    그래서 이 길은 최대한 짧아야 한다 — [SNS 연결] 탭을 거치지 않는다.
                    ⚠ 못 올리는 상태면 **버튼을 두지 않고 이유를 쓴다.** 눌러도 아무 일이 안 나는
                      버튼이 가장 나쁘다. */}
                {/* ★★ 이미 올린 기록 — **사실만** 적는다 (2026-09-12 지시 2).
                    · 지워진 것으로 «확인된» 것만 「지워졌어요」라고 쓴다
                    · 확인 못 한 것은 아무 말도 하지 않는다(추측하지 않는다)
                    · [보기] 는 주소가 있을 때만. 없는 링크를 보여 주지 않는다 */}
                {/* ★★ **SNS 등록 현황** (2026-09-12 지시 D1·D4).
                    ⚠ 전에는 «올라간 것»만 보여 줬다. 그래서 실패한 것은 **화면에서 사라졌고**,
                      사장님은 올라간 줄 알고 기다렸다. 이제 전부 보여 준다.
                    ★★ 영어(error_kind·status)는 **한 글자도 안 나간다** — sayPost() 가 번역한다
                      (검사: scripts/status-say-test.ts).
                    ★ 기록이 «없는» SNS 는 줄 자체를 안 그린다 — 회색 「안 올림」은 실패처럼 읽힌다. */}
                {(it.posted ?? []).map((x) => {
                  const said = sayPost(x);
                  if (!said) return null;
                  const tone = said.tone === "good" ? "text-green-700"
                    : said.tone === "bad" ? "text-danger" : "text-[var(--text-soft)]";
                  return (
                    <p key={x.provider} className={`t-caption leading-relaxed ${tone}`}>
                      <b>{providerName(x.provider)}</b> — {said.text}
                      {said.action === "보기" && x.url && (
                        <> <a href={x.url} target="_blank" rel="noreferrer" className="underline">[보기]</a></>
                      )}
                      {said.action === "다시 연결하기" && (
                        <> <button type="button" onClick={() => setView("sns")} className="underline">[다시 연결하기]</button></>
                      )}
                    </p>
                  );
                })}

                {/* ★ 이미 인스타에 올린 영상에는 버튼을 다시 두지 않는다 — 서버가 중복을 막으므로
                    눌러도 「이미 올렸어요」만 나온다. 눌러도 아무 일이 안 나는 버튼을 두지 않는다. */}
                {igReady && !(it.posted ?? []).some((x) => x.provider === "instagram" && x.status === "published") && (
                  /* ★ 이 «영상»이 규격에 안 맞으면 버튼을 아예 두지 않는다 (2026-09-12 지시).
                     눌러서 실패하면 하루 한도 1개가 줄어든다 — 눌러 봐야 아는 것이 손해다. */
                  igReady.ok && it.ig && !it.ig.ok ? (
                    <div className="rounded-xl border border-n-200 bg-n-50 p-3">
                      <p className="t-caption font-semibold">인스타그램에 올리기</p>
                      <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
                        이 영상은 <b>올릴 수 없어요.</b> {it.ig.why}
                      </p>
                      <p className="mt-1.5 t-caption text-[var(--text-soft)]">
                        아래 <b>[하나 더 찍기]</b> 로 새로 찍으시면 올릴 수 있는 형식으로 저장돼요.
                      </p>
                    </div>
                  ) : igReady.ok ? (
                    <div className="rounded-xl border border-green-700 p-3">
                      <p className="t-caption font-semibold">인스타그램에 올리기</p>
                      <label className="mt-2 block">
                        <span className="t-caption text-[var(--text-soft)]">글 (비워 두면 질문·제목이 들어가요)</span>
                        <textarea
                          className="mt-1 w-full rounded-lg border border-n-300 p-2 t-caption"
                          rows={3}
                          value={cap[it.id] ?? it.question ?? it.title ?? ""}
                          onChange={(e) => setCap((p) => ({ ...p, [it.id]: e.target.value }))}
                          placeholder="손님에게 하고 싶은 말을 적어 주세요"
                        />
                      </label>
                      <TextMeter text={cap[it.id] ?? it.question ?? it.title ?? ""} providers={["instagram"]} className="mt-1" />
                      <button type="button" disabled={pubBusy === it.id}
                        onClick={() => void publish(it.id, ["instagram"])}
                        className="mt-2 rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                        {pubBusy === it.id ? "올리는 중…" : "인스타에 올리기"}
                      </button>
                      <p className="mt-1.5 t-caption leading-relaxed text-[var(--text-soft)]">
                        인스타가 영상을 받는 데 <b>최대 5분</b>이 걸려요. 이 화면을 열어 두시면 알아서 마무리돼요.
                      </p>
                    </div>
                  ) : igReady.why ? (
                    <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed text-[var(--text-soft)]">{igReady.why}</p>
                  ) : null
                )}

                {/* ★★ 틱톡 — **올릴 때마다 사장님이 직접 고른다** (2026-09-12 지시 8).
                    틱톡 심사 요건이라 [간단 등록]에 넣을 수 없다. 서버도 같은 규칙으로 막는다. */}
                {ttReady && !(it.posted ?? []).some((x) => x.provider === "tiktok" && x.status === "published") && (
                  /* ★ 규격에 안 맞는 영상이면 틱톡 버튼도 두지 않는다 — 인스타와 같은 검사다
                     (같은 파일이라 판정도 같다. 위 인스타 상자가 이미 이유를 적어 준다) */
                  it.ig && !it.ig.ok ? null
                  : ttReady.ok ? (
                    ttSheet?.entryId === it.id ? (
                      <div className="rounded-xl border border-green-700 p-3">
                        <p className="t-caption font-semibold">틱톡에 올리기</p>

                        {ttSheet.state === "loading" && (
                          <p className="mt-2 t-caption text-[var(--text-soft)]">틱톡에 물어보는 중…</p>
                        )}

                        {ttSheet.state === "error" && (
                          <>
                            <p className="mt-2 t-caption font-semibold text-danger">{ttSheet.why}</p>
                            <button type="button" onClick={() => void openTiktokSheet(it)}
                              className="mt-2 rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">다시 시도</button>
                          </>
                        )}

                        {ttSheet.state === "ready" && (
                          <>
                            {ttSheet.opt.nickname && (
                              <p className="mt-1 t-caption text-[var(--text-soft)]">
                                올라갈 계정: <b>{ttSheet.opt.nickname}</b>
                              </p>
                            )}

                            <label className="mt-2 block">
                              <span className="t-caption text-[var(--text-soft)]">제목</span>
                              <textarea
                                className="mt-1 w-full rounded-lg border border-n-300 p-2 t-caption" rows={3}
                                value={ttSheet.title}
                                onChange={(e) => setTtSheet({ ...ttSheet, title: e.target.value })}
                                placeholder="손님에게 하고 싶은 말을 적어 주세요"
                              />
                            </label>
                            <TextMeter text={ttSheet.title} providers={["tiktok"]} className="mt-1" />

                            {/* ★ 공개범위 — **틱톡이 준 것만** 보여 준다. 우리가 지어내지 않는다.
                                ★ 미리 골라 두지 않는다 — 사장님이 직접 눌러야 한다(심사 요건) */}
                            <p className="mt-3 t-caption font-semibold">누가 볼 수 있나요?</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {ttSheet.opt.privacyOptions.map((p) => {
                                /* ★★ 「브랜디드 콘텐츠」와 「나만 보기」는 **함께 못 쓴다** (규격서 C-⑤).
                                   틱톡이 「Either… OR」라 했고, **「나만 보기」를 비활성하는 쪽**을 골랐다 —
                                   그쪽이 간단하고, 이미 고른 값을 우리가 몰래 바꾸지 않아도 된다. */
                                const blocked = ttSheet.brandedContent && p === TT_PRIVATE;
                                return (
                                  <button key={p} type="button" disabled={blocked}
                                    title={blocked ? "Branded content visibility cannot be set to private." : undefined}
                                    onClick={() => setTtSheet({ ...ttSheet, privacy: p })}
                                    className={`rounded-full px-3.5 py-1.5 t-caption font-semibold ${
                                      ttSheet.privacy === p ? "bg-green-700 text-white" : "border border-n-300"} ${
                                      blocked ? "opacity-40" : ""}`}>
                                    {TT_PRIVACY_LABEL[p] ?? p}
                                  </button>
                                );
                              })}
                            </div>

                            {/* ★★ **「허용」으로 묻는다** (2026-09-12 틱톡 규격서 D).
                                「막기」로 물으면 아무것도 안 만졌을 때 댓글이 «열린 채로» 올라가
                                틱톡 요구(기본 전부 꺼짐)와 **반대**가 된다. 심사관도 이 라벨을 본다.
                                ★ 못 켜는 것도 **빼지 않고 회색으로** 보여 준다 — 아예 없으면
                                  심사관이 「비활성 처리를 했는지」 판단할 수 없다(규격서 F). */}
                            <div className="mt-3 space-y-1">
                              {([
                                ["okComment", "댓글 허용", ttSheet.opt.commentDisabled],
                                ["okDuet", "듀엣 허용", ttSheet.opt.duetDisabled],
                                ["okStitch", "이어찍기 허용", ttSheet.opt.stitchDisabled],
                              ] as const).map(([key, label, off]) => (
                                <label key={key} className={`flex items-center gap-2 t-caption ${off ? "opacity-40" : ""}`}>
                                  <input type="checkbox" className="h-4 w-4" disabled={off}
                                    checked={!off && ttSheet[key]}
                                    onChange={(e) => setTtSheet({ ...ttSheet, [key]: e.target.checked })} />
                                  {label}
                                  {off && <span className="text-[var(--text-soft)]">— 이 계정에서 꺼 두셨어요</span>}
                                </label>
                              ))}
                            </div>
                            <p className="mt-1.5 t-caption text-[var(--text-soft)]">
                              틱톡 규칙이라 처음에는 모두 꺼져 있어요. 원하시는 것만 켜 주세요.
                            </p>

                            {/* ★★ 상업용 콘텐츠 토글 (2026-09-12 틱톡 규격서 C) — **없으면 반려된다.**
                                ⚠ 기본은 **꺼짐**이고 사장님이 직접 켜야 한다.
                                ⚠ 켰는데 아무것도 안 고르면 올리기를 막는다(규격서 C-④). */}
                            <label className="mt-4 flex items-center gap-2 t-caption font-semibold">
                              <input type="checkbox" className="h-4 w-4" checked={ttSheet.commercial}
                                onChange={(e) => setTtSheet({
                                  ...ttSheet, commercial: e.target.checked,
                                  /* 끄면 안쪽 선택도 함께 지운다 — 안 보이는 값이 남아 나가면 안 된다 */
                                  ...(e.target.checked ? {} : { brandOrganic: false, brandedContent: false }),
                                })} />
                              이 영상이 나 자신·브랜드·상품·서비스를 홍보하나요?
                            </label>
                            <p className="mt-1 t-caption text-[var(--text-soft)]">
                              가게나 상품을 소개하는 영상이면 켜 주세요. 틱톡 규칙입니다.
                            </p>

                            {ttSheet.commercial && (
                              <div className="mt-2 rounded-lg border border-n-200 p-2.5">
                                <label className="flex items-start gap-2 t-caption">
                                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={ttSheet.brandOrganic}
                                    onChange={(e) => setTtSheet({ ...ttSheet, brandOrganic: e.target.checked })} />
                                  <span><b>내 브랜드</b> — 내 사업을 홍보합니다</span>
                                </label>
                                <label className="mt-1.5 flex items-start gap-2 t-caption">
                                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={ttSheet.brandedContent}
                                    onChange={(e) => setTtSheet({
                                      ...ttSheet, brandedContent: e.target.checked,
                                      /* ★ 브랜디드를 켜는 순간 「나만 보기」는 못 쓴다 — 이미 골랐으면 **되돌린다.**
                                         화면은 못 고르게 막는데 값만 남아 있으면 그것이 거짓말이다. */
                                      ...(e.target.checked && ttSheet.privacy === TT_PRIVATE ? { privacy: "" } : {}),
                                    })} />
                                  <span><b>브랜디드 콘텐츠</b> — 다른 브랜드·제3자를 홍보합니다</span>
                                </label>

                                {/* ★ 고른 것에 따라 **틱톡이 지정한 문구**를 그대로 보여 준다 */}
                                {(ttSheet.brandOrganic || ttSheet.brandedContent) && (
                                  <p className="mt-2 t-caption font-semibold">
                                    {ttSheet.brandedContent
                                      ? "Your photo/video will be labeled as ‘Paid partnership’"
                                      : "Your photo/video will be labeled as ‘Promotional content’"}
                                  </p>
                                )}
                                {ttSheet.brandedContent && ttSheet.privacy === "" && (
                                  <p className="mt-1 t-caption text-[var(--text-soft)]">
                                    Branded content visibility cannot be set to private.
                                    <br />브랜디드 콘텐츠는 「나만 보기」로 올릴 수 없어요. 다시 골라 주세요.
                                  </p>
                                )}
                                {!ttSheet.brandOrganic && !ttSheet.brandedContent && (
                                  <p className="mt-2 t-caption font-semibold text-danger">
                                    You need to indicate if your content promotes yourself, a third party, or both.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* ★★ Music Usage Confirmation — **버튼 «바로 위»에, 영어 원문 그대로.**
                                틱톡이 문장을 지정했다. 번역하면 심사관이 못 찾는다(규격서 B).
                                ★ 브랜디드를 켜면 문구가 **바뀐다** — 그것도 틱톡이 정한 것이다. */}
                            <p className="mt-4 t-caption font-semibold">
                              {ttSheet.brandedContent
                                ? "By posting, you agree to TikTok’s Branded Content Policy and Music Usage Confirmation"
                                : "By posting, you agree to TikTok’s Music Usage Confirmation"}
                            </p>
                            <p className="mt-0.5 t-caption text-[var(--text-soft)]">
                              올리시면 틱톡의 음악 사용 확인에 동의하시는 것이 됩니다.
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button"
                                disabled={!ttSheet.privacy || pubBusy === it.id
                                  || (ttSheet.commercial && !ttSheet.brandOrganic && !ttSheet.brandedContent)}
                                title={ttSheet.commercial && !ttSheet.brandOrganic && !ttSheet.brandedContent
                                  ? "You need to indicate if your content promotes yourself, a third party, or both."
                                  : undefined}
                                onClick={() => void publish(it.id, ["tiktok"], {
                                  title: ttSheet.title, privacyLevel: ttSheet.privacy,
                                  /* ★ 화면은 「허용」, 틱톡 API 는 「disable」 — **여기서 뒤집는다** */
                                  disableComment: !ttSheet.okComment, disableDuet: !ttSheet.okDuet, disableStitch: !ttSheet.okStitch,
                                  /* ★ 토글이 꺼져 있으면 둘 다 false 로 나간다 — 화면과 보내는 값이 같아야 한다 */
                                  brandOrganic: ttSheet.commercial && ttSheet.brandOrganic,
                                  brandedContent: ttSheet.commercial && ttSheet.brandedContent,
                                })}
                                className="rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                                {pubBusy === it.id ? "올리는 중…" : "이 내용으로 틱톡에 올리기"}
                              </button>
                              <button type="button" onClick={() => setTtSheet(null)}
                                className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold">취소</button>
                            </div>
                            {!ttSheet.privacy && (
                              <p className="mt-1.5 t-caption text-[var(--text-soft)]">
                                <b>누가 볼 수 있는지</b>를 고르셔야 올릴 수 있어요.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <button type="button" onClick={() => void openTiktokSheet(it)}
                        className="rounded-full border border-green-700 px-4 py-2 t-caption font-semibold text-green-700">
                        틱톡에 올리기
                      </button>
                    )
                  ) : ttReady.why ? (
                    <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed text-[var(--text-soft)]">{ttReady.why}</p>
                  ) : null
                )}

                {/* ★ SNS 올리기 — [SNS 연결]에서 고른 곳에만 올린다.
                    ⚠ 고른 곳이 없으면 이 칸 자체가 안 보인다. 눌러도 아무 일이 안 나는
                      버튼을 두지 않는다. */}
                {snsPicked.length > 0 && (
                  <div className="rounded-xl border border-n-200 p-3">
                    <p className="t-caption font-semibold">SNS {snsPicked.length}곳에 올리기</p>
                    {/* ★★ **실제로 나갈 글**을 그대로 보여 주고 센다 (2026-09-12 지시 6).
                        고른 곳이 여럿이면 «가장 짧은 곳» 기준이다 — 인스타에 맞춰 쓴 글이
                        X 에서 잘려도 사장님은 모른다. 넘어도 막지 않고 무엇을 줄일지만 말한다. */}
                    <TextMeter
                      text={it.question || it.title || ""}
                      providers={snsPicked as SnsProvider[]}
                      className="mt-1"
                    />
                    <button type="button" disabled={pubBusy === it.id}
                      onClick={() => void publish(it.id)}
                      className="mt-2 rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                      {pubBusy === it.id ? "올리는 중…" : "고른 곳에 올리기"}
                    </button>
                  </div>
                )}

                {/* ★★ 올리기 결과 — **카드 하나에 한 곳**. (2026-09-12)
                    전에는 이 줄이 「고른 곳에 올리기」 상자 «안»에 있었다. 그래서 새로 만든
                    [인스타에 올리기] 로 올리면 **결과가 아무 데도 안 보였다.** 밖으로 뺐다. */}
                {(pub[it.id] ?? []).map((r) => (
                  <div key={r.provider} className={`rounded-xl p-3 t-caption leading-relaxed ${
                    r.state === "failed" ? "bg-danger-soft font-semibold text-danger"
                    : r.state === "published" ? "bg-n-50 font-semibold text-green-700"
                    : "bg-n-50 text-[var(--text-soft)]"}`}>
                    <p>
                      {r.state === "published" ? `${r.name} 에 올라갔어요.` : `${r.name} · ${r.msg}`}
                      {r.url && <> <a href={r.url} target="_blank" rel="noreferrer" className="underline">[보기]</a></>}
                    </p>
                    {/* ★ 틱톡 요구 (규격서 D): 「올린 뒤 처리에 몇 분 걸릴 수 있다」를 **반드시 알린다.**
                        ⚠ 안 알리면 사장님이 프로필에서 못 찾고 「안 올라갔다」고 생각한다 —
                          그 상태에서 또 올리면 같은 영상이 두 번 올라간다. */}
                    {r.provider === "tiktok" && r.state === "published" && (
                      <p className="mt-1 font-normal">
                        틱톡에서 영상을 다듬는 데 몇 분 걸릴 수 있어요. 그동안 프로필에 안 보여도 정상입니다.
                      </p>
                    )}
                    {/* ★ 실패했을 때만 «그쪽이 준 말»을 함께 보여 준다.
                        사장님에게는 위 한 줄이면 되지만, **무엇을 고쳐야 하는지**는 이 원문에만 있다. */}
                    {r.state === "failed" && (r.detail || r.spec) && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer font-normal">자세한 이유 보기</summary>
                        {r.detail && (
                          <p className="mt-1 break-all font-normal" style={{ fontFamily: "var(--font-mono, monospace)" }}>{r.detail}</p>
                        )}
                        {r.spec && (
                          <p className="mt-1 font-normal">
                            잰 값 — 형식 {r.spec.container ?? "못 잼"}
                            {" · "}크기 {r.spec.bytes === null ? "못 잼" : `${Math.round(r.spec.bytes / 1048576)}MB`}
                            {" · "}가로 {r.spec.width === null ? "못 잼" : `${r.spec.width}px`}
                            {" · "}파일 구조 {r.spec.moovFirst === null ? "못 잼" : r.spec.moovFirst ? "정상" : "뒤집힘"}
                          </p>
                        )}
                      </details>
                    )}
                  </div>
                ))}
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
