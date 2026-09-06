/**
 * 이미지뱅크 프롬프트 시스템 — 고품질·비중복의 단일 출처.
 * 조합: 역할(촬영 지시) × 업종(씬) × 무드(톤) × 변주 축(중복 방지)
 * 어드민에서 결과를 보고 이 파일의 씬·지시문을 계속 다듬는다 (반복 개선 워크플로).
 */

/** 공통 금지 — 모든 프롬프트에 붙는다. 글자·워터마크·간판 텍스트 사고 방지 + 초상권 회피 */
export const NEGATIVE =
  "No text, no letters, no signage with words, no watermark, no logo, no people's faces (hands or distant figures allowed), no distorted geometry, no fisheye. " +
  // 2026-09-06 — 무드 지시문만으로 서양 고급 주택·호텔이 끌려 나오는 것을 막는다.
  // "premium" 무드 실측에서 씬에 "Korean apartment"를 박아도 유럽 호텔 복도가 나왔다.
  "No chandelier, no Western crown molding, no wainscoting or panelled walls, no marble columns, " +
  "no hotel lobby, no arched doorways, no fireplace, no bay window. " +
  // 2026-09-06 — 폰에서 가운데 26% 만 남는다. 구도가 어긋나면 그 26% 가 못 쓰게 된다.
  "No tilted or converging verticals, no dutch angle, no two-point perspective, no corner-of-the-room view, " +
  "no 85mm telephoto compression, no empty blank wall in the center of the frame, " +
  "no off-center vanishing point, no subject cut in half at the frame center. " +
  // 2026-09-06 — ①거실 실측에서 창밖 뉴욕 스카이라인이 주인공이 됐고, ②주방은 서브웨이 타일이 나왔다
  "No subway tile, no New York skyline, no recognizable foreign cityscape, no landscape or sky as the subject, " +
  "no white countertop or white wall occupying the bottom third of the frame.";

/** 역할별 촬영 지시 — 화면비·구도·해상도 의도 */
export const ROLE_DIRECTION: Record<string, string> = {
  // ★ 히어로 = 가로 1장으로 PC·폰을 함께 쓴다 (2026-09-06 회장님 확정).
  //   폰에서는 100svh 로 꽉 채워 **가로의 가운데 26% 만 남는다.**
  //   그 26% 가 그것만으로 완성된 사진이어야 한다 — 빈 벽·벽 모서리·잘린 사물만 남으면 탈락이다.
  //   그래서 일반 히어로 관행("가운데를 비워 글자 자리를 만든다")과 **정반대**로 간다.
  hero:
    "16:9 landscape architectural interior photograph, wide lens (24-35mm equivalent). " +
    // ① 일점 투시 — 소실점이 화면 정중앙
    "ONE-POINT PERSPECTIVE: camera on the exact center line of the room, pointed straight ahead, " +
    "vanishing point at the dead center of the frame, perfectly straight vertical lines, no tilt, no dutch angle, " +
    "no two-point perspective corner view. " +
    // ② 가운데 세로 앵커 — 중앙 26% 를 혼자 지탱하는 수직 요소
    // ★ 앵커는 반드시 **시공한 결과물**이어야 한다 (2026-09-06 회장님 규칙).
    //   손님은 "이 업체가 뭘 만들었나"를 보러 온다. 창밖 풍경·도시 스카이라인은 시공한 게 아니다.
    "CENTER VERTICAL ANCHOR — must be something the contractor BUILT: " +
    "a feature accent wall, a TV wall, built-in wardrobe, a door frame, a shoe cabinet, a kitchen island, " +
    "a pendant light, ceiling cove lighting, a floor tile line, a vanity, or a mirror. " +
    "The exact middle of the frame is filled by that built element, FULL and self-sufficient — " +
    "never an empty wall, never a wall corner, and NEVER a window view, skyline, sky or trees as the subject. " +
    "Windows may only provide light from the side; blow the view outside to bright white or leave it soft and hazy. " +
    // ③ 세로 3층 — 위·중간·아래가 각각 제 몫을 한다
    "THREE HORIZONTAL BANDS: top band shows the ceiling with indirect cove or linear lighting; " +
    "middle band holds the main built subject at eye level; " +
    // ★ 아래 1/3 은 흰 글자가 얹히는 자리다. 흰 상판·흰 벽만 오면 글자가 안 보인다.
    "the BOTTOM THIRD must be DARK-TONED — dark wood flooring, deep-toned finishes, a sofa back, " +
    "a bar stool back, or a threshold strip. Never a white countertop or white wall in the bottom third. " +
    // ④ 좌우는 잘려도 되는 배경
    "The left and right thirds are croppable background only — nothing essential there. " +
    "Korean apartment context in every frame: balcony sash frames, apartment railing, flat Korean ceiling, " +
    "narrow entryway. Sharp focus throughout, high dynamic range, magazine quality.",
  gallery: "4:3 or square detail shot, editorial photography, one clear subject, tight composition, natural imperfections kept for realism.",
  about: "3:2 medium shot conveying craft and care, warm human presence implied without visible faces (tools, hands at work, materials).",
  process: "Clean documentary style shot of work in progress, honest and unglamorous but tidy, 4:3.",
};

/**
 * 무드 → 조명·색 지시.
 * ⚠ 무드 문장이 국적을 끌고 온다. 씬에 "Korean apartment"를 박아도 무드가 "luxurious, moody,
 *   brass"면 모델이 유럽 호텔을 그린다(2026-09-06 premium 실측). 고급스러움을 **한국 아파트의
 *   실제 고급 요소**로 표현한다 — 간접조명(코브·라인), 매립 다운라이트, 무광 마감, 톤온톤 우드/도장,
 *   히든 도어, 낮은 채도. 서양 고급 기호(샹들리에·몰딩·대리석 기둥)는 NEGATIVE 에서 막는다.
 */
export const MOOD_TONE: Record<string, string> = {
  clean: "Bright neutral daylight, white and light-gray palette, airy, minimal styling, flush recessed downlights.",
  warm: "Soft warm light from concealed cove lighting, beige and tone-on-tone wood, cozy and inviting.",
  premium:
    "Understated Korean high-end apartment finish: indirect cove and linear lighting, flush recessed downlights, " +
    "matte low-sheen surfaces, tone-on-tone wood and painted panels, hidden flush doors, low color saturation, " +
    "calm and restrained. Quiet luxury through material and light, not ornament.",
  lively: "Vivid but natural colors, energetic daylight, a single coral/red accent element, clean flat ceiling.",
};

/** 업종별 씬 목록 — 씬이 곧 변주의 1차 축. 어드민 검수 결과에 따라 계속 추가·수정 */
export const INDUSTRY_SCENES: Record<string, string[]> = {
  interior: [
    "freshly renovated Korean apartment living room with new flooring and built-in storage",
    "modern Korean apartment kitchen renovation with matte cabinets and tiled backsplash",
    "Korean apartment bedroom makeover with new wallpaper and warm lighting",
    "Korean apartment bathroom remodel with large-format tiles and glass shower",
    "Korean apartment entrance hallway with wood flooring, full-height hidden flush doors and a built-in shoe cabinet, flat ceiling with linear cove lighting",
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
