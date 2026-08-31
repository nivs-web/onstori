import { NextRequest, NextResponse } from "next/server";

/**
 * 서브도메인 → /sites/{slug} 재작성 (설계서 6장).
 * - onstori.com, www.onstori.com, *.vercel.app, localhost → 본사 사이트(app/ 그대로)
 * - {slug}.onstori.com, {slug}.localhost → app/sites/[slug]/... 로 내부 재작성 (주소창은 그대로)
 * 주의: Next.js에서 밑줄(_) 시작 폴더는 라우팅 제외(private)라 app/sites 를 사용한다.
 * 본사 도메인에서 /sites/* 직접 접근은 차단(아래) — 고객 사이트는 서브도메인으로만 노출.
 * 슬러그 형식·예약어의 최종 검증은 서버(생성 API)에서 한다 — 여기는 라우팅만 담당.
 */

const ROOT_DOMAIN = "onstori.com";

function extractSlug(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  // 로컬 개발: slug.localhost / localhost
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    return slug === "www" ? null : slug;
  }

  // Vercel 프리뷰 배포는 본사 취급
  if (hostname.endsWith(".vercel.app")) return null;

  // 프로덕션: slug.onstori.com
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) return null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  }

  // 그 외(커스텀 도메인 등)는 P9에서 다룬다 — 지금은 본사 취급
  return null;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = extractSlug(host);

  if (!slug) {
    // 본사 도메인에서 내부 경로 직접 접근 차단
    if (req.nextUrl.pathname.startsWith("/sites/")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // 정적 자원·내부 경로 제외
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|mp4|webm|woff2)$).*)"],
};
