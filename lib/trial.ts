/**
 * 14일 무료 → 정회원 (기획1 /mainplan #membership · 2026-09-05)
 * 판정은 서버·클라이언트 공용 순수 함수. status 변경(expired)은 크론(app/api/cron/expire)만 한다.
 */
export const TRIAL_DAYS = 14;
export const MEMBERSHIP_PRICE = 49_000; // 원 — 금액의 단일 출처 (규칙 4: 서버가 재계산)
export const MEMBERSHIP_NAME = "온스토리 정회원";

export type TrialInfo = {
  status: string;
  /** 무료 남은 일수 (오늘 포함, 0 이하면 만료) */
  daysLeft: number;
  expired: boolean;
  paid: boolean;
  endsAt: string | null;
};

export function trialInfo(site: { status?: string | null; trial_ends_at?: string | null; paid_at?: string | null }, now = new Date()): TrialInfo {
  const status = site.status ?? "trial";
  const paid = status === "active" || !!site.paid_at;
  const endsAt = site.trial_ends_at ?? null;
  const ms = endsAt ? new Date(endsAt).getTime() - now.getTime() : Infinity;
  const daysLeft = paid ? Infinity : Math.ceil(ms / 86_400_000);
  const expired = !paid && (status === "expired" || daysLeft <= 0);
  return { status, daysLeft: Number.isFinite(daysLeft) ? daysLeft : 9999, expired, paid, endsAt };
}

export const TRIAL_NOTICE = `${TRIAL_DAYS}일 이내에 결제하시면 이 홈페이지를 계속 유지하실 수 있습니다. ${TRIAL_DAYS}일 이후에는 자동으로 삭제됩니다.`;
