import type { MetadataRoute } from "next";

const BRAND_BASE = process.env.NEXT_PUBLIC_BRAND_URL ?? "/brand/v1";

/** 홈 화면 바로가기(안드로이드 PWA) — 아이콘의 단일 출처는 `public/brand/v1/icon/` 이다.
 *
 *  ★ 2026-09-15 — brand v1 으로 옮겼다. zip 에 같이 온 `site.webmanifest` 는 **쓰지 않는다.**
 *    Next 가 이 파일로 `/manifest.webmanifest` 를 만들고 `<link rel="manifest">` 도 자동으로 넣는다.
 *    둘 다 두면 **어느 쪽이 이겼는지 알 수 없어진다** — 하나만 남긴다.
 *  ⚠ maskable 192 는 brand v1 에 없다. 안드로이드는 **512 하나로도** 적응형 아이콘을 만든다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "온스토리 ONSTORI",
    short_name: "온스토리",
    description: "사장님의 60초가 영상·글·블로그로 바뀌는 자동화 엔진",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    // --green (app/globals.css) 과 같은 값. manifest 는 CSS 변수를 못 읽어 값을 적는다 — 색의 단일 출처는 globals.css.
    theme_color: "#005B2A",
    icons: [
      { src: `${BRAND_BASE}/icon/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BRAND_BASE}/icon/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BRAND_BASE}/icon/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
