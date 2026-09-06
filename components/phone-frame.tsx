"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 폰 프레임 라이브 프리뷰 — 실제 사이트를 375px 모바일 폭으로 렌더 후 축소.
 *
 * ⚠ iframe 은 **화면에 들어왔을 때만** 붙인다.
 *   이 안에 들어가는 건 손님 사이트 한 채가 통째로다 — 사진·글꼴·JS 까지 전부.
 *   첫 페이지에 이런 게 둘 있어서 그것만으로 요청 149개·1.6MB 가 됐다(2026-09-06 Lighthouse).
 *   iframe 의 loading="lazy" 는 `hidden lg:flex` 처럼 숨겨 둔 것까지는 막아주지 못한다.
 *
 * 이건 스크롤 애니메이션이 아니라 늦게 불러오기다 — MOTION.md 의 금지 대상이 아니다.
 * IntersectionObserver 가 없는 브라우저에서는 그냥 처음부터 불러온다(기능이 사라지지 않게).
 */
export function PhoneFrame({ slug, scale = 0.62, title }: { slug: string; scale?: number; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShow(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); }
      },
      // 화면에 닿기 조금 전에 미리 시작해 손님이 스크롤을 멈췄을 땐 이미 떠 있게
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
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
        {/* 크기는 iframe 이 붙기 전에도 그대로다 — 나중에 들어와도 아래가 밀리지 않는다(CLS) */}
        <div style={{ width: 375 * scale, height: 812 * scale }}>
          {show && (
            <iframe
              src={`/${slug}`}
              title={title ?? slug}
              loading="lazy"
              style={{ width: 375, height: 812, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
