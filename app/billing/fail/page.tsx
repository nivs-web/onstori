export const metadata = { title: "결제 취소 — 온스토리", robots: { index: false, follow: false } };

/** 토스 failUrl — 사용자가 취소했거나 실패. 다시 시도는 에디터의 [정회원 이용하기] */
export default async function BillingFail({ searchParams }: { searchParams: Promise<{ slug?: string; message?: string }> }) {
  const { slug = "", message } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <h1 className="font-display text-[26px]">결제가 완료되지 않았어요</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>{message ?? "취소되었거나 승인되지 않았습니다. 언제든 다시 시도하실 수 있어요."}</p>
      <a href={slug ? `/${slug}/edit` : "/my"} className="btn-lime mt-8">돌아가기</a>
    </main>
  );
}
