import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginUi } from "./ui";

export const metadata: Metadata = { title: "로그인 — 온스토리", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="px-6 py-24 text-center text-neutral-400">불러오는 중…</main>}>
      <LoginUi />
    </Suspense>
  );
}
