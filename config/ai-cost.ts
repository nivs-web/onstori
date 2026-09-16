/* 요금 출처: lib/trial.ts (MEMBERSHIP_PRICE) — 이 파일에 월 요금을 손으로 적지 않는다.
   단가·환율 출처: lib/ai-usage.ts (환경변수 AI_USD_PER_MTOK_IN · AI_USD_PER_MTOK_OUT · AI_USD_KRW). */
import { MEMBERSHIP_PRICE } from "@/lib/trial";
import type { UsageKind } from "@/lib/ai-usage";

/**
 * ★★★ **「어디에 토큰이 드는가」 — 기능별 소모 목록의 단일 출처.** (2026-09-16 대표님 지시)
 *
 * ★ 대표님 말씀 그대로: 「우리 **토큰 소모되는 금액과 토큰 쓰는 곳이 어딘지 목록**이 하단에
 *   나오면 좋겠어. … 각각 금액이 얼만지 알아야겠어. 그래야 이 부분은 AI 기능을 넣어야 할지,
 *   그 부분은 토큰 소모가 심하니 빼야 할지 판단한다. **(미적용) (적용중)** 이렇게 앞에 뜨게
 *   만들 거야. 미적용 중인 것 중에 **마이너스가 생기지 않는 한도 내에서** 조금씩 기능 오픈을
 *   할 거야. … **어떤 기능 추가 시 어느 정도 토큰이 드는지 싹 다 기재해 놔.**」
 *
 * ★★ **`lib/ai-usage.ts` 와 무엇이 다른가 — 헷갈리면 안 된다.**
 *   · `lib/ai-usage.ts` = **지나간 것**. 실제로 쓴 토큰을 사이트마다 적어 둔 «영수증»
 *   · 이 파일         = **앞으로 올 것**. 「이 기능을 켜면 대략 얼마가 든다」는 «메뉴판»
 *   둘을 섞지 마라. 영수증은 사실이고, 메뉴판은 **대부분 추정**이다.
 *
 * 🔴 **추정과 실측을 «반드시» 구별한다.**
 *   안 재본 것은 `measured: null` 로 두고 화면에 **「아직 안 쟀음」**이 그대로 보이게 한다.
 *   추정치를 사실처럼 적어 두면 대표님이 그 숫자로 기능을 열고 닫으신다 — 틀리면 그게 손해다.
 *
 * ⚠ **여기 있는 목록이 「지금 코드에 있는 것」과 어긋나면 이 파일이 틀린 것이다.**
 *   `status: "적용중"` 인 항목은 전부 `where` 에 적힌 자리에 실제 코드가 있다(2026-09-16 확인).
 *   기능을 새로 만들면 **그 커밋에서 이 파일도 같이 고친다.**
 */

/* ════════════════ 단계 ════════════════ */

export type CostStage = "site" | "keep" | "video" | "image" | "etc";

/** 대표님이 말씀하신 순서 그대로 — 제작 → 유지 → 60초 영상 → 이미지 → 그 밖 */
export const COST_STAGES: { id: CostStage; label: string; note: string }[] = [
  { id: "site", label: "홈페이지 제작 단계", note: "가입하고 홈페이지가 처음 만들어질 때까지. **한 번만** 든다." },
  { id: "keep", label: "유지 단계", note: "홈페이지를 쓰시는 동안 **매달 반복해서** 든다. 여기가 진짜 비용이다." },
  { id: "video", label: "60초 동영상 단계", note: "찍은 영상을 다듬고 자막을 붙이는 일. **아직 하나도 안 만들었다.**" },
  { id: "image", label: "이미지(사진) 만들기", note: "🔴 글보다 **훨씬 비싸다.** 장당 고정 단가이고 토큰 단가로 계산하면 틀린다." },
  { id: "etc", label: "그 밖 — AI 를 안 쓰는 것", note: "일부러 AI 를 안 쓴 자리다. **0원**인 것을 알고 계셔야 판단이 된다." },
];

/* ════════════════ 상태 ════════════════ */

/**
 * ★ 대표님이 화면 앞에 뜨기를 원하신 딱지.
 *   · **적용중** — 지금 손님이 쓰면 실제로 돈이 나간다
 *   · **미적용** — 코드가 아예 없다. 「열면 얼마나 드는가」를 미리 적어 둔 것
 *   · **검토중** — 만들다 말았거나, 만들지 말지 정하는 중
 */
export type CostStatus = "적용중" | "미적용" | "검토중";

/** 🔴 AI 를 안 쓰는 자리의 모델 이름 — 화면이 이 값을 보고 「0원」으로 그린다 */
export const NO_AI = "AI 안 씀";

export type CostItem = {
  id: string;
  stage: CostStage;
  /** 대표님이 읽으실 이름. 개발 용어를 쓰지 않는다 */
  label: string;
  status: CostStatus;
  /** 영수증(`lib/ai-usage.ts` 의 USAGE_KINDS)에 어떤 이름으로 적히나. 안 적히면 undefined */
  kind?: UsageKind;
  /** 모델 이름. AI 를 안 쓰면 `NO_AI` */
  model: string;
  /** 한 번 부를 때 **보내는** 글자의 추정 토큰 */
  estIn: number;
  /** 한 번 부를 때 **받는** 글자의 추정 토큰 */
  estOut: number;
  /**
   * 🔴 **실제로 재 본 값.** 안 쟀으면 `null` — 화면에 「아직 안 쟀음」이 뜬다.
   * ⚠ 「대충 이럴 것이다」를 여기 적지 마라. 그 순간 추정과 사실의 구분이 무너진다.
   */
  measured: { at: string; inTok: number; outTok: number; how: string } | null;
  /**
   * 장당 고정 단가(달러). 🔴 **이미지 모델 전용.**
   * 이미지는 글자 단가($0.3/$2.5)와 «완전히 다른» 단가로 청구된다 — 토큰 수로 계산하면
   * 10배 넘게 싸게 나와 거짓이 된다. 이 값이 있으면 화면은 **이 값으로** 원화를 그린다.
   */
  usdPerCall?: number;
  /** 코드가 어디 있나(적용중) 또는 어디에 붙을 것인가(미적용) */
  where: string;
  /** 추정 근거 — 「왜 이 숫자인가」 */
  basis: string;
  /** 대표님께 드리는 한 줄 */
  note: string;
};

/**
 * ★★ **토큰 어림법 — 한글은 «글자 1개 ≈ 토큰 1개»로 넉넉하게 잡았다.**
 *   구글 토크나이저는 한글에 영어보다 불리해서, 넉넉하게 잡아야 «덜 나오는» 쪽으로 틀린다.
 *   덜 잡아 두었다가 실제가 더 나오면 대표님이 손해를 보신다. **넉넉히 잡는 것이 안전하다.**
 */
export const TOKEN_RULE =
  "한글은 «글자 1개 ≈ 토큰 1개»로 넉넉하게 어림했습니다. 실제는 이보다 조금 적게 나오는 편입니다.";

/* ════════════════ 목록 ════════════════ */

export const AI_COST_ITEMS: CostItem[] = [
  /* ────────── 1) 홈페이지 제작 단계 ────────── */
  {
    id: "site_copy",
    stage: "site",
    label: "홈페이지 문구 짓기",
    status: "적용중",
    kind: "site_create",
    model: "gemini-3.5-flash",
    estIn: 1700,
    estOut: 800,
    measured: null,
    where: "lib/generate.ts › generateCopy — 영수증은 app/api/generate/route.ts 가 적는다",
    basis: "프롬프트 실제 길이 약 1,600글자 + 사장님 입력 약 150글자. 받는 글은 제목·소개글·진행과정 4단계·첫 이야기 합쳐 약 800글자.",
    note: "★ **지금 영수증에 적히는 것은 이것 하나뿐이다.** 가입 한 번에 한 번만 부른다.",
  },
  {
    id: "site_classify",
    stage: "site",
    label: "업종 알아맞히기",
    status: "적용중",
    model: "gemini-3.5-flash",
    estIn: 1100,
    estOut: 50,
    measured: null,
    where: "lib/generate.ts › classify",
    basis: "업종 17개 목록을 통째로 보낸다(약 770글자) + 안내문 약 300글자. 받는 글은 업종 id 하나라 아주 짧다.",
    note: "⚠ **대부분 안 부른다.** 온보딩에서 업종을 고르셨거나 상호에 업종 낱말이 있으면 코드가 바로 정한다. 🔴 지금 **영수증에 안 적힌다**(아래 「아직 못 재는 것」 참고).",
  },
  {
    id: "oneliner",
    stage: "site",
    label: "「하는 일 한 줄」 예시 2개",
    status: "적용중",
    model: "gemini-3.5-flash",
    estIn: 1350,
    estOut: 90,
    measured: null,
    where: "app/api/oneliner/route.ts",
    basis: "프롬프트 실제 길이 약 1,300글자. 받는 글은 35자 이내 문장 두 개.",
    note: "네이버 플레이스로 업종이 잡힌 분께만 드린다. 한 사람이 눌러 대지 못하게 **1분 6회 · 1시간 40회**로 막아 두었다. 🔴 아직 **영수증에 안 적힌다**(사이트가 생기기 «전»이라 적을 곳이 없다).",
  },

  /* ────────── 2) 유지 단계 ────────── */
  {
    id: "story_rewrite",
    stage: "keep",
    label: "이야기 다듬기 (말한 것 → 읽을 글)",
    status: "미적용",
    kind: "story_write",
    model: "gemini-3.5-flash (예정)",
    estIn: 2000,
    estOut: 700,
    measured: null,
    where: "아직 없다. 만들면 app/api/site/story 부근",
    basis: "받아쓴 60초 분량(약 900글자) + 규칙 안내 약 1,000글자. 받는 글은 이야기 한 편 약 700글자.",
    note: "대표님이 말씀하신 **「이야기 추출」**이 이것이다. 유지 단계에서 **가장 자주 부를 기능**이라 월 비용의 대부분을 차지한다.",
  },
  {
    id: "story_three_ways",
    stage: "keep",
    label: "글 3종 (원문 · 1인칭 · 3인칭)",
    status: "미적용",
    kind: "story_write",
    model: "gemini-3.5-flash (예정)",
    estIn: 2200,
    estOut: 1800,
    measured: null,
    where: "아직 없다",
    basis: "한 번 불러 세 벌을 한꺼번에 받는다고 보았다. 받는 글이 세 배라 출력 토큰이 크다.",
    note: "⚠ 홈페이지(/how-it-works)가 이미 **약속하고 있는 기능**이다. 아직 없다.",
  },
  {
    id: "sns_caption",
    stage: "keep",
    label: "SNS 올릴 글(캡션) 6종",
    status: "미적용",
    model: "gemini-3.5-flash (예정)",
    estIn: 1500,
    estOut: 600,
    measured: null,
    where: "아직 없다. 만들면 lib/sns 부근",
    basis: "이야기 한 편 + 채널 6곳 규칙. 받는 글은 채널마다 100글자 안팎씩 여섯 개.",
    note: "해시태그는 AI 를 안 쓴다(맨 아래 참고). 캡션만 AI 다.",
  },
  {
    id: "ai_rewrite",
    stage: "keep",
    label: "홈페이지 글 통째로 다시 쓰기",
    status: "미적용",
    model: "gemini-3.5-flash (예정)",
    estIn: 2500,
    estOut: 900,
    measured: null,
    where: "아직 없다 — 잠금 딱지만 있다(lib/plan-gate.ts › ai_rewrite)",
    basis: "지금 홈페이지 문구 전체를 보내고 다시 받는다고 보았다. 제작 때보다 보내는 글이 길다.",
    note: "정회원 전용으로 이미 **이름표가 붙어 있다.** 기능만 없다.",
  },
  {
    id: "weekly_question",
    stage: "keep",
    label: "주 1회 촬영 질문 고르기",
    status: "적용중",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "config/questions.ts + lib/weekly.ts",
    basis: "정해 둔 질문 목록에서 차례로 고른다. AI 를 부르지 않는다.",
    note: "★ **공짜다.** 매주 전 회원에게 나가는 것이라 AI 로 만들면 여기가 제일 먼저 비용이 된다 — 그래서 목록으로 두었다.",
  },

  /* ────────── 3) 60초 동영상 단계 ────────── */
  {
    id: "video_stt",
    stage: "video",
    label: "받아쓰기 (말 → 글자)",
    status: "미적용",
    kind: "caption",
    model: "gemini-3.5-flash (소리 입력, 예정)",
    estIn: 2500,
    estOut: 500,
    measured: null,
    where: "아직 없다 — 「자막 워커」가 통째로 미착수",
    basis: "🔴 **소리는 글자가 아니라 «초»로 센다.** 구글은 소리 1초를 약 32토큰으로 친다 — 60초면 약 1,900토큰, 여기에 안내문을 더해 2,500으로 잡았다. 받는 글은 자막 약 500글자.",
    note: "자막의 **출발점**이다. 이것 없이는 자막도 글 3종도 못 만든다.",
  },
  {
    id: "video_caption_burn",
    stage: "video",
    label: "자막 얹기 (영상 다시 만들기)",
    status: "미적용",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "아직 없다 — lib/sns/mp4.ts 주석의 「자막 워커」",
    basis: "글자를 영상에 태우는 일은 AI 가 아니라 영상 프로그램(ffmpeg)이 한다.",
    note: "⚠ **토큰은 0 인데 공짜가 아니다.** 60초 영상 한 편에 서버가 몇 십 초씩 돌아야 해서 **서버 사용료**가 든다. 그 값은 이 표에서 잴 수 없다.",
  },
  {
    id: "video_cut",
    stage: "video",
    label: "무음 컷 (조용한 데 잘라내기)",
    status: "미적용",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "아직 없다",
    basis: "소리 크기를 재서 자르는 일이라 AI 가 필요 없다.",
    note: "토큰 0. 위 「자막 얹기」와 같은 서버에서 같이 처리하면 추가 비용이 거의 없다.",
  },
  {
    id: "video_title",
    stage: "video",
    label: "영상 제목·설명 짓기",
    status: "미적용",
    model: "gemini-3.5-flash (예정)",
    estIn: 1200,
    estOut: 200,
    measured: null,
    where: "아직 없다",
    basis: "받아쓴 글 + 규칙. 받는 글은 제목 한 줄과 설명 몇 줄.",
    note: "싸다. 받아쓰기를 이미 했다면 **덤으로 붙이기 좋은 기능**이다.",
  },
  {
    id: "video_card",
    stage: "video",
    label: "사진 카드 만들기",
    status: "미적용",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "아직 없다",
    basis: "영상에서 뽑은 장면 위에 글자를 얹는 일이다. 새 그림을 «만드는» 것이 아니면 AI 가 필요 없다.",
    note: "⚠ 만약 **없는 그림을 새로 그리는** 방식으로 만들면 아래 「AI 사진」 값(장당 약 54원)이 그대로 붙는다.",
  },

  /* ────────── 4) 이미지 ────────── */
  {
    id: "bank_batch",
    stage: "image",
    label: "홈페이지 사진 미리 만들어 쌓기 (운영자)",
    status: "적용중",
    kind: "image",
    model: "gemini-3.1-flash-image",
    estIn: 300,
    estOut: 1120,
    usdPerCall: 0.039,
    measured: {
      at: "2026-09-06",
      inTok: 0,
      outTok: 1120,
      how: "scripts/bank-generate.ts 로 실제 3장 생성(batch 202609060033). 해상도 1K·2K 모두 응답 1,120토큰으로 같았다 — 2K 가 공짜로 더 큰 셈.",
    },
    where: "scripts/bank-generate.ts (운영자가 손으로 돌린다)",
    basis: "실측 1,120토큰. 원화는 장당 고정 단가 $0.039 로 계산한다.",
    note: "🔴 **회원이 부르는 것이 아니다.** 운영자가 미리 만들어 창고에 쌓아 두고, 가입하시면 그 중에서 골라 드린다 — 그래서 **회원 1명당 월 비용에 안 들어간다.**",
  },
  {
    id: "ai_image_member",
    stage: "image",
    label: "사장님이 직접 AI 사진 만들기",
    status: "미적용",
    kind: "image",
    model: "gemini-3.1-flash-image (예정)",
    estIn: 300,
    estOut: 1120,
    usdPerCall: 0.039,
    measured: {
      at: "2026-09-06",
      inTok: 0,
      outTok: 1120,
      how: "같은 모델이라 위 이미지뱅크 실측을 그대로 쓴다.",
    },
    where: "아직 없다 — 잠금 딱지만 있다(lib/plan-gate.ts › ai_image)",
    basis: "장당 고정 단가 $0.039. 더 좋은 모델(gemini-3-pro-image)은 $0.134 로 **3.4배**다.",
    note: "🔴 **글보다 15배쯤 비싸다.** 홈페이지 문구 한 번이 약 3.5원인데 사진 한 장이 약 54원이다. 열더라도 **하루 몇 장**으로 막아야 한다.",
  },

  /* ────────── 5) 그 밖 — 일부러 AI 를 안 쓴 자리 ────────── */
  {
    id: "logo",
    stage: "etc",
    label: "로고 만들기",
    status: "적용중",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "lib/logo-maker.ts",
    basis: "글자를 SVG 로 그리는 계산이다. AI 를 부르지 않는다.",
    note: "★ **몇 장을 만드셔도 0원이다.** 마음껏 열어 두어도 된다.",
  },
  {
    id: "hashtag",
    stage: "etc",
    label: "해시태그 자동 제안",
    status: "적용중",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "lib/hashtags.ts",
    basis: "상호·업종·주소에 «이미 있는 글자»만 옮긴다.",
    note: "★ 일부러 AI 를 안 썼다 — AI 가 없는 지역·업종을 지어내면 검색 조작이 된다. 덕분에 **0원**이다.",
  },
  {
    id: "place_search",
    stage: "etc",
    label: "네이버 플레이스로 가게 찾기",
    status: "적용중",
    model: NO_AI,
    estIn: 0,
    estOut: 0,
    measured: null,
    where: "app/api/place-search/route.ts",
    basis: "네이버 검색 API 다. 토큰과 무관하다.",
    note: "AI 비용은 0. 네이버 쪽 호출 한도만 본다.",
  },
];

/* ════════════════ 유료회원 1명당 월 얼마인가 ════════════════ */

/**
 * ★★ **가정이다. 사실이 아니다.** (2026-09-16)
 *   대표님이 「마이너스가 생기지 않는 한도 내에서 조금씩 기능 오픈」을 하시려면
 *   **「한 분이 한 달 쓰시면 얼마인가」**가 있어야 한다. 그런데 그 「얼마나 쓰시나」는
 *   아직 **아무도 모른다** — 유료회원이 없기 때문이다.
 *
 * 🔴 그래서 여기 숫자는 **우리가 정한 가정**이다. 실제 회원이 생기면 영수증(위쪽 표)을 보고
 *   이 숫자를 고친다. 화면에도 **「가정」이라고 크게 적혀 있어야 한다.**
 */
export const MONTHLY_ASSUMPTION: { itemId: string; perMonth: number; why: string }[] = [
  { itemId: "story_rewrite", perMonth: 4, why: "주 1회 촬영을 목표로 하니 한 달 4편" },
  { itemId: "video_stt", perMonth: 4, why: "그 4편에 자막을 붙인다면" },
  { itemId: "sns_caption", perMonth: 4, why: "그 4편을 SNS 에 올린다면" },
  { itemId: "ai_image_member", perMonth: 1, why: "사진은 어쩌다 한 장만 만드신다고 보았다" },
];

/** 이 가정을 화면에 그대로 적는다 — 「가정」을 숨기면 추정이 사실처럼 읽힌다 */
export const ASSUMPTION_NOTE =
  "가정 — 월 4회 이야기 다듬기 · 4회 자막 · 4회 SNS 글 · 1장 AI 사진. 홈페이지 제작비는 가입 때 한 번만 들므로 월 비용에 넣지 않았습니다.";

/** 비교 대상 월 요금 — 🔴 숫자를 여기 적지 않는다. lib/trial.ts 가 단일 출처다 */
export const MONTHLY_PRICE = MEMBERSHIP_PRICE;

/* ════════════════ 원화 계산 ════════════════ */

/**
 * 달러 → 원.
 * ⚠ **환율 출처는 `lib/ai-usage.ts` 와 «같은» 환경변수** `AI_USD_KRW` 다.
 * 🔴 다만 그 파일의 상수는 `export` 가 안 되어 있어 **import 하지 못한다.** 그래서 기본값
 *   1380 이 두 곳에 적혀 있다 — `lib/ai-usage.ts` 가 `USD_KRW` 를 내주면 이 함수는 그것을
 *   불러 쓰고 이 주석은 지운다. (2026-09-16 · 그 파일은 이번 작업 범위 밖이라 손대지 않았다)
 */
export function usdToKrw(usd: number): number {
  return usd * Number(process.env.AI_USD_KRW ?? 1380);
}

/** AI 를 안 쓰는 자리인가 — 화면이 「0원」으로 그린다 */
export function isFree(item: CostItem): boolean {
  return item.model === NO_AI;
}
