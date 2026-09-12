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
  /** 이미 쓴 «이름» — 앵커가 달라도 이름이 같으면 손님이 구분을 못 한다 */
  const usedLabels = new Set<string>();
  const out: { href: string; label: string }[] = [];
  for (const s of doc.sections) {
    const id = ANCHOR_OF[s.type];
    if (!id || seen.has(id)) continue;
    /* ⚠ 영상은 주소가 비면 **화면에 안 그려진다**(index.tsx 의 VideoSecR).
       그런데 차례에는 남으면 손님이 「영상」을 눌러도 아무 데도 안 간다 — 죽은 링크다.
       화면과 차례의 판정을 같은 것으로 맞춘다(불변 규칙 12 의 정신). */
    if (s.type === "video" && !s.url?.trim()) continue;
    seen.add(id);
    /**
     * ★★ **이름이 겹치면 «기본 이름»으로 돌린다.** (2026-09-13 박팀장 발견)
     *
     * ⚠ 전에는 **앵커만** 중복 검사하고 이름은 안 봤다. 그런데 섹션 제목 중 하나는
     *   AI 가 지은 것(`about`)이고 하나는 우리가 박은 것(`gallery` = 「작업 사진」)이라
     *   **우연히 같은 글자**가 될 수 있다. 실제로 `/interior2` 의 차례에 「작업 사진」이
     *   **두 번** 나왔고, 손님은 둘 중 무엇이 무엇인지 알 수 없었다.
     * ★ 겹치면 그 섹션의 **기본 이름**을 쓴다(about → 「소개」). 그래도 겹치면 그대로 둔다 —
     *   이름을 지어내는 것보다 겹치는 편이 낫다(없는 말을 만들지 않는다).
     */
    const title = "title" in s && typeof s.title === "string" ? s.title.trim() : "";
    let label = title || fallback[s.type] || id;
    if (usedLabels.has(label)) {
      const alt = fallback[s.type] || id;
      if (!usedLabels.has(alt)) label = alt;
    }
    usedLabels.add(label);
    out.push({ href: `#${id}`, label });
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
