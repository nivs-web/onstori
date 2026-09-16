import { Suspense } from "react";
import { NewPasswordUi } from "./ui";

export const metadata = { title: "새 비밀번호 정하기 — 온스토리", robots: { index: false, follow: false } };

/**
 * 새 비밀번호 정하기 — **비밀번호 재설정 메일의 링크가 도착하는 곳.** (2026-09-17 지시 [25])
 *
 * ★ 이 화면은 두 사장님이 함께 씁니다:
 *   · 비밀번호를 **잊으신** 분
 *   · 전에 **인증번호로 가입**해서 비밀번호가 **아예 없는** 분 (그분에게는 「만들기」다)
 *
 * ⚠ 검색에 올리지 않습니다(`robots: noindex`). 메일 링크로만 들어오는 자리입니다.
 */
export default function NewPasswordPage() {
  /* ⚠ `useSearchParams` 를 쓰는 화면이라 Suspense 가 필요하다 — 없으면 빌드가 막힌다 */
  return (
    <Suspense fallback={<main className="px-6 py-24 text-center text-[var(--text-soft)]">확인 중…</main>}>
      <NewPasswordUi />
    </Suspense>
  );
}
