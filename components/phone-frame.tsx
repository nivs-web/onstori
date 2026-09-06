/**
 * 폰 프레임 라이브 프리뷰 — 실제 사이트를 375px 모바일 폭으로 렌더 후 축소.
 * 순수 프레젠테이션(훅 없음) — 서버(히어로)·클라이언트(포트폴리오 탭) 양쪽에서 사용.
 * 색·모서리·그림자는 globals.css 토큰만 쓴다 (docs/DESIGN.md).
 */
export function PhoneFrame({ slug, scale = 0.62, title }: { slug: string; scale?: number; title?: string }) {
  return (
    <div
      style={{
        borderRadius: "var(--r-lg)", border: "1px solid var(--n-200)",
        background: "var(--n-900)", padding: "var(--s-2)", boxShadow: "var(--shadow-2)",
      }}
    >
      <div className="relative overflow-hidden" style={{ borderRadius: "var(--r-md)", background: "var(--n-0)" }}>
        {/* 노치 */}
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{ top: 6, height: 18, width: 86, borderRadius: "var(--r-full)", background: "var(--n-900)" }}
        />
        <div style={{ width: 375 * scale, height: 812 * scale }}>
          <iframe
            src={`/${slug}`}
            title={title ?? slug}
            loading="lazy"
            style={{ width: 375, height: 812, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
