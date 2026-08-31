/**
 * 이미지뱅크 프롬프트 시스템 — 고품질·비중복의 단일 출처.
 * 조합: 역할(촬영 지시) × 업종(씬) × 무드(톤) × 변주 축(중복 방지)
 * 어드민에서 결과를 보고 이 파일의 씬·지시문을 계속 다듬는다 (반복 개선 워크플로).
 */

/** 공통 금지 — 모든 프롬프트에 붙는다. 글자·워터마크·간판 텍스트 사고 방지 + 초상권 회피 */
export const NEGATIVE =
  "No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye.";

/** 역할별 촬영 지시 — 화면비·구도·해상도 의도 */
export const ROLE_DIRECTION: Record<string, string> = {
  hero: "Wide establishing shot, 16:9 landscape, professional architectural/commercial photography, shallow depth only where natural, crisp focus, high dynamic range, magazine cover quality. Composition leaves clear negative space in upper-left for headline text overlay.",
  gallery: "4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism.",
  about: "3:2 medium shot conveying craft and care, warm human presence implied without visible faces (tools, hands at work, materials).",
  process: "Clean documentary style shot of work in progress, honest and unglamorous but tidy, 4:3.",
};

/** 무드 → 조명·색 지시 */
export const MOOD_TONE: Record<string, string> = {
  clean: "Bright neutral daylight, white and light-gray palette, airy, minimal styling.",
  warm: "Golden-hour warm light, beige and wood tones, cozy and inviting.",
  premium: "Moody low-key lighting, deep charcoal and brass accents, luxurious and calm.",
  lively: "Vivid but natural colors, energetic daylight, a single coral/red accent element.",
};

/** 업종별 씬 목록 — 씬이 곧 변주의 1차 축. 어드민 검수 결과에 따라 계속 추가·수정 */
export const INDUSTRY_SCENES: Record<string, string[]> = {
  interior: [
    "freshly renovated Korean apartment living room with new flooring and built-in storage",
    "modern kitchen renovation with matte cabinets and tiled backsplash",
    "bedroom makeover with new wallpaper and warm lighting",
    "bathroom remodel with large-format tiles and glass shower",
    "hallway with herringbone wood floor and clean white moldings",
  ],
  construction: [
    "small commercial building under neat renovation with scaffolding",
    "newly finished storefront exterior with clean lines",
    "structural framing of an interior space, tidy site",
  ],
  wallpaper: [
    "wallpaper rolls and smoothing tools on a clean workbench",
    "freshly papered bright room corner with perfect seams",
    "vinyl flooring being laid in an empty sunlit room",
  ],
  tile: [
    "large-format porcelain tiles freshly laid in a bathroom",
    "mosaic tile detail with perfect grout lines",
    "tiling tools, spacers and cut tiles arranged on site",
  ],
  electric: [
    "neatly organized electrical panel with labeled breakers",
    "recessed ceiling lights in a freshly finished room",
    "electrician's insulated tools laid on a workbench",
  ],
  plumbing: [
    "gleaming copper and PVC pipework neatly installed",
    "modern boiler installation in a clean utility room",
    "bathroom fixtures freshly plumbed and polished",
  ],
  furniture: [
    "custom built-in wardrobe in light oak, just installed",
    "woodworking bench with chisels and wood shavings",
    "kitchen island custom-built with walnut top",
  ],
  cleaning: [
    "sunlit empty apartment freshly deep-cleaned, sparkling floor",
    "professional cleaning caddy with eco supplies, no labels",
    "gleaming kitchen after move-in cleaning",
  ],
  moving: [
    "neatly stacked moving boxes in a bright empty room",
    "moving truck interior loaded with blanket-wrapped furniture",
  ],
  repair: [
    "well-worn quality hand tools arranged on canvas roll",
    "repaired door hinge close-up, clean workmanship",
  ],
  install: [
    "new window frames freshly installed with clean sealant lines",
    "air-conditioning unit neatly mounted, cabling hidden",
  ],
  rental: [
    "clean stack of rental equipment in an organized warehouse",
  ],
  cafe: [
    "specialty coffee bar with espresso machine and warm wood counter",
    "latte art being poured, close-up, steam rising",
    "cozy cafe corner with window light and plants",
    "fresh scones and pastries on a wooden board",
  ],
  restaurant: [
    "korean charcoal grill table with glowing embers, appetizing",
    "chef's hands plating a beautiful dish, no face",
    "warm restaurant interior with wood tables at golden hour",
  ],
};

/** 변주 축 2차 — 같은 씬이라도 각도·시간대를 흔들어 중복 방지 */
export const VARIATIONS = [
  "morning light, eye-level angle",
  "late afternoon light, slightly low angle",
  "overcast soft light, three-quarter view",
  "evening interior lighting, straight-on view",
];

export function buildPrompt(industryId: string, mood: string, role: string, sceneIdx: number, varIdx: number) {
  const scenes = INDUSTRY_SCENES[industryId] ?? INDUSTRY_SCENES.interior;
  const scene = scenes[sceneIdx % scenes.length];
  const variation = VARIATIONS[varIdx % VARIATIONS.length];
  return `${ROLE_DIRECTION[role] ?? ROLE_DIRECTION.gallery} Scene: ${scene}. ${MOOD_TONE[mood] ?? ""} ${variation}. Photorealistic, ultra high quality. ${NEGATIVE}`;
}
