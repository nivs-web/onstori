import type { SectionT, SiteDocT } from "@/lib/schema";
import { telValue } from "@/lib/phone";

/**
 * 손님 사이트의 «차례»와 «연락처» — **렌더러가 없는 잎 모듈** (2026-09-10, V-1 B).
 *
 * ★★ 왜 파일을 나눴나 (실측으로 잡았다):
 *   `components/sections/site-chrome.tsx` 와 `connect-widget.tsx` 는 "use client" 인데
 *   `./index` 에서 `contactOf`·`SECTION_ANCHORS` 를 가져오고 있었다. 그 한 줄 때문에
 *   **섹션 렌더러 13종이 통째로 손님 브라우저 번들에 실렸다.**
 *   2026-09-10 에 영상 렌더러를 더했더니 손님 사이트 JS 가 1.1KB 늘어 발각됐다
 *   (번들에서 `70svh` 문자열이 나왔다 — 영상 렌더러의 style 값이다).
 *
 * ★ 이 파일에는 **JSX 도 렌더러도 없다.** 여기 있는 것만 손님 브라우저로 간다.
 * ⚠ 여기에 컴포넌트를 추가하지 마라. 추가하는 순간 같은 사고가 다시 난다.
 *   렌더러는 `./index` 에 두고, 그 파일은 **서버에서만** 불린다(docs/PERFORMANCE.md §5-2).
 */

/** 섹션 종류 → 손님 사이트의 앵커 id */
export const ANCHOR_OF: Partial<Record<SectionT["type"], string>> = {
  about: "about", storyFeed: "stories", gallery: "gallery", portfolioGallery: "portfolio",
  processSteps: "process", reviews: "reviews", menuPrice: "menu", hoursCard: "hours",
  map: "map", quoteForm: "quote",
  // 2026-09-10 V-1 — 손님이 차례에서 영상으로 바로 갈 수 있게
  video: "video",
};

/** 시트에 올릴 차례. 제목이 비어 있으면 종류의 기본 이름을 쓴다. */
export function SECTION_ANCHORS(doc: SiteDocT): { href: string; label: string }[] {
  const fallback: Partial<Record<SectionT["type"], string>> = {
    about: "소개", storyFeed: "작업 기록", gallery: "사진", portfolioGallery: "시공 사례",
    processSteps: "진행 과정", reviews: "후기", menuPrice: "가격", hoursCard: "영업시간",
    map: "오시는 길", quoteForm: "견적 문의", video: "영상",
  };
  const seen = new Set<string>();
  const out: { href: string; label: string }[] = [];
  for (const s of doc.sections) {
    const id = ANCHOR_OF[s.type];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = "title" in s && typeof s.title === "string" ? s.title.trim() : "";
    out.push({ href: `#${id}`, label: title || fallback[s.type] || id });
  }
  return out;
}

/**
 * 전화·카톡 주소 — 문의 받기 섹션에서 파생한다.
 * ⚠ 같은 값의 사본을 만들지 않는다(lib/schema.ts 의 Widget 주석 참조).
 */
export function contactOf(doc: SiteDocT): { tel: string; kakaoUrl: string } {
  const q = doc.sections.find((s) => s.type === "quoteForm");
  return {
    tel: telValue(q && "phone" in q ? q.phone : ""),
    kakaoUrl: (q && "kakaoUrl" in q ? q.kakaoUrl : "") ?? "",
  };
}
