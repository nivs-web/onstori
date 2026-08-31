import type { NextConfig } from "next";

// 진단용 맨몸 설정 — redirects/rewrites 전부 제거.
// 이 상태로 Vercel에서 페이지가 뜨면 라우팅 설정이 범인으로 확정.
const nextConfig: NextConfig = {};

export default nextConfig;
