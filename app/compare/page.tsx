import { redirect } from "next/navigation";

/** 메뉴에서 내렸다 — 내용은 /our-story#compare 로 옮겼다 (2026-09-06). 색인된 주소라 404 대신 넘긴다. */
export default function Compare() {
  redirect("/our-story#compare");
}
