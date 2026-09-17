import type { Metadata } from "next";
import Link from "next/link";
import { sbAdmin } from "@/lib/db-admin";
import { verifyStoryLink, signStoryLink } from "@/lib/story-link";
import { loadOwnedSite } from "@/lib/site-owner";
import { RecClient } from "./rec-client";
import { Relink } from "./relink";

export const dynamic = "force-dynamic";

/**
 * 60초 녹화 페이지 — 문자 링크로 연다 (기획1 /mainplan #rec · 2026-09-05).
 * 링크 서명(k)이 곧 로그인. 만료면 에디터에서 새 링크를 받게 안내.
 *
 * ★★ **2026-09-17 지시 [20] — 홈 화면 바로가기가 생겼다. 그래서 «열쇠 없이도» 들어온다.**
 *   바로가기는 `?k=` 를 박지 않는다(그 열쇠는 **주 단위로 만료**돼 2주 뒤 죽는다).
 *   ⇒ 열쇠가 없거나 만료됐을 때 **주인인지 한 번 더 물어보고**, 주인이면 **새 열쇠를 즉석에서**
 *     찍어 그대로 열어 준다. 주인이 아니면 예전과 똑같이 「만료됐어요」다.
 *   🔴 **문을 넓힌 것이 아니다** — 판정은 이미 쓰던 `loadOwnedSite` 그대로다.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "60초 녹화 — 온스토리",
    robots: { index: false, follow: false },
    /* ★ 🔴 **사장님마다 다른 바로가기.** 전체용 `/manifest.webmanifest` 를 쓰면
         아이콘을 눌렀을 때 «어느 가게인지» 모른다(지시 2번). */
    manifest: `/rec/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "60초 녹화" },
  };
}

export default async function RecPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
  const { slug } = await params;
  const { k } = await searchParams;

  /* ① 문자로 받은 열쇠가 살아 있으면 예전 그대로 */
  let key: string | null = verifyStoryLink(slug, k) ? (k as string) : null;

  /* ② 열쇠가 없거나 죽었으면 — **주인인지** 물어보고 맞으면 새로 찍어 준다 (홈 화면 바로가기 길) */
  if (!key) {
    try {
      const owned = await loadOwnedSite(slug);
      if (!("error" in owned)) key = signStoryLink(slug);
    } catch { /* 못 물어봤으면 아래 만료 화면으로 */ }
  }

  let name = "";
  if (key) {
    try {
      const { data, error } = await sbAdmin().from("sites").select("business_name").eq("slug", slug).maybeSingle();
      // 행이 없으면 무효. DB 자체가 안 닿으면(로컬·장애) 녹화는 열어 두고 제출 단계에서 다시 확인한다
      name = error ? slug : (data?.business_name ?? "");
    } catch { name = slug; }
  }

  if (!key || !name) {
    return (
      <main className="rec-shell flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display t-h1">이 링크는 만료됐어요</h1>
        <p className="mt-3 max-w-sm t-small opacity-80">녹화 링크는 그 주에만 유효합니다. 홈페이지 관리 화면에서 [녹화 링크 문자로 받기]를 눌러 새 링크를 받아 주세요.</p>
        {/* ★ 가입 «전»에 만든 홈페이지는 주인이 브라우저 안에 있다 — 서버가 못 읽는다.
            화면이 한 번 더 물어보고, 맞으면 사장님은 아무것도 안 하셔도 그대로 들어가신다. */}
        <Relink slug={slug} />
        <Link href="/my" className="btn-lime mt-8">마이페이지로</Link>
      </main>
    );
  }

  return (
    <>
      {/* 🔴 크롬은 설치 이벤트를 **React 가 붙기 전에** 던질 수 있다. 놓치면 「한 번에 설치」가
          영영 안 뜬다. 그래서 아주 이른 잔스크립트로 **받아만 둔다**(쓰는 것은 add-home.tsx). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__onstoriBip=e;});`,
        }}
      />
      <RecClient slug={slug} k={key} businessName={name} />
    </>
  );
}
