/**
 * 고객 사이트 렌더러 자리 (P1에서 구현).
 * P0 확인용: {slug}.localhost:3000 / {slug}.onstori.com 접속 시 이 페이지가 떠야
 * 미들웨어 재작성이 동작하는 것.
 */
export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
