import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/server";
import { sbAdmin } from "@/lib/db-admin";
import { LogoutButton } from "./ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "마이페이지 — 온스토리" };

type MySite = {
  slug: string;
  business_name: string;
  published_at: string | null;
  updated_at: string;
};

/** 계정 표시 이름 — 카카오는 닉네임, 이메일 로그인은 주소 */
function displayName(meta: Record<string, unknown>, email?: string) {
  const nick = meta.name ?? meta.nickname ?? meta.full_name;
  return typeof nick === "string" && nick.trim() ? nick : (email ?? "내 계정");
}

export default async function MyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fmy");

  // 데이터 접근은 service-role + 서버 세션 검증 (CLAUDE.md 아키텍처 유지)
  const { data } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, published_at, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const sites = (data ?? []) as MySite[];

  return (
    <main className="min-h-svh" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <header className="border-b" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-[17px] font-extrabold tracking-tight">온스토리</Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">내 홈페이지</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          {displayName(user.user_metadata ?? {}, user.email)}님으로 로그인했어요.
        </p>

        {sites.length === 0 ? (
          <div className="mt-10 rounded-2xl border px-6 py-12 text-center" style={{ borderColor: "var(--line)" }}>
            <p className="text-[15px] font-semibold">아직 만든 홈페이지가 없어요</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              가게 이름과 사진만 있으면 5분 만에 완성됩니다.
            </p>
            <Link
              href="/new"
              className="mt-6 inline-block rounded-full px-6 py-3 text-[15px] font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              홈페이지 만들기 — 무료
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {sites.map((s) => (
              <li
                key={s.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-4"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15.5px] font-bold">{s.business_name}</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
                    onstori.com/{s.slug}
                    {s.published_at ? "" : " · 아직 발행 전"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/${s.slug}`}
                    className="rounded-full border px-4 py-2 text-[13px] font-semibold"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                  >
                    사이트 보기
                  </Link>
                  <Link
                    href={`/${s.slug}/edit`}
                    className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    수정하기
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
