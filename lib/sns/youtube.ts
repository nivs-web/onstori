import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import * as db from "./db";
import { SnsHttpError, brief, callJson, kindFromStatus } from "./http";
import type { Availability, Connection, ErrorKind, Quota, SnsAdapter, UploadInput, UploadOutcome } from "./types";

/**
 * 유튜브 쇼츠 어댑터. (2026-09-11)
 *
 * ★★ 인스타와 **방식이 정반대**다. 인스타는 공개 주소를 주면 그쪽이 가져가지만,
 *   유튜브는 **우리가 파일을 직접 보낸다.** 그래서 공개 복사가 필요 없다 —
 *   비공개 원본을 그대로 읽어 보낸다.
 *
 * ★★ **지금은 열지 않는다**(회장님 지시 3). `app_settings` 의 key='sns:youtube' 로
 *   off / review / on 세 값을 두고, **줄이 없으면 off** 다.
 *   off 인 동안 화면에는 「준비 중」으로 보이고 체크가 아예 안 눌린다.
 *
 * ⚠⚠ **확인 필요 — 김팀장 조사 대조.** 엔드포인트·권한·업로드 방식은 클코가 아는 값이다.
 *   `fable51plandept/AI_Context/` 가 없어 조사를 못 읽었다. 심사 전에 반드시 대조할 것.
 *   특히 ①필요한 scope ②쇼츠로 인식시키는 조건(세로·길이·제목 태그) ③심사 전 업로드의 공개 범위 제한.
 */

/* ⚠ 확인 필요 — 김팀장 조사와 대조할 것 */
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const REVOKE = "https://oauth2.googleapis.com/revoke";
/** ⚠ 확인 필요 — 업로드에 실제로 요구되는 scope */
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

/** ⚠ 심사 전에는 비공개로 올린다. 확인 필요 — 심사 요건에 맞는 공개 범위 */
const PRIVACY_BEFORE_REVIEW = "private";

const clientId = () => process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const clientSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";

/** 한 번에 통째로 보낼 수 있는 크기 한계 — 60초 영상은 보통 10~30MB 다 */
const MAX_BYTES = 300 * 1024 * 1024;

type Gate = "off" | "review" | "on";

/**
 * 게이트 읽기 — **줄이 없으면 off.**
 * ⚠ 표가 아직 없을 수도 있다(db push 전). 그때도 off 로 본다 — 열려 있는 쪽으로 기울지 않는다.
 */
async function readGate(): Promise<Gate> {
  try {
    const { data } = await sbAdmin().from("app_settings").select("value").eq("key", "sns:youtube").maybeSingle();
    const m = (data as { value?: { mode?: string } } | null)?.value?.mode;
    return m === "on" || m === "review" ? m : "off";
  } catch { return "off"; }
}

/** 토큰이 만료됐으면 새로 받는다. 못 받으면 null */
async function freshToken(siteId: string): Promise<string | null> {
  const tk = await db.readTokens(siteId, "youtube");
  if (!tk) return null;
  const soon = Date.now() + 60_000;
  if (tk.accessToken && (!tk.expiresAt || new Date(tk.expiresAt).getTime() > soon)) return tk.accessToken;
  if (!tk.refreshToken) return null;
  try {
    const body = new URLSearchParams({
      client_id: clientId(), client_secret: clientSecret(),
      refresh_token: tk.refreshToken, grant_type: "refresh_token",
    });
    const r = (await callJson(TOKEN, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
    }, "yt:refresh")) as { access_token?: string; expires_in?: number };
    if (!r.access_token) return null;
    await db.saveConnection({
      siteId, provider: "youtube",
      accessToken: r.access_token,
      refreshToken: tk.refreshToken,
      expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
      accountId: tk.accountId, scopes: SCOPES,
    });
    return r.access_token;
  } catch { return null; }
}

export const youtube: SnsAdapter = {
  provider: "youtube",

  async isAvailable(): Promise<Availability> {
    const gate = await readGate();
    if (gate === "off") {
      /* ★ 「준비 중」이라고 **정확히** 말한다. 고장난 것처럼 보이지 않게 */
      /* ⚠ 「심사」는 금지어다(2026-09-12 회장님). 사장님에게 우리 사정을 말할 이유가 없고,
         「심사」는 «떨어질 수도 있다»로 읽힌다. 약속은 우리가 지는 쪽으로 적는다. */
      return { ok: false, why: "유튜브는 준비 중입니다. 준비되는 대로 열어 드리고 알려드리겠습니다." };
    }
    if (!clientId() || !clientSecret()) {
      return { ok: false, why: "유튜브 연결 열쇠가 아직 등록되지 않았어요. (GOOGLE_OAUTH_CLIENT_ID·SECRET)" };
    }
    return { ok: true };
  },

  async isConnected(siteId: string): Promise<Connection | null> {
    return db.getConnection(siteId, "youtube");
  },

  async connect({ siteId, redirectUri, code }) {
    const av = await this.isAvailable();
    if (!av.ok) return { stage: "failed" as const, kind: "REJECTED" as ErrorKind, detail: av.why };

    if (!code) {
      const u = new URL(AUTH);
      u.searchParams.set("client_id", clientId());
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", SCOPES.join(" "));
      u.searchParams.set("access_type", "offline");     // refresh_token 을 받으려면 필요하다
      u.searchParams.set("prompt", "consent");
      u.searchParams.set("state", siteId);
      return { stage: "redirect" as const, authUrl: u.toString() };
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId(), client_secret: clientSecret(),
        code, grant_type: "authorization_code", redirect_uri: redirectUri,
      });
      const tok = (await callJson(TOKEN, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
      }, "yt:token")) as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!tok.access_token) {
        return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "토큰을 받지 못했어요." };
      }

      /* ⚠ 확인 필요 — 채널 이름을 가져오는 호출(youtube.readonly 권한이 더 필요할 수 있다).
         권한이 없으면 이름 없이 연결만 저장한다. 이름은 «있으면 좋은 것»이지 필수가 아니다. */
      let accountName: string | null = null;
      let accountId: string | null = null;
      try {
        const ch = (await callJson(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { method: "GET", headers: { Authorization: `Bearer ${tok.access_token}` } }, "yt:channel",
        )) as { items?: { id?: string; snippet?: { title?: string } }[] };
        accountId = ch.items?.[0]?.id ?? null;
        accountName = ch.items?.[0]?.snippet?.title ?? null;
      } catch { /* 이름 없이 진행 */ }

      const saved = await db.saveConnection({
        siteId, provider: "youtube",
        accountId, accountName,
        accessToken: tok.access_token, refreshToken: tok.refresh_token ?? null,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
        scopes: SCOPES,
      });
      if (!saved) return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "연결을 저장하지 못했어요." };
      return { stage: "connected" as const, connection: saved };
    } catch (e) {
      return { stage: "failed" as const, kind: youtube.translateError(e), detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },

  /**
   * ★★ 연결 끊기 — **유튜브 약관이 «저장한 토큰을 실제로 파기하라»고 요구한다.**
   *   그래서 ①구글에도 폐기를 알리고 ②우리 표에서 줄을 지운다.
   *   ①이 실패해도 ②는 반드시 한다 — 우리 손에 토큰이 남는 것이 더 나쁘다.
   */
  async disconnect(siteId: string) {
    const tk = await db.readTokens(siteId, "youtube");
    const t = tk?.refreshToken || tk?.accessToken;
    if (t) {
      try {
        await fetch(REVOKE, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: t }).toString(), cache: "no-store",
        });
      } catch { /* 그래도 아래에서 우리 쪽은 지운다 */ }
    }
    const ok = await db.deleteConnection(siteId, "youtube");
    return ok ? { ok: true } : { ok: false, detail: "연결을 끊지 못했어요. 잠시 후 다시 시도해 주세요." };
  },

  translateError(e: unknown): ErrorKind {
    if (e instanceof SnsHttpError) {
      const b = e.body.toLowerCase();
      /* ⚠ 확인 필요 — 구글이 실제로 내려주는 reason 값과 대조 */
      if (b.includes("quotaexceeded") || b.includes("ratelimitexceeded") || b.includes("uploadlimitexceeded")) return "QUOTA_EXCEEDED";
      if (b.includes("invalid_grant") || b.includes("invalid credentials") || b.includes("unauthorized")) return "AUTH_EXPIRED";
      if (b.includes("failedprecondition") || b.includes("invalidvideo") || b.includes("mediabodyrequired")) return "REJECTED";
      return kindFromStatus(e.status);
    }
    return "TRANSIENT";   // ★ 모르는 것은 전부 여기
  },

  isDuplicate: (siteId, entryId) => db.isDuplicate(siteId, entryId, "youtube"),
  getQuota: (siteId): Promise<Quota> => db.readQuota("youtube", siteId),

  async upload(input: UploadInput): Promise<UploadOutcome> {
    const gate = await readGate();
    if (gate === "off") return { state: "failed", kind: "REJECTED", detail: "유튜브는 아직 준비 중이에요." };

    const token = await freshToken(input.siteId);
    if (!token) {
      await db.markExpired(input.siteId, "youtube");
      return { state: "failed", kind: "AUTH_EXPIRED", detail: "연결이 풀렸어요." };
    }

    try {
      /* ── 파일을 읽는다. 유튜브는 **우리가 직접 보낸다** ── */
      const src = await storage.signedGetUrl(input.sourceKey, 900);
      const fileRes = await fetch(src, { cache: "no-store" });
      if (!fileRes.ok) return { state: "failed", kind: "TRANSIENT", detail: "영상 파일을 읽지 못했어요." };
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) {
        return { state: "failed", kind: "REJECTED", detail: `영상이 너무 커요 (${Math.round(bytes.byteLength / 1048576)}MB).` };
      }

      /* ── ① 업로드 자리 받기(resumable) ── */
      const meta = {
        snippet: { title: input.title.slice(0, 100), description: input.caption.slice(0, 4900) },
        status: { privacyStatus: gate === "on" ? "public" : PRIVACY_BEFORE_REVIEW, selfDeclaredMadeForKids: false },
      };
      const init = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(bytes.byteLength),
        },
        body: JSON.stringify(meta),
        cache: "no-store",
      });
      if (!init.ok) throw new SnsHttpError(init.status, brief(await init.text()), "yt:init");
      const where = init.headers.get("location");
      if (!where) return { state: "failed", kind: "TRANSIENT", detail: "업로드 자리를 받지 못했어요." };

      /* ── ② 파일 보내기 ── */
      const put = await fetch(where, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) },
        body: bytes,
        cache: "no-store",
      });
      if (!put.ok) throw new SnsHttpError(put.status, brief(await put.text()), "yt:put");
      const done = (await put.json().catch(() => ({}))) as { id?: string };
      if (!done.id) return { state: "failed", kind: "TRANSIENT", detail: "올라갔는지 확인하지 못했어요." };

      return { state: "published", remotePostId: done.id, remoteUrl: `https://www.youtube.com/watch?v=${done.id}` };
    } catch (e) {
      const kind = youtube.translateError(e);
      if (kind === "AUTH_EXPIRED") await db.markExpired(input.siteId, "youtube");
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};
