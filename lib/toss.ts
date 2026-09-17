/**
 * 토스페이먼츠 정기결제(빌링키) 창구 — 2026-09-06.
 *
 * 회장님 확정: 월 **구독**. 일반결제가 아니다. 금액은 lib/trial.ts 참조.
 * ⚠ 가맹 심사(정기결제)가 진행 중이라 **실호출로 검증한 적이 없다.**
 *   TOSS_SECRET_KEY 가 붙는 즉시 아래 세 함수를 테스트 키로 한 번씩 태워야 한다.
 *   그 전에는 checkout 라우트가 ready:false 를 주어 결제창이 열리지 않는다.
 *
 * 흐름 (일반결제와 완전히 다르다)
 *   1) 브라우저: payment.requestBillingAuth({ customerKey, successUrl, failUrl })
 *      → 카드 등록창. 성공하면 successUrl 로 authKey·customerKey 가 붙어 돌아온다
 *   2) 서버: issueBillingKey(authKey, customerKey) → billingKey 발급 (표 billing 에 보관)
 *   3) 서버: charge(billingKey, ...) 로 **그 자리에서 첫 달을 청구**
 *   4) 이후 매달 크론이 charge() 를 부른다
 *
 * ★ billingKey 는 그것만으로 카드를 긁을 수 있는 자격증명이다.
 *   클라이언트로 내보내지 않는다. 로그에 찍지 않는다. billing 표는 RLS 정책이 없어 서비스 롤만 읽는다.
 */

const API = "https://api.tosspayments.com/v1";

function authHeader(): string {
  const secret = process.env.TOSS_SECRET_KEY?.trim();
  if (!secret) throw new Error("TOSS_SECRET_KEY 없음 — 가맹 심사 완료 후 Vercel 환경변수에 등록");
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

export type TossResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

async function call<T>(path: string, body: unknown, idempotencyKey?: string): Promise<TossResult<T>> {
  const headers: Record<string, string> = { Authorization: authHeader(), "Content-Type": "application/json" };
  // 같은 주문이 두 번 청구되지 않게 — 네트워크 재시도가 중복 결제로 이어지는 것을 막는다
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: String(data.code ?? `HTTP_${res.status}`),
      message: String(data.message ?? "결제 처리에 실패했습니다"),
    };
  }
  return { ok: true, data: data as T };
}

export type BillingKeyResult = {
  billingKey: string;
  customerKey: string;
  card?: { company?: string; number?: string; cardType?: string };
};

/** 카드 등록창에서 받은 authKey 를 빌링키로 바꾼다. 빌링키는 한 번만 발급된다. */
export function issueBillingKey(authKey: string, customerKey: string) {
  return call<BillingKeyResult>("/billing/authorizations/issue", { authKey, customerKey });
}

export type PaymentResult = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method?: string;
  approvedAt?: string;
};

/**
 * 빌링키로 청구한다. orderId 는 우리가 만들고 **유일해야** 한다(payments.order_id unique).
 * idempotencyKey 로 orderId 를 그대로 넘겨 재시도가 중복 청구가 되지 않게 한다.
 */
export function charge(args: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}) {
  const { billingKey, customerKey, amount, orderId, orderName } = args;
  return call<PaymentResult>(`/billing/${encodeURIComponent(billingKey)}`, { customerKey, amount, orderId, orderName }, orderId);
}

/** 결제 취소·환불. cancelAmount 를 주면 부분 환불. */
export function cancelPayment(paymentKey: string, reason: string, cancelAmount?: number) {
  const body: Record<string, unknown> = { cancelReason: reason };
  if (typeof cancelAmount === "number") body.cancelAmount = cancelAmount;
  return call<PaymentResult>(`/payments/${encodeURIComponent(paymentKey)}/cancel`, body, `cancel-${paymentKey}-${cancelAmount ?? "full"}`);
}

/**
 * 🔴 **빌링키 폐기 — 해지하면 토스 쪽 카드 정보도 지운다.** (2026-09-17 지시 [32])
 *
 * ★ **왜:** ①**개인정보** — 목적이 끝난 카드 정보는 지우는 것이 원칙이다
 *   ②**신뢰** — 「해지하면 카드 정보도 지웁니다」라고 쓸 수 있어야 **안심하고 가입**하신다
 *   ③**사고 대비** — 우리가 언젠가 뚫려도 **이미 지운 빌링키는 못 쓴다**
 *
 * ★ **공식 문서에서 확인했다**(2026-09-17 · 두 곳 대조):
 *   `DELETE /v1/billing/{billingKey}` · 성공하면 **본문 없이 200** · 실패하면 `code`·`message`.
 *   (docs.tosspayments.com/reference 의 「빌링키 삭제」 · guides/v2/billing/integration-api 가 그리로 링크한다)
 *
 * ⚠ **이 함수는 «실호출로 검증한 적이 없다».** `TOSS_SECRET_KEY` 가 아직 없고 유료 고객이 0명이라
 *   **진짜 빌링키가 하나도 없다.** 첫 유료 고객이 해지하실 때가 첫 실행이다 —
 *   그래서 부르는 쪽이 **실패해도 해지를 무르지 않게** 되어 있다(`api/billing/cancel`).
 * ⚠ 다른 함수와 달리 **POST 가 아니라 DELETE** 라 `call()` 을 못 쓴다. 여기서 직접 부른다.
 * ⚠ **빌링키를 로그에 찍지 않는다.** 그것만으로 카드를 긁을 수 있는 자격증명이다.
 */
export async function deleteBillingKey(billingKey: string): Promise<TossResult<Record<string, never>>> {
  try {
    const res = await fetch(`${API}/billing/${encodeURIComponent(billingKey)}`, {
      method: "DELETE",
      headers: { Authorization: authHeader() },
    });
    if (res.ok) return { ok: true, data: {} };
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: false,
      status: res.status,
      code: String(data.code ?? `HTTP_${res.status}`),
      message: String(data.message ?? "빌링키를 지우지 못했습니다"),
    };
  } catch (e) {
    /* 열쇠가 없으면 `authHeader()` 가 던진다 — 가맹 심사 전에는 그게 정상이다 */
    return { ok: false, status: 0, code: "NO_CALL", message: String(e).slice(0, 120) };
  }
}

/** 카드 번호 마스킹본에서 마지막 4자리만 뽑는다 (화면 표시용) */
export function last4(masked?: string): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
