import { GoogleAuth } from "google-auth-library";

/**
 * Vertex AI 호출 공통 — 서비스 계정 인증 + generateContent.
 * Gemini API(`?key=`)에서 이관: GCP 크레딧(무료 체험판 이월분)을 쓰기 위함. DECISIONS 2026-09-01 참조.
 *
 * 필요 env:
 *   GOOGLE_CLOUD_PROJECT          프로젝트 ID
 *   GOOGLE_CLOUD_LOCATION         기본 global (us-central1 등 리전도 가능)
 *   GOOGLE_SERVICE_ACCOUNT_JSON   서비스 계정 키 JSON — 원문 1줄 또는 base64
 *                                 (미설정 시 GOOGLE_APPLICATION_CREDENTIALS 파일 경로로 폴백)
 */

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export function vertexProject(): string {
  const p = process.env.GOOGLE_CLOUD_PROJECT;
  if (!p) throw new Error("GOOGLE_CLOUD_PROJECT missing");
  return p;
}
export function vertexLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || "global";
}

let cached: GoogleAuth | null = null;
function auth(): GoogleAuth {
  if (cached) return cached;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    // Vercel 환경변수에 넣기 쉽게 base64도 허용 (private_key의 개행 이슈 회피)
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    cached = new GoogleAuth({ credentials: JSON.parse(json), scopes: [SCOPE] });
  } else {
    cached = new GoogleAuth({ scopes: [SCOPE] }); // ADC (GOOGLE_APPLICATION_CREDENTIALS)
  }
  return cached;
}

/** 서비스 계정 액세스 토큰 (라이브러리가 캐시·갱신 처리) */
export async function vertexToken(): Promise<string> {
  const token = await (await auth().getClient()).getAccessToken();
  const t = typeof token === "string" ? token : token?.token;
  if (!t) throw new Error("Vertex 액세스 토큰 발급 실패");
  return t;
}

function endpoint(model: string): string {
  const loc = vertexLocation();
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${vertexProject()}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

export type VertexResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/** generateContent 원샷 호출. 요청/응답 본문은 Gemini API와 동일 스키마라 호출부 변경이 작다. */
export async function vertexGenerate(model: string, body: unknown): Promise<VertexResult> {
  const res = await fetch(endpoint(model), {
    method: "POST",
    headers: { Authorization: `Bearer ${await vertexToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
