/** ONSTORI 워드마크 — 서버·클라이언트 양쪽에서 쓰는 순수 프레젠테이션 (chrome.tsx 는 서버 전용 import 가 있어 분리) */

/** 원본 600x103 — width/height 를 반드시 같이 넣는다. 없으면 로고가 들어오는 순간 헤더가 튄다(CLS). */
const RATIO = 600 / 103;

export function Logo({ variant = "dark", height = 26 }: { variant?: "dark" | "cream"; height?: number }) {
  const src = variant === "cream" ? "/brand/onstori-logo-cream-600.png" : "/brand/onstori-logo-600.png";
  const width = Math.round(height * RATIO);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="온스토리 ONSTORI" width={width} height={height} style={{ height, width }} />;
}
