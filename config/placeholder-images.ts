/**
 * 이미지 뱅크가 채워지기 전까지 쓰는 업종별 기본 이미지 (무료 스톡).
 * 뱅크(image_bank)에 승인 이미지가 생기면 lib/bank.ts가 뱅크를 우선 사용.
 * 고객은 에디터(P3)에서 언제든 자기 사진으로 교체.
 */
const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const construction = { hero: U("photo-1600585154340-be6161a56a0c"), gallery: [U("photo-1600210492486-724fe5c67fb0", 900), U("photo-1586023492125-27b2c045efd7", 900)] };
const service = { hero: U("photo-1581578731548-c64695cc6952"), gallery: [U("photo-1584820927498-cfe5211fd8bf", 900)] };
const food = { hero: U("photo-1495474472287-4d71bcdd2085"), gallery: [U("photo-1554118811-1e0d58224f24", 900), U("photo-1509042239860-f550ce710b93", 900)] };

export const PLACEHOLDER_IMAGES: Record<string, { hero: string; gallery: string[] }> = {
  interior: construction, construction, wallpaper: construction, tile: construction,
  electric: construction, plumbing: construction, furniture: construction,
  cleaning: service, moving: service, repair: service, install: service, rental: service,
  cafe: food, restaurant: food,
};

export function placeholderFor(industryId: string) {
  return PLACEHOLDER_IMAGES[industryId] ?? construction;
}
