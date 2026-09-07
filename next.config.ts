import type { NextConfig } from "next";

/**
 * 주소 체계: 경로 방식 — onstori.com/{slug} (2026-08-31 전면 전환, DECISIONS 참조)
 * 이유: 네이버 서치어드바이저는 CAPTCHA로 대량 자동 등록이 불가 → 서브도메인이면
 * 고객 수만큼 수동 등록·사이트맵 제출·2주 수집 대기. 경로 방식은 등록 1번 +
 * 사이트맵 인덱스 1개로 전 고객 커버 + 도메인 권위 승계.
 *
 * 서브도메인은 폐기가 아니라 "본사 내부 기능 전용"으로 보류 — 어드민의
 * '서브도메인 만들기' 메뉴에서만 관리(공간만, 추후 사용). 고객 사이트에는 쓰지 않는다.
 */
/**
 * sharp 의 리눅스 네이티브 파일 — **필요한 라우트에만** 붙인다.
 * 목록을 한 곳에 두어 라우트가 늘어나도 값을 복사하지 않게 한다.
 */
const SHARP_LINUX = [
  "./node_modules/@img/sharp-linux-x64/**",
  "./node_modules/@img/sharp-libvips-linux-x64/**",
];

const nextConfig: NextConfig = {
  /**
   * 이미지 저장소는 Cloudflare R2(`img.onstori.com`) — docs/specs/storage-r2.md, DECISIONS 2026-09-03.
   * 2026-09-06 부터 손님 사이트 사진은 next/image 를 거친다(docs/PERFORMANCE.md).
   * 히어로는 priority, 나머지는 lazy. URL 이 아래 호스트가 아니면 렌더러가 평범한 <img> 로
   * 떨어진다 — 옛 사이트의 낯선 호스트를 물리면 그 페이지가 통째로 500 이 된다.
   * supabase 는 R2 이전(2026-09-03) 사이트들의 이미지가 아직 거기 있어서 남긴다.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    // 손님 사이트 사진은 65 로 내보낸다. AVIF 에서 75 와 눈으로 구분이 안 되는데
    // 장당 30% 가까이 가볍다 (2026-09-06 실측: 갤러리 사진 100KB대 → 70KB대).
    qualities: [65, 75],
    remotePatterns: [
      { protocol: "https", hostname: "img.onstori.com" },
      { protocol: "https", hostname: "wpsrfjqfbhmeriscdacu.supabase.co" },
    ],
  },
  /* ★ 2026-09-07 — `/api/**` 였던 것을 **실제로 sharp 를 쓰는 5곳**으로 좁혔다.
     전에는 API 라우트 **30개 전부**에 sharp 리눅스 바이너리(libvips 포함, 수십 MB)를
     밀어 넣고 있었다. 27곳은 쓰지도 않는데 배포본마다 사본이 붙었다.
     배포 스토리지 10GB 무료 한도를 다 쓴 원인 중 제일 큰 항목이다.
     ⚠ 여기서 한 곳이라도 빠지면 프로덕션에서 그 라우트가 500 이 난다:
       ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6: cannot open shared object file
     새로 sharp 를 쓰는 라우트를 만들면 **여기 줄을 추가해야 한다.**

     원래 이 설정이 필요했던 이유(2026-09-04): .node 는 올라가는데 libvips 공유
     라이브러리(.so)가 트레이싱에서 빠져 sharp 라우트가 전부 500 이었다.
     optionalDependencies 로 끌어올리는 것만으로는 해결되지 않았다.

     ⚠ 키 형식은 2026-09-07 에 실측했다. `/api/inquiry` 와 `/api/inquiry/route` **둘 다** 먹는다
       (윈도우에 있는 sharp-win32-x64 로 시험해 .nft.json 에 들어가는 것을 확인했다).
       리눅스 패키지는 윈도우에 없어서 로컬 빌드로는 확인할 수 없다 — 배포 뒤 사진 업로드로 확인할 것. */
  outputFileTracingIncludes: {
    // sharp 를 직접 import 하는 곳
    "/api/inquiry": SHARP_LINUX,
    "/api/site/logo": SHARP_LINUX,
    "/api/site/upload": SHARP_LINUX,
    // lib/site-shot.ts 를 거쳐 sharp 를 쓰는 곳
    "/api/site/publish": SHARP_LINUX,
    "/api/admin/site-shot": SHARP_LINUX,
    /**
     * 내부 대시보드는 content/ 에 있고 라우트 핸들러가 fs 로 읽는다(public/ 이 아니다).
     * 트레이싱에 넣지 않으면 서버리스 번들에 파일이 안 올라가 프로덕션에서 404 가 난다.
     */
    "/mainplan/**": ["./content/mainplan/**"],
    "/plandept/**": ["./content/plandept/**"],
    "/onstoriplandept/**": ["./content/onstoriplandept/**"],
  },
  /**
   * 내부 대시보드 — content/<이름>/ 의 정적 파일을 운영자 전용 라우트가 서빙한다.
   *  - /mainplan        : 기획1 이야기 엔진 기획실 (app/mainplan/[[...path]]/route.ts) — 2026-09-05 신설
   *  - /plandept        : 기획2 전략기획실   (app/plandept/[[...path]]/route.ts)
   *  - /onstoriplandept : 기획3 사업 설계도  (app/onstoriplandept/[[...path]]/route.ts)
   * 2026-09-04 회장님 결정으로 운영자 로그인 전용이 됐다. public/ 에 두면 누구나 볼 수 있어
   * content/ 로 옮기고 ADMIN_KEY 쿠키를 확인하는 라우트로만 내보낸다(lib/private-static.ts).
   * 정적 파일 rewrite 는 더 이상 필요 없다 — app/ 의 정적 세그먼트가 [slug] 보다 먼저 잡는다.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      // www → apex
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.onstori.com" }],
        destination: "https://onstori.com/:path*",
        permanent: true,
      },
      // 과거 서브도메인 링크 호환: {sub}.onstori.com/* → onstori.com/{sub}/*
      // (위 www 규칙이 먼저 매치되므로 www는 여기 오지 않음)
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>[a-z0-9-]+)\\.onstori\\.com" }],
        destination: "https://onstori.com/:sub/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
