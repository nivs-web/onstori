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
    //
    // 경로는 정규식 트릭 없이 "허용 목록"으로 명시한다 — lookahead가 든 source 패턴은
    // Vercel 라우팅에서 전체 NOT_FOUND를 유발했음(2026-08-31, DECISIONS.md).
    // 고객 사이트에 경로가 늘어나면 여기에 한 줄씩 추가한다.
    const hosts = [
      "(?<slug>[a-z0-9-]+)\\.onstori\\.com",
      "(?<slug>[a-z0-9-]+)\\.localhost(?::\\d+)?", // 로컬 개발
    ];
    const sitePaths: Array<[string, string]> = [
      ["/", "/sites/:slug"],
      ["/edit/:path*", "/sites/:slug/edit/:path*"],
      ["/admin/:path*", "/sites/:slug/admin/:path*"],
      ["/story/:path*", "/sites/:slug/story/:path*"],
      ["/sitemap.xml", "/sites/:slug/sitemap.xml"],
      ["/robots.txt", "/sites/:slug/robots.txt"],
    ];
    return {
      beforeFiles: hosts.flatMap((host) =>
        sitePaths.map(([source, destination]) => ({
          source,
          destination,
          has: [{ type: "host" as const, value: host }],
        })),
      ),
    };
  },
};

export default nextConfig;
