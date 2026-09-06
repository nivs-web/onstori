import Image from "next/image";

/**
 * ONSTORI 워드마크 — 서버·클라이언트 양쪽에서 쓰는 순수 프레젠테이션
 * (chrome.tsx 는 서버 전용 import 가 있어 분리).
 *
 * ⚠ 원본 600x103 PNG(52KB)이 아니라 **160x27 로 다시 뽑은 것**을 쓴다(2KB).
 *   화면에는 20~26px 높이로만 나오는데 600px 원본을 내려보내고 있었다 —
 *   next/image 를 물려도 52KB 그대로 나갔다(2026-09-06 Lighthouse 실측).
 *   26px × DPR 3 = 78px 이므로 160px 이면 어느 화면에서도 충분하다.
 *   원본 600 판은 지우지 않는다 — 인쇄·큰 화면용으로 남겨 둔다.
 * ⚠ width/height 를 반드시 같이 넣는다. 없으면 로고가 들어오는 순간 헤더가 튄다(CLS).
 */
const RATIO = 600 / 103;

export function Logo({ variant = "dark", height = 26 }: { variant?: "dark" | "cream"; height?: number }) {
  const src = variant === "cream" ? "/brand/onstori-logo-cream-160.png" : "/brand/onstori-logo-160.png";
  const width = Math.round(height * RATIO);
  return (
    <Image
      src={src}
      alt="온스토리 ONSTORI"
      width={width}
      height={height}
      // 헤더 로고는 첫 화면에 있다 — 늦게 부르면 상단이 비어 보인다
      priority
      sizes={`${width}px`}
      style={{ height, width }}
    />
  );
}
