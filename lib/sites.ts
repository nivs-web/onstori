import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { SiteDoc, StoryEntry, type SiteDocT, type StoryEntryT } from "./schema";
import { z } from "zod";

/**
 * 사이트 데이터 소스 — DB(Supabase) 우선, seeds/*.json 폴백.
 * - DB: sites.published(발행본)만 읽음. RLS가 trial/active만 공개 (expired = 자동 비공개)
 * - 시드: 쇼케이스·개발용. 같은 슬러그가 DB에 있으면 DB가 이김
 * - 렌더러는 이 파일의 SiteData만 알면 됨 — 소스 교체가 여기서 끝나는 구조
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

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // env 미설정 환경에서도 시드 폴백으로 동작
  return createClient(url, anon, { auth: { persistSession: false } });
}

async function getFromDb(slug: string): Promise<SiteData | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data: site } = await client
      .from("sites")
      .select("id, slug, status, published")
      .eq("slug", slug)
      .maybeSingle();
    if (!site || !site.published) return null;

    const doc = SiteDoc.parse(site.published); // 불량 데이터는 여기서 차단

    const { data: rows } = await client
      .from("story_entries")
      .select("id, entry_type, title, body, photos, entry_date")
      .eq("site_id", site.id)
      .order("entry_date", { ascending: false })
      .limit(30);

    const stories: StoryEntryT[] = (rows ?? []).flatMap((r) => {
      const parsed = StoryEntry.safeParse({
        id: r.id,
        entryType: r.entry_type,
        title: r.title,
        body: r.body,
        photos: r.photos ?? [],
        entryDate: String(r.entry_date),
      });
      return parsed.success ? [parsed.data] : [];
    });

    const status = site.status === "active" ? "active" : "trial";
    return { slug, doc, stories, status };
  } catch {
    return null;
  }
}

async function getFromSeed(slug: string): Promise<SiteData | null> {
  try {
    const file = path.join(process.cwd(), "seeds", `${slug}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const parsed = SeedFile.parse(JSON.parse(raw));
    return { slug, ...parsed };
  } catch {
    return null;
  }
}

export async function getSiteBySlug(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null; // 라우팅 최종 방어선
  return (await getFromDb(slug)) ?? (await getFromSeed(slug));
}
