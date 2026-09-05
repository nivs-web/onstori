import { Suspense } from "react";
import type { Metadata } from "next";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "홈페이지 만들기 — 온스토리", robots: { index: false, follow: false } };

/**
 * 온보딩 5단계 위저드 (기획1 /mainplan #onboarding · 2026-09-05)
 * 1 상호명(+플레이스 불러오기) → 2 세부 업종 → 3 한 줄·로고·주소·전화 → 4 다크/화이트·8색 → 5 만들기(1→100%) + 정회원 안내
 * 화면·문구·디자인은 독자 제작 (CLAUDE.md 규칙 8). useSearchParams 를 쓰는 클라이언트 컴포넌트라 Suspense 로 감싼다.
 */
export default function NewSitePage() {
  return (
    <Suspense fallback={<main className="px-6 py-24 text-center" style={{ color: "var(--muted)" }}>준비 중…</main>}>
      <Wizard />
    </Suspense>
  );
}
