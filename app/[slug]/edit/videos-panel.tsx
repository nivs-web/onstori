"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SHORTS_MAX, SHORTS_STYLES, SHORTS_STYLE_DEFAULT, SHORTS_ORDERS, SHORTS_ORDER_DEFAULT, STAGE_N_CHOICES, STAGE_N_MAX, CARDS_N_CHOICES, CARDS_N_DEFAULT, type ShortsStyle, type ShortsOrder } from "@/config/shorts";
import type { SectionT, SiteDocT } from "@/lib/schema";
import { StoryLinkButton } from "./story-link";
import { SnsPanel } from "./sns-panel";
import { ReviewSheet } from "./review-sheet";
import { sayPost, providerName, josa } from "@/lib/sns/status-say";
import { SNS_EDIT_NOTICE, SNS_GROWTH_NOTE, SNS_DELETE_SCOPE, SNS_DELETE_BUTTON, SNS_DELETE_ASK } from "@/lib/sns/copy";
import { TextMeter } from "./text-meter";
import type { SnsProvider } from "@/lib/sns/types";
import {
  SNS_DEFAULTS, composeCaption, normalizeTags, TEXT_MAX, TAGS_MAX,
  type SnsDefaults,
} from "@/lib/sns-defaults";

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
 *
 * ★★ **2026-09-16 — 「한 편만」이 끝났다.** 홈페이지는 `video_out_key` 가 있는 영상을
 *   **전부** 숏폼 피드로 보여 준다(`lib/shorts.ts`). 여기서도 여러 편을 걸고, 내릴 때는
 *   **그 한 편만** 내린다. 옛 주석의 「한 편만 · 바꾸시겠습니까」는 폐기됐다.
 *
 * ★★ **「한 방 등록」이 이 화면의 중심이다** (2026-09-16 대표님 지시).
 *   글·해시태그를 한 번 정해 두면 영상마다 다시 안 적는다. 버튼 하나로
 *   홈페이지 + 인스타 + 틱톡이 함께 나간다.
 *   🔴 **틱톡의 «공개범위»만은 매번 묻는다.** 미리 골라 두면 틱톡 심사에서 떨어진다
 *     (`lib/sns/tiktok.ts` 의 `canPrefill:false`). 우리 기술이 아니라 **틱톡 규정**이다.
 */

type Item = {
  id: string;
  title: string;
  question: string;
  date: string;
  poster: string | null;
  preview: string | null;
  publicUrl: string | null;
  /**
   * ★ **지금 홈페이지에 걸려 있나** — 서버가 `video_out_key` 로 판정해 준다 (2026-09-16).
   *   ⚠ 옛 화면은 「doc 의 video 섹션 url 과 같은가」로 봤다. 홈페이지가 영상을 «여러 편»
   *     보여 주게 되면서 그 판정이 틀렸다 — 서버 판정을 그대로 쓴다.
   */
  attached?: boolean;
  /** ★ 누르기 «전»에 잰 인스타 가능 여부 (2026-09-12). 서버가 준다 */
  ig?: { ok: boolean; why: string };
  /** ⚠ **완성도 점수를 세는 칸**이다(lib/score.ts). 화면의 스위치로 쓰지 마라 — 점수가 조용히 바뀐다 */
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
  /** 🔴 사장님이 고른 숏폼 모양 (지시 [42] §4). 서버가 목록과 함께 알려 준다 */
  const [style, setStyle] = useState<ShortsStyle>(SHORTS_STYLE_DEFAULT);
  const [order, setOrder] = useState<ShortsOrder>(SHORTS_ORDER_DEFAULT);
  /** 🔴 숏폼형태가 «가두는» 편수 — 사장님이 5~10 에서 고른다(2026-09-17 대표님) */
  const [stageN, setStageN] = useState<number>(STAGE_N_MAX);
  /** 🔴 카드형태가 «늘어놓는» 편수 — 10~40 에서 고른다(2026-09-18 대표님 B-17) */
  const [cardsN, setCardsN] = useState<number>(CARDS_N_DEFAULT);
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleMsg, setStyleMsg] = useState("");
  const [loadErr, setLoadErr] = useState("");
  /** 🔴 「인스타에서 안 보이는」 글 수 — **지워졌다고 단정하지 않는다**(지시 [48]①) */
  const [snsSuspect, setSnsSuspect] = useState(0);
  /** 🔴 서버가 세어 준 «걸린 전체 편수». 목록은 잘려 오므로 이 수로만 판단한다 */
  const [attachedTotal, setAttachedTotal] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);
  const [dur, setDur] = useState<Record<string, number>>({});
  /**
   * 영상 메뉴 안의 **세 갈래** — 「내 영상」·「영상 설정」·「SNS 연결」 (2026-09-18 대표님 B-14)
   * ⚠ 첫 화면은 **언제나 「내 영상」**이다. 사장님이 여기 오시는 까닭은 «올리는 일»이다.
   */
  const [view, setView] = useState<"list" | "settings" | "sns">("list");
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

  /* ══ 「한 방 등록」 (2026-09-16 대표님 지시) ══════════════════════════════
     대표님 말씀: 「인스타 릴스 각각 설정 넣고 등록하기 누르고, 또 틱톡도 각각 설정하고 —
     이게 무슨 한 방 등록이야.」 글·해시태그·영상은 **공통**이니 한 번 적고 한 번에 나가야 한다.
     ⚠ 아래 개별 상자(인스타·틱톡)는 **그대로 둔다.** 채널마다 다르게 쓰고 싶은 분의 길이다. */
  const [sd, setSd] = useState<SnsDefaults>(SNS_DEFAULTS);
  const [sdOpen, setSdOpen] = useState(false);
  const [sdSaved, setSdSaved] = useState<"" | "saving" | "ok" | "fail">("");
  /** 설정을 한 번이라도 저장하셨나 — 아직이면 카드를 펼쳐 둔다(처음 오신 분이 그냥 지나치지 않게) */
  const [sdReady, setSdReady] = useState(false);

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
      const got = (await r.json()) as { items: Item[]; softDeleteReady?: boolean; attachedTotal?: number | null; shortsStyle?: ShortsStyle; shortsOrder?: ShortsOrder; stageN?: number; cardsN?: number };
      setItems(got.items);
      if (got.shortsStyle) setStyle(got.shortsStyle);
      if (got.shortsOrder) setOrder(got.shortsOrder);
      if (typeof got.stageN === "number") setStageN(got.stageN);
      if (typeof got.cardsN === "number") setCardsN(got.cardsN);
      /* ⚠ 「지우기」 칸이 아직 없으면 그 버튼을 안 그린다 */
      if (got.softDeleteReady === false) setCanDelete(false);
      /* 🔴 서버가 세어 준 «걸린 전체 편수» — 목록은 잘려 오므로 이 수로만 판단한다 */
      setAttachedTotal(typeof got.attachedTotal === "number" ? got.attachedTotal : null);
    } catch {
      setLoadErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
      setItems([]);
    }
  }, [slug]);

  /**
   * 🔴 **「그 영상 아직 SNS 에 살아 있나」를 화면이 뜬 «뒤»에 한 번 물어본다.** (2026-09-17 지시 [48]①)
   *
   * ⚠ 목록을 받을 때 같이 물어보면 **인스타에 다녀오는 시간만큼 목록이 늦게 뜬다** —
   *   사장님이 빈 화면을 몇 초 본다. 그래서 **목록을 먼저 보여 주고** 뒤에서 조용히 확인한다.
   * ★ 지워진 것이 나오면 **그때 목록을 다시 읽어** 화면이 스스로 고쳐진다.
   * ⚠ 실패는 **조용히 넘어간다** — 이것 때문에 편집화면이 시끄러우면 안 된다.
   */
  const recheckSns = useCallback(async () => {
    try {
      const r = await fetch("/api/site/videos/recheck", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId }),
      });
      const d = (await r.json().catch(() => ({}))) as { suspect?: number };
      /* ⚠ 「없다」는 답은 **지워졌다는 뜻이 아니다** — 우리 토큰으로 안 보인다는 뜻이다
         (비공개·권한일 수도 있다. `recheck/route.ts` 주석 참조).
         그래서 **감추지 않고 사장님께 「확인해 보세요」라고만** 말한다. */
      if (r.ok && (d.suspect ?? 0) > 0) setSnsSuspect(d.suspect ?? 0);
    } catch { /* 못 물어봤으면 그만이다 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, anonId]);

  /* ⚠ 이펙트 «본문»에서 곧바로 setState 하면 렌더가 연쇄로 돈다(load 의 첫 줄이 setLoadErr 다).
     한 틱 뒤에 부른다 — 그동안은 「불러오는 중…」이 떠 있다. */
  useEffect(() => {
    /* ★ 목록을 «먼저» 띄우고, 그 뒤에 「SNS 에 아직 살아 있나」를 조용히 물어본다(지시 [48]①) */
    const t = window.setTimeout(() => { void load().then(() => recheckSns()); }, 0);
    return () => window.clearTimeout(t);
  }, [load, recheckSns]);

  /**
   * ★★ **녹화 화면에서 «한 방에 올리기»를 누르고 넘어온 경우** (2026-09-17 지시 [17]).
   *
   *   `/{상호}/edit?tab=video&oneshot={영상id}` 로 들어오면 **사장님이 한 번 더 누르지 않아도**
   *   그 영상의 「한 방에 올리기」가 저절로 돕니다.
   *
   * ★ 대표님 원문: 「왜 `/edit` 으로 이동한 다음에 한 방에 올리기를 **또 눌러야** 하는지
   *   이해할 수 없다.」 — 맞는 말씀이라 **두 번째 누르기를 없앴습니다.**
   *
   * ⚠ **왜 녹화 화면 «그 자리»에서 안 올리나:** 녹화 화면은 문자 링크(서명)로 들어오는 곳이라
   *   **«이 사람이 주인인가»를 모릅니다.** SNS 올리기는 주인만 할 수 있어야 하는데(`loadOwnedSite`),
   *   서명만으로 올리게 열면 **링크를 받은 누구나 사장님 SNS 에 글을 올릴 수 있게** 됩니다.
   *   그래서 «주인임이 확인되는 곳»(편집화면)으로 데려와 거기서 저절로 돌립니다.
   *
   * ⚠ **딱 한 번만** 돕니다. `ranOneShot` 이 그것을 지킵니다 — 안 그러면 목록이 다시 그려질 때마다
   *   또 올라갑니다(같은 영상이 SNS 에 여러 번 올라가는 사고).
   * ⚠ 주소에서 그 표시를 **지웁니다.** 안 지우면 새로고침할 때마다 또 올라갑니다.
   */
  const ranOneShot = useRef(false);
  useEffect(() => {
    if (ranOneShot.current || !items || !sdReady) return;
    const want = new URLSearchParams(window.location.search).get("oneshot");
    if (!want) return;
    const it = items.find((x) => x.id === want);
    ranOneShot.current = true;
    /* 주소를 먼저 지운다 — 올리다 실패해도 새로고침으로 또 올라가지 않게 */
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("oneshot");
      window.history.replaceState(null, "", u.toString());
    } catch { /* 주소를 못 고쳐도 위 ranOneShot 이 막는다 */ }
    /* ⚠ `setErr` 를 쓰면 **안 보인다** — 그 메시지는 «그 영상 줄 옆»에 붙는데, 못 찾은 영상에는
       붙을 줄이 없다(2026-09-17 실측으로 잡았다). 목록 위에 뜨는 `loadErr` 를 쓴다. */
    if (!it) { setLoadErr("방금 찍으신 영상을 목록에서 못 찾았어요. 아래 목록에서 직접 [⚡ 한 방에 올리기] 를 눌러 주세요."); return; }
    void oneShot(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sdReady]);

  /* ★ 「한 방 등록」 기본 설정을 읽어 온다. 못 읽어도 기본값으로 돈다 — 화면이 멈추지 않는다 */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let anonId = "";
        try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 사생활 보호 모드 */ }
        const r = await fetch("/api/site/sns-defaults", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, anonId, read: true }),
        });
        const d = (await r.json().catch(() => ({}))) as { defaults?: SnsDefaults; configured?: boolean };
        if (!alive || !d.defaults) return;
        setSd(d.defaults);
        setSdReady(!!d.configured);
        /* 아직 한 번도 안 정하셨으면 펼쳐 둔다 — 「한 방」의 값어치는 채워 넣어야 생긴다 */
        if (!d.configured) setSdOpen(true);
      } catch { /* 기본값으로 간다 */ }
    })();
    return () => { alive = false; };
  }, [slug]);

  /** 기본 설정 저장 — 한 칸만 보내도 나머지는 서버가 지킨다 */
  async function saveDefaults(next: Partial<SnsDefaults>) {
    const merged = { ...sd, ...next };
    setSd(merged);
    setSdSaved("saving");
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 무시 */ }
      const r = await fetch("/api/site/sns-defaults", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, ...merged }),
      });
      setSdSaved(r.ok ? "ok" : "fail");
      if (r.ok) setSdReady(true);
    } catch { setSdSaved("fail"); }
  }

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
  /**
   * 🔴🔴 **유튜브도 같은 판정.** (2026-09-19 — 유튜브 API 감사 신청용 화면)
   *
   * ★ **뒷단은 이미 다 있었다.** 새로 만든 것이 없다 —
   *   `lib/sns/index.ts`(열림) · `youtube.ts`(어댑터) · `db.ts`(하루 1개 한도) ·
   *   `youtube-gate.ts`(문) · `api/sns/publish`(어댑터 호출). **화면에만 길이 없었다.**
   * 🔴 **`isAvailable` 안에 «문»이 들어 있다**(`youtube.ts:137` → `canUpload`).
   *   ⇒ 여기 `ok` 가 참인 것은 **그 사이트가 올려도 되는 곳**이라는 뜻이다.
   *     감사 전 아무 사장님 계정에 단추가 뜨는 일은 **구조적으로** 생기지 않는다.
   */
  const [ytReady, setYtReady] = useState<{ ok: boolean; why: string } | null>(null);

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

  /**
   * @param prefill 「한 방에 올리기」가 넘겨 주는 글. 제목은 `canPrefill: true` 라 미리 채워도 된다.
   *   ⚠ **공개범위는 절대 미리 고르지 않는다** — 그건 `canPrefill: false` 다(틱톡 심사 요건).
   */
  async function openTiktokSheet(it: Item, prefill?: string) {
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
        title: prefill ?? (it.question || it.title || ""),
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
        if (!r.ok) { if (alive) { setIgReady({ ok: false, why: "" }); setYtReady({ ok: false, why: "" }); } return; }
        type Row = { provider: string; name: string; available: { ok: boolean; why?: string }; connection: { status: string; disclaimerAgreedAt: string | null } | null };
        const d = (await r.json()) as { items?: Row[] };
        if (!alive) return;
        /* 인스타·틱톡을 **같은 규칙**으로 판정한다 — 한쪽만 고치면 다른 쪽이 조용히 어긋난다 */
        const verdict = (p: string, label: string): { ok: boolean; why: string } => {
          const row = d.items?.find((x) => x.provider === p);
          if (!row) return { ok: false, why: "" };
          if (!row.available.ok) return { ok: false, why: row.available.why ?? "" };
          if (!row.connection || row.connection.status !== "active") {
            /* ⚠ 받침에 맞는 조사를 쓴다 — 「유튜브 쇼츠을」 같은 말이 **심사관 화면에** 뜬다
               (2026-09-13 감사 준비 중 발견). 판정은 lib/sns/status-say.ts 의 josa() 한 곳에 있다. */
            return { ok: false, why: `[SNS 연결] 에서 ${label}${josa(label, "을/를")} 먼저 연결해 주세요.` };
          }
          if (!row.connection.disclaimerAgreedAt) {
            return { ok: false, why: "[SNS 연결] 에서 [올려도 좋아요]를 먼저 눌러 주세요." };
          }
          return { ok: true, why: "" };
        };
        setIgReady(verdict("instagram", "인스타그램"));
        setTtReady(verdict("tiktok", "틱톡"));
        setYtReady(verdict("youtube", "유튜브 쇼츠"));
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
      } catch { if (alive) { setIgReady({ ok: false, why: "" }); setTtReady({ ok: false, why: "" }); setYtReady({ ok: false, why: "" }); } }
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
   * 영상관리 — 고치기·순서·지우기. (2026-09-12 지시 D2)
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

  /**
   * 🔴 **모양 바꾸기.** (2026-09-17 지시 [42] §4)
   * ⚠ **먼저 화면을 바꾸고** 서버에 보낸다 — 누르자마자 반응이 있어야 한다.
   *   실패하면 **되돌리고 사실대로 말한다**(조용히 삼키면 바뀐 줄 안다).
   */
  async function chooseShorts(patch: { style?: ShortsStyle; order?: ShortsOrder; stageN?: number; cardsN?: number }) {
    if (styleBusy) return;
    if (patch.style && patch.style === style) return;
    if (patch.order && patch.order === order) return;
    if (patch.stageN && patch.stageN === stageN) return;
    if (patch.cardsN && patch.cardsN === cardsN) return;
    const before = { style, order, stageN, cardsN };
    if (patch.style) setStyle(patch.style);
    if (patch.order) setOrder(patch.order);
    if (patch.stageN) setStageN(patch.stageN);
    if (patch.cardsN) setCardsN(patch.cardsN);
    setStyleBusy(true); setStyleMsg("");
    try {
      const r = await fetch("/api/site/shorts-style", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, ...patch }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setStyle(before.style); setOrder(before.order); setStageN(before.stageN); setCardsN(before.cardsN); setStyleMsg(d.error ?? "바꾸지 못했어요."); return; }
      setStyleMsg("바꿨어요. 홈페이지를 열어 보시면 바로 보입니다.");
    } catch {
      setStyle(before.style); setOrder(before.order); setStageN(before.stageN); setCardsN(before.cardsN);
      setStyleMsg("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
    } finally { setStyleBusy(false); }
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
        /* ★★★ **검토 화면이 준 값은 «비어 있어도» 그대로 싣는다.** (2026-09-13 점검에서 잡힌 것)
           ⚠ 전에는 `captionOverride?.trim() || cap[...]` 이라 **빈 글이 «안 보낸 것»으로** 취급돼,
             간단등록 칸에 남아 있던 옛 글이나 서버의 질문 문장이 대신 올라갔다.
             화면은 「(아직 아무것도 없어요)」라고 말한 뒤 다른 글을 올린 셈이다 — 이 화면이
             생긴 이유(질문 문장이 그대로 올라간 사고) 자체를 되살리는 자리였다. */
        body: JSON.stringify({
          slug, anonId, entryId, providers: send,
          caption: captionOverride ?? (cap[entryId]?.trim() || undefined),
          tiktok,
        }),
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

  /**
   * ★★ 홈페이지에서 **이 영상만** 내린다. (2026-09-16)
   *   서버가 `video_out_key` 를 비우면 숏폼 피드에서 사라진다.
   *   ⚠ 파일은 안 지운다 — 다시 걸면 바로 올라온다. 「안 보이게」와 「없애기」는 다른 일이다.
   *   ⚠ 지금 doc 의 video 섹션이 «이 영상»이었으면 그 섹션도 함께 뺀다 — 안 그러면
   *     옛 길(피드가 비었을 때)로 그 한 편이 계속 보인다.
   */
  async function detach(it: Item) {
    setBusyId(it.id); setErr(null);
    try {
      let anonId = "";
      try { anonId = localStorage.getItem("onstori:anonId") ?? ""; } catch { /* 무시 */ }
      const r = await fetch("/api/site/video/manage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId, entryId: it.id, action: "detach" }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErr({ id: it.id, msg: d.error ?? `내리지 못했어요 (${r.status})` });
        return;
      }
      if (it.publicUrl && it.publicUrl === attachedUrl) onDetach();
      await load();
    } catch {
      setErr({ id: it.id, msg: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusyId(null);
    }
  }

  /**
   * ★★ **한 방에 올리기** — 이 화면의 중심 기능이다. (2026-09-16 대표님 지시)
   *
   *   ① 홈페이지에 건다 (아직 안 걸렸으면)
   *   ② 저장된 글 + 해시태그로 SNS 에 한 번에 보낸다
   *   ③ 🔴 틱톡이 끼어 있으면 **공개범위만** 고르는 시트를 연다 — 제목은 이미 채워져 있다
   *
   * 🔴 **왜 틱톡만 한 번 더 묻나 — 틱톡 규정이다.**
   *   틱톡 심사는 「사장님이 **매번 스스로** 공개범위를 골랐는가」를 본다.
   *   미리 골라 두면 그 하나로 심사에서 떨어진다(`lib/sns/tiktok.ts` 의 `canPrefill:false`).
   *   기술로는 한 번에 되지만 **규정이 막는다.** 그래서 「인스타·홈페이지는 즉시,
   *   틱톡은 한 번 더 누르기」가 지금 만들 수 있는 가장 짧은 길이다.
   *
   * ⚠ 이미 올린 곳은 **뺀다.** 서버가 중복을 막지만, 빼고 보내야 「이미 올렸어요」가 안 뜬다.
   * ⚠ 규격에 안 맞는 영상(`it.ig.ok === false`)이면 SNS 는 건너뛰고 홈페이지만 건다 —
   *   눌러서 실패하면 그날 한도가 줄어든다.
   */
  async function oneShot(it: Item) {
    setErr(null);
    const already = new Set((it.posted ?? []).filter((x) => x.status === "published").map((x) => x.provider));
    const badSpec = !!it.ig && !it.ig.ok;

    /* ① 홈페이지 */
    const attachedNow = it.attached ?? (!!it.publicUrl && it.publicUrl === attachedUrl);
    if (sd.home && !attachedNow) await attach(it);

    if (badSpec) {
      setErr({ id: it.id, msg: `홈페이지에는 걸었어요. 다만 이 영상은 SNS 규격에 안 맞아요 — ${it.ig?.why ?? ""}` });
      return;
    }

    /* ② 어디로 보낼까 — 저장된 채널 중 «아직 안 올린 곳»만 */
    const want = sd.providers.filter((p) => !already.has(p));
    if (want.length === 0) {
      if (!sd.home) setErr({ id: it.id, msg: "올릴 곳이 없어요. 아래 [한 방 등록 설정]에서 채널을 골라 주세요." });
      return;
    }

    const caption = composeCaption(sd, it.question || it.title || "");

    /* ③ 틱톡이 끼어 있으면 — 공개범위를 먼저 받는다(규정) */
    if (want.includes("tiktok")) {
      /* 틱톡 말고 먼저 보낼 수 있는 곳은 지금 보낸다 — 기다릴 이유가 없다 */
      const rest = want.filter((p) => p !== "tiktok");
      if (rest.length) await publish(it.id, rest, undefined, caption);
      await openTiktokSheet(it, caption);
      return;
    }

    await publish(it.id, want, undefined, caption);
  }

  async function attach(it: Item) {
    /* ★ 2026-09-16 — **묻지 않는다.** 전에는 「지금 걸린 것을 이 영상으로 바꿀까요?」를 물었다.
       한 편만 걸리던 시절의 말이다. 이제 여러 편이 함께 걸리므로 바꾸는 것이 아니라 «더하는» 것이다. */
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
    /* ★ `id="video-list"` — 녹화 화면이 `#video-list` 로 **이 자리까지** 데려온다 (2026-09-17 지시 [17]).
       대표님: 「여기로 이동하면 «이건 뭐지?» 라고 느끼지 않겠니?」 — 느끼십니다. 그래서 앵커를 답니다.
       ⚠ `data-tour` 는 그대로 둔다. 그건 투어·완성도 힌트의 이름이고(규칙 3), 이 `id` 는 스크롤용이다.
         둘은 목적이 달라 한 자리에 같이 있어도 된다. */
    <div id="video-list" className="flex gap-2" data-tour="panel-video" style={{ scrollMarginTop: "var(--s-8)" }}>
      {/* 🔴 **순서가 곧 «자주 쓰는 차례»다**(대표님 B-14). 「내 영상」이 맨 앞이다 */}
      {([["list", "내 영상"], ["settings", "영상 설정"], ["sns", "SNS 연결"]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setView(id)}
          className={`rounded-full px-4 py-2 t-caption font-semibold ${
            view === id ? "bg-green-700 text-white" : "border border-n-300"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  /**
   * 🔴🔴 **「영상 설정」 — 한 번 정하면 끝인 것들을 «따로» 둔다.** (2026-09-18 대표님 지시 B-14)
   *
   * > 대표님: 「edit 영상 메뉴를 **(내 영상) (영상 설정) (SNS 연결)** 셋으로.
   * >   **「내 영상」엔 영상 목록 + 「한 방에 올리기」가 «바로»** 보이게.
   * >   숏폼스타일·재생순서·이름바꾸기는 **「영상 설정」**으로」
   *
   * ⚠⚠ **왜 옮기나:** 설정은 **한 번 정하면 끝**인데 그것이 목록 «위»에 있어서,
   *   영상을 올리러 오신 사장님이 **매번 그 큰 칸을 지나쳐야** 했다.
   *   ⇒ 「내 영상」을 열면 **올리는 일이 제일 먼저** 보이게 한다.
   * ⚠ 내용은 **한 줄도 바꾸지 않았다. 자리만 옮겼다** — 그래야 뭔가 어긋났을 때
   *   «옮기기가 잘못됐는지 내용이 잘못됐는지»를 가를 수 있다([42] §1 에서 배운 것).
   * ⚠ **「이름 바꾸기」(B-15)는 아직 없다.** 만들면 이 탭에 들어온다.
   * ★ 목록을 불러오는 «동안»에도 들어올 수 있게 `items === null` 검사 **위**에 둔다.
   */
  if (view === "settings") {
    return (
      <div className="space-y-4">
        {tabs}
        {/**
          * 🔴🔴 **「숏폼 스타일 선택」 — 사장님이 «모양»을 고르는 자리.** (2026-09-17 지시 [42] §4)
          *
          * ★ **왜 여기인가:** 고르는 것이 **사이트마다**라 사장님 화면이 자연스럽다.
          *   대표님 원문은 「홈페이지 관리자 - 어드민 - 영상 - "숏폼 스타일 선택"」인데
          *   「관리자」가 사장님인지 우리인지 갈려 **권반장이 대표님께 여쭙는 중**이다.
          *   ⇒ **사장님 쪽을 «주»로 먼저 만든다**(권반장이 정함). 어드민 표는 그 뒤다.
          *
          * ⚠⚠ **설명글은 «대표님이 쓰신 문장 그대로»다. 다듬지 마라.**
          *   (`fable51plandept/handoff/2026-09-17-숏폼시네마/00-기획서-대표님확인용.md` §1-1)
          * 🔴 **「몰입모드」·「숏폼시네마」라는 낱말을 여기 쓰지 않는다**(권반장이 정함) —
          *   **우리끼리 부르는 이름**이라 사장님도 모른다. **무엇이 일어나는지**로 쓴다.
          * ★ **그림으로 한눈에** — 세로/가로 방향을 작은 그림으로 보여 준다(글보다 빠르다).
          */}
        <section data-tour="panel-shorts-style" className="space-y-3 rounded-2xl border border-n-200 p-4">
          <div>
            <p className="t-body font-bold">숏폼 스타일 선택</p>
            <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
              홈페이지에서 영상을 <b>어떤 모양으로</b> 보여 드릴지 고르세요. 언제든 바꿀 수 있어요.
            </p>
            {/**
              * 🔴 **대표님이 주신 문장 그대로다. 다듬지 마라.** (2026-09-18 지시 B-16)
              * > 「기존 문구 아래에 **「어떤 영상이든 영상을 클릭하면 몰입모드로 바뀌고,
              * >   몰입모드에서는 모든 영상이 재생됩니다」** — **몰입모드 존재를 각인시키는 목적**」
              *
              * ⚠ **「몰입모드」라는 낱말이 여기에는 있어도 된다.** 2026-09-18 대표님 B-18 로
              *   규칙이 «완화»되었다 — 「**사장님은 몰입모드·숏폼시네마를 알아도 됨.
              *   홈페이지 방문 «손님»에게만** 굳이 안 알려도 된다」.
              * 🔴 **손님 화면(`components/sections/*`)에는 여전히 쓰지 않는다.** 여기는 사장님 화면이다.
              */}
            <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
              어떤 영상이든 영상을 클릭하면 몰입모드로 바뀌고, 몰입모드에서는 모든 영상이 재생됩니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SHORTS_STYLES.map((o) => {
              const on = style === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => chooseShorts({ style: o.key })}
                  disabled={styleBusy}
                  aria-pressed={on}
                  className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${on ? "border-green-700 bg-n-50" : "border-n-200"}`}
                >
                  <span className="flex items-center gap-2">
                    {/* 고른 것에 동그라미 — 라디오처럼 보이게(하나만 고른다는 뜻) */}
                    <span className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-green-700" : "border-n-300"}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-green-700" />}
                    </span>
                    <b className="t-body">{o.label}</b>
                    {/* 🔴 **고른 값을 그대로 보여 준다.** 고정 숫자(10·20)를 적어 두면 사장님이 5편으로
                        바꾸셨을 때 화면이 거짓말을 한다(불변 규칙 12) */}
                    <span className="t-caption text-[var(--text-soft)]">최근 {o.key === "shorts" ? stageN : cardsN}편</span>
                  </span>

                  {/* ★ 그림 한 장 — 세로로 넘기나(숏폼형태) 옆으로 넘기나(카드형태) */}
                  <span aria-hidden className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-n-100 p-3">
                    {o.key === "shorts" ? (
                      <span className="flex flex-col items-center gap-1">
                        <span className="block h-3 w-10 rounded bg-n-300" />
                        <span className="block h-10 w-10 rounded bg-n-400" />
                        <span className="block h-3 w-10 rounded bg-n-300" />
                        <span className="t-caption font-semibold text-[var(--text-soft)]">↓ 세로로</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1">
                          <span className="block h-10 w-4 rounded bg-n-300" />
                          <span className="block h-12 w-9 rounded bg-n-400" />
                          <span className="block h-10 w-4 rounded bg-n-300" />
                        </span>
                        <span className="t-caption font-semibold text-[var(--text-soft)]">→ 옆으로</span>
                      </span>
                    )}
                  </span>

                  {/* 🔴 **대표님이 쓰신 문장 그대로**(기획서 §1-1). 줄이거나 다듬지 마라 */}
                  <span className="mt-3 block t-caption font-bold leading-relaxed">&ldquo;{o.headline}&rdquo;</span>
                  {o.body.map((line) => (
                    <span key={line} className="mt-2 block t-caption leading-relaxed text-[var(--text-soft)]">{line}</span>
                  ))}
                </button>
              );
            })}
          </div>

          {/**
            * 🔴 **가두는 편수 — 5~10편.** (2026-09-17 대표님 지시)
            *
            * > 「스크롤에 갇히는 거 몇 개로 할지 설정할 수 있게 … **최소 5개에서 최대 10개 중에 고를 수 있음.**
            * >   숏폼형태 10개면 **너무 많이 영상이 가려서 사장님들이 답답해 할 수 있으니까**」
            *
            * ⚠ **숏폼형태일 때만** 뜬다 — 카드형태는 스크롤을 안 가두므로 이 숫자가 뜻이 없다.
            * ⚠ 카드형태 20편은 **대표님 지시로 그대로** 둔다(고르는 칸을 안 만든다).
            */}
          {style === "shorts" && (
            <div className="border-t border-n-200 pt-3">
              <p className="t-body font-bold">가두는 영상 수</p>
              <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
                손님이 <b>몇 편까지 보고</b> 홈페이지의 다음 부분으로 내려가게 할지 고르세요.
                <br />숫자가 클수록 영상을 더 많이 보시지만, <b>홈페이지의 다른 내용이 그만큼 늦게</b> 나옵니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STAGE_N_CHOICES.map((n) => {
                  const on = stageN === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => chooseShorts({ stageN: n })}
                      disabled={styleBusy}
                      aria-pressed={on}
                      className={`min-w-[52px] rounded-xl border px-3 py-2 t-caption font-bold transition disabled:opacity-60 ${on ? "border-green-700 bg-n-50" : "border-n-200"}`}
                    >
                      {n}편
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/**
            * 🔴 **카드형태가 늘어놓는 편수 — 10~40편.** (2026-09-18 대표님 지시 B-17)
            *
            * > 「카드형태 편수 선택 — **10 / 15 / 20 / 25 / 30 / 40** 중 고르게 (최저 10, 최대 40)」
            *
            * ⚠ **카드형태일 때만** 뜬다 — 숏폼형태에는 「가두는 편수」(위 칸)가 그 몫이다.
            * ⚠ 숫자를 여기 박지 않는다 — `config/shorts.ts` 의 `CARDS_N_CHOICES` 를 돌려 그린다.
            * ★ 숏폼형태(5~10)보다 **넉넉히 열어 둔 까닭**은 카드형태가 **스크롤을 안 가두기** 때문이다.
            *   많아도 손님이 답답하지 않다 — 옆으로 넘기다 말면 그만이다.
            */}
          {style === "cards" && (
            <div className="border-t border-n-200 pt-3">
              <p className="t-body font-bold">보여 드릴 영상 수</p>
              <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
                홈페이지의 카드 줄에 <b>최근 몇 편까지</b> 늘어놓을지 고르세요.
                <br />여기서 자르더라도 <b>영상을 클릭하면 올려 두신 영상이 전부</b> 이어서 재생됩니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CARDS_N_CHOICES.map((n) => {
                  const on = cardsN === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => chooseShorts({ cardsN: n })}
                      disabled={styleBusy}
                      aria-pressed={on}
                      className={`min-w-[52px] rounded-xl border px-3 py-2 t-caption font-bold transition disabled:opacity-60 ${on ? "border-green-700 bg-n-50" : "border-n-200"}`}
                    >
                      {n}편
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/**
            * 🔴 **재생 순서.** (지시 [42] §5 · 대표님 기획서 §1-2)
            * ⚠ **목록을 여기 박지 않는다** — `config/shorts.ts` 의 `SHORTS_ORDERS` 를 돌려 그린다.
            *   대표님이 **「옵션이 더 늘어난다」**고 하셔서, 늘 때 **그 배열에 한 줄만** 더하면 되게 뒀다.
            */}
          <div className="border-t border-n-200 pt-3">
            <p className="t-body font-bold">재생 순서</p>
            <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
              손님이 홈페이지에 들어왔을 때 <b>어떤 차례로</b> 보여 드릴지 고르세요.
            </p>
            <div className="mt-3 space-y-2">
              {SHORTS_ORDERS.map((o) => {
                const on = order === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => chooseShorts({ order: o.key })}
                    disabled={styleBusy}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-60 ${on ? "border-green-700 bg-n-50" : "border-n-200"}`}
                  >
                    <span className={`mt-0.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-green-700" : "border-n-300"}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-green-700" />}
                    </span>
                    <span>
                      <b className="t-caption">{o.label}</b>
                      <span className="mt-0.5 block t-caption leading-relaxed text-[var(--text-soft)]">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {/* ⚠ 「왜 새로고침해도 안 바뀌나」를 미리 답해 둔다 — 안 그러면 「고장났나?」 한다 */}
            {order !== "newest" && (
              <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                손님 한 분에게는 <b>보시는 동안 순서가 바뀌지 않습니다.</b> 새로 오시면 그때 다시 섞입니다.
              </p>
            )}
          </div>

          {styleMsg && <p className="t-caption font-semibold">{styleMsg}</p>}
        </section>
      </div>
    );
  }

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

  /**
   * 🔴 지금 «홈페이지에 걸린» 편수 — **서버가 따로 세어 준 수**를 쓴다.
   * ⚠⚠ **목록 길이로 세면 안 된다.** 목록은 이미 `SHORTS_MAX` 로 잘려서 오기 때문에
   *   25편을 거셔도 20줄뿐이고, 그러면 **이 안내가 영영 안 뜬다**(실측으로 잡았다).
   * ⚠ 옛 서버 응답에는 이 수가 없다 — 그때는 안내를 안 띄운다(없는 말을 지어내지 않는다).
   */
  const attachedCount = attachedTotal;

  return (
    <div className="space-y-4">
      {tabs}
      {loadErr && <p className="rounded-xl bg-danger-soft p-3 t-caption font-semibold text-danger">{loadErr}</p>}


      {/**
        * 🔴🔴 **21편째부터 «어디에도» 안 나온다 — 그런데 화면은 「걸림」이라고 말한다.**
        *   (2026-09-17 권반장 조사 8-2 [1]a)
        *
        * ⚠ `lib/shorts.ts` 의 `SHORTS_MAX` 가 **DB 조회 자체를 그만큼으로 자른다.**
        *   그래서 25편을 거신 사장님의 21~25편은 **홈페이지에 영영 안 나옵니다.**
        *   그런데 편집화면은 그 영상들을 **「걸림」으로 보여 줍니다** — **화면이 거짓말을 하고 있다.**
        * ★ **먼저 거짓말부터 멈춘다.** 상한을 코드로 «푸는 것»은 가상화(8-2 [3])가 끝난 뒤다 —
        *   지금 풀면 폰에서 40편 넘는 영상이 크롬 재생기 상한에 걸려 **검은 화면**이 된다.
        */}
      {/* 🔴 「인스타에서 안 보인다」 — **지워졌다고 말하지 않는다.** 확인을 권한다(지시 [48]①) */}
      {snsSuspect > 0 && (
        <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed">
          ⚠ 인스타에 올린 영상 <b>{snsSuspect}건</b>이 지금 <b>저희 쪽에서 안 보입니다.</b>
          <br />지우셨거나 비공개로 바꾸셨다면 <b>정상</b>입니다. 그런 적이 없으시면 인스타 연결을 한 번 확인해 주세요.
        </p>
      )}

      {attachedCount !== null && attachedCount > SHORTS_MAX && (
        <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed">
          ⚠ 지금 <b>{attachedCount}편</b>을 걸어 두셨는데, 홈페이지에는 <b>최신 {SHORTS_MAX}편</b>이 나옵니다.
          <br />꼭 보여 주고 싶은 영상은 <b>[▲ 위로]</b> 로 순서를 올려 주세요.
        </p>
      )}

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
          {/* ══ 「한 방 등록」 설정 — 한 번 정해 두면 영상마다 다시 안 적는다 (2026-09-16) ══ */}
          <section className="rounded-2xl border border-green-700 p-4">
            <button type="button" onClick={() => setSdOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left">
              <span>
                <span className="t-small font-bold">⚡ 한 방 등록 설정</span>
                <span className="ml-2 t-caption text-[var(--text-soft)]">
                  {sdReady ? "정해 두셨어요 — 버튼 한 번이면 다 나갑니다" : "먼저 한 번만 정해 주세요"}
                </span>
              </span>
              <span className="shrink-0 t-caption text-[var(--text-soft)]">{sdOpen ? "접기 ▴" : "펼치기 ▾"}</span>
            </button>

            {!sdOpen && (
              <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                지금 설정: {sd.home ? "홈페이지 + " : ""}
                {sd.providers.length ? sd.providers.map(providerName).join(" · ") : "고른 채널 없음"}
                {normalizeTags(sd.tags).length > 0 && ` · 해시태그 ${normalizeTags(sd.tags).length}개`}
              </p>
            )}

            {sdOpen && (
              <div className="mt-3 space-y-3">
                <p className="t-caption leading-relaxed text-[var(--text-soft)]">
                  여기서 정한 <b>글과 해시태그가 모든 채널에 똑같이</b> 들어갑니다.
                  영상마다 다시 적지 않으셔도 돼요. 채널별로 다르게 쓰고 싶으시면 아래 개별 상자를 쓰시면 됩니다.
                </p>

                <label className="block">
                  <span className="t-caption font-semibold">기본 글 <span className="font-normal text-[var(--text-soft)]">(비워 두면 그 영상의 질문이 들어가요)</span></span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-n-300 p-2 t-caption" rows={3}
                    maxLength={TEXT_MAX}
                    value={sd.text}
                    onChange={(e) => setSd({ ...sd, text: e.target.value })}
                    onBlur={() => void saveDefaults({})}
                    placeholder="예) 다산 리모델링입니다. 오늘도 현장에서 한 컷 남깁니다."
                  />
                </label>

                <label className="block">
                  <span className="t-caption font-semibold">해시태그 <span className="font-normal text-[var(--text-soft)]">(# 없이 적으셔도 됩니다)</span></span>
                  <input
                    className="mt-1 w-full rounded-lg border border-n-300 p-2 t-caption"
                    maxLength={TAGS_MAX}
                    value={sd.tags}
                    onChange={(e) => setSd({ ...sd, tags: e.target.value })}
                    onBlur={() => void saveDefaults({})}
                    placeholder="예) 남양주인테리어 다산리모델링 욕실공사"
                  />
                  {normalizeTags(sd.tags).length > 0 && (
                    <span className="mt-1 block t-caption text-[var(--text-soft)]">
                      {normalizeTags(sd.tags).map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </label>

                <div>
                  <p className="t-caption font-semibold">어디에 올릴까요</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-full border border-n-300 px-3 py-1.5 t-caption">
                      <input type="checkbox" checked={sd.home}
                        onChange={(e) => void saveDefaults({ home: e.target.checked })} />
                      홈페이지
                    </label>
                    {(["instagram", "tiktok"] as SnsProvider[]).map((p) => (
                      <label key={p} className="inline-flex items-center gap-1.5 rounded-full border border-n-300 px-3 py-1.5 t-caption">
                        <input type="checkbox" checked={sd.providers.includes(p)}
                          onChange={(e) => void saveDefaults({
                            providers: e.target.checked
                              ? [...sd.providers.filter((x) => x !== p), p]
                              : sd.providers.filter((x) => x !== p),
                          })} />
                        {providerName(p)}
                      </label>
                    ))}
                  </div>
                  {/**
                    * 🔴🔴 **유튜브를 이 목록(「한 방 등록」)에 «넣지 않는다».** (2026-09-19)
                    *
                    * 이유 둘 — 둘 다 무겁다:
                    * ① **하루 1개뿐**이다(`lib/sns/db.ts` 사이트당 1/일). 한 방에 섞이면
                    *    사장님이 **모르는 새 그날 몫이 사라진다.**
                    * ② 🔴 **감사 신청서에 「한 번의 명시적 클릭마다 한 번 호출」이라고 적었다.**
                    *    화면이 그 말과 어긋나면 **그 자체가 반려 사유**가 된다.
                    * ⇒ 유튜브는 **영상마다 있는 [유튜브에 올리기] 단추 하나**로만 나간다.
                    */}
                  <p className="mt-1.5 t-caption leading-relaxed text-[var(--text-soft)]">
                    쓰레드·X·페이스북은 <b>준비 중</b>이라 아직 못 고릅니다. 열리는 대로 여기에 나타납니다.
                    <br />
                    유튜브 쇼츠는 <b>영상마다 있는 [유튜브에 올리기]</b> 로 한 편씩 올립니다(하루 1편).
                  </p>
                </div>

                {/* 🔴 틱톡 규정 — 이걸 안 적으면 「왜 틱톡만 한 번 더 누르지?」가 된다 */}
                {sd.providers.includes("tiktok") && (
                  <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed text-[var(--text-soft)]">
                    ⚠ <b>틱톡만은 올릴 때마다 「누가 볼 수 있나요?」를 한 번 물어봅니다.</b>{" "}
                    틱톡 규정이 「사장님이 매번 직접 고를 것」을 요구해서, 우리가 미리 정해 둘 수 없습니다.
                    제목·해시태그는 이미 채워져 있으니 <b>공개범위만 한 번 누르시면</b> 됩니다.
                  </p>
                )}

                <p className="t-caption font-semibold">
                  {sdSaved === "saving" ? "저장 중…"
                    : sdSaved === "ok" ? <span className="text-green-700">저장했어요</span>
                    : sdSaved === "fail" ? <span className="text-danger">저장하지 못했어요. 다시 한 번 눌러 주세요.</span>
                    : null}
                </p>
              </div>
            )}
          </section>

          {/* ★★ 2026-09-16 — 「한 편만」이 **사실이 아니게 됐다.** 홈페이지가 걸린 영상을
              전부 보여 준다(숏폼 피드). 옛 문장을 그대로 두면 사장님이 한 편만 거신다. */}
          <p className="t-caption leading-relaxed text-[var(--text-soft)]">
            홈페이지에 <b>여러 편을 걸 수 있어요.</b> 건 영상은 첫 화면 아래 <b>숏폼 칸</b>에
            인스타 릴스처럼 나란히 나옵니다 — 손님이 옆으로 넘겨 봅니다.
            내리고 싶은 영상만 <b>[홈페이지에서 내리기]</b> 를 누르시면 됩니다.
          </p>
          {items.map((it) => {
            /* ★ 2026-09-16 — 걸림 판정을 **서버(`video_out_key`)** 로 옮겼다.
               홈페이지가 영상을 여러 편 보여 주게 되어 「doc 의 한 칸과 같은가」로는 못 센다.
               ⚠ 옛 서버 응답에는 `attached` 가 없다 — 그때는 예전 방식으로 내려앉는다. */
            const on = it.attached ?? (!!it.publicUrl && it.publicUrl === attachedUrl);
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

                {/* ══ ⚡ 한 방에 올리기 — 이 화면의 중심 버튼 (2026-09-16 대표님 지시) ══
                    ⚠ 아래 개별 상자(인스타·틱톡)는 그대로 둔다. 채널마다 다르게 쓰실 분의 길이다. */}
                {(sd.home || sd.providers.length > 0) && (
                  <div className="rounded-xl border-2 border-green-700 bg-green-50/40 p-3">
                    <button type="button" disabled={pubBusy === it.id || busyId === it.id}
                      onClick={() => void oneShot(it)}
                      className="w-full rounded-full bg-green-700 px-4 py-3 t-small font-bold text-white disabled:opacity-40">
                      {pubBusy === it.id || busyId === it.id ? "올리는 중…" : "⚡ 한 방에 올리기"}
                    </button>
                    <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                      {[sd.home ? "홈페이지" : null, ...sd.providers.map(providerName)].filter(Boolean).join(" + ")}
                      {" 에 한 번에 올라갑니다."}
                      {normalizeTags(sd.tags).length > 0 && " 정해 두신 글·해시태그가 그대로 들어갑니다."}
                      {sd.providers.includes("tiktok") && <> <b>틱톡은 「누가 볼 수 있나요?」만 한 번 눌러 주시면 됩니다.</b></>}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {on ? (
                    /* ★ 내리는 길 — 걸기만 되고 못 내리면 사장님이 갇힌다(회장님 지시 2)
                       ★★ 2026-09-16 — **이 영상만** 내린다. 서버가 `video_out_key` 를 비운다.
                         전에는 doc 에서 섹션만 뺐는데, 홈페이지가 여러 편을 보여 주게 되면서
                         그것만으로는 **내려도 계속 보였다.** */
                    <button type="button" disabled={busyId === it.id}
                      onClick={() => void detach(it)}
                      className="rounded-full border border-n-300 px-4 py-2 t-caption font-semibold disabled:opacity-40">
                      {busyId === it.id ? "내리는 중…" : "홈페이지에서 내리기"}
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

                    {/* ★★ **「숨기기」 버튼을 일부러 두지 않았다.** (2026-09-12 배포 확인 중 발견)
                        · 홈페이지에 보이고 안 보이고는 이미 위의 [홈페이지에 걸기]·[내리기] 가 한다
                        · 그리고 `story_entries.visible` 은 **완성도 점수**를 세는 칸이다
                          (lib/score.ts storyCount·photos). 여기에 스위치를 달면 사장님이
                          「숨기기」를 누른 순간 **점수가 조용히 내려간다** — 불변 규칙 12 위반이다.
                        ⚠ 나중에 영상을 여러 편 거는 날이 오면, 그때는 `visible` 이 아니라
                          **새 칸**을 만들어라. 점수 칸과 노출 칸을 겸하면 반드시 한쪽이 거짓말을 한다. */}
                    <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                      홈페이지에 <b>보이고 안 보이고</b>는 위의 [홈페이지에 걸기] · [홈페이지에서 내리기] 로 정합니다.
                    </p>

                    {/* ★★ 지우기 확인 — 일곱 자리 중 ⑤. **버튼 글자 자체가 «어디까지 지우는지»를 말한다** */}
                    {askDelete === it.id && (
                      <div className="mt-3 rounded-xl border border-danger p-3">
                        {/* 🔴 **대표님 문장 그대로다(2026-09-18 B-20).** `lib/sns/copy.ts` 한 곳에서 읽는다 */}
                        <p className="t-caption font-bold text-danger">{SNS_DELETE_ASK}</p>
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
                    /* 🔴 **`provider` 를 열쇠로 써도 되는 이유** (2026-09-17 지시 [40]).
                       ⚠ 2026-09-17 까지는 **안 됐다** — 실패한 시도가 줄로 쌓여
                         한 영상에 `tiktok` 이 **여덟 줄**이었고, 콘솔에
                         「Encountered two children with the same key」가 났다.
                       ⇒ 이제 **서버가 SNS 한 곳당 한 줄만** 보낸다
                         (`app/api/site/videos/route.ts` 의 `SNS한곳에한줄`).
                       🔴 **열쇠를 `provider+index` 로 바꿔 덮지 마라** — 그러면 경고만 사라지고
                         「안 올라갔어요」와 「올라갔어요」가 **나란히 뜨는 거짓말**은 그대로 남는다. */
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

                {/**
                  * 🔴🔴 **유튜브에 올리기 — «한 번의 명시적 클릭마다 한 번 호출».** (2026-09-19)
                  *
                  * ★ **인스타 상자를 그대로 본떴다.** 다른 것은 셋뿐이다:
                  *   ① 보내는 곳이 `["youtube"]` ② 글자 수 재기가 유튜브 기준(설명 5000자·해시태그 15개)
                  *   ③ **「비공개로 올라갑니다」 안내**가 붙는다(아래).
                  *
                  * 🔴 **왜 「비공개」인가 — 되돌릴 수 없는 일이라 그렇다**(`lib/sns/youtube-gate.ts` 원문):
                  *   감사 통과 «전»에 올린 영상은 **비공개로 잠기고 «항소가 안 된다».**
                  *   감사를 나중에 통과해도 **이미 잠긴 것은 안 풀린다** — 다시 찍어 다시 올려야 한다.
                  *   ⇒ 그래서 문(`youtube-gate`)이 **올려도 되는 사이트만** 열어 준다.
                  *     이 상자가 보인다는 것은 **이미 그 문을 통과했다**는 뜻이다(`isAvailable` 안에 문이 있다).
                  *
                  * ⚠ **이미 올린 영상에는 상자를 다시 두지 않는다**(인스타와 같은 규칙).
                  *   하루 1편뿐이라, 눌러도 「이미 올렸어요」만 나오는 단추는 **한도를 걱정하게** 만든다.
                  * ⚠ **영상 규격 검사는 인스타 것을 함께 쓴다**(`it.ig`) — 틱톡 상자와 같은 방식이다.
                  *   위 인스타 상자가 이미 «왜 못 올리는지»를 적어 주므로 여기서 또 말하지 않는다.
                  */}
                {ytReady && !(it.posted ?? []).some((x) => x.provider === "youtube" && x.status === "published") && (
                  it.ig && !it.ig.ok ? null
                  : ytReady.ok ? (
                    <div className="rounded-xl border border-green-700 p-3">
                      <p className="t-caption font-semibold">유튜브에 올리기</p>
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
                      <TextMeter text={cap[it.id] ?? it.question ?? it.title ?? ""} providers={["youtube"]} className="mt-1" />
                      <button type="button" disabled={pubBusy === it.id}
                        onClick={() => void publish(it.id, ["youtube"])}
                        className="mt-2 rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white disabled:opacity-40">
                        {pubBusy === it.id ? "올리는 중…" : "유튜브에 올리기"}
                      </button>
                      {/* 🔴 **이 문장을 지우지 마라.** 「올렸는데 왜 안 보이지?」를 미리 막는 말이고,
                          감사 전에는 **실제로 비공개로 올라간다**(위 주석). 화면이 사실과 같아야 한다 */}
                      <p className="mt-1.5 t-caption leading-relaxed text-[var(--text-soft)]">
                        지금은 준비 기간이라 <b>비공개</b>로 올라갑니다.
                        사장님 유튜브에서는 보이지만 손님에게는 아직 안 보입니다.
                      </p>
                    </div>
                  ) : ytReady.why ? (
                    <p className="rounded-xl bg-n-50 p-3 t-caption leading-relaxed text-[var(--text-soft)]">{ytReady.why}</p>
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
