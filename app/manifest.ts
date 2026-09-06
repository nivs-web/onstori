import type { MetadataRoute } from "next";

/** 홈 화면 바로가기(안드로이드 PWA) — 아이콘의 단일 출처는 public/brand/*. */
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
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
