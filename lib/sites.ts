import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { isPremade } from "./premade";
import { forVisitors } from "./phone-privacy";
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
  /** 온보딩 3단계 로고 URL (sites.settings.logo) — 섹션 스키마 밖. 없으면 undefined (2026-09-05) */
  logo?: string;
  /**
   * 사이트 설정 원본 — 구조화 데이터(lib/jsonld.ts)가 주소·한 줄 소개를 여기서 읽는다.
   * ⚠ **화면에 그대로 뿌리지 마라.** 여기에는 전화번호·알림 설정 등 «손님에게 안 보일 것»이 섞여 있다.
   *   손님 화면에 나가는 것은 `doc` 뿐이고, 그쪽 번호는 이미 지워져 있다(lib/phone-privacy.ts).
   */
  settings?: Record<string, unknown>;
  /**
   * ★ **온스토리가 만든 «예시» 홈페이지인가.** (2026-09-13 박팀장 지적 13)
   *   화면 맨 위에 「예시입니다」를 띄운다 — 손님이 진짜 가게로 착각하면 안 된다.
   *   불변 규칙 7 도 「샘플 사이트에 한해 예시 후기를 넣되 «예시» 표시를 단다」고 정한다.
   */
  sample?: boolean;
};

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // env 미설정 환경에서도 시드 폴백으로 동작
  return createClient(url, anon, { auth: { persistSession: false } });
}

/**
 * ★★ **미리 만들어 둔 견본을 어떻게 다룰까.** (2026-09-13 상무님 지적 7)
 *
 * · "hide"(기본) — 견본이면 **없는 것처럼** 다룬다. 손님 주소 `/{상호}` 가 쓴다.
 * · "only"       — 견본**만** 보여 준다. 회장님이 영업에 쓰는 `/g/{상호}` 가 쓴다.
 *
 * ★★ **왜 `/{상호}` 페이지에 조건을 안 넣고 여기에 넣었나.**
 *   그 페이지는 ISR 로 캐시되고(revalidate=60) 빌드 때 200곳을 미리 만들어 둔다
 *   (`generateStaticParams`). 거기에 「요청마다 봐야 하는 조건」을 넣으면 **손님 사이트
 *   200곳의 캐시가 통째로 무너진다** — 2026-09-07 실측에서 캐시가 빠지자 TTFB 가
 *   0.73~1.19초로 뛰었다. 여기서 «자료를 읽을 때» 거르면 결과가 그대로 캐시되므로
 *   빠르기를 잃지 않는다.
 * ⚠ 대신 넘겨주는 순간 캐시를 풀어야 한다 — `app/api/auth/handover` 가 `revalidatePath` 한다.
 */
export type PremadeMode = "hide" | "only";

/**
 * ★ **예시 홈페이지 목록 — 단일 출처.** (2026-09-13 지시 13)
 *   `seeds/*.json` 에서 오는 것은 전부 예시다. 그 밖에 DB 에 있는 예시는 여기 적는다.
 * ⚠ 여기에 진짜 사장님 주소를 적지 마라 — 그분 홈페이지에 「예시」가 붙는다.
 */
export const SAMPLE_SLUGS = new Set(["sample-interior"]);

async function getFromDb(slug: string, premade: PremadeMode = "hide"): Promise<SiteData | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data: site } = await client
      .from("sites")
      /* ★★★ owner_id·anon_id 를 «반드시» 함께 읽는다 (2026-09-13 사고로 배운 것).
         ⚠ 이 둘이 없으면 isPremade 가 「주인이 아무도 없다」로 읽어 **모든 사이트를 견본으로**
           판정한다. 실제로 그래서 손님 사이트가 통째로 404 가 됐다. 빼지 마라. */
      .select("id, slug, status, published, settings, owner_id, anon_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!site || !site.published) return null;

    /**
     * ★ 견본인가 아닌가 — 부르는 쪽이 원한 것과 다르면 «없는 것»이다.
     *
     * ⚠ **예시 사이트는 «견본»이 아니다.** 둘은 성격이 다르다:
     *   · 견본(premade) = 콜드콜용. 그 가게 상호로 검색에 뜨면 안 된다 → /g/{주소}
     *   · 예시(sample)  = 우리 쇼케이스. **랜딩 포트폴리오가 이것을 쓴다**(components/portfolio.tsx)
     *     → /{주소} 에 그대로 있어야 하고, 화면 맨 위에 「예시입니다」가 붙는다.
     * ⚠ 예시는 주인이 없어서 isPremade 에 걸린다. 그래서 여기서 **보이기 판정에서만** 뺀다 —
     *   문자 판정(lib/premade.ts)에서는 그대로 견본으로 둔다. 예시로 문자가 나가면 안 된다.
     */
    const hidden = isPremade(site) && !SAMPLE_SLUGS.has(slug);
    if (hidden !== (premade === "only")) return null;

    /**
     * ★★ **전화번호는 기본이 비공개다.** (2026-09-13 대표님 결정 · lib/phone-privacy.ts)
     *   여기가 «손님에게 나가는 유일한 문»이라, 여기서 한 번 지우면 화면 네 곳이 함께 사라진다.
     * ⚠ 검사(parse)를 **지난 뒤에** 지운다 — 견적 문의의 번호 칸은 스키마상 필수라
     *   먼저 비우면 홈페이지 전체가 안 열린다.
     */
    const doc = forVisitors(SiteDoc.parse(site.published), site.settings); // 불량 데이터는 parse 에서 차단

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
    const logo = (site.settings as { logo?: unknown } | null)?.logo;
    return {
      slug, doc, stories, status,
      logo: typeof logo === "string" && logo ? logo : undefined,
      settings: (site.settings as Record<string, unknown> | null) ?? {},
      sample: SAMPLE_SLUGS.has(slug),
    };
  } catch {
    return null;
  }
}

async function getFromSeed(slug: string): Promise<SiteData | null> {
  try {
    const file = path.join(process.cwd(), "seeds", `${slug}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const parsed = SeedFile.parse(JSON.parse(raw));
    /* ⚠ 시드에는 settings 가 없다 → 비공개가 기본이라 번호가 안 나간다. 그게 맞다 */
    /* ⚠ 시드에서 오는 것은 **전부 예시**다 — 쇼케이스·개발용이라 진짜 가게가 아니다 */
    return { slug, ...parsed, doc: forVisitors(parsed.doc, null), sample: true };
  } catch {
    return null;
  }
}

export async function getSiteBySlug(slug: string, premade: PremadeMode = "hide"): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null; // 라우팅 최종 방어선
  const fromDb = await getFromDb(slug, premade);
  if (fromDb) return fromDb;
  /* ⚠ 시드(쇼케이스)는 견본이 아니다 — `/g/` 로 들어온 요청에는 주지 않는다 */
  return premade === "only" ? null : await getFromSeed(slug);
}

/**
 * ★ 이 주소가 **아예 없는 것**인지, **쉬고 있는 사장님 홈페이지**인지 가른다. (2026-09-12 지시 5)
 *
 * ★★ 왜 필요한가: 위 `getSiteBySlug` 는 **손님 권한(anon)** 으로 읽는다. RLS 가
 *   `trial`·`active` 만 보여 주므로 **정지·만료된 사이트는 「없는 주소」와 똑같이 보인다.**
 *   그런데 그 주소는 사장님이 **명함·플레이스에 적어 둔 주소**다. 손님이 그걸 눌렀을 때
 *   영어 404 를 보면 「이 가게 망했나」가 된다 — 우리가 판 물건이 손님 앞에서 부서지는 순간이다.
 *
 * ⚠ 여기서는 **운영자 권한**으로 «있는지»만 본다. 내용(published)은 읽지 않는다 —
 *   비공개인 홈페이지 내용이 손님 화면에 새어 나갈 길을 아예 만들지 않는다.
 * ⚠ 상호명만 돌려준다. 그것도 «없는 주소»와 구분해 인사하기 위한 최소한이다.
 */
export async function getPausedSite(slug: string): Promise<{ businessName: string } | null> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin
      .from("sites")
      .select("business_name, status")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    /* trial·active 인데 여기까지 왔다면 «발행 전»이다. 그건 쉬는 게 아니라 아직 없는 것 */
    if (data.status === "trial" || data.status === "active") return null;
    return { businessName: (data.business_name as string) || "" };
  } catch {
    return null;
  }
}
