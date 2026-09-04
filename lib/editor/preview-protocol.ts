import type { SiteDocT } from "@/lib/schema";

export const PREVIEW_MSG = "onstori:preview" as const;

/** 미리보기 → 에디터 : 창이 준비됨(이걸 받고 에디터가 첫 doc 을 보낸다) */
export type PreviewReady = { ch: typeof PREVIEW_MSG; type: "ready" };
/** 에디터 → 미리보기 : 문서 갱신 */
export type PreviewDoc = { ch: typeof PREVIEW_MSG; type: "doc"; doc: SiteDocT };
/** 에디터 → 미리보기 : 이 섹션으로 스크롤 */
export type PreviewFocus = { ch: typeof PREVIEW_MSG; type: "focus"; index: number };
export type PreviewMessage = PreviewReady | PreviewDoc | PreviewFocus;
