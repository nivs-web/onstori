/**
 * 폰 프레임 라이브 프리뷰 — 실제 사이트를 375px 모바일 폭으로 렌더 후 축소.
 * 순수 프레젠테이션(훅 없음) — 서버(히어로)·클라이언트(포트폴리오 탭) 양쪽에서 사용.
 */
export function PhoneFrame({ slug, scale = 0.62, title }: { slug: string; scale?: number; title?: string }) {
  return (
    <div className="rounded-[2.4rem] border border-black/10 bg-neutral-900 p-[9px] shadow-[0_24px_60px_-20px_rgba(23,25,29,0.45)]">
      <div className="relative overflow-hidden rounded-[1.9rem] bg-white">
        <div className="absolute left-1/2 top-1.5 z-10 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-neutral-900" />
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
