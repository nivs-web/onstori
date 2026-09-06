/**
 * 요금·기간 정책의 **단일 출처** (2026-09-06 회장님 최종 확정).
 *
 * ★ 이 파일이 유일한 진실이다. 요금·무료기간·정지·유예·삭제를 말하는 문구는
 *   화면이든 문서든 반드시 여기서 읽어 간다. 같은 말을 다른 곳에 복사하지 않는다.
 *   (복사본이 생기면 한쪽만 고쳐지고 화면이 거짓말을 하게 된다 — 2026-09-06 실제로 그랬다:
 *    components/site/pay-modal.tsx 에 TRIAL_NOTICE 와 같은 문장이 통째로 복사돼 있었고,
 *    그 문장은 정지·유예 단계가 빠진 틀린 문장이었다.)
 *
 * ── 확정 정책 ────────────────────────────────────────────────
 *   요금   월 49,000원 **구독**. 홈페이지를 유지하는 동안 매달 자동으로 결제된다.
 *          (기간의 정함이 없는 1회 결제가 아니다.)
 *   D0     가입. 14일 무료 시작.
 *   D+14   미결제 → 홈페이지 **정지**(비공개). 손님에게 안 보인다. 사장님 자료는 보관한다.
 *   D+14~28  **유예 14일.** 여전히 안 보이지만, 이 사이에 결제하면 즉시 되살아난다.
 *   D+28   미결제 → **자동 삭제**. 삭제 전에 반드시 사전 통지한다.
 *
 * ── 코드가 아직 못 하는 것 (2026-09-06 기준) ──────────────────
 *   ⚠ 정기결제(빌링키)가 구현돼 있지 않다. api/billing/* 은 토스 **일반결제(1회성)** 로 짜여 있고,
 *     그 계약조차 하지 않았다(정기결제로 가맹 심사 진행 예정, 2~3주 소요).
 *   ⚠ 유예 14일과 D+28 자동 삭제가 크론에 없다. 현재 크론은 D+14 정지까지만 한다.
 *   ⚠ 삭제 전 사전 통지가 없다.
 *   → 위 셋이 끝나기 전에는 첫 결제를 받으면 안 된다. 약속과 실제가 갈라진다.
 */

/** 무료 체험 일수 — 가입일로부터 */
export const TRIAL_DAYS = 14;
/** 정지된 뒤 되살릴 수 있는 유예 일수 */
export const GRACE_DAYS = 14;
/** 가입일로부터 이 날이 지나면 자동 삭제 (= 무료 + 유예) */
export const DELETE_DAYS = TRIAL_DAYS + GRACE_DAYS;

/**
 * 자동 삭제 며칠 전에 예고 문자를 보낼지.
 * ⚠ 예고 없이 지우면 안 된다 — 이용약관이 "삭제 전에 미리 알려드립니다" 라고 약속한다.
 *   이 배열을 비우면 그 약속이 깨진다.
 */
export const DELETE_NOTICE_DAYS = [3, 1] as const;

/** 월 구독료(원). 금액의 단일 출처 — 서버가 재계산한다 (CLAUDE.md 규칙 4) */
export const MEMBERSHIP_PRICE = 49_000;
export const MEMBERSHIP_NAME = "온스토리 정회원";
/** 청구 주기 — 정기결제(빌링키)로 매달 청구 */
export const BILLING_INTERVAL = "월" as const;

/**
 * 사이트가 지금 어느 단계인가.
 *  active    결제 중(구독 유효) — 공개
 *  trial     무료 기간 — 공개
 *  grace     정지·유예 중 — 비공개. 결제하면 되살아난다
 *  deletable 유예까지 지났다 — 삭제 대상
 */
export type Phase = "active" | "trial" | "grace" | "deletable";

export type TrialInfo = {
  status: string;
  phase: Phase;
  /** 무료 남은 일수 (오늘 포함, 0 이하면 무료 종료) */
  daysLeft: number;
  /** 자동 삭제까지 남은 일수 (정지 이후에 의미가 있다) */
  daysUntilDelete: number;
  /** 무료가 끝났는가 (= 정지 이상) */
  expired: boolean;
  paid: boolean;
  endsAt: string | null;
  /** 이 시각이 지나면 자동 삭제 */
  deleteAt: string | null;
};

const DAY = 86_400_000;

export function trialInfo(
  site: { status?: string | null; trial_ends_at?: string | null; paid_at?: string | null },
  now = new Date()
): TrialInfo {
  const status = site.status ?? "trial";
  const paid = status === "active" || !!site.paid_at;
  const endsAt = site.trial_ends_at ?? null;
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  const deleteMs = endMs === null ? null : endMs + GRACE_DAYS * DAY;

  if (paid) {
    return {
      status, phase: "active", daysLeft: 9999, daysUntilDelete: 9999,
      expired: false, paid: true, endsAt, deleteAt: null,
    };
  }

  const daysLeft = endMs === null ? 9999 : Math.ceil((endMs - now.getTime()) / DAY);
  const daysUntilDelete = deleteMs === null ? 9999 : Math.ceil((deleteMs - now.getTime()) / DAY);
  const expired = status === "expired" || daysLeft <= 0;
  const phase: Phase = !expired ? "trial" : daysUntilDelete > 0 ? "grace" : "deletable";

  return {
    status, phase, daysLeft, daysUntilDelete, expired, paid: false,
    endsAt,
    deleteAt: deleteMs === null ? null : new Date(deleteMs).toISOString(),
  };
}

/**
 * 화면 문구의 단일 출처.
 * ⚠ 이 문장들을 다른 파일에 복사하지 마라. import 해서 써라.
 * ⚠ 정기결제는 "매달 자동으로 결제된다"는 사실을 결제 전에 분명히 알려야 한다.
 *   PRICE_LINE 과 AUTOPAY_NOTICE 를 결제 버튼 근처에서 빼지 마라.
 */
export const COPY = {
  /** 가격 표기 — "49,000원"만 쓰면 1회 결제로 읽힌다. 반드시 주기를 붙인다. */
  priceLine: `${BILLING_INTERVAL} ${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원`,

  /** 무료 체험 한 줄 */
  trialShort: `${TRIAL_DAYS}일 전 기능 무료`,

  /** 가입 화면·결제 모달의 정책 안내 (정지·유예·삭제를 전부 말한다) */
  policy:
    `가입 후 ${TRIAL_DAYS}일 동안 전 기능을 무료로 쓰실 수 있습니다. ` +
    `무료 기간이 끝나면 홈페이지가 정지되어 손님에게 보이지 않지만, 자료는 그대로 보관합니다. ` +
    `정지된 뒤 ${GRACE_DAYS}일 안에 결제하시면 홈페이지가 그대로 되살아납니다. ` +
    `가입 후 ${DELETE_DAYS}일까지 결제가 없으면 자료가 삭제되며, 삭제 전에 미리 알려드립니다.`,

  /** 결제 직전 자동결제 고지 — 법이 요구하는 사전 고지다. 빼지 마라. */
  autopay:
    `결제하시면 ${BILLING_INTERVAL} ${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원이 매달 자동으로 결제됩니다. ` +
    `언제든 해지하실 수 있고, 해지하시면 다음 달부터 청구되지 않습니다.`,

  /** 정지 상태에서 보여줄 안내 — daysUntilDelete 를 넣어 부른다 */
  graceNotice: (daysUntilDelete: number) =>
    `무료 기간이 끝나 홈페이지가 정지됐습니다. ${Math.max(0, daysUntilDelete)}일 안에 결제하시면 그대로 되살아납니다. ` +
    `그때까지 결제가 없으면 자료가 삭제됩니다.`,
} as const;
