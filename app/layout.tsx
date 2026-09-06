import type { Metadata } from "next";
import "./globals.css";

/* ★ 2026-09-07 — 제목용 명조(Noto Serif KR)를 완전히 폐기했다.
   화면당 서른 글자 남짓 쓰자고 한글 세리프 405KB 를 받고 있었다(Lighthouse 실측).
   제목은 이제 서체가 아니라 **굵기와 자간**으로 낸다 — app/globals.css 의 --w-bold/--ls-h1.
   글꼴은 Pretendard 하나뿐이고, 자체 호스팅한다(app/fonts.css). */

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
