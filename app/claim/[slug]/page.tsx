import type { Metadata } from "next";
import Link from "next/link";
import { sbAdmin } from "@/lib/db-admin";
import { verifyHandover } from "@/lib/handover";
import { getSessionUser } from "@/lib/supabase/server";
import { ClaimClient } from "./claim-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "홈페이지 넘겨받기 — 온스토리",
  /* ⚠ 검색에 절대 걸리면 안 된다 — 링크를 받은 분만 오는 자리다 */
  robots: { index: false, follow: false },
};

/**
 * **「사장님, 홈페이지 가져가세요」 화면.** (2026-09-13 회장님 지시 B1·B3)
 *
 * 회장님이 미리 만들어 둔 홈페이지를 그 가게 사장님께 넘기는 자리다.
 * 주소는 `onstori.com/claim/{상호주소}?k={열쇠}` — 열쇠 없이는 아무것도 안 보인다.
 *
 * ★ 순서: 링크를 연다 → (로그인 안 돼 있으면) 로그인 → [이 홈페이지 가져가기] → 편집화면.
 * ★ 넘겨받기 자체는 `app/api/auth/handover` 가 한다. 이 화면은 보여 주고 누르게만 한다.
 */
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug } = await params;
  const { k } = await searchParams;

  const valid = verifyHandover(slug, k);

  let name = "";
  let taken = false;
  if (valid) {
    try {
      const { data } = await sbAdmin()
        .from("sites").select("business_name, owner_id").eq("slug", slug).maybeSingle();
      name = data?.business_name ?? "";
      taken = !!data?.owner_id;
    } catch {
      /* DB 가 안 닿으면 아래에서 「만료」로 보낸다 — 짐작으로 열어 주지 않는다 */
    }
  }

  if (!valid || !name) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display t-h1">이 링크는 만료됐어요</h1>
        <p className="mt-3 max-w-sm t-small opacity-80">
          홈페이지를 넘겨받는 링크는 짧은 기간만 열려 있어요.
          링크를 보내 드린 분께 새 링크를 요청해 주세요.
        </p>
        <Link href="/" className="btn-lime mt-8">온스토리 첫 화면으로</Link>
      </main>
    );
  }

  const user = await getSessionUser();

  /* 이미 누가 가져간 뒤 — 본인이면 편집화면으로 안내한다 */
  if (taken) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display t-h1">이미 주인이 계신 홈페이지예요</h1>
        <p className="mt-3 max-w-sm t-small opacity-80">
          {name} 홈페이지는 이미 넘겨드렸어요. 사장님 계정이라면 로그인 후 관리 화면에서 보실 수 있어요.
        </p>
        <Link href={user ? "/my" : `/login?next=${encodeURIComponent("/my")}`} className="btn-lime mt-8">
          {user ? "내 홈페이지 보기" : "로그인"}
        </Link>
      </main>
    );
  }

  return <ClaimClient slug={slug} k={k!} businessName={name} loggedIn={!!user} />;
}
