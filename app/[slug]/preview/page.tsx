import type { Metadata } from "next";
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
   * ★★ **폐기됨 — 「견본은 미리보기도 막는다」 (2026-09-15 대표님 지시).**
   *
   * ★ 2026-09-13 에 여기에 자물쇠를 걸었었다. 이유는 「견본은 `/g/{주소}` 로 옮길 텐데
   *   이 창이 열려 있으면 뒷문이 된다」였다. 그런데 **`/g/` 자체가 폐기됐다.**
   *   `/{주소}` 가 누구에게나 열리는 지금, 이 창만 막는 것은 **뒷문이 아니라 헛문**이다 —
   *   막는 것이 없으면서 **대표님이 만드신 홈페이지의 미리보기만 못 열게** 했다.
   *
   * ⚠ 대표님 말씀: 「시키지 않은 안전장치를 마음대로 넣지 마라.」 이것이 그 예였다.
   * ★ 정말 막아야 하는 것(만료·정지)은 **RLS 가 이미 막는다.** 여기서 또 걸 필요가 없다.
   */
  const site = await getSiteBySlug(slug);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <PreviewClient slug={slug} initialDoc={site?.doc ?? null} stories={site?.stories ?? []} />
    </>
  );
}
