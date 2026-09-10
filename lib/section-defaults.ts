import type { SectionT } from "@/lib/schema";

/**
 * 섹션 추가 시 타입별 기본값 팩토리 (P3 에디터 전용).
 * - 저장 API가 SiteDoc 전체를 zod 검증하므로, 모든 기본값은 min 제약을 통과해야 한다.
 * - 영업시간·주소·전화 같은 사실 정보는 날조하지 않는다 — 입력 안내 문구로 채워 사장님이 바꾸게 한다.
 * - hero는 생성 시 항상 존재하고 순서가 고정이라 추가 대상에서 제외.
 */

/**
 * 「섹션 추가」로 넣을 수 있는 것.
 *
 * ⚠ `hero` 는 생성 시 항상 있고 순서가 고정이라 제외한다.
 * ⚠ **`video` 도 제외한다** (2026-09-10 회장님). 사장님은 영상 «주소»를 타이핑할 수 없다.
 *   영상은 편집화면의 **[홈페이지에 걸기] 하나로만** 들어간다 — 길이 하나여야 헷갈리지 않는다.
 *   ★ 주석이 아니라 **타입으로** 막아 둔다. ADDABLE_SECTIONS 에 video 를 적으면 컴파일이 깨진다.
 */
export type AddableType = Exclude<SectionT["type"], "hero" | "video">;

export const ADDABLE_SECTIONS: { type: AddableType; name: string; needsPhoto?: boolean }[] = [
  { type: "about", name: "소개" },
  { type: "storyFeed", name: "이야기 코너" },
  { type: "gallery", name: "사진 갤러리", needsPhoto: true },
  { type: "reviews", name: "고객 이야기" },
  { type: "map", name: "오시는 길" },
  { type: "banner", name: "띠 배너" },
  { type: "portfolioGallery", name: "시공 사례", needsPhoto: true },
  { type: "processSteps", name: "진행 과정" },
  { type: "quoteForm", name: "문의 받기" },
  { type: "hoursCard", name: "영업시간" },
  { type: "menuPrice", name: "메뉴판" },
];

/** photoUrl은 needsPhoto 타입(gallery·portfolioGallery)에서 필수 — zod min(1) 배열의 첫 항목이 된다. */
export function sectionDefault(type: AddableType, photoUrl?: string): SectionT {
  switch (type) {
    case "about": return { type, title: "소개", body: "우리 가게를 소개하는 글을 적어주세요." };
    case "storyFeed": return { type, title: "우리 가게 이야기", showCount: 5 };
    case "gallery": return { type, title: "갤러리", photos: [photoUrl ?? ""] };
    case "reviews": return { type, title: "고객 이야기", items: [{ title: "", body: "" }] };
    case "map": return { type, title: "오시는 길", address: "주소를 입력해 주세요" };
    case "banner": return { type, text: "안내 문구를 입력해 주세요" };
    case "portfolioGallery": return { type, title: "시공 사례", items: [{ title: "", image: photoUrl ?? "" }] };
    case "processSteps": return { type, title: "진행 과정", steps: [{ name: "상담" }, { name: "진행" }] };
    case "quoteForm": return { type, title: "견적 문의", phone: "전화번호를 입력해 주세요", allowPhotos: true };
    case "hoursCard": return { type, title: "영업시간", hours: "영업시간을 입력해 주세요" };
    case "menuPrice": return { type, title: "메뉴", items: [{ name: "", price: "" }] };
  }
}

/**
 * 영상 섹션 만들기 — **편집화면의 [홈페이지에 걸기] 전용** (2026-09-10, V-1).
 *
 * ★ `sectionDefault()` 와 따로 둔 이유: 영상은 「섹션 추가」로 못 만든다(위 AddableType 참조).
 *   빈 값으로 만들 수 있는 물건이 아니라 **주소가 반드시 있어야** 하는 물건이다.
 * ★ 기본값이 한 곳에만 있게 여기 둔다 — C덩어리가 객체를 직접 조립하면 제목이 곳곳에서 갈린다.
 *
 * ⚠ `poster` 는 없을 수 있다(표지 뽑기 실패). 그때는 넣지 않는다 — 빈 문자열을 넣으면
 *   브라우저가 «없는 사진»을 받으러 가서 404 를 한 번 낸다.
 */
export function videoSection(v: { url: string; poster?: string; caption?: string }): SectionT {
  return {
    type: "video",
    title: "사장님 이야기",
    url: v.url,
    ...(v.poster ? { poster: v.poster } : {}),
    ...(v.caption ? { caption: v.caption.slice(0, 120) } : {}),
  };
}
