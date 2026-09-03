import type { NextConfig } from "next";

/**
 * 주소 체계: 경로 방식 — onstori.com/{slug} (2026-08-31 전면 전환, DECISIONS 참조)
 * 이유: 네이버 서치어드바이저는 CAPTCHA로 대량 자동 등록이 불가 → 서브도메인이면
 * 고객 수만큼 수동 등록·사이트맵 제출·2주 수집 대기. 경로 방식은 등록 1번 +
 * 사이트맵 인덱스 1개로 전 고객 커버 + 도메인 권위 승계.
 *
 * 서브도메인은 폐기가 아니라 "본사 내부 기능 전용"으로 보류 — 어드민의
 * '서브도메인 만들기' 메뉴에서만 관리(공간만, 추후 사용). 고객 사이트에는 쓰지 않는다.
 */
const nextConfig: NextConfig = {
  /**
   * 이미지 저장소는 Cloudflare R2(`img.onstori.com`) — docs/specs/storage-r2.md, DECISIONS 2026-09-03.
   * 지금은 <img> 직접 사용이라 필요 없지만, next/image 도입 시 외부 호스트 허용이 선행돼야 한다.
   */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.onstori.com" }],
  },
  /**
   * 사업 설계도 대시보드(/onstoriplandept) — public/onstoriplandept/index.html 정적 파일.
   * beforeFiles 로 앞세우지 않으면 app/[slug] 동적 라우트가 고객 사이트 슬러그로 가로챈다.
   * 슬러그 자체는 reserved_slugs 에도 넣어 고객이 선점하지 못하게 했다.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/onstoriplandept", destination: "/onstoriplandept/index.html" },
        { source: "/onstoriplandept/", destination: "/onstoriplandept/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      // www → apex
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.onstori.com" }],
        destination: "https://onstori.com/:path*",
        permanent: true,
      },
      // 과거 서브도메인 링크 호환: {sub}.onstori.com/* → onstori.com/{sub}/*
      // (위 www 규칙이 먼저 매치되므로 www는 여기 오지 않음)
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>[a-z0-9-]+)\\.onstori\\.com" }],
        destination: "https://onstori.com/:sub/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
