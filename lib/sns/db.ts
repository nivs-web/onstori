import { sbAdmin } from "@/lib/db-admin";
import type { Connection, ErrorKind, Quota, SnsProvider } from "./types";

/**
 * SNS 표를 다루는 **유일한 자리**. (2026-09-11)
 *
 * ★★ **토큰은 이 파일 밖으로 나가지 않는다.** 어댑터도 화면도 `Connection`(토큰 없는 모양)만 받는다.
 *   토큰이 필요한 것은 어댑터의 HTTP 호출뿐이라 `readTokens()` 로만 꺼낸다.
 *
 * ⚠ 두 표는 RLS 를 켜고 정책이 하나도 없다. 서비스 롤(`sbAdmin`)로만 닿는다.
 *   그래서 이 파일은 **서버에서만** import 해야 한다. "use client" 파일에서 부르지 마라.
 */

/* ─────────────── 연결 ─────────────── */

type Row = {
  site_id: string; provider: string;
  account_id: string | null; account_name: string | null;
  status: string; disclaimer_agreed_at: string | null; connected_at: string;
};

const toConnection = (r: Row): Connection => ({
  siteId: r.site_id,
  provider: r.provider as SnsProvider,
  accountId: r.account_id,
  accountName: r.account_name,
  status: (r.status as Connection["status"]) ?? "active",
  disclaimerAgreedAt: r.disclaimer_agreed_at,
  connectedAt: r.connected_at,
});

/** 토큰을 뺀 모양으로 읽는다 — 화면·API 가 쓰는 것 */
export async function getConnection(siteId: string, provider: SnsProvider): Promise<Connection | null> {
  const { data, error } = await sbAdmin()
    .from("sns_connections")
    .select("site_id, provider, account_id, account_name, status, disclaimer_agreed_at, connected_at")
    .eq("site_id", siteId).eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  return toConnection(data as Row);
}

/** 한 사이트의 연결 전부 — 연결 화면이 쓴다 */
export async function listConnections(siteId: string): Promise<Connection[]> {
  const { data, error } = await sbAdmin()
    .from("sns_connections")
    .select("site_id, provider, account_id, account_name, status, disclaimer_agreed_at, connected_at")
    .eq("site_id", siteId);
  if (error || !data) return [];
  return (data as Row[]).map(toConnection);
}

/** ★ 토큰을 꺼내는 **유일한 함수**. 어댑터의 HTTP 호출에서만 쓴다. 응답에 절대 싣지 마라. */
export async function readTokens(siteId: string, provider: SnsProvider): Promise<{
  accessToken: string | null; refreshToken: string | null; expiresAt: string | null; accountId: string | null;
} | null> {
  const { data, error } = await sbAdmin()
    .from("sns_connections")
    .select("access_token, refresh_token, token_expires_at, account_id")
    .eq("site_id", siteId).eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { access_token: string | null; refresh_token: string | null; token_expires_at: string | null; account_id: string | null };
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: d.token_expires_at, accountId: d.account_id };
}

export async function saveConnection(input: {
  siteId: string; provider: SnsProvider;
  accountId?: string | null; accountName?: string | null;
  accessToken?: string | null; refreshToken?: string | null;
  expiresAt?: string | null; scopes?: string[] | null;
}): Promise<Connection | null> {
  const { error } = await sbAdmin().from("sns_connections").upsert({
    site_id: input.siteId,
    provider: input.provider,
    account_id: input.accountId ?? null,
    account_name: input.accountName ?? null,
    access_token: input.accessToken ?? null,
    refresh_token: input.refreshToken ?? null,
    token_expires_at: input.expiresAt ?? null,
    scopes: input.scopes ?? null,
    status: "active",
    updated_at: new Date().toISOString(),
  }, { onConflict: "site_id,provider" });
  if (error) {
    console.error(JSON.stringify({ evt: "sns_save_conn_failed", provider: input.provider, err: error.message.slice(0, 160) }));
    return null;
  }
  return getConnection(input.siteId, input.provider);
}

/**
 * ★★ 연결 끊기 — **줄을 통째로 지운다.**
 *
 * ⚠ 불변 규칙 10(「삭제는 복구 가능한 표시 변경으로」)의 **예외**다.
 *   유튜브 약관이 「사용자가 연결을 끊으면 저장한 토큰을 실제로 파기하라」고 요구한다.
 *   토큰을 남겨 두면 약관 위반이고, 심사에서 바로 걸린다.
 *   ⚠ 대신 **올린 기록(`sns_posts`)은 지우지 않는다** — 그건 사장님의 이력이다.
 */
export async function deleteConnection(siteId: string, provider: SnsProvider): Promise<boolean> {
  const { error } = await sbAdmin().from("sns_connections").delete()
    .eq("site_id", siteId).eq("provider", provider);
  if (error) {
    console.error(JSON.stringify({ evt: "sns_disconnect_failed", provider, err: error.message.slice(0, 160) }));
    return false;
  }
  return true;
}

/** 연결이 풀렸다고 표시 — 토큰은 못 쓰니 함께 비운다 */
export async function markExpired(siteId: string, provider: SnsProvider): Promise<void> {
  await sbAdmin().from("sns_connections")
    .update({ status: "expired", access_token: null, updated_at: new Date().toISOString() })
    .eq("site_id", siteId).eq("provider", provider);
}

/** 면책 동의 — 누른 시각을 적는다. 비어 있으면 올리기를 시작하지 않는다 */
export async function agreeDisclaimer(siteId: string, provider: SnsProvider): Promise<void> {
  await sbAdmin().from("sns_connections")
    .update({ disclaimer_agreed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("site_id", siteId).eq("provider", provider);
}

/* ─────────────── 등록 시도 ─────────────── */

export type PostRow = {
  id: string; status: string; container_id: string | null;
  remote_post_id: string | null; remote_url: string | null;
  error_kind: ErrorKind | null; error_detail: string | null;
  attempts: number; public_key: string | null; created_at: string;
  provider: string; entry_id: string | null;
};

const LIVE = ["queued", "uploading", "processing", "published"];

/**
 * ★ 중복 방지 — 「살아 있는 시도」가 이미 있나.
 * ⚠ 실패·취소한 것은 **다시 시도할 수 있어야 하므로** 여기서 세지 않는다.
 *   DB 에도 같은 조건의 유일 인덱스가 있어 경쟁 상황에서도 두 줄이 안 생긴다.
 */
export async function isDuplicate(siteId: string, entryId: string, provider: SnsProvider): Promise<boolean> {
  const { data } = await sbAdmin().from("sns_posts").select("id")
    .eq("site_id", siteId).eq("entry_id", entryId).eq("provider", provider)
    .in("status", LIVE).limit(1);
  return (data?.length ?? 0) > 0;
}

/** 이어 할 것이 있나 — 인스타 ②단계에서 끊긴 줄 */
export async function findLivePost(siteId: string, entryId: string, provider: SnsProvider): Promise<PostRow | null> {
  const { data } = await sbAdmin().from("sns_posts")
    .select("id, status, container_id, remote_post_id, remote_url, error_kind, error_detail, attempts, public_key, created_at, provider, entry_id")
    .eq("site_id", siteId).eq("entry_id", entryId).eq("provider", provider)
    .in("status", LIVE).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as PostRow) ?? null;
}

export async function createPost(input: {
  siteId: string; entryId: string; provider: SnsProvider; publicKey?: string | null;
}): Promise<PostRow | null> {
  const { data, error } = await sbAdmin().from("sns_posts").insert({
    site_id: input.siteId, entry_id: input.entryId, provider: input.provider,
    status: "queued", public_key: input.publicKey ?? null,
  }).select("id, status, container_id, remote_post_id, remote_url, error_kind, error_detail, attempts, public_key, created_at, provider, entry_id").maybeSingle();
  if (error) {
    /* 유일 인덱스에 막혔다 = 이미 살아 있는 시도가 있다. 조용히 실패하지 않고 그 줄을 돌려준다 */
    console.warn(JSON.stringify({ evt: "sns_post_insert_blocked", provider: input.provider, err: error.message.slice(0, 120) }));
    return findLivePost(input.siteId, input.entryId, input.provider);
  }
  return (data as PostRow) ?? null;
}

export async function updatePost(id: string, patch: Partial<{
  status: string; container_id: string | null; remote_post_id: string | null; remote_url: string | null;
  error_kind: ErrorKind | null; error_detail: string | null; attempts: number; public_key: string | null;
  published_at: string | null;
}>): Promise<void> {
  await sbAdmin().from("sns_posts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

/** 한 영상이 어디까지 갔나 — 화면이 쓴다 */
export async function listPostsForEntry(siteId: string, entryId: string): Promise<PostRow[]> {
  const { data } = await sbAdmin().from("sns_posts")
    .select("id, status, container_id, remote_post_id, remote_url, error_kind, error_detail, attempts, public_key, created_at, provider, entry_id")
    .eq("site_id", siteId).eq("entry_id", entryId).order("created_at", { ascending: false });
  return (data as PostRow[]) ?? [];
}

/* ─────────────── 하루 한도 ─────────────── */

/**
 * ★ 한도는 **이미 있는 `rate_limit_hit` 을 쓴다.** 새로 만들지 않는다(회장님 지시 6).
 *   열쇠 모양도 지시문 그대로다: `ig:{site_id}` · `yt:{site_id}` · `yt:app`
 *
 * ⚠ `checkRateLimit()`(lib/rate-limit.ts)을 거치지 않는다. 그 함수는 열쇠를
 *   `scope:label:ip` 로 조립해서 지시문의 모양과 달라진다. 여기선 RPC 를 직접 부른다.
 */
export const SNS_LIMITS: Record<string, { key: (siteId: string) => string; window: number; max: number }[]> = {
  instagram: [{ key: (s) => `ig:${s}`, window: 86400, max: 5 }],
  youtube: [
    { key: (s) => `yt:${s}`, window: 86400, max: 1 },
    { key: () => "yt:app", window: 86400, max: 100 },   // 앱 전체 한도
  ],
};

/** ★ 실제로 **쓴다**(카운트를 올린다). 올리기 직전에 한 번만 부른다 */
export async function consumeQuota(provider: SnsProvider, siteId: string): Promise<boolean> {
  const rules = SNS_LIMITS[provider];
  if (!rules) return true;
  const sb = sbAdmin();
  for (const r of rules) {
    try {
      const { data, error } = await sb.rpc("rate_limit_hit", { p_key: r.key(siteId), p_window: r.window, p_max: r.max });
      if (error) {
        /* 카운터가 죽었다고 정상 사장님을 막지 않는다 — lib/rate-limit.ts 와 같은 판단 */
        console.warn(JSON.stringify({ evt: "sns_quota_error", provider, err: error.message.slice(0, 120) }));
        continue;
      }
      if (data === false) return false;
    } catch (e) {
      console.warn(JSON.stringify({ evt: "sns_quota_error", provider, err: String(e).slice(0, 120) }));
    }
  }
  return true;
}

/**
 * ★★ 남은 개수를 **세기만 한다.**
 * ⚠ `rate_limit_hit` 을 부르면 **한 개를 써 버린다.** 화면에 「남은 개수」를 보여 주려고
 *   부르면 볼 때마다 한도가 줄어든다. 그래서 `rate_limits` 표를 직접 읽는다.
 *   버킷 계산은 그 함수와 똑같이 «창 길이로 내림»이다.
 */
export async function readQuota(provider: SnsProvider, siteId: string): Promise<Quota> {
  const rules = SNS_LIMITS[provider];
  if (!rules?.length) return { remaining: 0, limit: 0, windowSec: 86400 };
  const sb = sbAdmin();
  let worst: Quota | null = null;
  for (const r of rules) {
    const bucket = new Date(Math.floor(Date.now() / 1000 / r.window) * r.window * 1000).toISOString();
    let used = 0;
    try {
      const { data } = await sb.from("rate_limits").select("count")
        .eq("key", r.key(siteId)).eq("window_start", bucket).maybeSingle();
      used = (data as { count?: number } | null)?.count ?? 0;
    } catch { used = 0; }
    const q: Quota = { remaining: Math.max(0, r.max - used), limit: r.max, windowSec: r.window };
    if (!worst || q.remaining < worst.remaining) worst = q;   // 가장 빡빡한 규칙이 진짜 남은 개수
  }
  return worst!;
}
