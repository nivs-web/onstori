/* 기간 출처: lib/trial.ts — 아래 주석의 「30일」은 대표님 말씀을 그대로 옮긴 것이고,
   실제 기간 값은 그 파일(`TRIAL_DAYS`)이 정한다. 여기에 숫자를 쓰지 않는다. */
import { trialInfo } from "./trial";

/**
 * ★★★ **무료 30일은 «기능 제한판»이다 — 단일 출처.** (2026-09-15 대표님 확정)
 *
 * ★ 대표님 말씀 그대로:
 *   「30일 무료이지만, **문자로 연락 받기 · 유료 AI API 쓰기 등 큰 수정**은 전부 누르면
 *    **「무료 기간중에는 활성화 되지 않습니다. 활성화 하시려면 결제해 주세요.
 *    → 정회원 결제하기」**(이 버튼 누르면 실제 결제창으로 이동) — 이 방침으로 갈 거야.
 *    사실 무료 30일이지만 **기능 제한이 걸린 상태로**, 30일이라서 짧지만
 *    **계속 유료 가입을 유도하는 거지.**」
 *
 * ★★ **왜 한 파일에 모으나.** 잠금이 화면마다 흩어지면 반드시 한쪽이 빠진다 —
 *   빠진 자리는 «공짜로 열린 문»이 되고, 그게 돈이 나가는 기능이면 그대로 비용이다.
 *   2026-09-06 에 요금·기간을 화면마다 적어 두었다가 **182곳 중 175곳이 어긋난** 적이 있다.
 *
 * ⚠ **잠그되 «숨기지» 않는다.** 버튼을 안 보이게 하면 사장님은 그 기능이 있는지도 모르신다.
 *   **보이게 두고 누르면 「결제하시면 됩니다」**를 보여 주는 것이 유도가 된다. 그게 대표님 뜻이다.
 * ⚠ **이미 만든 것을 뺏지 않는다.** 무료 기간에 만든 홈페이지·이야기·사진은 그대로다.
 *   잠그는 것은 «앞으로 쓸 기능»이지 «이미 가진 것»이 아니다.
 */

/** 무엇을 잠그나 — 화면에 보여 줄 이름까지 한 곳에 둔다 */
export const PAID_FEATURES = {
  sms: {
    label: "문자로 연락 받기",
    why: "주 1회 질문과 알림을 문자로 받는 기능입니다. 문자는 보낼 때마다 비용이 들어 정회원께만 드립니다.",
  },
  ai_image: {
    label: "AI 사진 만들기",
    why: "사진을 새로 만들어 드리는 기능입니다. 만들 때마다 비용이 들어 정회원께만 드립니다.",
  },
  ai_rewrite: {
    label: "AI 로 글 다시 쓰기",
    why: "홈페이지 글을 통째로 다시 써 드리는 기능입니다. 정회원께만 드립니다.",
  },
  video_edit: {
    label: "영상 편집 · 자막",
    why: "영상을 다듬고 자막을 붙이는 기능입니다. 정회원께만 드립니다.",
  },
  sns_publish: {
    label: "SNS 한 번에 올리기",
    why: "여섯 채널에 한 번에 올리는 기능입니다. 정회원께만 드립니다.",
  },
} as const;

export type PaidFeature = keyof typeof PAID_FEATURES;

/** 잠금 안내 — **문구의 단일 출처**. 화면마다 다시 쓰지 마라 */
export const LOCK_TITLE = "무료 기간중에는 활성화 되지 않습니다.";
export const LOCK_BODY = "활성화 하시려면 결제해 주세요.";
export const LOCK_CTA = "정회원 결제하기";
/** 결제창으로 가는 길 — 바뀌면 여기만 고친다 */
export const LOCK_HREF = "/my?pay=1";

export type SiteLike = {
  status?: string | null;
  trial_ends_at?: string | null;
  paid_at?: string | null;
  suspended_at?: string | null;
};

/**
 * **이 사장님이 정회원인가.**
 * ⚠ 판정은 `lib/trial.ts` 한 곳이 한다. 여기서 날짜를 다시 세지 않는다 —
 *   두 곳이 세면 반드시 어긋나고, 어긋난 판정으로 «돈 낸 분의 기능이 잠긴다».
 */
export function isPaid(site: SiteLike): boolean {
  return trialInfo(site).paid;
}

/**
 * **이 기능을 쓸 수 있나.**
 *
 * ⚠ **막는 쪽으로 기운다.** 사이트 정보를 못 읽었으면(`null`) 잠근다 —
 *   모를 때 열어 두면 그 틈으로 비용이 나간다. 잠긴 것은 사장님이 바로 말씀하시지만,
 *   열린 것은 청구서가 올 때까지 아무도 모른다.
 */
export function canUse(site: SiteLike | null | undefined, _feature: PaidFeature): boolean {
  if (!site) return false;
  return isPaid(site);
}

/**
 * 잠겼을 때 화면·API 가 함께 쓰는 답.
 * ⚠ API 는 이것을 **402**(결제 필요)로 돌려준다 — 401(로그인)·403(권한)과 구별되어야
 *   화면이 「로그인하세요」가 아니라 「결제하세요」를 보여 줄 수 있다.
 */
export function lockedPayload(feature: PaidFeature) {
  return {
    locked: true as const,
    feature,
    label: PAID_FEATURES[feature].label,
    title: LOCK_TITLE,
    body: LOCK_BODY,
    why: PAID_FEATURES[feature].why,
    cta: LOCK_CTA,
    href: LOCK_HREF,
  };
}
