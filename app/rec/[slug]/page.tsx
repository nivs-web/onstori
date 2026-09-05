import type { Metadata } from "next";
import Link from "next/link";
import { sbAdmin } from "@/lib/db-admin";
import { verifyStoryLink } from "@/lib/story-link";
import { RecClient } from "./rec-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "60초 녹화 — 온스토리", robots: { index: false, follow: false } };

/**
 * 60초 녹화 페이지 — 문자 링크로 연다 (기획1 /mainplan #rec · 2026-09-05).
 * 링크 서명(k)이 곧 로그인. 만료면 에디터에서 새 링크를 받게 안내.
 */
export default async function RecPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
  const { slug } = await params;
  const { k } = await searchParams;
  const valid = verifyStoryLink(slug, k);
  let name = "";
  if (valid) {
    try {
      const { data, error } = await sbAdmin().from("sites").select("business_name").eq("slug", slug).maybeSingle();
      // 행이 없으면 무효. DB 자체가 안 닿으면(로컬·장애) 녹화는 열어 두고 제출 단계에서 다시 확인한다
      name = error ? slug : (data?.business_name ?? "");
    } catch { name = slug; }
  }
  if (!valid || !name) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center" style={{ background: "var(--forest)", color: "var(--cream)" }}>
        <h1 className="font-display text-[26px]">이 링크는 만료됐어요</h1>
        <p className="mt-3 max-w-sm text-[14.5px] opacity-80">녹화 링크는 그 주에만 유효합니다. 홈페이지 관리 화면에서 [녹화 링크 문자로 받기]를 눌러 새 링크를 받아 주세요.</p>
        <Link href="/my" className="btn-lime mt-8">마이페이지로</Link>
      </main>
    );
  }
  return <RecClient slug={slug} k={k!} businessName={name} />;
}
