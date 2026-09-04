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
  const site = await getSiteBySlug(slug);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <PreviewClient slug={slug} initialDoc={site?.doc ?? null} stories={site?.stories ?? []} />
    </>
  );
}
