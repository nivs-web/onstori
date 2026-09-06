import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import "./globals.css";

/* 제목용 세리프 — next/font 가 빌드 때 내려받아 자체 호스팅한다.
   전에는 globals.css 의 @import 였다: CSS → 구글 CSS → 폰트 파일로 이어지는
   렌더 차단 사슬이라 LCP 를 그대로 늦춘다 (docs/PERFORMANCE.md).
   본문용 Pretendard 는 app/fonts.css 에서 자체 호스팅한다. */
const serifKr = Noto_Serif_KR({
  weight: ["600", "700"],
  subsets: ["latin"],
  // ⚠ swap 이 아니라 optional 이다. swap 이면 폴백 명조로 그린 제목이 세리프가 도착한 뒤
  //   다시 그려지면서 아래 문단을 밀어낸다 — 2026-09-06 Lighthouse 에서 CLS 0.055 의
  //   전부가 이 한 번의 교체였다. optional 이면 첫 페인트에 못 대면 그 방문에서는
  //   폴백 명조로 끝까지 간다: 교체가 없으니 밀림도 없다. 다음 방문엔 캐시에서 바로 뜬다.
  display: "optional",
  variable: "--font-serif-kr",
  preload: false, // 한글 글리프가 커서 미리 받지 않는다 — 히어로 사진과 대역폭을 다투지 않게
});

export const metadata: Metadata = {
  metadataBase: new URL("https://onstori.com"),
  title: {
    default: "온스토리 — 홈페이지는 빈 집입니다. 스토리에는 진짜 사람이 있습니다.",
    template: "%s", // 고객 사이트는 자체 상호명 타이틀 사용
  },
  description:
    "사장님이 들려주시는 60초 스토리가 홈페이지·자막 영상·글이 되어 유튜브 쇼츠·인스타 릴스·쓰레드·네이버 블로그·홈페이지에 쌓입니다. 글쓰기 금지 · 문자 링크만 · 다운로드 없음. 온스토리.",
  openGraph: {
    siteName: "온스토리",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${serifKr.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
