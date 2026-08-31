/**
 * 업종 → 카테고리 → 템플릿 매핑의 단일 출처.
 * 3층 모델: 업종(무한) → 카테고리 7(내부 분류·전시 태그) → 템플릿 5(화면 구조·CTA).
 * 온보딩은 카테고리를 묻지 않는다 — 이 파일의 키워드 사전이 1차 추론을 담당하고,
 * 미적중 시 LLM 분류, 저확신 시 1회 되묻기, 최종적으로 에디터에서 교정 가능.
 */

export type Template = "visit" | "book" | "quote" | "consult" | "browse";
export type CtaType = "call" | "reserve" | "quote" | "consult" | "browse";

export type CategoryId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Category {
  id: CategoryId;
  name: string;
  template: Template;
  cta: CtaType;
  /** v1 코드에서 활성화 여부. 나머지는 문서용으로만 존재. */
  active: boolean;
}

/** 카테고리 7 — 문서로 확정(설계서 3장). active만 코드가 사용. */
export const CATEGORIES: Category[] = [
  { id: 1, name: "매장·로컬", template: "visit", cta: "call", active: true }, // 카페·식당만 v1 활성
  { id: 2, name: "예약·케어", template: "book", cta: "reserve", active: false },
  { id: 3, name: "교육·레슨", template: "consult", cta: "consult", active: false }, // 체험신청 폼 변형
  { id: 4, name: "전문가·상담", template: "consult", cta: "consult", active: false }, // 의료 업종은 후기 비활성 정책 예약
  { id: 5, name: "시공·출장", template: "quote", cta: "quote", active: true }, // ★ 런칭 집중
  { id: 6, name: "공간·대관", template: "book", cta: "reserve", active: false }, // v1 예약=신청 폼(실시간 캘린더 아님)
  { id: 7, name: "기업·브랜드·판매", template: "browse", cta: "browse", active: false },
];

export interface Industry {
  id: string; // 영문 슬러그 (안정 식별자)
  name: string; // 한글 표기
  categoryId: CategoryId;
  /** 추론 1차: "하는 일 한 줄"과 대조하는 키워드 사전 */
  keywords: string[];
  /** 이미지 뱅크 매칭 태그 */
  bankTags: string[];
  /** 기본 분위기 (위저드 분위기 미선택 시) */
  defaultMood: "clean" | "warm" | "premium" | "lively";
}

/** v1 활성 업종 14개 = 카테고리 5 전체(12) + 카페·식당(2, 랜딩 탭 전시용) */
export const INDUSTRIES: Industry[] = [
  // ── 카테고리 5 · 시공·출장 (QUOTE) ──
  { id: "interior", name: "인테리어", categoryId: 5, keywords: ["인테리어", "리모델링", "집수리", "올수리", "부분수리", "상가인테리어", "주거인테리어"], bankTags: ["interior", "construction"], defaultMood: "clean" },
  { id: "construction", name: "건설·시공", categoryId: 5, keywords: ["건설", "시공", "건축", "증축", "신축", "철거"], bankTags: ["construction"], defaultMood: "clean" },
  { id: "wallpaper", name: "도배·장판", categoryId: 5, keywords: ["도배", "장판", "벽지", "바닥재", "마루"], bankTags: ["interior", "wallpaper"], defaultMood: "clean" },
  { id: "tile", name: "타일·욕실", categoryId: 5, keywords: ["타일", "욕실", "방수", "줄눈"], bankTags: ["tile", "bathroom"], defaultMood: "clean" },
  { id: "electric", name: "전기", categoryId: 5, keywords: ["전기", "조명", "배선", "콘센트", "전기공사"], bankTags: ["electric"], defaultMood: "clean" },
  { id: "plumbing", name: "설비·배관", categoryId: 5, keywords: ["설비", "배관", "보일러", "누수", "수도"], bankTags: ["plumbing"], defaultMood: "clean" },
  { id: "furniture", name: "가구제작", categoryId: 5, keywords: ["가구", "붙박이장", "싱크대", "목공", "제작가구"], bankTags: ["furniture", "wood"], defaultMood: "warm" },
  { id: "cleaning", name: "청소", categoryId: 5, keywords: ["청소", "입주청소", "준공청소", "특수청소", "에어컨청소"], bankTags: ["cleaning"], defaultMood: "clean" },
  { id: "moving", name: "이사", categoryId: 5, keywords: ["이사", "포장이사", "용달", "운송"], bankTags: ["moving"], defaultMood: "clean" },
  { id: "repair", name: "수리", categoryId: 5, keywords: ["수리", "보수", "AS", "고장", "교체"], bankTags: ["repair"], defaultMood: "clean" },
  { id: "install", name: "설치", categoryId: 5, keywords: ["설치", "시스템에어컨", "샷시", "창호", "블라인드", "커튼"], bankTags: ["install"], defaultMood: "clean" },
  { id: "rental", name: "렌탈", categoryId: 5, keywords: ["렌탈", "대여", "임대", "리스"], bankTags: ["rental"], defaultMood: "clean" },
  // ── 카테고리 1 · 매장·로컬 중 v1 예외 활성 (VISIT, 랜딩 [카페·식당] 탭) ──
  { id: "cafe", name: "카페", categoryId: 1, keywords: ["카페", "커피", "베이커리", "디저트", "브런치"], bankTags: ["cafe"], defaultMood: "warm" },
  { id: "restaurant", name: "식당", categoryId: 1, keywords: ["식당", "맛집", "한식", "중식", "일식", "양식", "고기", "곱창", "국밥", "분식"], bankTags: ["restaurant", "food"], defaultMood: "warm" },
];

/** 랜딩 포트폴리오 탭 — 카테고리가 아닌 전시용 태그 (showcase.portfolio_tag) */
export const PORTFOLIO_TABS = ["전체", "인테리어", "시공·건설", "서비스·출장", "카페·식당"] as const;

export function categoryOf(industry: Industry): Category {
  return CATEGORIES.find((c) => c.id === industry.categoryId)!;
}

/** 추론 1차: 키워드 사전 매칭. 미적중 시 null → LLM 분류로 넘어간다(P2). */
export function matchIndustry(text: string): Industry | null {
  const t = text.replace(/\s/g, "");
  let best: { industry: Industry; hits: number } | null = null;
  for (const ind of INDUSTRIES) {
    const hits = ind.keywords.filter((k) => t.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { industry: ind, hits };
  }
  return best?.industry ?? null;
}
