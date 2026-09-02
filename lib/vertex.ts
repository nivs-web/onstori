import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { GoogleAuth, ExternalAccountClient, type AuthClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Vertex AI 호출 공통 — generateContent + 인증.
 * Gemini API(`?key=`)에서 이관: GCP 크레딧을 쓰기 위함. DECISIONS 2026-09-01 참조.
 *
 * 인증 (우선순위 — 코드 순서 그대로):
 *   1) WIF — Vercel OIDC → GCP STS → 서비스 계정 가장. **키 파일이 없다.**
 *      GCP_PROJECT_NUMBER · GCP_SERVICE_ACCOUNT_EMAIL · GCP_WORKLOAD_IDENTITY_POOL_ID ·
 *      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID 넷이 다 있으면 이 경로. 전부 비밀이 아니다.
 *   2) GOOGLE_SERVICE_ACCOUNT_JSON — WIF 전환 전의 임시 경로(장기 키). 롤백용으로만 남긴다.
 *      서비스 계정 키 JSON(원문 1줄 또는 base64). 로컬 `.env.local`에는 두지 않는다.
 *   3) ADC — 로컬 기본. `gcloud auth application-default login` 한 번이면 키 파일이 필요 없다.
 *      프로젝트·quota project도 gcloud 설정에서 따라오므로 env 없이 동작.
 *
 * 선택 env: GOOGLE_CLOUD_PROJECT(미설정 시 ADC에서 추론) · GOOGLE_CLOUD_LOCATION(기본 global)
 */

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type AuthMode = "wif" | "service-account" | "adc";

const wifEnv = () => ({
  num: process.env.GCP_PROJECT_NUMBER?.trim(),
  sa: process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim(),
  pool: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim(),
  provider: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim(),
});

export function authMode(): AuthMode {
  const w = wifEnv();
  if (w.num && w.sa && w.pool && w.provider) return "wif";
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) return "service-account";
  return "adc";
}

/** SA JSON / ADC 전용 — WIF 는 GoogleAuth 를 거치지 않는다 */
let googleAuthCache: GoogleAuth | null = null;
function googleAuth(): GoogleAuth {
  if (googleAuthCache) return googleAuthCache;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    // base64도 허용 — private_key 개행이 env에서 깨지는 문제 회피
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    googleAuthCache = new GoogleAuth({ credentials: JSON.parse(json), scopes: [SCOPE] });
  } else {
    googleAuthCache = new GoogleAuth({ scopes: [SCOPE] }); // ADC
  }
  return googleAuthCache;
}

/** 지금 실제로 쓰이는 경로 — WIF 를 시도했다가 폴백했으면 여기 반영된다 */
let resolvedMode: AuthMode | null = null;
export function resolvedAuthMode(): AuthMode | null { return resolvedMode; }

function buildWifClient(): AuthClient {
  const w = wifEnv();
  const c = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${w.num}/locations/global/workloadIdentityPools/${w.pool}/providers/${w.provider}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${w.sa}:generateAccessToken`,
    scopes: [SCOPE],
    // Vercel 함수 안에서만 토큰이 나온다. 로컬에서 부르면 던진다.
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  });
  if (!c) throw new Error("ExternalAccountClient.fromJSON 이 null — GCP_* 값 형식 확인");
  return c;
}

/**
 * 진단용 — 캐시를 거치지 않고 WIF 를 새로 시도해 결과(또는 실패 사유)를 그대로 돌려준다.
 * 운영 경로는 폴백 때문에 실패를 삼키므로, 전환 여부를 판단하려면 이런 창구가 필요하다.
 */
export async function probeWif(): Promise<{ ok: boolean; head?: string; err?: string }> {
  try {
    const c = buildWifClient();
    const t = await c.getAccessToken();
    return { ok: true, head: (t.token ?? "").slice(0, 8) + "…" };
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 600) };
  }
}

let clientCache: Promise<AuthClient> | null = null;
/**
 * 실제 요청에 쓰는 클라이언트 — 세 경로를 하나의 AuthClient 로 수렴시킨다.
 *
 * WIF 는 **토큰을 한 번 받아보고** 성공해야 채택한다. 실패하면 SA JSON/ADC 로 폴백한다.
 * 폴백이 없으면 WIF 설정이 어긋나는 순간 사이트 생성이 통째로 죽는다 — 2026-09-02 실제로
 * 그렇게 프로덕션이 500이 났다. SA 키를 롤백용으로 남겨두고도 코드가 쓰지 않으면 안전망이 아니다.
 * 결과는 한 번만 판정해 캐시한다(요청마다 STS 를 두드리지 않게).
 */
function authClient(): Promise<AuthClient> {
  if (clientCache) return clientCache;
  clientCache = (async (): Promise<AuthClient> => {
    if (authMode() === "wif") {
      const w = wifEnv();
      try {
        const c = buildWifClient();
        await c.getAccessToken(); // 여기서 실패하면 폴백
        resolvedMode = "wif";
        console.log(JSON.stringify({ evt: "auth_wif_ok", pool: w.pool, provider: w.provider }));
        return c;
      } catch (e) {
        const hasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
        console.error(JSON.stringify({
          evt: "auth_wif_failed",
          err: String(e).slice(0, 400),
          audience: `//iam.googleapis.com/projects/${w.num}/locations/global/workloadIdentityPools/${w.pool}/providers/${w.provider}`,
          sa: w.sa,
          fallback: hasKey ? "service-account" : "adc",
        }));
        // 폴백 대상이 아예 없으면 감추지 말고 그대로 던진다
        if (!hasKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.VERCEL) throw e;
      }
    }
    resolvedMode = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ? "service-account" : "adc";
    return googleAuth().getClient();
  })();
  return clientCache;
}

/** ADC 파일의 quota_project_id — gcloud 바이너리가 PATH에 없어도 프로젝트를 알아내는 경로 */
function adcQuotaProject(): string | null {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || (process.platform === "win32"
      ? join(process.env.APPDATA ?? "", "gcloud", "application_default_credentials.json")
      : join(homedir(), ".config", "gcloud", "application_default_credentials.json"));
  try {
    return JSON.parse(readFileSync(p, "utf8")).quota_project_id ?? null;
  } catch { return null; }
}

let projectCache: string | null = null;
/** 프로젝트 ID — env → ADC 추론 → ADC 파일의 quota_project_id 순 */
export async function vertexProject(): Promise<string> {
  if (projectCache) return projectCache;
  const fromEnv = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (fromEnv) return (projectCache = fromEnv);
  // WIF 는 GoogleAuth 를 안 거치므로 추론이 없다 — Vercel 에서는 GOOGLE_CLOUD_PROJECT 가 단일 출처
  const fromAdc = authMode() === "wif" ? null : await googleAuth().getProjectId().catch(() => null);
  if (fromAdc) return (projectCache = fromAdc);
  const fromQuota = adcQuotaProject();
  if (fromQuota) return (projectCache = fromQuota);
  throw new Error("프로젝트를 알 수 없음 — GOOGLE_CLOUD_PROJECT 설정 또는 `gcloud config set project <ID>`");
}

export function vertexLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || "global";
}

/** 인증 헤더 — 라이브러리가 만들게 해서 ADC의 quota project(x-goog-user-project)까지 자동 포함 */
async function authHeaders(url: string): Promise<Record<string, string>> {
  const raw = await (await authClient()).getRequestHeaders(url);
  const headers: Record<string, string> = {};
  if (raw && typeof (raw as Headers).forEach === "function") {
    (raw as Headers).forEach((v, k) => { headers[k] = v; });
  } else {
    Object.assign(headers, raw as unknown as Record<string, string>); // 구버전 호환(plain object)
  }
  headers["Content-Type"] = "application/json";
  return headers;
}

/** 액세스 토큰 단독 발급 (프리플라이트에서 인증만 따로 확인할 때) */
export async function vertexToken(): Promise<string> {
  const token = await (await authClient()).getAccessToken();
  const t = typeof token === "string" ? token : token?.token;
  if (!t) throw new Error("액세스 토큰 발급 실패 — `gcloud auth application-default login` 확인");
  return t;
}

async function endpoint(model: string): Promise<string> {
  const loc = vertexLocation();
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${await vertexProject()}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

export type VertexResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/** generateContent 원샷 호출. 요청/응답 본문은 Gemini API와 동일 스키마라 호출부 변경이 작다. */
export async function vertexGenerate(model: string, body: unknown): Promise<VertexResult> {
  const url = await endpoint(model);
  const res = await fetch(url, { method: "POST", headers: await authHeaders(url), body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { message?: string } } | null)?.error?.message;
    return { ok: false, status: res.status, error: e ?? `HTTP ${res.status}` };
  }
  return { ok: true, data };
}

/** 응답에서 첫 텍스트 파트 */
export function textOf(data: unknown): string | undefined {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  return parts?.find((p) => typeof p.text === "string")?.text;
}

/** 응답에서 첫 이미지 파트 (base64) */
export function imageOf(data: unknown): Buffer | undefined {
  const parts = (data as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  const b64 = parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  return b64 ? Buffer.from(b64, "base64") : undefined;
}
