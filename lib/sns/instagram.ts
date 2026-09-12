import * as db from "./db";
import { limitsOf } from "./limits";
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

/* ★★ 2026-09-12 회장님 지시 — **「인스타 로그인」 길로 바꿨다.**
   전에는 페이스북 로그인(www.facebook.com/dialog/oauth + pages_show_list)이라
   사장님이 **페이스북 페이지를 먼저 만들어야** 연결이 됐다. 동네 사장님 대부분은 페이지가 없다.
   가입 이탈이 가장 큰 자리였다.
   ⚠ 페이스북 게시는 **나중에 따로** 붙인다. 지금 묶지 않는다 —
     묶으면 인스타만 쓰려는 사장님까지 페이스북을 만들어야 한다. */
const GRAPH = "https://graph.instagram.com/v21.0";
const OAUTH_DIALOG = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
/** ★ 장기 토큰 교환·갱신은 **버전 없는** 주소다(graph.instagram.com 바로 아래). */
const GRAPH_ROOT = "https://graph.instagram.com";
/** ⚠ 확인 필요 — 인스타 로그인 방식의 권한 이름. 심사 전에 대조할 것 */
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

const appId = () => process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? "";
const appSecret = () => process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET ?? "";

/** 인스타가 그쪽에서 처리를 끝냈나 — ⚠ 값 집합 확인 필요 */
type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "PUBLISHED" | "EXPIRED";

/* ════════════════ 토큰 수명 ════════════════
   ★★ 인스타 토큰은 **두 종류**다. 이 구분을 놓치면 연결이 조용히 죽는다.

   | 종류 | 수명 | 어떻게 얻나 |
   |---|---|---|
   | 단기(short-lived) | **1시간 안팎** | 로그인 직후 코드를 바꿔 받는 첫 토큰 |
   | 장기(long-lived)  | **60일** | 단기 토큰을 `ig_exchange_token` 으로 한 번 더 바꾼다 |

   ★ 2026-09-12 이전 코드는 **단기 토큰을 그대로 저장**했다. 사장님이 연결하고 한 시간이
     지나면 올리기가 실패했다는 뜻이다.
   ★ 장기 토큰도 60일이면 끝난다. 그런데 **갱신(`ig_refresh_token`)은 만료 «전»에만 된다.**
     한 번 넘기면 사장님이 처음부터 다시 연결해야 한다. 그래서 크론이 미리 밀어 준다
     (`lib/sns/maintenance.ts`). 갱신은 발급 24시간 뒤부터 가능한데, 우리는 46일째에
     밀므로 그 조건에 걸리지 않는다.
   ⚠ 값(60일·24시간)의 근거는 김팀장 조사(2026-09-12). 심사 전에 한 번 더 대조할 것. */

type TokenAnswer = { access_token?: string; expires_in?: number };

/** 몇 초짜리 토큰인지를 만료 시각(ISO)으로. 값이 없으면 null — 「모른다」를 지어내지 않는다 */
const expiryFrom = (sec: number | undefined) =>
  sec ? new Date(Date.now() + sec * 1000).toISOString() : null;

/**
 * 단기 토큰 → **장기 토큰(60일)**. 연결 직후 한 번만 부른다.
 * 실패해도 던지지 않는다 — 단기 토큰이라도 저장하는 편이 «연결 실패» 보다 낫다(그 자리에서 한 번은 올릴 수 있다).
 */
export async function exchangeForLongLived(shortToken: string): Promise<TokenAnswer | null> {
  if (!appSecret()) return null;
  const u = new URL(`${GRAPH_ROOT}/access_token`);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", appSecret());
  u.searchParams.set("access_token", shortToken);
  try {
    const r = (await callJson(u.toString(), { method: "GET" }, "ig:exchange")) as TokenAnswer;
    return r.access_token ? r : null;
  } catch (e) {
    console.error(JSON.stringify({ evt: "ig_exchange_failed", err: brief(String(e), 160) }));
    return null;
  }
}

/**
 * ★ 올린 글이 **아직 살아 있나.** (2026-09-12 회장님 지시 2)
 *
 * · `"alive"`   — 있다
 * · `"gone"`    — **없다.** 그쪽에서 지워졌다 (사장님이 인스타 앱에서 지운 경우)
 * · `"unknown"` — 못 물어봤다(네트워크·권한·한도). **이때는 아무 말도 하지 않는다** —
 *                 「모르니까 지워졌다」고 적으면 멀쩡한 글에 거짓 표시가 붙는다.
 *
 * ⚠ 「없다」의 판정을 **404 하나로만** 한다. 401·403·429 는 우리 쪽 사정이지 글의 사정이 아니다.
 */
export async function isPostAlive(postId: string, token: string): Promise<"alive" | "gone" | "unknown"> {
  try {
    await callJson(`${GRAPH}/${postId}?fields=id&access_token=${encodeURIComponent(token)}`, { method: "GET" }, "ig:alive");
    return "alive";
  } catch (e) {
    if (e instanceof SnsHttpError && e.status === 404) return "gone";
    /* 메타는 «없는 개체»에도 400 + code 100 을 주는 일이 있다. 본문에 확실한 단서가 있을 때만 인정한다 */
    if (e instanceof SnsHttpError && e.status === 400) {
      const b = e.body.toLowerCase();
      if (b.includes("does not exist") || b.includes("unsupported get request")) return "gone";
    }
    return "unknown";
  }
}

/**
 * 장기 토큰 **갱신** — 다시 60일. 만료 «전»에만 된다.
 * 던지지 않고 결과만 돌려준다. 부르는 쪽(크론)이 「끝났다/다시 해 보자」를 판단한다.
 */
export async function refreshLongLived(
  longToken: string,
): Promise<{ ok: true; token: string; expiresAt: string | null } | { ok: false; kind: ErrorKind; detail: string }> {
  const u = new URL(`${GRAPH_ROOT}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", longToken);
  try {
    const r = (await callJson(u.toString(), { method: "GET" }, "ig:refresh")) as TokenAnswer;
    if (!r.access_token) return { ok: false, kind: "TRANSIENT", detail: "새 토큰이 오지 않았어요." };
    return { ok: true, token: r.access_token, expiresAt: expiryFrom(r.expires_in) };
  } catch (e) {
    return {
      ok: false,
      kind: instagram.translateError(e),
      detail: e instanceof SnsHttpError ? e.body : brief(String(e)),
    };
  }
}

export const instagram: SnsAdapter = {
  provider: "instagram",

  async isAvailable(): Promise<Availability> {
    if (!appId() || !appSecret()) {
      return { ok: false, why: "인스타그램 연결 열쇠가 아직 등록되지 않았어요. (INSTAGRAM_APP_ID·INSTAGRAM_APP_SECRET)" };
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

    /* 돌아왔다 — 코드를 토큰으로 바꾼다.
       ⚠ 인스타 로그인은 **POST 폼**으로 주고받는다(페이스북 로그인의 GET 방식과 다르다). */
    try {
      const form = new URLSearchParams({
        client_id: appId(), client_secret: appSecret(),
        grant_type: "authorization_code", redirect_uri: redirectUri, code,
      });
      const tok = (await callJson(TOKEN_URL, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
      }, "ig:token")) as { access_token?: string; user_id?: string | number; permissions?: string; expires_in?: number };
      if (!tok.access_token) {
        return { stage: "failed" as const, kind: "TRANSIENT" as ErrorKind, detail: "토큰을 받지 못했어요." };
      }

      /* ★ 인스타 로그인은 **페이스북 페이지를 거치지 않는다.** 내 계정을 바로 묻는다.
         ⚠ 확인 필요 — 필드 이름(user_id·username·account_type)은 심사 전에 대조할 것. */
      let accountId: string | null = tok.user_id ? String(tok.user_id) : null;
      let accountName: string | null = null;
      let accountType: string | null = null;
      try {
        const me = (await callJson(
          `${GRAPH}/me?fields=id,username,account_type&access_token=${encodeURIComponent(tok.access_token)}`,
          { method: "GET" }, "ig:me",
        )) as { id?: string; username?: string; account_type?: string };
        accountId = me.id ?? accountId;
        accountName = me.username ?? null;
        accountType = me.account_type ?? null;
      } catch { /* 아래에서 안내한다 */ }

      if (!accountId) {
        /* ★ 조용히 실패하지 않는다. 무엇을 해야 하는지 말한다 */
        return {
          stage: "failed" as const, kind: "REJECTED" as ErrorKind,
          detail: "인스타그램 계정을 확인하지 못했어요. 다시 한 번 시도해 주세요.",
        };
      }
      /* ⚠ 개인 계정으로는 외부에서 올릴 수 없다 — 그건 인스타 정책이라 우리가 못 바꾼다.
         다만 **페이스북 페이지는 더 이상 필요 없다.** 안내 문구도 그렇게 바뀐다. */
      if (accountType && !/business|creator|media_creator/i.test(accountType)) {
        return {
          stage: "failed" as const, kind: "REJECTED" as ErrorKind,
          detail: "인스타그램을 «프로페셔널 계정»(비즈니스 또는 크리에이터)으로 바꿔 주세요.",
        };
      }

      /* ★★ 첫 토큰은 **1시간짜리**다. 여기서 곧바로 **60일짜리**로 바꾼다.
         바꾸지 않으면 사장님이 연결한 지 한 시간 뒤부터 올리기가 실패한다.
         교환이 실패하면 단기 토큰이라도 저장한다 — 그 자리에서 한 번은 올릴 수 있고,
         만료되면 화면이 「다시 연결해 주세요」로 안내한다(조용히 죽지 않는다). */
      const long = await exchangeForLongLived(tok.access_token);
      const accessToken = long?.access_token ?? tok.access_token;
      const expiresAt = expiryFrom(long?.expires_in ?? tok.expires_in);
      if (!long) {
        console.error(JSON.stringify({ evt: "ig_long_lived_skipped", siteId, why: "교환 실패 — 단기 토큰으로 저장한다" }));
      }
      const saved = await db.saveConnection({
        siteId, provider: "instagram",
        accountId, accountName, accessToken, expiresAt, scopes: SCOPES,
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

  getLimits: () => limitsOf("instagram"),
  /* ⑩ 인스타는 더 받을 것이 없다 — **빈 배열**이면 화면이 시트를 안 그린다 */
  extraOptions: async () => [],

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

      /* ★ 게시물 주소(permalink)를 한 번 더 물어본다. (2026-09-12)
         ⚠ 2026-09-12 첫 실제 게시에서 `remote_url` 이 **비어 있었다** — 화면의 [보기] 가
           나오지 않아 회장님이 올라간 글을 눌러서 확인할 수 없었다.
         ⚠ **여기서 실패해도 «올라간 것»을 뒤집지 않는다.** 글은 이미 올라갔다.
           주소를 못 얻은 것은 «보기 링크가 없는 것»일 뿐이다 — 그걸로 성공을 실패로 바꾸면
           사장님이 같은 영상을 또 올린다. */
      let remoteUrl: string | null = null;
      try {
        const link = (await callJson(
          `${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
          { method: "GET" }, "ig:permalink",
        )) as { permalink?: string };
        remoteUrl = link.permalink ?? null;
      } catch (e) {
        console.warn(JSON.stringify({ evt: "ig_permalink_failed", id: pub.id, err: brief(String(e), 160) }));
      }

      return { state: "published", remotePostId: pub.id, remoteUrl };
    } catch (e) {
      const kind = instagram.translateError(e);
      if (kind === "AUTH_EXPIRED") await db.markExpired(input.siteId, "instagram");
      return { state: "failed", kind, detail: e instanceof SnsHttpError ? e.body : brief(String(e)) };
    }
  },
};
