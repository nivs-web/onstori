import { promises as fs } from "fs";
import path from "path";
import { SiteDoc, StoryEntry, type SiteDocT, type StoryEntryT } from "./schema";
import { z } from "zod";

/**
 * 사이트 데이터 소스.
 * P1: seeds/*.json 파일에서 읽는다 (렌더러 개발·쇼케이스용).
 * DB(Supabase) 연결은 .env 키 등록 후 이 파일만 교체 — 렌더러는 모름.
 */

const SeedFile = z.object({
  doc: SiteDoc,
  stories: z.array(StoryEntry).default([]),
  status: z.enum(["trial", "active"]).default("trial"),
});

export type SiteData = {
  slug: string;
  doc: SiteDocT;
  stories: StoryEntryT[];
  status: "trial" | "active";
};

export async function getSiteBySlug(slug: string): Promise<SiteData | null> {
  // 슬러그 검증 (라우팅 최종 방어선)
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null;
  try {
    const file = path.join(process.cwd(), "seeds", `${slug}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const parsed = SeedFile.parse(JSON.parse(raw)); // zod 검증 — 불량 데이터는 여기서 차단
    return { slug, ...parsed };
  } catch {
    return null;
  }
}

/** 실적 카운터: 스토리에서 자동 집계 — 임의 숫자 입력 없음 (컨셉 + 표시광고법) */
export function workCount(stories: StoryEntryT[]): number {
  return stories.filter((s) => s.entryType === "work").length;
}
