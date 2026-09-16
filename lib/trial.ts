/**
 * 요금·기간 정책의 **단일 출처** (2026-09-06 회장님 최종 확정).
 *
 * ★ 이 파일이 유일한 진실이다. 요금·무료기간·정지·삭제를 말하는 문구는
 *   화면이든 문서든 반드시 여기서 읽어 간다. 같은 말을 다른 곳에 복사하지 않는다.
 *   (복사본이 생기면 한쪽만 고쳐지고 화면이 거짓말을 한다 — 2026-09-06 실제로 그랬다:
 *    저장소 42개 파일에 정책 진술이 182곳 흩어져 있었고 그중 175곳이 어긋나 있었다.)
 *
 * ── 확정 정책 ────────────────────────────────────────────────
 *   요금   월 49,900원 **구독**(값은 아래 MEMBERSHIP_PRICE). 홈페이지를 유지하는 동안 매달 자동으로 결제된다.
 *   D0     가입. **30일** 무료 시작 (전 기능).
 *   D+31   미결제 → 홈페이지 **정지**. 손님에게 안 보이고 검색에서 빠진다. 자료는 보관.
 *          사장님이 들어오면 "결제하면 바로 다시 켜집니다" 화면. 언제든 결제하면 즉시 복구.
 *   정지+60일  사장님 콘텐츠 **영구 삭제** (삭제 30일 전·7일 전 문자 예고).
 *   정지+60일  손님 견적 문의 정보(이름·전화·내용·사진) **파기**.
 *   → 총 수명 30 + 60 = 90일
 *
 * ── 마케팅 문구 규칙 (회장님 지시 2026-09-06) ─────────────────
 *   ★ 홈페이지·문자·콜 스크립트에는 **"30일 무료"** 만 쓴다.
 *     정지 후 60일 삭제 유예는 **약관·개인정보처리방침에만** 적는다.
 *     화면용은 COPY, 법무 문서용은 LEGAL 로 나눠 뒀다 — 섞어 쓰지 마라.
 *
 * ── 구현 현황 (2026-09-06) ───────────────────────────────────
 *   ✅ 정지·삭제 예고·자동 삭제·문의 파기 → app/api/cron/expire (단계별로 분리)
 *   ✅ 정기결제(빌링키) 발급·매달 청구·해지 → lib/toss.ts · api/billing/subscribe · cancel
 *   ⚠ 토스 가맹 심사(정기결제) 중이라 **결제는 실호출로 검증한 적이 없다.**
 *   ⚠ 마이그레이션 20260906120000(billing·payments) · 20260906140000(sites.suspended_at) 적용 전.
 */

/** 무료 체험 일수 — 가입일로부터. 이 날이 지나면(D+31) 정지된다. */
export const TRIAL_DAYS = 30;

/**
 * 정지된 뒤 이 날이 지나면 사장님 콘텐츠를 영구 삭제한다.
 * ⚠ 기준은 **가입일이 아니라 정지일**이다. 결제 실패로 정지된 사장님은 가입일이 한참 전이라
 *   가입일 기준으로 계산하면 정지되자마자 삭제 대상이 된다. sites.suspended_at 을 쓴다.
 */
export const DELETE_AFTER_SUSPEND_DAYS = 60;

/**
 * 손님 견적 문의(이름·전화·내용·사진)를 정지일로부터 이 날이 지나면 파기한다.
 * 사장님 콘텐츠와 같은 60일이지만 **개념이 다르다** — 이건 손님의 개인정보이고,
 * 오래 갖고 있는 것 자체가 위험이라 사장님 콘텐츠와 따로 관리한다.
 */
export const INQUIRY_RETENTION_DAYS = 60;

/**
 * 정지와 무관하게, 접수일로부터 이 날이 지난 문의는 파기한다.
 * ⚠ 견적 폼의 동의 문구가 손님에게 "1년 뒤 삭제합니다" 라고 약속한 값이다
 *   (components/sections/quote-form.tsx). 이 값을 바꾸면 그 문구도 함께 바꿔야 한다.
 *   위 INQUIRY_RETENTION_DAYS 와 **둘 중 먼저 오는 때**에 파기한다.
 */
export const INQUIRY_MAX_AGE_DAYS = 365;

/**
 * 자동 삭제 며칠 전에 예고 문자를 보낼지.
 * ⚠ 예고 없이 지우면 안 된다 — 이용약관이 "삭제 전에 미리 알려드립니다" 를
 *   삭제권의 발생 요건으로 약속한다. 이 배열을 비우면 그 약속이 깨진다.
 */
export const DELETE_NOTICE_DAYS = [30, 7] as const;

/**
 * **무료 기간이 끝나기 며칠 전에 알릴까.** (2026-09-13 — 크론에 손으로 박혀 있던 것을 옮겼다)
 *
 * ⚠ 전에는 `app/api/cron/expire/route.ts` 안에 `left !== 3 && left !== 1` 로 **글자로** 박혀
 *   있었다. 불변 규칙 9 — 기간·금액은 이 파일이 단일 출처다. 그 규칙이 금액만 지켜지고
 *   기간에서는 새고 있었다.
 * ⚠ 크론이 **하루 한 번** 돌기 때문에 조회 창은 「가장 이른 예고일 + 반나절」이어야 한다.
 *   그 계산도 여기서 내려 준다(`TRIAL_NOTICE_WINDOW_DAYS`) — 크론이 다시 계산하면 어긋난다.
 */
export const TRIAL_NOTICE_DAYS = [3, 1] as const;

/** 예고 대상을 찾을 때 볼 창(일) — 가장 이른 예고일보다 반나절 넉넉히 */
export const TRIAL_NOTICE_WINDOW_DAYS = Math.max(...TRIAL_NOTICE_DAYS) + 0.5;

/**
 * 월 구독료(원). 금액의 단일 출처 — 서버가 재계산한다 (CLAUDE.md 규칙 4)
 * 2026-09-07 회장님 확정: 49,000 → **49,900**.
 */
export const MEMBERSHIP_PRICE = 49_900;
export const MEMBERSHIP_NAME = "온스토리 정회원 월 구독";
/** 청구 주기 — 정기결제(빌링키)로 매달 청구 */
export const BILLING_INTERVAL = "월" as const;

/**
 * 한 달에 새로 만들 수 있는 사이트 수 상한 — AI 생성 비용 안전장치.
 * ⚠ 화면에 표시하지 않는다(회장님 지시 2026-09-06). 넘으면 일반적인 "잠시 뒤 다시" 안내만 준다.
 *   운영 중 늘려야 하면 Vercel 환경변수 MONTHLY_SITE_CAP 으로 덮어쓴다.
 */
export const MONTHLY_SITE_CAP = Number(process.env.MONTHLY_SITE_CAP ?? 300);

/**
 * 사이트가 지금 어느 단계인가.
 *  active     결제 중(구독 유효) — 공개
 *  trial      무료 기간 — 공개
 *  suspended  정지 — 비공개. 결제하면 즉시 복구된다
 *  deletable  정지 후 유예까지 지났다 — 삭제 대상
 */
export type Phase = "active" | "trial" | "suspended" | "deletable";

export type TrialInfo = {
  status: string;
  phase: Phase;
  /** 무료 남은 일수 (오늘 포함, 0 이하면 무료 종료) */
  daysLeft: number;
  /** 영구 삭제까지 남은 일수 (정지 이후에 의미가 있다) */
  daysUntilDelete: number;
  /** 무료가 끝났는가 (= 정지 이상) */
  expired: boolean;
  paid: boolean;
  endsAt: string | null;
  /** 정지된 시각 */
  suspendedAt: string | null;
  /** 이 시각이 지나면 영구 삭제 */
  deleteAt: string | null;
};

const DAY = 86_400_000;

export function trialInfo(
  site: { status?: string | null; trial_ends_at?: string | null; paid_at?: string | null; suspended_at?: string | null },
  now = new Date()
): TrialInfo {
  const status = site.status ?? "trial";
  const paid = status === "active" || !!site.paid_at;
  const endsAt = site.trial_ends_at ?? null;
  const endMs = endsAt ? new Date(endsAt).getTime() : null;

  if (paid) {
    return {
      status, phase: "active", daysLeft: 9999, daysUntilDelete: 9999,
      expired: false, paid: true, endsAt, suspendedAt: null, deleteAt: null,
    };
  }

  const daysLeft = endMs === null ? 9999 : Math.ceil((endMs - now.getTime()) / DAY);
  const expired = status === "expired" || daysLeft <= 0;

  // 정지 시각 — 기록이 있으면 그것을, 없으면(옛 데이터) 무료 종료 시각을 쓴다
  const suspendedMs = site.suspended_at ? new Date(site.suspended_at).getTime() : expired ? endMs : null;
  const deleteMs = suspendedMs === null ? null : suspendedMs + DELETE_AFTER_SUSPEND_DAYS * DAY;
  const daysUntilDelete = deleteMs === null ? 9999 : Math.ceil((deleteMs - now.getTime()) / DAY);
  const phase: Phase = !expired ? "trial" : daysUntilDelete > 0 ? "suspended" : "deletable";

  return {
    status, phase, daysLeft, daysUntilDelete, expired, paid: false, endsAt,
    suspendedAt: suspendedMs === null ? null : new Date(suspendedMs).toISOString(),
    deleteAt: deleteMs === null ? null : new Date(deleteMs).toISOString(),
  };
}

/**
 * 손님·사장님 화면에 쓰는 문구의 단일 출처.
 * ⚠ 이 문장들을 다른 파일에 복사하지 마라. import 해서 써라.
 * ⚠ 여기에는 **60일 삭제 유예를 적지 않는다**(회장님 지시). 그건 아래 LEGAL 쪽이다.
 */
/** 가격 괄호의 «단 하나의 출처» — `COPY.priceLine` 과 요금제 카드가 둘 다 이것을 읽는다 */
const PRICE_SUFFIX = `(${BILLING_INTERVAL} 구독 요금제 · 부가세 포함)`;

export const COPY = {
  /**
   * 가격 표기 — **금액이 먼저, 괄호가 뒤**(2026-09-07 회장님 확정).
   *   «49,900원 (월 구독 요금제 · 부가세 포함)»
   * ⚠ 금액만 쓰면 1회 결제로 읽힌다. 괄호를 빼지 마라.
   * ⚠ 이 문자열을 다른 파일에 복사하지 마라 — import 해서 써라.
   *   2026-09-06 에 182곳 중 175곳이 어긋나 있던 것이 복사 때문이었다.
   *
   * ★★ **「부가세 포함」은 2026-09-17 대표님 승인으로 더했다** (권반장 지시 [24]).
   *   대표님 원문: 「그래 **부가세 포함으로 싹 다 바꿔.**」
   *   · 우리는 **간이과세자**라 부가세를 따로 받지 않는다 ⇒ 「부가세 포함」이 사실이다
   *   · 토스에 물어 「간이과세자도 상관없다」는 답을 받으셨고, **2027-01-01 일반과세 전환**이 확정돼 있다
   *   · 단건 상품(`config/custom-products.ts`)에는 이미 적혀 있었다 — **월 구독만 빠져 있었다**
   *   ⚠ **숫자 49,900 은 한 글자도 안 건드렸다.** 괄호 안 설명만 늘렸다.
   *
   * 🔴 **문자(SMS)에 쓸 때는 길이를 재고 써라 — 돈이 걸린다.**
   *   `app/api/cron/expire` 의 예고 문자가 이 값을 쓰는데, 이 한 줄이 길어지면서
   *   **EUC-KR 87바이트 → 102바이트**가 됐다. **90바이트를 넘으면 SMS 가 아니라 LMS 요금**이다.
   *   (2026-09-17 실측. 그 문자는 지금 **꺼져 있어**(`expiryAlertOn:false`) 당장 나가는 돈은 없다.)
   *   ⇒ `docs/WAITING.md` 에 대표님 판단으로 올려 두었다. **켜기 전에 정하셔야 한다.**
   */
  priceLine: `${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원 ${PRICE_SUFFIX}`,

  /**
   * ★★ **괄호만 따로** — 숫자를 «크게» 쓰는 자리(요금제 카드 제목)가 쓴다. (2026-09-17 지시 [24])
   *
   * 🔴 **왜 만들었나 — 실제로 어긋나 있었다.** `app/page.tsx` 의 요금제 카드 둘이
   *   `priceLine` 을 안 쓰고 **`(${BILLING_INTERVAL} 구독 요금제)` 를 손으로 적고** 있었다.
   *   그래서 `priceLine` 에 「부가세 포함」을 더하자 **그 두 곳만 옛 문장으로 남았다** —
   *   우리 홈페이지에서 **가장 큰 가격 글자** 둘이 나머지와 말이 달라졌다(2026-09-17 실측으로 잡음).
   *   ⇒ 괄호를 여기 한 곳에 두고 양쪽이 **같은 값을 읽게** 했다.
   * ⚠ 이 문자열을 다시 손으로 적지 마라. 그것이 2026-09-06 사고(182곳 중 175곳)의 원인이었다.
   */
  priceSuffix: PRICE_SUFFIX,

  /** 금액만 필요할 때 (제목에서 숫자를 크게 쓰는 자리 등) */
  priceOnly: `${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원`,

  /**
   * **말하는 말** 전용 — 통화 대사·안내 멘트.
   * 전화로 "괄호 월 구독 요금제"를 읽을 수는 없다(2026-09-07 회장님).
   */
  priceSpoken: `매달 ${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원`,

  /** 무료 체험 한 줄 */
  trialShort: `${TRIAL_DAYS}일 전 기능 무료`,

  /**
   * 가입 화면·결제 모달의 정책 안내.
   *
   * ⚠ **「정지」를 쓰지 않는다.** (2026-09-13 상무님 지적 13)
   *   가입을 «막 끝낸» 사장님이 보는 첫 화면에 「정지」가 있으면 벌을 받는 것처럼 읽힌다.
   *   실제로 일어나는 일은 «비공개로 바뀌는 것»이고 자료는 그대로다 — 그 사실을 그대로 쓴다.
   * ★ 법무 문서(`LEGAL`)에는 「정지(비공개)」를 그대로 둔다. 거기서는 정확함이 먼저다.
   */
  policy:
    `가입 후 ${TRIAL_DAYS}일 동안 전 기능을 무료로 쓰실 수 있습니다. ` +
    `${TRIAL_DAYS}일이 지나면 홈페이지가 비공개로 바뀌어 손님에게 보이지 않지만, 자료는 그대로 보관합니다. ` +
    `언제든 결제하시면 바로 다시 공개됩니다.`,

  /** 결제 직전 자동결제 고지 — 법이 요구하는 사전 고지다. 빼지 마라. */
  autopay:
    `결제하시면 ${BILLING_INTERVAL} ${MEMBERSHIP_PRICE.toLocaleString("ko-KR")}원이 매달 자동으로 결제됩니다. ` +
    `언제든 해지하실 수 있고, 해지하시면 다음 달부터 청구되지 않습니다.`,

  /** 쉬는 상태 안내 — 마케팅 문구라 삭제 시점을 말하지 않는다. ⚠ 「정지」를 쓰지 않는다(지적 13) */
  suspendedNotice:
    `무료 기간이 끝나 홈페이지가 비공개로 바뀌었습니다. 손님에게는 보이지 않지만 자료는 그대로 보관돼 있습니다. ` +
    `결제하시면 바로 다시 공개됩니다.`,
} as const;

/**
 * **약관·개인정보처리방침 전용** 문구. 화면·문자·영업 문구에는 쓰지 않는다.
 * 법무 문서에는 실제 보관·파기 기간을 정확히 적어야 한다 — 실제와 다르면 그 자체가 위법이다.
 */
export const LEGAL = {
  lifecycle:
    `가입 후 ${TRIAL_DAYS}일이 지나면 홈페이지가 정지(비공개)되고, ` +
    `정지된 날부터 ${DELETE_AFTER_SUSPEND_DAYS}일이 지나면 자료를 영구 삭제합니다. ` +
    `삭제 ${DELETE_NOTICE_DAYS[0]}일 전과 ${DELETE_NOTICE_DAYS[1]}일 전에 문자로 알려드립니다.`,
} as const;
