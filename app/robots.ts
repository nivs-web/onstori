import type { MetadataRoute } from "next";

/** 도메인 전체 robots — 경로 방식이라 파일 1개로 끝 (체험 사이트는 페이지 메타 noindex로 차단) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] }],
    sitemap: "https://onstori.com/sitemap.xml",
  };
}
