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
  display: "swap",
  variable: "--font-serif-kr",
  preload: false, // 한글 글리프가 커서 미리 받지 않는다 — 제목은 폴백 명조로 먼저 그려진다
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
