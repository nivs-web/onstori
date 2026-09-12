import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sbAdmin } from "@/lib/db-admin";
import { isPremade } from "@/lib/premade";
import { getSiteBySlug } from "@/lib/sites";
import { PreviewClient } from "./preview-client";

export const metadata: Metadata = { title: "미리보기", robots: { index: false, follow: false } };

/**
 * 라이브 미리보기 — 에디터가 iframe 으로 여는 창(content/plandept/docs/editor-preview-2026-09-05.md).
 * 여기서 읽는 건 발행본뿐이다(getSiteBySlug 는 published 만 본다, draft 는 안 읽는다).
 * 작성 중인 내용은 에디터가 postMessage 로만 넘긴다 — 그래서 주소가 새어도 남의 미완성
 * 내용은 노출되지 않고, 권한 게이트도 필요 없다. 미발행 사이트는 doc=null 로 넘어간다.
 */
export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /**
   * ★★ **미리 만들어 둔 견본은 이 창으로도 안 보여 준다.** (2026-09-13 상무님 지적 8)
   *
   * ★ 원래 이 창은 「어차피 발행본만 보여 주니 권한이 필요 없다」는 판단이었고,
   *   **그 판단 자체는 지금도 맞다** — 여기서 읽는 것은 `/{주소}` 에서 이미 누구나 보는 내용이다.
   * ⚠ 그런데 견본은 앞으로 `/g/{주소}` 로 따로 둔다(지시 7). 그러면 `/{주소}` 는 막히는데
   *   **이 창은 그대로 열려** 뒷문이 된다. 그래서 여기서도 같은 자물쇠를 건다.
   * ⚠ 판정에 필요한 주인 정보는 손님 권한으로 못 읽어서 운영자 권한으로 **그것만** 읽는다.
   *   내용(published)은 아래 `getSiteBySlug` 가 손님 권한으로 읽는다 — 권한을 넓히지 않는다.
   */
  try {
    const { data } = await sbAdmin()
      .from("sites").select("owner_id, anon_id, settings").eq("slug", slug).maybeSingle();
    if (data && isPremade(data)) return notFound();
  } catch {
    /* 판정을 못 하면 그냥 진행한다 — 미리보기가 DB 장애로 통째로 죽으면 편집이 멈춘다 */
  }

  const site = await getSiteBySlug(slug);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <PreviewClient slug={slug} initialDoc={site?.doc ?? null} stories={site?.stories ?? []} />
    </>
  );
}
