import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * 고객 사이트 렌더러 자리 (P1에서 구현).
 * 라우팅은 next.config.ts의 host 기반 rewrites가 담당:
 * {slug}.onstori.com → /sites/{slug}. 본사 도메인에서 /sites/* 직접 접근은 홈으로 돌려보낸다.
 */
export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  const viaSubdomain =
    host === `${slug}.onstori.com` || host === `${slug}.localhost`;
  if (!viaSubdomain) redirect("/");

  return (
    <main style={{ fontFamily: "sans-serif", padding: "4rem 2rem", textAlign: "center" }}>
      <p style={{ color: "#888", fontSize: 14, letterSpacing: 2 }}>ONSTORI · P0</p>
      <h1 style={{ fontSize: 28, margin: "0.5rem 0" }}>{slug}.onstori.com</h1>
      <p style={{ color: "#555" }}>
        고객 사이트 렌더러 자리입니다. P1에서 site JSON → 페이지 렌더링이 여기에 들어옵니다.
      </p>
    </main>
  );
}
