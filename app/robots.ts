import type { MetadataRoute } from "next";

/**
 * 도메인 전체 robots — 경로 방식이라 파일 1개로 끝 (체험 사이트는 페이지 메타 noindex로 차단).
 * /onstoriplandept 는 내부용 사업 설계도 대시보드 — 페이지 자체도 meta noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/onstoriplandept"] }],
    sitemap: "https://onstori.com/sitemap.xml",
  };
}
