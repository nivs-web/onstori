import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";

/**
 * 없는 주소 화면 (2026-09-12 회장님 지시 4 · 상무님 지적)
 *
 * ★ 전에는 이 파일이 **없어서** Next.js 기본 화면이 나왔다 —
 *   흰 바탕에 영어로 「404 · This page could not be found.」
 *   사장님 손님이 오타 하나로 들어와도 영어 오류 화면을 본다. 그 자체가 사고다.
 *
 * ★ 여기는 **정말 없는 주소**를 위한 자리다. 무료가 끝나 «쉬고 있는» 사장님 홈페이지는
 *   여기로 오지 않는다 — 그건 `app/[slug]/page.tsx` 가 따로 안내한다(지시 5).
 *   두 경우를 섞으면, 오타로 들어온 손님에게 「쉬고 있어요」라고 거짓말을 하게 된다.
 *
 * ⚠ 여기서 회사 사정·요금 이야기를 하지 않는다. 손님은 그 사장님을 찾아온 사람이다.
 */

export const metadata: Metadata = {
  title: "페이지를 찾지 못했어요 — 온스토리",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center text-center"
      style={{ background: "var(--cream)", color: "var(--ink)", paddingInline: "var(--gutter)" }}
    >
      <Link href="/" aria-label="온스토리 홈" className="flex items-center" style={{ minHeight: "var(--tap)" }}>
        <Logo height={22} />
      </Link>

      <h1 className="font-display t-h1 leading-snug" style={{ marginTop: "var(--s-6)" }}>
        찾으시는 페이지가 없어요
      </h1>
      <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--muted)", maxWidth: "34rem" }}>
        주소가 잘못됐거나, 지금은 없는 페이지예요.
        <br />
        주소를 다시 한 번 확인해 주세요.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: "var(--s-6)" }}>
        <Link href="/" className="btn btn-primary">온스토리 첫 화면으로</Link>
        <Link href="/faq" className="btn btn-text">자주 묻는 질문</Link>
      </div>
    </main>
  );
}
