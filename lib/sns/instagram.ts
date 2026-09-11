import * as db from "./db";
import { SnsHttpError, brief, callJson, kindFromStatus } from "./http";
import type { Availability, Connection, ErrorKind, Quota, SnsAdapter, UploadInput, UploadOutcome } from "./types";

/**
 * 인스타그램 릴스 어댑터. (2026-09-11)
 *
 * ★★ 인스타는 **우리가 «공개 주소»를 주면 그쪽이 가져간다.** 파일을 보내지 않는다.
 *   그래서 올리기 직전에 그 영상 한 개만 공개 창고로 복사해 둬야 한다
 *   (복사는 라우트가 한다 — `storage.copyToPublic`. 어댑터는 주소만 받는다).
 *
 * ★★ 3단계다: ① 컨테이너 만들기 → ② 다 됐는지 확인 → ③ 게시.
 *   ②가 오래 걸린다(최대 5분). 그래서 `upload()` 는 한 번에 안 끝나고
 *   `{state:"processing", containerId}` 를 돌려줄 수 있다. 그 값을 `sns_posts.container_id`
 *   에 적어 두고 다시 부르면 **①을 건너뛴다.** ①부터 다시 하면 같은 영상이 두 번 올라간다.
 *
 * ⚠⚠ **확인 필요 — 김팀장 조사 대조.** 아래 엔드포인트·필드 이름은 클코가 아는 값으로 적었다.
 *   `fable51plandept/AI_Context/` 가 없어 김팀장 조사를 못 읽었다. 실제 심사 전에 반드시 대조해야 한다.
 *   특히 ①API 버전 ②`media_type` 값 ③`status_code` 의 값 집합 ④필요한 권한(scope) 목록.
 */

/* ⚠ 확인 필요 — 김팀장 조사와 대조할 것 */
const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";
/** ⚠ 확인 필요 — 릴스 게시에 실제로 요구되는 권한 목록 */
const SCOPES = ["instagram_basic", "instagram_content_publish", "pages_show_list", "business_management"];

const appId = () => process.env.META_APP_ID ?? "";
const appSecret = () => process.env.META_APP_SECRET ?? "";

/** 인스타가 그쪽에서 처리를 끝냈나 — ⚠ 값 집합 확인 필요 */
type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "PUBLISHED" | "EXPIRED";

export const instagram: SnsAdapter = {
  provider: "instagram",

  async isAvailable(): Promise<Availability> {
    if (!appId() || !appSecret()) {
      return { ok: false, why: "인스타그램 연결 열쇠가 아직 등록되지 않았어요. (META_APP_ID·META_APP_SECRET)" };
    }
    return { ok: true };
  },

  async isConnected(siteId: string): Promise<Connection | null> {
    const c = await db.getConnection(siteId, "instagram");
    return c && c.status === "active" ? c : c;   // expired 도 돌려준다 — 화면이 「다시 연결」을 보여 줘야 한다
  },

  async connect({ siteId, redirectUri, code }) {
    const av = await this.isAvailable();
    if (!av.ok) return { stage: "failed" as const, kind: "REJECTED" as ErrorKind, detail: av.why };

    /* 아직 돌아오기 전 — 사장님을 메타 로그인으로 보낸다 */
    if (!code) {
      const u = new URL(OAUTH_DIALOG);
      u.searchParams.set("client_id", appId());
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("scope", SCOPES.join(","));
      u.searchParams.set("response_type", "code");
      u.searchParams.set("state", siteId);
      return { stage: "redirect" as const, authUrl: u.toString() };
    }

    /* 돌아왔다 — 코드를 토큰으로 바꾼다 */
    try {
      const t = new URL(`${GRAPH}/oauth/access_token`);
      t.searchParams.set("client_id", appId());
      t.searchParams.set("client_secret", appSecret());
      t.searchParams.set("redirect_uri", redirectUri);
      t.searchParams.set("code", code);
      const tok = (await callJson(t.toString(), { method: "GET" }, "ig:token")) as {
        access_token?: string; expires_in?: number;
      };
      if (!tok.access_token) {
        return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "토큰을 받지 못했어요." };
      }

      /* ⚠ 확인 필요 — 페이지→인스타 프로페셔널 계정을 찾아오는 정확한 경로.
         지금은 «내 페이지 목록 → 연결된 instagram_business_account» 순서로 적었다. */
      let accountId: string | null = null;
      let accountName: string | null = null;
      try {
        const pages = (await callJson(
          `${GRAPH}/me/accounts?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(tok.access_token)}`,
          { method: "GET" }, "ig:pages",
        )) as { data?: { instagram_business_account?: { id?: string; username?: string } }[] };
        const hit = pages.data?.find((p) => p.instagram_business_account?.id);
        accountId = hit?.instagram_business_account?.id ?? null;
        accountName = hit?.instagram_business_account?.username ?? null;
      } catch { /* 아래에서 «프로페셔널 계정이 아니다»로 안내한다 */ }

      if (!accountId) {
        /* ★ 조용히 실패하지 않는다. 무엇을 해야 하는지 말한다 */
        return {
          stage: "failed" as const, kind: "REJECTED" as ErrorKind,
          detail: "인스타그램 «프로페셔널(비즈니스) 계정»이 페이스북 페이지에 연결돼 있어야 해요.",
        };
      }

      const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;
      const saved = await db.saveConnection({
        siteId, provider: "instagram",
        accountId, accountName, accessToken: tok.access_token, expiresAt, scopes: SCOPES,
      });
      if (!saved) return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "연결을 저장하지 못했어요." };
      return { stage: "connected" as const, connection: saved };
    } catch (e) {
      return { stage: "failed" as const, kind: instagram.translateError(e), detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },

  /** ★ 토큰을 실제로 지운다 */
  async disconnect(siteId: string) {
    const ok = await db.deleteConnection(siteId, "instagram");
    return ok ? { ok: true } : { ok: false, detail: "연결을 끊지 못했어요. 잠시 후 다시 시도해 주세요." };
  },

  translateError(e: unknown): ErrorKind {
    if (e instanceof SnsHttpError) {
      const b = e.body.toLowerCase();
      /* ⚠ 확인 필요 — 메타가 실제로 내려주는 코드/문구와 대조.
         아래는 «확실한 단서가 있을 때만» 올려 잡는 규칙이다. 나머지는 상태 코드 기본값. */
      if (b.includes("oauthexception") && (b.includes("expired") || b.includes("session"))) return "AUTH_EXPIRED";
      if (b.includes("rate limit") || b.includes("too many")) return "QUOTA_EXCEEDED";
      return kindFromStatus(e.status);
    }
    return "TRANSIENT";   // ★ 모르는 것은 전부 여기
  },

  isDuplicate: (siteId, entryId) => db.isDuplicate(siteId, entryId, "instagram"),
  getQuota: (siteId): Promise<Quota> => db.readQuota("instagram", siteId),

  async upload(input: UploadInput): Promise<UploadOutcome> {
    const tk = await db.readTokens(input.siteId, "instagram");
    if (!tk?.accessToken || !tk.accountId) {
      return { state: "failed", kind: "AUTH_EXPIRED", detail: "연결이 없어요." };
    }
    const token = tk.accessToken;
    const ig = tk.accountId;

    try {
      /* ── ① 컨테이너 만들기 — 이미 있으면 건너뛴다(두 번 올라가는 것을 막는 핵심) ── */
      let containerId = input.containerId ?? null;
      if (!containerId) {
        const c = new URL(`${GRAPH}/${ig}/media`);
        c.searchParams.set("media_type", "REELS");       // ⚠ 확인 필요
        c.searchParams.set("video_url", input.publicUrl);
        c.searchParams.set("caption", input.caption.slice(0, 2200));
        c.searchParams.set("access_token", token);
        const made = (await callJson(c.toString(), { method: "POST" }, "ig:container")) as { id?: string };
        if (!made.id) return { state: "failed", kind: "TRANSIENT", detail: "컨테이너를 만들지 못했어요." };
        containerId = made.id;
      }

      /* ── ② 다 됐나 확인 — ⚠ 여기서는 **기다리지 않는다.** 한 번만 보고 돌려준다.
             기다림(1분 간격 최대 5분)은 부르는 쪽이 맡는다. 서버리스 함수가 5분을 붙들고 있으면
             시간 초과로 끊기고, 그 끊김이 곧 «두 번 올리기»의 원인이 된다. ── */
      const st = (await callJson(
        `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
        { method: "GET" }, "ig:status",
      )) as { status_code?: ContainerStatus };

      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        return { state: "failed", kind: "REJECTED", detail: `그쪽이 영상을 받지 않았어요 (${st.status_code}).` };
      }
      if (st.status_code !== "FINISHED") {
        return { state: "processing", containerId };    // 아직 — 다시 불러 달라
      }

      /* ── ③ 게시 ── */
      const p = new URL(`${GRAPH}/${ig}/media_publish`);
      p.searchParams.set("creation_id", containerId);
      p.searchParams.set("access_token", token);
      const pub = (await callJson(p.toString(), { method: "POST" }, "ig:publish")) as { id?: string };
      if (!pub.id) return { state: "processing", containerId };   // 애매하면 «아직»으로 둔다 — 두 번 올리는 것보다 낫다

      return {
        state: "published",
        remotePostId: pub.id,
        /* ⚠ 확인 필요 — 게시물 주소를 만드는 정확한 방법(permalink 조회가 필요할 수 있다) */
        remoteUrl: null,
      };
    } catch (e) {
      const kind = instagram.translateError(e);
      if (kind === "AUTH_EXPIRED") await db.markExpired(input.siteId, "instagram");
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};
