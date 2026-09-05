import { Suspense } from "react";
import { BillingResult } from "./ui";

export const metadata = { title: "결제 확인 — 온스토리", robots: { index: false, follow: false } };

/** 토스 successUrl — 쿼리(paymentKey·orderId·amount)를 서버 confirm 으로 넘긴다 */
export default function BillingSuccess() {
  return (
    <Suspense fallback={<main className="px-6 py-24 text-center" style={{ color: "var(--muted)" }}>결제 확인 중…</main>}>
      <BillingResult />
    </Suspense>
  );
}
