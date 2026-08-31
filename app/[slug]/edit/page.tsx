import type { Metadata } from "next";
import { EditUi } from "./ui";

export const metadata: Metadata = { title: "홈페이지 수정", robots: { index: false, follow: false } };

/** 에디터 v1 — 폼 기반 (3패널 에디터는 P3 후반). 소유 확인은 클라이언트 anonId → 서버 검증 */
export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditUi slug={slug} />;
}
