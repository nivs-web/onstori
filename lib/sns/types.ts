/**
 * SNS 발행 어댑터 — **겉모양(규격)**. (2026-09-11)
 *
 * ★ 왜 어댑터인가: 유튜브와 인스타는 올리는 방식이 **정반대**다.
 *   · 인스타 — 우리가 «공개 주소»를 주면 그쪽이 가져간다 (컨테이너 → 확인 → 게시, 3단계)
 *   · 유튜브 — 우리가 **파일을 직접 보낸다** (1단계)
 *   화면과 대기열이 이 차이를 몰라도 되게 겉모양을 하나로 맞춘다.
 *
 * ★ 서랍 구조 — 이번에 실제로 여는 것은 instagram·youtube 둘뿐이다.
 *   나머지 넷은 자리만 있고 `isAvailable()` 이 false 를 돌려준다.
 *
 * ⚠ 상무님 어댑터 규격서를 **못 읽은 상태**에서 만들었다(2026-09-11 기준
 *   `fable51plandept/AI_Context/` 폴더가 없다). 메서드 8개의 **이름과 개수**는
 *   회장님 지시문 그대로이고, 인자·반환 모양은 클코가 설계했다. 규격서를 받으면 대조가 필요하다.
 */

export const PROVIDERS = ["instagram", "youtube", "tiktok", "facebook", "threads", "x"] as const;
export type SnsProvider = (typeof PROVIDERS)[number];

/** 화면에 쓰는 이름 — 코드 이름을 그대로 보여주지 않는다 */
export const PROVIDER_NAME: Record<SnsProvider, string> = {
  instagram: "인스타그램 릴스",
  youtube: "유튜브 쇼츠",
  tiktok: "틱톡",
  facebook: "페이스북 페이지",
  threads: "쓰레드",
  x: "X (트위터)",
};

/**
 * ★★ 실패 이유는 **이 넷뿐이다. 다섯 번째를 만들지 마라.** (회장님 지시 2)
 *
 * · TRANSIENT      — 잠깐 그런 것. 다시 하면 될 수 있다. **모르는 오류는 전부 여기다.**
 * · AUTH_EXPIRED   — 연결이 풀렸다. 사장님이 다시 연결해야 한다.
 * · REJECTED       — 그쪽이 거절했다(형식·정책). 다시 해도 같다.
 * · QUOTA_EXCEEDED — 한도를 넘었다. 시간이 지나야 한다.
 */
export const ERROR_KINDS = ["TRANSIENT", "AUTH_EXPIRED", "REJECTED", "QUOTA_EXCEEDED"] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

/** 사장님에게 보여 줄 말 — 화면마다 다시 쓰지 않는다 */
export const ERROR_SAY: Record<ErrorKind, string> = {
  TRANSIENT: "지금은 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
  /* ⚠ 버튼 이름과 **글자까지 같아야 한다.** 연결이 풀린 줄의 버튼은 [다시 연결하기] 다
     (app/[slug]/edit/sns-panel.tsx). 없는 버튼을 가리키면 사장님이 화면에서 헤맨다 — 불변 규칙 12. */
  AUTH_EXPIRED: "연결이 풀렸어요. [다시 연결하기]를 눌러 주세요.",
  REJECTED: "그쪽에서 이 영상을 받지 않았어요. 다른 영상으로 시도해 주세요.",
  QUOTA_EXCEEDED: "오늘 올릴 수 있는 개수를 다 썼어요. 내일 다시 시도해 주세요.",
};

/**
 * 연결 한 건 — **토큰이 이 타입에 없다.**
 * ⚠ 일부러 뺐다. 화면·API 응답이 이 타입만 쓰면 토큰이 손님 브라우저로 샐 수 없다.
 *   토큰은 `lib/sns/db.ts` 안에서만 다룬다.
 */
export type Connection = {
  siteId: string;
  provider: SnsProvider;
  accountId: string | null;
  accountName: string | null;
  status: "active" | "expired" | "revoked";
  /** 면책 동의를 누른 시각. 비어 있으면 올리기를 시작하지 않는다 */
  disclaimerAgreedAt: string | null;
  connectedAt: string;
};

/** 올리기에 필요한 것 */
export type UploadInput = {
  siteId: string;
  entryId: string;
  /** 손님이 볼 수 있는 공개 주소 — **인스타가 이걸 가져간다.** 올리기를 누른 그 순간 만든다 */
  publicUrl: string;
  /** 비공개 원본 키 — **유튜브가 파일을 직접 보낼 때** 쓴다 */
  sourceKey: string;
  title: string;
  /**
   * ★★ **X(트위터)로 보낼 때는 반드시 `captionFor()` 를 거친 값이어야 한다.**
   *   X 는 글에 링크가 있으면 요금이 **13배** 뛴다($0.015 → $0.200).
   *   원본 글은 녹화 화면이 보낸 값이라 폰에서 조작될 수 있다 — 서버가 지워야 한다.
   *   `lib/sns/no-url.ts` 참조. 이 자리를 그냥 넘기지 마라.
   */
  caption: string;
  /** 이어 하기 — 인스타 ②단계에서 끊겼을 때 그 컨테이너를 다시 쓴다 */
  containerId?: string | null;
};

/**
 * 올리기 결과.
 * ★ `processing` 이 핵심이다 — 인스타는 «맡겨 놓고 나중에 확인»이라 한 번에 안 끝난다.
 *   그때 받은 containerId 를 sns_posts 에 적어 두고 다시 부르면 ①을 건너뛴다.
 */
export type UploadOutcome =
  | { state: "published"; remotePostId: string; remoteUrl: string | null }
  | { state: "processing"; containerId: string }
  | { state: "failed"; kind: ErrorKind; detail: string };

/** 오늘 몇 개나 더 올릴 수 있나 */
export type Quota = { remaining: number; limit: number; windowSec: number };

/** 이 SNS 를 지금 쓸 수 있나 — 못 쓰면 **왜인지** 같이 준다(조용히 실패 금지) */
export type Availability = { ok: true } | { ok: false; why: string };

/** ★ 겉모양 8개. 회장님 지시 2 의 목록 그대로다. */
export type SnsAdapter = {
  readonly provider: SnsProvider;

  /** ① 연결 — OAuth 는 «보내기»와 «돌아오기» 두 번이라 한 메서드가 둘 다 맡는다 */
  connect(input: { siteId: string; redirectUri: string; code?: string }): Promise<
    | { stage: "redirect"; authUrl: string }
    | { stage: "connected"; connection: Connection }
    | { stage: "failed"; kind: ErrorKind; detail: string }
  >;

  /** ② 연결 끊기 — ★ **토큰을 실제로 지운다.** 유튜브 약관이 요구한다 */
  disconnect(siteId: string): Promise<{ ok: boolean; detail?: string }>;

  /** ③ 연결돼 있나 — 없으면 null */
  isConnected(siteId: string): Promise<Connection | null>;

  /** ④ 올리기 */
  upload(input: UploadInput): Promise<UploadOutcome>;

  /** ⑤ 오류를 **네 값 중 하나**로 바꾼다. 모르면 TRANSIENT */
  translateError(e: unknown): ErrorKind;

  /** ⑥ 이 영상을 이미 여기에 올렸나 (중복 방지) */
  isDuplicate(siteId: string, entryId: string): Promise<boolean>;

  /** ⑦ 남은 한도 */
  getQuota(siteId: string): Promise<Quota>;

  /** ⑧ 지금 쓸 수 있나 (키가 있나 · 게이트가 열렸나) */
  isAvailable(): Promise<Availability>;
};
