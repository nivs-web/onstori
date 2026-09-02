import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { authMode, resolvedAuthMode, vertexToken } from "@/lib/vertex";

/**
 * Vertex 인증 경로 진단 — 운영자 전용.
 *
 * WIF 전환은 실패해도 SA/ADC 로 조용히 폴백하므로(그래야 서비스가 안 죽는다) 겉으로는
 * 200이 나온다. "지금 진짜로 어느 경로로 인증하고 있는가"를 눈으로 볼 수단이 필요하다.
 * Vercel 함수 로그를 뒤지지 않고 URL 하나로 답이 나오게 하는 것이 목적이다.
 *
 * 내보내는 값에 비밀은 없다 — 토큰 존재 여부(불리언)와 앞 8자, 프로젝트 번호·SA 이메일·풀 ID는
 * 전부 공개 식별자다. 그래도 운영자 게이트 뒤에 둔다.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Vercel 이 요청에 OIDC 토큰을 붙였는지 — WIF 가 안 되는 가장 흔한 원인이 "안 붙음"이다
  const oidcHeader = req.headers.get("x-vercel-oidc-token");

  let token: { ok: boolean; head?: string; err?: string };
  try {
    const t = await vertexToken();
    token = { ok: true, head: t.slice(0, 8) + "…" };
  } catch (e) {
    token = { ok: false, err: String(e).slice(0, 300) };
  }

  return NextResponse.json({
    선언모드: authMode(),
    실제경로: resolvedAuthMode(),
    oidc: {
      요청헤더에토큰: !!oidcHeader,
      길이: oidcHeader?.length ?? 0,
      빌드변수: !!process.env.VERCEL_OIDC_TOKEN,
    },
    env: {
      GCP_PROJECT_NUMBER: process.env.GCP_PROJECT_NUMBER ?? null,
      GCP_SERVICE_ACCOUNT_EMAIL: process.env.GCP_SERVICE_ACCOUNT_EMAIL ?? null,
      GCP_WORKLOAD_IDENTITY_POOL_ID: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID ?? null,
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID ?? null,
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ?? null,
      // 값은 절대 안 내보낸다 — 있는지만
      GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "(설정됨)" : null,
    },
    token,
  });
}
