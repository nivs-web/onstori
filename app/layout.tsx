import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://onstori.com"),
  title: {
    default: "온스토리 — 이야기가 쌓이는 가게 홈페이지",
    template: "%s", // 고객 사이트는 자체 상호명 타이틀 사용
  },
  description:
    "사진만 보내면 5분 만에 완성. 시공 사례와 가게 이야기가 차곡차곡 쌓여 견적 문의를 부르는 소상공인 홈페이지, 온스토리.",
  openGraph: {
    siteName: "온스토리",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
