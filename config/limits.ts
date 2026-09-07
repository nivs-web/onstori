/**
 * 사진·파일 상한의 **단일 출처**.
 *
 * 2026-09-07 회장님 확정 — 전에는 세 곳에 흩어져 있었다:
 *   견적 폼 3장(components/sections/quote-form.tsx) · 갤러리 30장 · 이야기 10장(lib/schema.ts).
 * 흩어져 있으면 한쪽만 고쳐져 화면과 서버가 서로 다른 말을 한다 —
 * 요금 문구가 182곳 중 175곳 어긋났던 것과 같은 사고다(lib/trial.ts 머리 주석).
 *
 * ⚠ 값을 바꿀 때 같이 확인할 곳:
 *   - lib/schema.ts 의 zod max() — 서버가 실제로 거절하는 한계
 *   - 화면의 안내 문구 — 반드시 여기서 읽어 쓴다
 */

/**
 * 한 계정이 가질 수 있는 홈페이지 수 — **1개**(2026-09-07 회장님 확정).
 *
 * 왜 지금 넣었나: 2026-09-07 조회에서 사이트 8곳이 전부 `owner_id` 가 비어 있었다
 * (운영자가 만든 전시·시험용). **2개 이상 가진 실제 계정이 0개**라 지금 넣으면
 * 기존 회원 중 걸리는 사람이 한 명도 없다.
 *
 * ⚠ 로그인하지 않은(익명) 생성은 막지 않는다. 지금 온보딩은 로그인 없이 만들고
 *   나중에 계정에 귀속(claim)하는 구조라, 여기서 막으면 신규 가입이 통째로 끊긴다.
 */
export const SITES_PER_ACCOUNT = 1;

/** 화면·API 가 같은 문장을 쓰도록 문구도 여기 둔다(복사하면 한쪽만 고쳐진다) */
export const SITE_LIMIT_MSG =
  "한 계정에 홈페이지 하나입니다. 두 개가 필요하시면 계정을 하나 더 만들어 주세요.";

export const PHOTO_LIMITS = {
  /** 손님이 견적 문의에 붙이는 현장 사진 */
  inquiry: 3,
  /** 사장님이 온보딩(위저드)에서 한 번에 올리는 자료 사진 */
  onboarding: 15,
  /** 갤러리 섹션에 들어가는 사진 */
  gallery: 30,
  /** 이야기(스토리) 한 편에 붙는 사진 */
  story: 10,
} as const;

export type PhotoLimitKey = keyof typeof PHOTO_LIMITS;

/** 업로드 파일 한 장의 최대 크기 (바이트) — API 와 화면 안내가 같은 값을 본다 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "15MB";

/** "최대 N장" 안내 문구 — 화면마다 숫자를 손으로 적지 않는다 */
export function photoLimitLabel(key: PhotoLimitKey): string {
  return `최대 ${PHOTO_LIMITS[key]}장`;
}
