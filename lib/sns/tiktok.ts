import * as db from "./db";
import { SnsHttpError, brief, callJson, kindFromStatus } from "./http";
import type { Availability, Connection, ErrorKind, Quota, SnsAdapter, UploadInput, UploadOutcome } from "./types";

/**
 * 틱톡 어댑터 — Direct Post (2026-09-12 회장님 지시)
 *
 * ★★ **인스타와 같은 방식이다** — 우리가 «공개 주소»를 주면 틱톡이 가져간다(`PULL_FROM_URL`).
 *   도메인 인증이 끝났기에 이 길을 쓴다. 파일을 우리 서버로 통과시키지 않는다.
 *
 * ★★ **인스타와 다른 것 셋** — 이것이 틱톡의 심사 요건이다:
 *   ① 올리기 전에 **`creator_info` 를 반드시 먼저 불러야 한다.** 그 응답이 주는
 *      «고를 수 있는 공개범위»만 보내야 하고, 마음대로 정하면 심사에서 떨어진다.
 *   ② 사장님이 **매번 직접** 제목·공개범위·댓글 허용을 골라야 한다(기본값으로 몰래 넘기면 안 된다).
 *   ③ 토큰이 **24시간**이면 만료된다(인스타는 60일). 그래서 **올리기 직전에 항상 갱신**한다.
 *      갱신 토큰은 365일짜리다.
 *
 * ⚠ **첫 게시 전에 반드시 확인할 것 — 도메인 인증 대상.**
 *   `PULL_FROM_URL` 은 틱톡에 **인증된 도메인**의 주소만 받는다. 우리 영상은
 *   공개 저장소(`R2_PUBLIC_BASE`, 지금 `img.onstori.com`)에서 나간다.
 *   `onstori.com` 만 인증하셨다면 **그 주소는 거절된다.** 실패하면 화면의
 *   [자세한 이유 보기]에 `url_ownership_unverified` 같은 말이 뜬다 — 그때는 도메인을 하나 더 인증하면 된다.
 *
 * ⚠ 아래 엔드포인트·필드는 틱톡 공식 문서 기준으로 적었다. **첫 실제 게시로 대조해야 한다.**
 */

const API = "https://open.tiktokapis.com/v2";
const OAUTH_DIALOG = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = `${API}/oauth/token/`;

/** 심사에 신청한 그대로. 늘리지 마라 — 안 쓰는 권한을 달라고 하면 심사에서 떨어진다 */
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];

const clientKey = () => process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
const clientSecret = () => process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "";

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
};

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
  async disconnect(siteId: string) {
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

    try {
      let publishId = input.containerId ?? null;

      /* ── ① 맡기기 — 이미 맡겼으면 건너뛴다(두 번 올라가는 것을 막는 핵심) ── */
      if (!publishId) {
        const body = {
          post_info: {
            title: (choice!.title || input.caption || input.title).slice(0, 2200),
            privacy_level: choice!.privacyLevel,
            disable_comment: choice!.disableComment,
            disable_duet: choice!.disableDuet,
            disable_stitch: choice!.disableStitch,
          },
          source_info: { source: "PULL_FROM_URL", video_url: input.publicUrl },
        };
        const made = (await callJson(`${API}/post/publish/video/init/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify(body),
        }, "tt:init")) as { data?: { publish_id?: string } };
        if (!made.data?.publish_id) return { state: "failed", kind: "TRANSIENT", detail: "틱톡이 접수 번호를 주지 않았어요." };
        publishId = made.data.publish_id;
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
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};
