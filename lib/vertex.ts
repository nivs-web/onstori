import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { GoogleAuth } from "google-auth-library";

/**
 * Vertex AI 호출 공통 — generateContent + 인증.
 * Gemini API(`?key=`)에서 이관: GCP 크레딧을 쓰기 위함. DECISIONS 2026-09-01 참조.
 *
 * 인증 (우선순위):
 *   1) ADC — 로컬 기본. `gcloud auth application-default login` 한 번이면 키 파일이 필요 없다.
 *      프로젝트·quota project도 gcloud 설정에서 따라오므로 env 없이 동작.
 *   2) GOOGLE_SERVICE_ACCOUNT_JSON — Vercel처럼 ADC를 쓸 수 없는 곳에서만.
 *      서비스 계정 키 JSON(원문 1줄 또는 base64).
 *
 * 선택 env: GOOGLE_CLOUD_PROJECT(미설정 시 ADC에서 추론) · GOOGLE_CLOUD_LOCATION(기본 global)
 */

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cached: GoogleAuth | null = null;
function auth(): GoogleAuth {
  if (cached) return cached;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    // base64도 허용 — private_key 개행이 env에서 깨지는 문제 회피
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    cached = new GoogleAuth({ credentials: JSON.parse(json), scopes: [SCOPE] });
  } else {
    cached = new GoogleAuth({ scopes: [SCOPE] }); // ADC
  }
  return cached;
}

export function authMode(): "service-account" | "adc" {
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ? "service-account" : "adc";
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
  const fromAdc = await auth().getProjectId().catch(() => null);
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
  const raw = await (await auth().getClient()).getRequestHeaders(url);
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
  const token = await (await auth().getClient()).getAccessToken();
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
