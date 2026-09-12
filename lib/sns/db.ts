import { sbAdmin } from "@/lib/db-admin";
import type { Connection, ErrorKind, Quota, SnsProvider } from "./types";
import { APP_DAILY_UPLOADS, PER_SITE_DAILY_UPLOADS } from "./limits";

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

/**
 * ★ 갱신할 때가 된 연결 — 크론이 쓴다. (2026-09-12)
 *
 * 「만료가 `dueBefore` 보다 앞인 살아 있는 연결」을 준다. 토큰까지 함께 준다 —
 * 부르는 쪽이 곧바로 갱신 호출을 해야 해서다. **응답·화면에 절대 싣지 마라.**
 * ⚠ `token_expires_at` 이 비어 있는 줄도 함께 준다. 만료를 «모르는» 연결이야말로
 *   조용히 죽는 자리라, 크론이 한 번 밀어 보는 편이 안전하다.
 */
export async function listForRefresh(provider: SnsProvider, dueBefore: string, limit = 200): Promise<{
  siteId: string; accessToken: string | null; expiresAt: string | null;
}[]> {
  const { data, error } = await sbAdmin()
    .from("sns_connections")
    .select("site_id, access_token, token_expires_at")
    .eq("provider", provider)
    .eq("status", "active")
    .not("access_token", "is", null)
    .or(`token_expires_at.lte.${dueBefore},token_expires_at.is.null`)
    .limit(limit);
  if (error || !data) {
    if (error) console.error(JSON.stringify({ evt: "sns_list_refresh_failed", provider, err: error.message.slice(0, 160) }));
    return [];
  }
  return (data as { site_id: string; access_token: string | null; token_expires_at: string | null }[])
    .map((d) => ({ siteId: d.site_id, accessToken: d.access_token, expiresAt: d.token_expires_at }));
}

/**
 * ★ 토큰만 갈아 끼운다 — 계정 이름·동의 시각 같은 다른 칸을 건드리지 않는다.
 * `saveConnection` 은 upsert 라 넘기지 않은 칸을 null 로 덮는다. 갱신에는 쓰면 안 된다.
 */
export async function updateToken(
  siteId: string, provider: SnsProvider, accessToken: string, expiresAt: string | null,
): Promise<boolean> {
  const { error } = await sbAdmin().from("sns_connections")
    .update({ access_token: accessToken, token_expires_at: expiresAt, status: "active", updated_at: new Date().toISOString() })
    .eq("site_id", siteId).eq("provider", provider);
  if (error) {
    console.error(JSON.stringify({ evt: "sns_update_token_failed", provider, err: error.message.slice(0, 160) }));
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

/**
 * ★ 화면이 닫혀 «받는 중»으로 멈춰 버린 시도들 — 마무리 크론이 쓴다. (2026-09-12)
 *
 * ⚠ `updated_at` 이 오래된 것만 준다. 브라우저가 지금 1분마다 밀고 있는 건을 크론이
 *   같이 밀면 **같은 영상이 두 번 올라갈 수 있다.** 손을 뗀 것만 집는다.
 */
export async function listStuckPosts(idleSince: string, limit = 50): Promise<(PostRow & { site_id: string })[]> {
  const { data, error } = await sbAdmin().from("sns_posts")
    .select("id, status, container_id, remote_post_id, remote_url, error_kind, error_detail, attempts, public_key, created_at, provider, entry_id, site_id")
    .in("status", ["queued", "uploading", "processing"])
    .lt("updated_at", idleSince)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error(JSON.stringify({ evt: "sns_list_stuck_failed", err: error.message.slice(0, 160) }));
    return [];
  }
  return (data as (PostRow & { site_id: string })[]) ?? [];
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
 * 한도 규칙 하나. `scope` 가 중요하다 — **되돌릴 수 있는 것과 없는 것이 갈린다.**
 *
 * · `site` — 우리가 사장님께 스스로 건 약속. 올리기가 실패했으면 **되돌려도 된다.**
 * · `app`  — 그쪽(유튜브)의 진짜 할당량을 흉내 낸 것. **호출이 이미 나갔으면 되돌리면 안 된다.**
 *   되돌리면 우리 숫자만 줄고 그쪽 숫자는 그대로라, 결국 그쪽에서 거절당한다.
 */
export type QuotaRule = {
  scope: "site" | "app";
  key: (siteId: string) => string;
  window: number;
  max: number;
};

/**
 * ★ 한도는 **이미 있는 `rate_limit_hit` 을 쓴다.** 새로 만들지 않는다(회장님 지시 6).
 *   열쇠 모양도 지시문 그대로다: `ig:{site_id}` · `yt:{site_id}` · `yt:app`
 *
 * ⚠ `checkRateLimit()`(lib/rate-limit.ts)을 거치지 않는다. 그 함수는 열쇠를
 *   `scope:label:ip` 로 조립해서 지시문의 모양과 달라진다. 여기선 RPC 를 직접 부른다.
 *
 * ★ 숫자는 여기 적지 않는다 — `lib/sns/limits.ts` 가 **단일 출처**다 (2026-09-12 지시 B4).
 *   전에는 `max: 100` 이 이 파일에 손으로 박혀 있어, 증액 승인이 나면 코드를 고쳐야 했다.
 */
export const SNS_LIMITS: Record<string, QuotaRule[]> = {
  instagram: [{ scope: "site", key: (s) => `ig:${s}`, window: 86400, max: PER_SITE_DAILY_UPLOADS.instagram ?? 5 }],
  /* ★ 틱톡 (2026-09-12). 인스타와 같은 하루 5개로 맞춘다.
     ⚠ 없으면 `readQuota` 가 `{remaining:0, limit:0}` 을 돌려줘 화면이 **「오늘 0개」**라고 거짓말한다.
     ⚠ 심사 전 앱은 틱톡 쪽 한도가 따로 더 빡빡하다. 그건 그쪽이 거절로 알려 준다. */
  tiktok: [{ scope: "site", key: (s) => `tt:${s}`, window: 86400, max: PER_SITE_DAILY_UPLOADS.tiktok ?? 5 }],
  youtube: [
    { scope: "site", key: (s) => `yt:${s}`, window: 86400, max: PER_SITE_DAILY_UPLOADS.youtube ?? 1 },
    { scope: "app", key: () => "yt:app", window: 86400, max: APP_DAILY_UPLOADS.youtube ?? 100 },
  ],
};

/** 이 규칙의 «지금 창». `rate_limit_hit` 과 **똑같은 공식**이어야 한다 — 어긋나면 딴 칸을 읽는다 */
const bucketOf = (r: QuotaRule) => new Date(Math.floor(Date.now() / 1000 / r.window) * r.window * 1000).toISOString();

/** 이 규칙을 지금까지 몇 번 썼나. 못 읽었으면 `null` — **0 이 아니다** */
async function usedCount(r: QuotaRule, siteId: string): Promise<number | null> {
  try {
    const { data, error } = await sbAdmin().from("rate_limits").select("count")
      .eq("key", r.key(siteId)).eq("window_start", bucketOf(r)).maybeSingle();
    if (error) return null;
    return (data as { count?: number } | null)?.count ?? 0;
  } catch { return null; }
}

/**
 * ★★ 실제로 **쓴다**(카운트를 올린다). 올리기 직전에 한 번만 부른다.
 *
 * ★★ 2026-09-12 — **두 단계로 고쳤다 (지시 B4).** 왜 고쳤나:
 *
 *   전에는 규칙을 순서대로 돌며 그 자리에서 바로 카운트를 올렸다. 유튜브는 규칙이 둘이고
 *   **사장님당 하루 1건**이라, 앱 전체 100건이 차 있는 날에는 이런 일이 벌어졌다:
 *     ① `yt:{siteId}` 를 올린다 → 사장님의 **오늘 단 하나**가 소모된다
 *     ② `yt:app` 에서 막힌다 → false 를 돌려준다
 *     ③ 사장님은 **올리지도 못했는데** 내일까지 다시 못 올린다
 *   인스타(하루 5건)에서는 티가 안 나던 문제가 유튜브에서만 치명적으로 드러났다.
 *
 * ★ 지금은 **①전부 본 뒤 ②전부 쓴다.** 한 줄이라도 이미 차 있으면 **아무것도 쓰지 않는다.**
 * ⚠ ①과 ② 사이의 짧은 틈에 남이 끼어들 수 있다(경합). 그때는 ②에서 막히고,
 *   **이미 올린 것을 되돌린다** — 그래야 사장님의 하나가 날아가지 않는다.
 * ⚠ 카운터가 죽었으면(`error`) 통과시킨다. 정상 사장님을 DB 사정으로 막지 않는다.
 */
export async function consumeQuota(provider: SnsProvider, siteId: string): Promise<boolean> {
  const rules = SNS_LIMITS[provider];
  if (!rules?.length) return true;
  const sb = sbAdmin();

  /* ① 먼저 전부 본다 — 한 줄이라도 찼으면 아무것도 쓰지 않고 돌아간다 */
  for (const r of rules) {
    const used = await usedCount(r, siteId);
    if (used !== null && used >= r.max) {
      console.log(JSON.stringify({ evt: "sns_quota_full", provider, scope: r.scope, used, max: r.max }));
      return false;
    }
  }

  /* ② 통과했으면 전부 쓴다. 도중에 막히면 이미 쓴 것을 되돌린다 */
  const spent: QuotaRule[] = [];
  for (const r of rules) {
    try {
      const { data, error } = await sb.rpc("rate_limit_hit", { p_key: r.key(siteId), p_window: r.window, p_max: r.max });
      if (error) {
        console.warn(JSON.stringify({ evt: "sns_quota_error", provider, err: error.message.slice(0, 120) }));
        continue;                                   // 카운터가 죽었다 — 되돌릴 것도 없다
      }
      if (data === false) {                          // 경합에 졌다
        await giveBack(spent, siteId);
        console.log(JSON.stringify({ evt: "sns_quota_race", provider, scope: r.scope, gaveBack: spent.length }));
        return false;
      }
      spent.push(r);
    } catch (e) {
      console.warn(JSON.stringify({ evt: "sns_quota_error", provider, err: String(e).slice(0, 120) }));
    }
  }
  return true;
}

/**
 * 쓴 것을 하나 되돌린다.
 *
 * ⚠ 읽고-빼고-쓰기라 완벽하지 않다(그 사이에 남이 올리면 한 건이 어긋난다).
 *   그래도 그냥 두는 것보다 낫다 — 어긋나는 쪽이 **사장님에게 관대한 쪽**이고,
 *   앱 전체 카운터는 애초에 되돌리지 않기 때문이다.
 * ⚠ SQL 함수를 새로 만들면 정확해지지만 마이그레이션이 필요하고, 그건 회장님 손을 타야 한다.
 */
async function giveBack(rules: QuotaRule[], siteId: string): Promise<void> {
  const sb = sbAdmin();
  for (const r of rules) {
    const used = await usedCount(r, siteId);
    if (used === null || used <= 0) continue;
    try {
      await sb.from("rate_limits").update({ count: used - 1 })
        .eq("key", r.key(siteId)).eq("window_start", bucketOf(r));
    } catch { /* 못 되돌렸으면 그냥 둔다 — 사장님이 하루 손해를 보지만 숫자가 틀어지진 않는다 */ }
  }
}

/**
 * ★★ **올리기가 실패했을 때 사장님 몫만 돌려준다.** (2026-09-12 지시 B4)
 *
 * ⚠ 왜 필요한가: 한도는 `upload()` **전에** 소모된다(써 보고 나서 세면 두 번 올라간다).
 *   그런데 유튜브는 사장님당 **하루 1건**이라, 잠깐 끊긴 것(TRANSIENT) 한 번에
 *   **그날이 끝나 버린다.** 인스타(5건)에서는 안 보이던 문제다.
 *
 * ★★ **`app` 규칙은 돌려주지 않는다.** 그쪽 할당량은 호출이 나간 순간 진짜로 줄었다.
 *   우리 숫자만 되돌리면 우리는 계속 보내는데 그쪽이 거절한다 — 더 나쁜 상태가 된다.
 */
export async function refundQuota(provider: SnsProvider, siteId: string): Promise<void> {
  const rules = (SNS_LIMITS[provider] ?? []).filter((r) => r.scope === "site");
  if (!rules.length) return;
  await giveBack(rules, siteId);
  console.log(JSON.stringify({ evt: "sns_quota_refunded", provider, rules: rules.length }));
}

/**
 * ★★ 남은 개수를 **세기만 한다.**
 * ⚠ `rate_limit_hit` 을 부르면 **한 개를 써 버린다.** 화면에 「남은 개수」를 보여 주려고
 *   부르면 볼 때마다 한도가 줄어든다. 그래서 `rate_limits` 표를 직접 읽는다.
 * ⚠ 못 읽은 것(`null`)은 **0 으로 세지 않는다** — 「다 썼다」는 거짓말이 되기 때문이다.
 */
export async function readQuota(provider: SnsProvider, siteId: string): Promise<Quota> {
  const rules = SNS_LIMITS[provider];
  if (!rules?.length) return { remaining: 0, limit: 0, windowSec: 86400 };
  let worst: Quota | null = null;
  for (const r of rules) {
    const used = await usedCount(r, siteId) ?? 0;
    const q: Quota = { remaining: Math.max(0, r.max - used), limit: r.max, windowSec: r.window };
    if (!worst || q.remaining < worst.remaining) worst = q;   // 가장 빡빡한 규칙이 진짜 남은 개수
  }
  return worst!;
}
