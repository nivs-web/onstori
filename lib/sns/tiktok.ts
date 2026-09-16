import * as db from "./db";
/* ★ 2026-09-17 — 파일을 «우리가 직접» 보낸다(지시 [18]). 그래서 저장소를 읽는다 */
import * as storage from "@/lib/storage";
import { SNIFF_BYTES, sniff } from "@/lib/media-sniff";
import { limitsOf } from "./limits";
import { SnsHttpError, brief, callJson, kindFromStatus } from "./http";
import type { Availability, Connection, ErrorKind, ExtraField, Quota, SnsAdapter, UploadInput, UploadOutcome } from "./types";

/**
 * 틱톡 어댑터 — Direct Post (2026-09-12 회장님 지시)
 *
 * ★★★ **2026-09-17 — `PULL_FROM_URL` 을 버리고 `FILE_UPLOAD` 로 바꿨다** (지시 [18]).
 *   대표님이 네 번 시도해 네 번 다 `url_ownership_unverified` 로 거절당하셨다.
 *   **파일은 아무 잘못이 없었다.** 우리 영상은 `img.onstori.com` 에서 나가는데
 *   틱톡에 인증된 것은 `onstori.com` 하나뿐이었다 — **서브도메인은 «다른 도메인»으로 본다.**
 *   (아래 옛 경고문이 이미 그 말을 하고 있었다. 우리가 놓쳤다.)
 *
 *   ⇒ 이제 **우리가 영상 바이트를 틱톡에 직접 밀어 넣는다.** 틱톡이 우리 주소로 가지러 오지 않으니
 *   **도메인 인증이 영영 필요 없다.** 저장소를 옮기거나 도메인을 바꿔도 안 깨진다.
 *   ⚠ 인스타는 그대로 `PULL_FROM_URL` 이다 — 이 변경은 **틱톡에만** 해당한다.
 *
 * ★★ **인스타와 다른 것 셋** — 이것이 틱톡의 심사 요건이다:
 *   ① 올리기 전에 **`creator_info` 를 반드시 먼저 불러야 한다.** 그 응답이 주는
 *      «고를 수 있는 공개범위»만 보내야 하고, 마음대로 정하면 심사에서 떨어진다.
 *   ② 사장님이 **매번 직접** 제목·공개범위·댓글 허용을 골라야 한다(기본값으로 몰래 넘기면 안 된다).
 *   ③ 토큰이 **24시간**이면 만료된다(인스타는 60일). 그래서 **올리기 직전에 항상 갱신**한다.
 *      갱신 토큰은 365일짜리다.
 *
 * ⚠ **옛 경고문 — 남겨 둔다.** 아래는 `PULL_FROM_URL` 을 쓰던 때의 경고이고, 2026-09-17 에
 *   **실제로 그 일이 났다.** 지우면 「왜 바꿨는지」가 사라진다:
 *   「`PULL_FROM_URL` 은 틱톡에 **인증된 도메인**의 주소만 받는다. 우리 영상은 공개 저장소
 *   (`R2_PUBLIC_BASE`, 지금 `img.onstori.com`)에서 나간다. `onstori.com` 만 인증하셨다면
 *   **그 주소는 거절된다.** 실패하면 `url_ownership_unverified` 가 뜬다.」
 *   ⇒ **지금은 해당 없다.** 파일을 직접 보내므로 어느 도메인에서 나가든 상관없다.
 *
 * ⚠ 아래 엔드포인트·필드는 틱톡 공식 문서 기준으로 적었다. **첫 실제 게시로 대조해야 한다.**
 */

/**
 * 한 덩이로 보낼 수 있는 최대 크기 (2026-09-17 지시 [18]).
 * ⚠ 틱톡 규칙 — 덩이 하나는 **5MB 이상 64MB 이하**. 5MB 미만이면 «반드시» 통째로 보낸다.
 *   그래서 64MB 까지는 언제나 한 덩이로 끝난다. 그 위는 여러 덩이로 나눠야 하는데,
 *   60초 영상이 64MB 를 넘을 일이 없어 **만들지 않았다**(만들면 시험할 방법이 없다).
 */
const TT_MAX_BYTES = 64 * 1024 * 1024;

const API = "https://open.tiktokapis.com/v2";
const OAUTH_DIALOG = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = `${API}/oauth/token/`;
/**
 * ★ 연결 끊기를 **틱톡에도 알린다.** (2026-09-13 김팀장 지적)
 *   https://developers.tiktok.com/doc/oauth-user-access-token-management (Revoke access)
 */
const REVOKE_URL = `${API}/oauth/revoke/`;

/** 심사에 신청한 그대로. 늘리지 마라 — 안 쓰는 권한을 달라고 하면 심사에서 떨어진다 */
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];

const clientKey = () => process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
const clientSecret = () => process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "";

/** 틱톡 값 → 사람 말. **틱톡이 준 값만** 쓰되 읽을 수 있게만 바꾼다. 없는 값은 그대로 보여 준다 */
export const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "모두에게 공개",
  MUTUAL_FOLLOW_FRIENDS: "서로 팔로우한 친구만",
  FOLLOWER_OF_CREATOR: "내 팔로워만",
  SELF_ONLY: "나만 보기",
};

/** 틱톡이 주는 공개범위 값 — 이 목록은 계정마다 다르다. **우리가 지어내지 않는다** */
export type PrivacyLevel = string;

export type TiktokOptions = {
  /** 사장님 틱톡 별명 — 「내가 어느 계정에 올리는지」를 화면이 보여 줘야 한다(심사 요건) */
  nickname: string;
  /** 고를 수 있는 공개범위. 틱톡이 준 것만 */
  privacyOptions: PrivacyLevel[];
  /** 이 계정이 지금 못 켜는 것들 — 틱톡이 «꺼져 있다»고 알려 준다 */
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  /** 이 계정이 올릴 수 있는 최대 길이(초) */
  maxSec: number | null;
};

/** 사장님이 고른 값 — 올리기 요청에 그대로 실린다 */
export type TiktokChoice = {
  title: string;
  privacyLevel: PrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  /**
   * ★★ 상업용 콘텐츠 — 틱톡이 **화면에 토글을 두라**고 요구하는 항목이다. (2026-09-12 규격서 C)
   *
   * · `brandOrganic`  = 「내 브랜드」 — **내 사업**을 홍보한다 → 「Promotional content」 라벨이 붙는다
   * · `brandedContent` = 「브랜디드 콘텐츠」 — **남의 브랜드**를 홍보한다 → 「Paid partnership」 라벨
   *
   * ⚠ **둘 다 기본은 꺼짐이고, 사장님이 직접 켜야 한다.**
   * ⚠ **`brandedContent` 와 「나만 보기」는 함께 못 쓴다** — 틱톡이 거절한다. 화면이 미리 막는다.
   * ★ 화면에 토글만 두고 값을 안 보내면 **화면이 거짓말**이 된다. 그래서 여기까지 실어 보낸다.
   */
  brandOrganic: boolean;
  brandedContent: boolean;
};

/** ★ 「브랜디드 콘텐츠」와 함께 쓸 수 없는 공개범위 — 틱톡이 거절한다 */
export const PRIVATE_LEVEL = "SELF_ONLY";

/* ─────────────── 토큰 ─────────────── */

type TokenAnswer = {
  access_token?: string; refresh_token?: string;
  expires_in?: number; open_id?: string; scope?: string;
};

const expiryFrom = (sec: number | undefined) =>
  sec ? new Date(Date.now() + sec * 1000).toISOString() : null;

async function exchange(form: Record<string, string>): Promise<TokenAnswer> {
  return (await callJson(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  }, "tt:token")) as TokenAnswer;
}

/**
 * ★★ **올리기 직전에 항상 부른다.** 틱톡 접근 토큰은 **24시간**짜리다.
 *   인스타(60일)처럼 «가끔 갱신»으로는 안 된다 — 사장님이 어제 연결하고 오늘 올리면 이미 죽어 있다.
 * ⚠ 갱신에 실패하면 **null.** 부르는 쪽이 「다시 연결해 주세요」로 안내한다.
 */
export async function freshToken(siteId: string): Promise<string | null> {
  const tk = await db.readTokens(siteId, "tiktok");
  if (!tk) return null;
  /* 1분 이상 남아 있으면 그대로 쓴다 */
  const soon = Date.now() + 60_000;
  if (tk.accessToken && tk.expiresAt && new Date(tk.expiresAt).getTime() > soon) return tk.accessToken;
  if (!tk.refreshToken) return null;
  try {
    const r = await exchange({
      client_key: clientKey(), client_secret: clientSecret(),
      grant_type: "refresh_token", refresh_token: tk.refreshToken,
    });
    if (!r.access_token) return null;
    await db.saveConnection({
      siteId, provider: "tiktok",
      accessToken: r.access_token,
      /* ⚠ 틱톡은 갱신할 때 **새 갱신 토큰**을 준다. 옛것을 그대로 두면 365일 뒤 한 번에 죽는다 */
      refreshToken: r.refresh_token ?? tk.refreshToken,
      expiresAt: expiryFrom(r.expires_in),
      accountId: tk.accountId, scopes: SCOPES,
    });
    return r.access_token;
  } catch (e) {
    console.error(JSON.stringify({ evt: "tt_refresh_failed", siteId, err: brief(String(e), 160) }));
    return null;
  }
}

/* ─────────────── 사장님이 골라야 하는 것 ─────────────── */

/**
 * ★★ **틱톡 심사 요건.** 올리기 화면을 그리기 전에 이것을 먼저 불러야 한다.
 *   여기서 준 공개범위 «중에서만» 고르게 해야 하고, 우리가 값을 지어내면 안 된다.
 */
export async function creatorOptions(siteId: string): Promise<{ ok: true; options: TiktokOptions } | { ok: false; why: string }> {
  const token = await freshToken(siteId);
  if (!token) return { ok: false, why: "틱톡 연결이 풀렸어요. [다시 연결하기]를 눌러 주세요." };
  try {
    const r = (await callJson(`${API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: "{}",
    }, "tt:creator")) as {
      data?: {
        creator_nickname?: string;
        privacy_level_options?: string[];
        comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean;
        max_video_post_duration_sec?: number;
      };
    };
    const d = r.data ?? {};
    const privacyOptions = Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [];
    if (!privacyOptions.length) {
      /* ★ 조용히 넘기지 않는다. 고를 것이 없으면 올릴 수 없다 */
      return { ok: false, why: "틱톡이 공개범위 선택지를 주지 않았어요. 틱톡 앱에서 한 번 로그인한 뒤 다시 시도해 주세요." };
    }
    return {
      ok: true,
      options: {
        nickname: d.creator_nickname ?? "",
        privacyOptions,
        commentDisabled: d.comment_disabled === true,
        duetDisabled: d.duet_disabled === true,
        stitchDisabled: d.stitch_disabled === true,
        maxSec: typeof d.max_video_post_duration_sec === "number" ? d.max_video_post_duration_sec : null,
      },
    };
  } catch (e) {
    return { ok: false, why: e instanceof SnsHttpError ? `틱톡이 거절했어요. ${brief(e.body, 120)}` : "틱톡에 물어보지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}

/* ─────────────── 어댑터 ─────────────── */

export const tiktok: SnsAdapter = {
  provider: "tiktok",

  async isAvailable(): Promise<Availability> {
    if (!clientKey() || !clientSecret()) {
      return { ok: false, why: "틱톡 연결 열쇠가 아직 등록되지 않았어요. (TIKTOK_CLIENT_KEY·TIKTOK_CLIENT_SECRET)" };
    }
    return { ok: true };
  },

  async isConnected(siteId: string): Promise<Connection | null> {
    /* expired 도 그대로 돌려준다 — 화면이 「다시 연결하기」를 보여 줘야 한다 */
    return db.getConnection(siteId, "tiktok");
  },

  async connect({ siteId, redirectUri, code }) {
    const av = await this.isAvailable();
    if (!av.ok) return { stage: "failed" as const, kind: "REJECTED" as ErrorKind, detail: av.why };

    if (!code) {
      const u = new URL(OAUTH_DIALOG);
      u.searchParams.set("client_key", clientKey());
      u.searchParams.set("scope", SCOPES.join(","));
      u.searchParams.set("response_type", "code");
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("state", siteId);
      return { stage: "redirect" as const, authUrl: u.toString() };
    }

    try {
      const tok = await exchange({
        client_key: clientKey(), client_secret: clientSecret(),
        code, grant_type: "authorization_code", redirect_uri: redirectUri,
      });
      if (!tok.access_token) {
        return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "토큰을 받지 못했어요." };
      }

      /* 별명은 «있으면» 적는다. 못 얻어도 연결 자체를 실패로 만들지 않는다 */
      let accountName: string | null = null;
      try {
        const me = (await callJson(`${API}/user/info/?fields=display_name`, {
          method: "GET", headers: { Authorization: `Bearer ${tok.access_token}` },
        }, "tt:me")) as { data?: { user?: { display_name?: string } } };
        accountName = me.data?.user?.display_name ?? null;
      } catch { /* 아래에서 그대로 진행 */ }

      const saved = await db.saveConnection({
        siteId, provider: "tiktok",
        accountId: tok.open_id ?? null, accountName,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? null,
        expiresAt: expiryFrom(tok.expires_in),
        scopes: SCOPES,
      });
      if (!saved) return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "연결을 저장하지 못했어요." };
      return { stage: "connected" as const, connection: saved };
    } catch (e) {
      return { stage: "failed" as const, kind: tiktok.translateError(e), detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },

  /** ★ 토큰을 실제로 지운다 — 인스타·유튜브와 같은 규칙 */
  /**
   * ★★ 연결 끊기 — **그쪽에도 알린다.** (2026-09-13 김팀장 지적)
   *
   * ⚠ 전에는 **우리 표에서 줄만 지웠다.** 그러면 틱톡 쪽에는 «온스토리가 여전히 연결돼 있다»로
   *   남는다. 사장님이 끊었다고 믿는데 그쪽 설정에는 우리 앱이 그대로 보인다 —
   *   유튜브는 이미 제대로 하고 있어서(lib/sns/youtube.ts) 두 SNS 가 서로 다르게 굴었다.
   *
   * ★ 순서는 유튜브와 똑같이 맞춘다: ①그쪽에 폐기를 알리고 ②우리 표에서 지운다.
   *   ⚠ ①이 실패해도 ②는 **반드시** 한다 — 우리 손에 토큰이 남는 것이 더 나쁘다.
   */
  async disconnect(siteId: string) {
    const tk = await db.readTokens(siteId, "tiktok");
    const token = tk?.refreshToken || tk?.accessToken;
    if (token && clientKey() && clientSecret()) {
      try {
        await fetch(REVOKE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: clientKey(), client_secret: clientSecret(), token,
          }).toString(),
          cache: "no-store",
        });
      } catch (e) {
        /* 그래도 아래에서 우리 쪽은 지운다 */
        console.warn(JSON.stringify({ evt: "tt_revoke_failed", err: String(e).slice(0, 160) }));
      }
    }
    const ok = await db.deleteConnection(siteId, "tiktok");
    return ok ? { ok: true } : { ok: false, detail: "연결을 끊지 못했어요. 잠시 후 다시 시도해 주세요." };
  },

  translateError(e: unknown): ErrorKind {
    if (e instanceof SnsHttpError) {
      const b = e.body.toLowerCase();
      /* 확실한 단서가 있을 때만 올려 잡는다 — 나머지는 상태 코드 기본값 */
      if (b.includes("access_token_invalid") || b.includes("scope_not_authorized") || b.includes("token expired")) return "AUTH_EXPIRED";
      if (b.includes("rate_limit") || b.includes("too many")) return "QUOTA_EXCEEDED";
      /* ★ 도메인 인증이 안 됐을 때 틱톡이 주는 말 — 이건 다시 해도 안 된다 */
      if (b.includes("url_ownership_unverified")) return "REJECTED";
      if (b.includes("spam_risk") || b.includes("privacy_level_option_mismatch")) return "REJECTED";
      return kindFromStatus(e.status);
    }
    return "TRANSIENT";   // ★ 모르면 TRANSIENT
  },

  /** ⑨ 한도. ★ 길이는 **계정마다 다르다** — `extraOptions` 가 그쪽에 물어 실제 값을 얹는다 */
  getLimits: () => limitsOf("tiktok"),

  /**
   * ⑩ ★★ **넷 중 유일하게 «빈 배열이 아닌» 어댑터.** (상무님 규격서 v5 ⑩)
   *
   * 화면은 이 목록을 **읽어서** 시트를 그린다 — 화면 코드에 「틱톡」이라는 말이 없어야 한다.
   * 그래야 나중에 다른 SNS 가 비슷한 요구를 해도 시트 코드를 안 고친다.
   *
   * ★★ 공개범위·댓글의 `canPrefill` 이 **false** 인 것이 핵심이다.
   *   틱톡 심사는 「사장님이 **매번 스스로** 골랐는가」를 본다. 미리 골라 두면 그것으로 떨어진다.
   * ⚠ 보기 목록은 **그쪽(`creator_info`)이 준 것만** 쓴다. 우리가 지어내지 않는다.
   * ⚠ 못 물어보면 **빈 배열**을 돌려준다 — 「기본값으로 올려 버리기」보다 「시트를 안 그리기」가 안전하다.
   */
  async extraOptions(siteId: string): Promise<ExtraField[]> {
    const r = await creatorOptions(siteId);
    if (!r.ok) return [];
    const o = r.options;
    return [
      { key: "title", label: "제목", kind: "text", required: true, canPrefill: true },
      {
        key: "privacyLevel", label: "누가 볼 수 있나요", kind: "choice", required: true,
        canPrefill: false,                       // ★ 미리 고르면 안 된다
        options: o.privacyOptions.map((v) => ({ value: v, label: PRIVACY_LABEL[v] ?? v })),
      },
      /* ★★ **「허용」으로 묻는다. 「막기」가 아니다.** (2026-09-12 틱톡 규격서 D)
         틱톡은 **기본이 «전부 꺼짐»**이어야 한다고 정했다. 「막기」로 물으면
         아무것도 안 만졌을 때 **댓글이 열린 채로** 올라가 요구와 반대가 된다.
         심사관도 화면의 라벨을 보는데 「댓글 막기」는 요구를 안 따른 것으로 읽힌다.
         ⚠ 틱톡 API 필드는 `disable_*` 이라 **보낼 때 뒤집는다**(화면 allow → 서버 disable).
         ★ 못 켜는 것도 **빼지 않고 보여 준다** — 심사관이 「비활성 처리를 했는지」 봐야 하는데
           아예 없으면 판단을 못 한다. `disabled` 로 함께 준다. */
      { key: "allowComment", label: "댓글 허용", kind: "check", required: false, canPrefill: false, disabled: o.commentDisabled },
      { key: "allowDuet", label: "듀엣 허용", kind: "check", required: false, canPrefill: false, disabled: o.duetDisabled },
      { key: "allowStitch", label: "이어찍기 허용", kind: "check", required: false, canPrefill: false, disabled: o.stitchDisabled },
    ];
  },

  isDuplicate: (siteId, entryId) => db.isDuplicate(siteId, entryId, "tiktok"),
  getQuota: (siteId): Promise<Quota> => db.readQuota("tiktok", siteId),

  /**
   * 올리기 — 인스타와 같은 두 걸음: ①맡기기 → ②다 됐나 확인.
   *
   * ★★ **`extra`(사장님이 고른 값)가 없으면 «시작하지 않는다».** 틱톡 심사 요건이다.
   *   기본값으로 몰래 올리면 심사에서 떨어지고, 무엇보다 **사장님 계정에 우리가 마음대로 공개범위를 정하는 것**이 된다.
   * ★★ `containerId` 에 틱톡의 `publish_id` 를 담는다 — 인스타 컨테이너와 같은 자리다.
   *   있으면 ①을 건너뛴다. 안 그러면 **같은 영상이 두 번 올라간다.**
   */
  async upload(input: UploadInput): Promise<UploadOutcome> {
    const token = await freshToken(input.siteId);
    if (!token) return { state: "failed", kind: "AUTH_EXPIRED", detail: "연결이 없어요." };

    const choice = input.extra as TiktokChoice | undefined;
    if (!input.containerId && (!choice || !choice.privacyLevel)) {
      return {
        state: "failed", kind: "REJECTED",
        detail: "틱톡은 올릴 때마다 제목·공개범위를 직접 고르셔야 해요. [틱톡에 올리기]를 눌러 골라 주세요.",
      };
    }
    /* ★★ 「브랜디드 콘텐츠」 + 「나만 보기」는 틱톡이 거절한다. **서버가 마지막으로 막는다.**
       화면도 막지만, 화면 값을 그대로 믿지 않는다(불변 규칙 4의 정신).
       ⚠ 여기서 안 막으면 한도 1개를 쓰고 그쪽 거절 메시지만 받게 된다. */
    if (!input.containerId && choice?.brandedContent && choice.privacyLevel === PRIVATE_LEVEL) {
      return {
        state: "failed", kind: "REJECTED",
        detail: "Branded content visibility cannot be set to private. (브랜디드 콘텐츠는 「나만 보기」로 올릴 수 없어요)",
      };
    }

    /* ⚠ `try` **밖**에 둔다. 안에 두면 오류가 났을 때 catch 가 이 번호를 못 봐서,
       바이트를 이미 보낸 건의 접수 번호가 사라진다 ⇒ 다시 누르면 두 번 올라간다. */
    let publishId = input.containerId ?? null;
    try {

      /* ── ⓪ 파일을 읽는다 — **틱톡에 직접 보내려고** (2026-09-17 지시 [18]) ──
         ⚠ 이미 맡긴 건(`containerId` 있음)이면 **읽지 않는다.** 바이트는 그때 이미 갔다.
         ⚠ 권반장 걱정: 「메모리에 통째로 올리지 마십시오」. 그런데 틱톡은 `video_size` 를
           **init 에 먼저** 요구하고, PUT 에는 정확한 `Content-Length`·`Content-Range` 를 요구한다.
           흘려보내면서 그 값을 맞추는 길이 이 런타임에는 없다(위 §파일 보내기 주석 참조).
           ⇒ **대신 크기로 막는다.** 아래 상한을 넘으면 읽지도 않고 돌려보낸다.
           60초 영상은 보통 5~15MB 라 실제로 걸릴 일은 거의 없다. */
      let bytes = new Uint8Array(0);
      if (!publishId) {
        const src = await storage.signedGetUrl(input.sourceKey, 900);
        /* ★ **한 바이트만 받아 «전체 크기»를 먼저 안다.**
           ⚠ `HEAD` 로 물으면 **403** 이 온다 — 서명은 `GET` 에만 유효하다(2026-09-17 실측).
             전에 여기 HEAD 를 썼다가 크기가 늘 0 으로 읽혀 **상한 검사가 죽어 있었다.**
           ⇒ `Range: bytes=0-0` 로 받으면 `Content-Range: bytes 0-0/전체` 가 와서 총 길이를 준다. */
        const probe = await fetch(src, { headers: { Range: "bytes=0-0" }, cache: "no-store" }).catch(() => null);
        const declared = Number(probe?.headers.get("content-range")?.split("/")[1] ?? 0);
        if (declared > TT_MAX_BYTES) {
          return { state: "failed", kind: "REJECTED", detail: `영상이 너무 커요 (${Math.round(declared / 1048576)}MB). 60초 안쪽으로 다시 찍어 주세요.` };
        }
        const fileRes = await fetch(src, { cache: "no-store" });
        if (!fileRes.ok) return { state: "failed", kind: "TRANSIENT", detail: "영상 파일을 읽지 못했어요." };
        bytes = new Uint8Array(await fileRes.arrayBuffer());
        if (bytes.byteLength === 0) return { state: "failed", kind: "TRANSIENT", detail: "영상 파일이 비어 있어요." };
        if (bytes.byteLength > TT_MAX_BYTES) {
          return { state: "failed", kind: "REJECTED", detail: `영상이 너무 커요 (${Math.round(bytes.byteLength / 1048576)}MB). 60초 안쪽으로 다시 찍어 주세요.` };
        }
      }

      /* ── ① 맡기기 — 이미 맡겼으면 건너뛴다(두 번 올라가는 것을 막는 핵심) ── */
      if (!publishId) {
        const body = {
          post_info: {
            title: (choice!.title || input.caption || input.title).slice(0, 2200),
            privacy_level: choice!.privacyLevel,
            disable_comment: choice!.disableComment,
            disable_duet: choice!.disableDuet,
            disable_stitch: choice!.disableStitch,
            /* ★ 상업용 콘텐츠 — 화면의 토글이 실제로 여기까지 온다 (2026-09-12 규격서 C) */
            brand_organic_toggle: choice!.brandOrganic === true,
            brand_content_toggle: choice!.brandedContent === true,
          },
          /* 🔴 **여기가 2026-09-17 에 바뀐 자리다** (지시 [18]).
             전에는 `{ source: "PULL_FROM_URL", video_url: input.publicUrl }` 이었고,
             그 주소가 `img.onstori.com` 이라 틱톡이 **네 번 다** `url_ownership_unverified` 로
             거절했다. 이제 **우리가 바이트를 직접 밀어 넣는다.** 아래 §파일 보내기 참조. */
          source_info: {
            source: "FILE_UPLOAD",
            video_size: bytes.byteLength,
            /* ⚠ **한 덩이로 보낸다.** 틱톡 규칙: 5MB 미만은 «반드시» 통째로,
               그 위로도 64MB 까지는 한 덩이가 허용된다. 60초 영상은 늘 그 아래다.
               ⚠ `chunk_size` 와 `video_size` 가 다르면 틱톡이 거절한다. 같이 둬라. */
            chunk_size: bytes.byteLength,
            total_chunk_count: 1,
          },
        };
        const made = (await callJson(`${API}/post/publish/video/init/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify(body),
        }, "tt:init")) as { data?: { publish_id?: string; upload_url?: string } };
        if (!made.data?.publish_id) return { state: "failed", kind: "TRANSIENT", detail: "틱톡이 접수 번호를 주지 않았어요." };
        if (!made.data.upload_url) return { state: "failed", kind: "TRANSIENT", detail: "틱톡이 올릴 자리를 주지 않았어요." };
        publishId = made.data.publish_id;

        /* ── §파일 보내기 — 받은 자리에 바이트를 그대로 PUT 한다 ──
           ⚠ 세 헤더가 **전부 필수**다(틱톡 문서). `Content-Length` 는 손으로 적지 않는다 —
             바이트 덩이를 body 로 주면 런타임이 정확히 넣어 준다.
             (`lib/sns/youtube.ts` 가 「fetch 가 Content-Length 를 조용히 무시한다」고 적어 둔
              바로 그 이유다. 손으로 적고 「적었다」고 믿는 것이 가장 위험하다.)
           ⚠ 여기서 실패하면 `publish_id` 를 버리고 실패로 돌린다. **아직 아무것도 게시되지 않았다** —
             다시 누르면 새 번호로 처음부터 한다. 두 번 올라가지 않는다. */
        /* ⚠ **형식을 손으로 적지 않는다.** 틱톡이 받는 것은 mp4·quicktime·webm 셋뿐이고,
             딱지가 내용과 다르면 거절한다. 우리 저장소에는 옛 `.webm` 녹화도 남아 있다
             (2026-09-17 실측 — `sample-interior` 의 영상 13건이 webm 이다).
           ★ 파일 머리 64바이트로 **진짜 형식**을 본다 — `lib/media-sniff.ts` 가 하는 그 일이다. */
        const found = sniff(bytes.subarray(0, SNIFF_BYTES));
        const ct = found.container === "webm" ? "video/webm"
          : found.container === "quicktime" ? "video/quicktime"
          : "video/mp4";
        const put = await fetch(made.data.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": ct,
            "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
          },
          body: bytes,
          cache: "no-store",
        });
        if (!put.ok) {
          const why = brief(await put.text().catch(() => ""), 160);
          console.error(JSON.stringify({ evt: "tt_put_failed", status: put.status, why }));
          return {
            state: "failed",
            kind: kindFromStatus(put.status),
            detail: `틱톡에 영상을 올리지 못했어요 (${put.status}). ${why}`,
          };
        }
        console.log(JSON.stringify({ evt: "tt_put_ok", bytes: bytes.byteLength, ct, publishId }));
      }

      /* ── ② 다 됐나 — **여기서 기다리지 않는다.** 한 번만 보고 돌려준다.
             기다림은 부르는 쪽(화면 폴링·크론)이 맡는다 — 인스타와 같은 규칙이다. ── */
      const st = (await callJson(`${API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id: publishId }),
      }, "tt:status")) as {
        data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] };
      };
      const status = st.data?.status ?? "";

      if (status === "FAILED") {
        return { state: "failed", kind: "REJECTED", detail: `틱톡이 받지 않았어요 (${st.data?.fail_reason ?? "이유 없음"}).` };
      }
      if (status !== "PUBLISH_COMPLETE") {
        return { state: "processing", containerId: publishId };   // 아직 — 다시 불러 달라
      }

      /* ★ 틱톡은 게시물 «주소»를 바로 주지 않는다. id 만 준다.
         ⚠ 없는 주소를 지어내지 않는다 — [보기] 를 안 보여 주는 편이 낫다. */
      const postId = st.data?.publicaly_available_post_id?.[0];
      return {
        state: "published",
        remotePostId: postId ? String(postId) : publishId,
        remoteUrl: null,
      };
    } catch (e) {
      const kind = tiktok.translateError(e);
      if (kind === "AUTH_EXPIRED") await db.markExpired(input.siteId, "tiktok");
      /* 🔴 **이미 맡긴 건이면 «실패»로 끝내지 않는다** (2026-09-17 지시 [18] 을 만들며 고침).
         바이트는 이미 틱톡에 들어갔고 번호도 받았다. 여기서 실패로 돌리면 번호가 사라져,
         사장님이 다시 누르면 **같은 영상이 한 번 더 올라간다.**
         ⚠ 연결이 풀린 것(AUTH_EXPIRED)·틱톡이 거절한 것(REJECTED)은 다시 눌러도 소용없으니 그대로 실패다.
         ⚠ 잠깐 그런 것(TRANSIENT)만 「아직 진행 중」으로 돌려 번호를 지킨다. */
      if (publishId && kind === "TRANSIENT") {
        console.warn(JSON.stringify({ evt: "tt_status_transient", publishId, err: brief(String(e), 120) }));
        return { state: "processing", containerId: publishId };
      }
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};
