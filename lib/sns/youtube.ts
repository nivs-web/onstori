import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import * as db from "./db";
import { limitsOf, TEXT_LIMITS, YOUTUBE_SPEC } from "./limits";
import { SnsHttpError, brief, callJson, kindFromStatus } from "./http";
import type { Availability, Connection, ErrorKind, Quota, SnsAdapter, UploadInput, UploadOutcome } from "./types";

/**
 * 유튜브 쇼츠 어댑터. (2026-09-11 · **2026-09-12 공식 문서로 값 검증**)
 *
 * ★★ 인스타와 **방식이 정반대**다. 인스타는 공개 주소를 주면 그쪽이 가져가지만,
 *   유튜브는 **우리가 파일을 직접 보낸다.** 그래서 공개 복사가 필요 없다 —
 *   비공개 원본을 그대로 읽어 보낸다.
 *
 * ★★ **지금은 열지 않는다**(회장님 지시 3). `app_settings` 의 key='sns:youtube' 로
 *   off / review / on 세 값을 두고, **줄이 없으면 off** 다.
 *   off 인 동안 화면에는 「준비 중」으로 보이고 체크가 아예 안 눌린다.
 *
 * ════════ 2026-09-12 공식 문서 대조 결과 ════════
 *
 * ✅ **확인됨** (출처를 각 상수 옆에 적었다)
 *   · resumable 업로드 절차(POST → Location → PUT → 201)와 이어받기(308 + Range)
 *   · `youtube.upload` 스코프로 `videos.insert` 가 **된다**
 *   · 심사 전 프로젝트의 업로드는 **강제로 비공개**가 된다 (아래 ⚠)
 *   · 쇼츠 분류 조건은 「정사각·세로 + **3분** 이하」 — `#Shorts` 태그 요구는 **없다**
 *   · 하루 100건 (`videos.insert` 전용 버킷 · 1 unit/건). 「1600 units」는 **폐기된 값**
 *
 * ⚠⚠ **심사 전에는 `privacyStatus:'public'` 을 보내도 무시되고 비공개로 잠긴다.**
 *   원문: 「All videos uploaded via the videos.insert endpoint from unverified API projects
 *   created after 28 July 2020 will be restricted to private viewing mode」
 *   게다가 **채널 주인에게 「비공개로 잠겼다」는 구글 메일이 자동 발송된다.**
 *   그래서 우리는 ①`review` 동안 애초에 비공개로 올리고 ②올린 뒤 그쪽이 준 공개범위를
 *   **되읽어** 사장님 화면에 그대로 말한다. 화면이 「올렸어요」라고만 하면 거짓말이 된다.
 *
 * ⚠⚠ **`youtube.upload` 만으로는 올린 뒤에 아무것도 못 고친다.**
 *   `videos.update` 는 youtube / youtube.force-ssl / youtubepartner 만 받는다 —
 *   `youtube.upload` 는 **허용 목록에 없다.** 즉 감사 통과 후에 예전 영상을
 *   비공개→공개로 **뒤집는 기능은 지금 스코프로 불가능**하다. 그 기능이 필요해지면
 *   스코프를 넓혀야 하고, 그러면 동의 화면 문구가 훨씬 무서워진다. 지금은 넓히지 않는다.
 *
 * ⚠ **「인증」이 두 가지다.** ①API 프로젝트 감사(안 받으면 비공개 잠김) ②유튜브 계정 인증
 *   (안 받으면 15분 초과 영상 불가). 우리 영상은 60초라 ②에는 안 걸린다.
 *
 * ⚠ **아직 확인 못 한 것** — 짐작으로 채우지 마라:
 *   · `youtube.upload` 토큰만으로 `videos.list` 를 불러 방금 올린 비공개 영상의
 *     처리 상태를 읽을 수 있는지 (문서에 스코프 표가 아예 없다)
 *   · 채널 단위 하루 업로드 건수 제한(`uploadLimitExceeded`)의 실제 숫자
 */

/* ── 엔드포인트 — 전부 공식 문서 확인 (2026-09-12) ── */
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
/** https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol */
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
/** https://developers.google.com/identity/protocols/oauth2/web-server (Revoking a token) */
const REVOKE = "https://oauth2.googleapis.com/revoke";
/**
 * ✅ `videos.insert` 가 받는 스코프 넷 중 **가장 좁은 것**을 고른다.
 *   (허용: youtube.upload · youtube · youtubepartner · youtube.force-ssl)
 *   https://developers.google.com/youtube/v3/docs/videos/insert#auth
 * ★ 좁은 것을 고른 대가가 위의 「올린 뒤 못 고친다」다. 알고 고른 것이다.
 */
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

/** 심사 전에는 비공개로 올린다. ★ 어차피 그쪽이 강제로 비공개로 만든다 — 우리가 먼저 말하는 것뿐이다 */
const PRIVACY_BEFORE_REVIEW = "private";

const clientId = () => process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const clientSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";

/**
 * 한 번에 통째로 보낼 수 있는 크기 한계 — 60초 영상은 보통 10~30MB 다.
 * ⚠ 유튜브 공식 상한은 256GB(`YOUTUBE_SPEC.officialMaxBytes`)지만 그건 **그쪽 한계**고,
 *   여기 값은 **우리 서버리스 함수가 메모리에 올릴 수 있는 한계**다. 둘을 헷갈리지 마라.
 */
const MAX_BYTES = 300 * 1024 * 1024;

/** 글자 수를 코드포인트로 자른다 — `slice` 는 이모지 하나를 둘로 쪼갠다 */
const cut = (s: string, n: number) => [...(s ?? "")].slice(0, n).join("");

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
    /* ★★ 준비 기간(review)에는 **쓸 수 있지만 영상이 비공개로 올라간다.** (2026-09-12 지시 B3)
       올린 «뒤»에만 말하면 늦다 — 사장님은 이미 손님에게 「유튜브에 올렸어요」라고 했을 수 있다.
       ⚠ 「심사」는 금지어다(회장님). 「준비 기간」으로 말한다. */
    if (gate === "review") {
      return {
        ok: true,
        notice: "지금은 준비 기간이라 올린 영상이 «비공개»로 올라가요. 사장님 유튜브에서는 보이지만 손님에게는 아직 안 보입니다.",
      };
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

  getLimits: () => limitsOf("youtube"),
  extraOptions: async () => [],

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

      /* ── ① 업로드 «자리» 받기 (resumable 1단계) ──
         ⚠ 자리는 **만료된다.** 받자마자 바로 보내라고 공식 문서가 못 박았다.
         ⚠ `notifySubscribers` 기본값이 **true** 다. 비공개로 올리는 동안 구독자에게 알림을 쏘면
            «아무도 볼 수 없는 영상»의 알림만 가는 셈이라 끈다. 공개로 올릴 때는 켜 둔다 —
            사장님 채널의 사장님 영상이니 알림이 가는 편이 이득이다. */
      const meta = {
        snippet: {
          title: cut(input.title, YOUTUBE_SPEC.maxTitleChars),
          description: cut(input.caption, TEXT_LIMITS.youtube.chars),
        },
        status: { privacyStatus: gate === "on" ? "public" : PRIVACY_BEFORE_REVIEW, selfDeclaredMadeForKids: false },
      };
      const initUrl = `${UPLOAD}?uploadType=resumable&part=snippet,status&notifySubscribers=${gate === "on"}`;
      const init = await fetch(initUrl, {
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

      /* ── ② 파일 보내기 (끊기면 «이어서») ── */
      const put = await sendWithResume(where, bytes, token);
      if (!put.ok) throw new SnsHttpError(put.status, put.body, "yt:put");
      if (!put.video.id) return { state: "failed", kind: "TRANSIENT", detail: "올라갔는지 확인하지 못했어요." };

      /* ★★ **그쪽이 «실제로» 어떻게 올렸는지 되읽는다.** (2026-09-12)
         심사 전 프로젝트는 `public` 을 보내도 **무시하고 비공개로 잠근다.**
         되읽지 않으면 화면이 「올렸어요」라고만 말하고, 사장님은 유튜브에서 자기 영상을
         못 찾아 우리에게 전화한다. 「왜 안 보이나」에 답할 수 있어야 한다. */
      const privacy = put.video.status?.privacyStatus ?? null;
      const lockedDespitePublic = privacy === "private" && gate === "on";
      const note = privacy === "private"
        ? (lockedDespitePublic
          ? "유튜브가 이 영상을 «비공개»로 올렸어요. 유튜브 쪽 확인이 끝나면 공개로 바뀝니다."
          : "지금은 준비 기간이라 «비공개»로 올라갔어요. 사장님 유튜브에서는 보이지만 손님에게는 아직 안 보입니다.")
        : undefined;
      if (lockedDespitePublic) {
        console.warn(JSON.stringify({ evt: "yt_locked_private", videoId: put.video.id }));
      }

      return {
        state: "published",
        remotePostId: put.video.id,
        remoteUrl: `https://www.youtube.com/watch?v=${put.video.id}`,
        note,
      };
    } catch (e) {
      const kind = youtube.translateError(e);
      if (kind === "AUTH_EXPIRED") await db.markExpired(input.siteId, "youtube");
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};

/** 유튜브가 만들어 준 영상 자원 — 우리가 쓰는 칸만 적는다 */
type YtVideo = { id?: string; status?: { privacyStatus?: string; uploadStatus?: string } };

/** 파일 보내기의 결과 */
type PutResult = { ok: true; video: YtVideo } | { ok: false; status: number; body: string };

/** 다시 해도 되는 것은 **이 넷뿐**이다. 나머지 4xx/5xx 는 영구 실패라 재시도하면 안 된다 */
const RETRYABLE = new Set([500, 502, 503, 504]);

const asVideo = async (r: Response): Promise<YtVideo> => (await r.json().catch(() => ({}))) as YtVideo;

/**
 * ★★ 파일을 보낸다. **끊기면 처음부터가 아니라 «이어서»** 보낸다. (2026-09-12 지시 B3)
 *
 * ⚠ 전에는 한 번 PUT 하고 끝이었다. resumable 로 «자리»를 받아 놓고 정작 이어받기를 안 썼다 —
 *   이름만 resumable 이었던 셈이다. 45MB 짜리가 끝에서 끊기면 45MB 를 통째로 다시 보냈다.
 *
 * ★ 공식 절차(https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol):
 *   ① 본문 없이 「Content-Range: bytes 별표/전체길이」로 PUT → 308 과 함께 「Range: bytes=0-N」이 온다
 *   ② 다음에 보낼 첫 바이트는 **N+1** 이다
 *   ③ 「Content-Range: bytes N+1-끝/전체길이」로 나머지를 보낸다
 *
 * ⚠⚠ **off-by-one 이 조용히 죽인다.** N 을 그대로 보내면(겹침) 또는 N+2 를 보내면(건너뜀)
 *   오류가 나지 않고 **아무 바이트도 안 올라간다.** 그래서 이 계산을 손대지 마라.
 * ⚠ 자리가 만료되면 404 가 온다. 이어받기가 불가능하니 그냥 실패로 돌린다 —
 *   처음부터 다시 하는 판단은 부르는 쪽(대기열)이 한다.
 * ⚠ 308 에 `Range` 헤더가 **아예 없을 수 있다**(한 바이트도 안 올라간 상태). null 을 다뤄야 한다.
 */
async function sendWithResume(sessionUrl: string, bytes: Uint8Array<ArrayBuffer>, token: string): Promise<PutResult> {
  /* ⚠ `Content-Length` 는 fetch 가 **조용히 무시하는** 금지 헤더다. 전에 넣어 뒀지만
     한 번도 실제로 설정된 적이 없다 — 넣고서 「설정했다」고 믿는 것이 더 위험하다. */
  try {
    const first = await fetch(sessionUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
      body: bytes,
      cache: "no-store",
    });
    if (first.ok) return { ok: true, video: await asVideo(first) };
    const body = brief(await first.text());
    if (!RETRYABLE.has(first.status)) return { ok: false, status: first.status, body };
    return resumeAfterBreak(sessionUrl, bytes, token, body);
  } catch (e) {
    /* 연결이 끊겼다 — 어디까지 갔는지 물어볼 값어치가 있다 */
    return resumeAfterBreak(sessionUrl, bytes, token, brief(String(e)));
  }
}

/** 끊긴 뒤 **한 번만** 이어서 보낸다. 두 번은 안 한다 — 서버리스 함수의 시간이 유한하다(maxDuration) */
async function resumeAfterBreak(sessionUrl: string, bytes: Uint8Array<ArrayBuffer>, token: string, why: string): Promise<PutResult> {
  const total = bytes.byteLength;
  try {
    /* ① 어디까지 갔나 */
    const probe = await fetch(sessionUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Range": `bytes */${total}` },
      cache: "no-store",
    });
    /* 사실은 다 올라가 있었다 — 끊긴 것은 «응답»이었던 경우다 */
    if (probe.ok) return { ok: true, video: await asVideo(probe) };
    if (probe.status !== 308) return { ok: false, status: probe.status, body: brief(await probe.text()) };

    /* ② 다음 첫 바이트 = Range 의 끝 + 1. Range 가 없으면 한 바이트도 안 갔다는 뜻이다 */
    const range = probe.headers.get("range");
    const end = range ? Number(/bytes=\d+-(\d+)/.exec(range)?.[1] ?? NaN) : NaN;
    const from = Number.isFinite(end) ? end + 1 : 0;
    if (from >= total) return { ok: false, status: 500, body: "이어받을 곳을 찾지 못했어요." };

    console.log(JSON.stringify({ evt: "yt_resume", from, total, why: why.slice(0, 120) }));

    /* ③ 나머지를 보낸다 */
    const rest = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "video/mp4",
        "Content-Range": `bytes ${from}-${total - 1}/${total}`,
      },
      body: bytes.subarray(from),
      cache: "no-store",
    });
    if (!rest.ok) return { ok: false, status: rest.status, body: brief(await rest.text()) };
    return { ok: true, video: await asVideo(rest) };
  } catch (e) {
    return { ok: false, status: 503, body: brief(String(e)) };
  }
}
