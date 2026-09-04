import type { StoryEntryT } from "./schema";

/** 실적 카운터: 스토리에서 자동 집계 — 임의 숫자 입력 없음 (컨셉 + 표시광고법) */
export function workCount(stories: StoryEntryT[]): number {
  return stories.filter((s) => s.entryType === "work").length;
}
