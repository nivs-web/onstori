import type { NextConfig } from "next";

/**
 * 서브도메인 멀티테넌시 — 미들웨어 없이 host 기반 rewrites로 처리 (설계서 6장 개정).
 *
 * 배경: 이 Vercel 프로젝트에서 미들웨어가 코드와 무관하게 MIDDLEWARE_INVOCATION_FAILED로
 * 죽는 문제가 있어(최소 미들웨어로 확인, docs/DECISIONS.md 2026-08-31 참고),
 * 엣지 라우팅 계층에서 동작하는 rewrites로 전환. 함수 호출이 없어 더 빠르고 안정적.
 *
 * - {slug}.onstori.com/*  → 내부적으로 /sites/{slug}/* (주소창은 그대로)
 * - www.onstori.com       → onstori.com 으로 리다이렉트
 * - afterFiles 단계라 /_next/* 등 실제 파일이 항상 우선 — 정적 자원은 영향 없음
 * - 본사 도메인에서 /sites/* 직접 접근 차단은 페이지 내 host 검사로 처리 (P1에서 렌더러에 통합)
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.onstori.com" }],
        destination: "https://onstori.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // beforeFiles 필수: 루트 "/" 등 실제 존재하는 라우트보다 먼저 실행돼야
    // 서브도메인에서 본사 페이지 대신 고객 사이트가 뜬다.
    // source의 커스텀 정규식으로 _next/·api/·정적 파일(.ext)은 제외 — 자산은 그대로 서빙.
    const sitePath = "/:path((?!_next/|api/|.*\\.[\\w]+$).*)";
    return {
      beforeFiles: [
        {
          source: sitePath,
          has: [{ type: "host", value: "(?<slug>[a-z0-9-]+)\\.onstori\\.com" }],
          destination: "/sites/:slug/:path",
        },
        // 로컬 개발: {slug}.localhost:3000
        {
          source: sitePath,
          has: [{ type: "host", value: "(?<slug>[a-z0-9-]+)\\.localhost(?::\\d+)?" }],
          destination: "/sites/:slug/:path",
        },
      ],
    };
  },
};

export default nextConfig;
