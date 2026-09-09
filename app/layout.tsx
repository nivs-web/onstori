import type { Metadata } from "next";
import "./globals.css";
import { themeAttrs, themeVars } from "@/lib/design-tokens";
import { readDesign } from "@/lib/design-settings";

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

/**
 * ★ 테마 엔진 주입 지점 (2026-09-08, S1).
 *
 * `<html>` 을 그리는 파일은 이 하나뿐이고, App Router 의 레이아웃은 **자기가 어느 경로인지
 * 알 수 없다.** 그래서 여기는 **온스토리 홈(site) 설정**을 심고, 다른 화면은 각자
 * 래퍼에서 덮는다(`/admin` 은 `.admin-shell`, 손님 사이트는 `app/[slug]/page.tsx`).
 * 미들웨어도 라우트 그룹 재배치도 필요 없다.
 *
 * ⚠ **여기서 `cookies()`·`headers()` 를 부르면 안 된다.** 부르는 순간 `/` 와 `/{slug}` 가
 *   전부 동적으로 떨어져 TTFB 0.06초를 잃는다(2026-09-08 기준값 측정).
 *
 * ⚠ **DB 읽기는 위 금지에 걸리지 않는다.** 정적 렌더를 깨는 것은 `cookies()`·`headers()` 같은
 *   동적 API 와 `cache:"no-store"` 를 명시한 fetch 뿐이다. Supabase 클라이언트는 둘 다 아니다
 *   (2026-09-09 Next 16.1.6 소스 확인). 빌드·재생성 시점에 한 번 읽어 화면에 구워진다.
 * ⚠ `readDesign` 은 **절대 던지지 않는다.** 표가 없거나 DB 가 죽어도 기본값으로 떨어진다 —
 *   여기서 던지면 사이트 전체가 500 이다.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const setting = await readDesign("site");
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      {...themeAttrs(setting, "site")}
      /* 루트는 기준선이다 — globals.css 의 기본값과 다른 것만 심는다(기본이면 0바이트) */
      style={themeVars(setting) as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
