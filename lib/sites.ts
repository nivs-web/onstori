import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { forVisitors } from "./phone-privacy";
/* ⚠ 5eaaf47(`/g/` 폐기) 에서 이 줄이 «함께» 지워졌다 — 그 커밋이 없앤 것은 「보이기」 판정이었는데,
   260 줄의 「쉬는 화면 vs 없는 주소」 판정은 남아 있어 `main` 이 타입 검사에서 깨져 있었다.
   `lib/premade.ts` 는 건드리지 않았다 — 09-13 P0 의 자물쇠다. 부르는 줄만 되살린다. (2026-09-16) */
import { isPremade } from "./premade";
import { SiteDoc, StoryEntry, type SiteDocT, type StoryEntryT } from "./schema";
import { loadShorts, type ShortT } from "./shorts";
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
  /**
   * ★ **홈페이지에 걸린 영상 «전부»** — 숏폼 피드가 쓴다. (2026-09-16 대표님 지시)
   *   판정은 `story_entries.video_out_key` 하나다(`lib/shorts.ts`). 없으면 빈 배열이다.
   * ⚠ 이걸 못 읽어도 사이트는 열려야 한다 — `loadShorts` 가 절대 던지지 않는다.
   */
  shorts?: ShortT[];
};

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // env 미설정 환경에서도 시드 폴백으로 동작
  return createClient(url, anon, { auth: { persistSession: false } });
}

/**
 * ★★★ **폐기됨 — `/g/` 견본 경로 (2026-09-15 대표님 지시).**
 *
 *   전에는 「미리 만든 홈페이지」를 `/{상호}` 에서 **숨기고** `/g/{상호}` 에만 보여 주었다.
 *   그런데 그 판정이 `isPremade()` — **문자를 보내면 안 되는 곳인가**를 묻는 함수 — 와
 *   **한 덩어리로 묶여 있었다.** 그래서 대표님이 만드신 홈페이지가 만들자마자
 *   **`/{상호}` 에서 안 열렸다.** 실제로 09-15 에 `onstori.com/feliz` 를 못 만드셨다.
 *
 * ★★ **둘은 다른 질문이다. 이제 갈라 둔다:**
 *   · **보이기** — 발행됐으면 `/{상호}` 에서 **그냥 열린다.** 조건 없다 (여기)
 *   · **문자**   — `isPremade()` 가 그대로 막는다 (`lib/premade.ts` · 크론 셋)
 *   ⚠ **`lib/premade.ts` 를 건드리지 마라.** 그것은 09-13 P0(남의 가게로 문자가 나갈 뻔한 것)의
 *     자물쇠다. 보이기 때문에 그 자물쇠를 풀면 **그 사고가 그대로 되살아난다.**
 *
 * ★ 대표님 말씀: 「시키지 않은 안전장치를 마음대로 넣지 마라. `/g/` 로 옮기기 같은 것.」
 *   `/g/{상호}` 는 **`/{상호}` 로 영구 이동**한다(`app/g/[slug]/page.tsx`) — 이미 보내 둔
 *   링크가 깨지지 않게 길만 남겨 두고 화면은 없앴다.
 */

/**
 * ★ **예시 홈페이지 목록 — 단일 출처.** (2026-09-13 지시 13)
 *   `seeds/*.json` 에서 오는 것은 전부 예시다. 그 밖에 DB 에 있는 예시는 여기 적는다.
 * ⚠ 여기에 진짜 사장님 주소를 적지 마라 — 그분 홈페이지에 「예시」가 붙는다.
 */
export const SAMPLE_SLUGS = new Set(["sample-interior", "sample-toss"]);

/**
 * ★★ **검색에서 «지우는» 예시** — 이 목록에 있으면 `noindex` 가 붙는다. (2026-09-17 지시 [22])
 *
 * ⚠ **`SAMPLE_SLUGS` 와 다른 목록이다. 합치지 마라.** 둘은 서로 다른 질문에 답한다:
 *   · `SAMPLE_SLUGS` = 「예시인가」 → 「예시」 표시 · 사이트맵 제외 · 구조화 데이터 제외
 *   · 여기          = 「검색에서 지울 것인가」 → `noindex`
 *
 * ★ `sample-interior` 는 **여기 없다. 넣지 마라.** 그 화면은 유튜브·인스타 심사관이 검색으로도
 *   찾아 볼 수 있어야 한다(2026-09-16 지시 [8] — 「사이트맵에서 빼기」와 「검색에서 지우기」는 다르다).
 * ★ `sample-toss` 는 **토스 심사 때만 쓰는 껍데기**라 검색에 아예 없는 편이 맞다.
 *   권반장 지시 [22]: 「🔴 `noindex` + 사이트맵 제외. 없는 업체가 구글에 색인되면 안 됩니다.」
 */
export const NOINDEX_SLUGS = new Set(["sample-toss"]);

async function getFromDb(slug: string): Promise<SiteData | null> {
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
     * ★★ **발행됐으면 그냥 보여 준다.** (2026-09-15 대표님 지시)
     *   전에 여기에 「견본이면 숨긴다」가 있었다. 그것 때문에 만든 홈페이지가 안 열렸다.
     *   ⚠ 안 보여야 할 것은 **RLS 가 이미 막는다** — 손님 권한(anon)은 `trial`·`active` 만 읽는다.
     *     즉 만료·정지된 사이트는 여기까지 오지도 못한다. 자물쇠를 두 번 걸 필요가 없다.
     *   ⚠ 문자 자물쇠(`isPremade`)는 **손대지 않았다.** 크론 셋이 그대로 쓴다.
     */

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

    /* ★ 홈페이지에 걸린 영상 전부 — 숏폼 피드용. 실패해도 빈 배열이라 사이트는 그대로 열린다 */
    const shorts = await loadShorts(client, site.id);

    const status = site.status === "active" ? "active" : "trial";
    const logo = (site.settings as { logo?: unknown } | null)?.logo;
    return {
      slug, doc, stories, status, shorts,
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

export async function getSiteBySlug(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null; // 라우팅 최종 방어선
  const fromDb = await getFromDb(slug);
  if (fromDb) return fromDb;
  return await getFromSeed(slug);
}

/**
 * ★★ **비공개 홈페이지를 «운영자만» 읽는다.** (2026-09-15 대표님 지시)
 *
 * ★ 대표님 말씀 그대로: 「돈을 안 내서 기간이 지난 고객도 **나중에 돈을 낼 수 있는 고객**이다.
 *   우리는 **그 어떤 사이트도 삭제하지 않는다.** 단, 권한을 아예 없애 **관리자만** 볼 수 있는
 *   곳으로 바꾼다.」
 *
 * · 손님에게는 `/{상호}` 가 **「쉬고 있어요」 안내**만 보여 준다 (RLS 가 내용을 안 준다)
 * · 운영자는 `/x/{상호}` 에서 **원래 홈페이지 그대로** 본다 (이 함수)
 * · 결제하면 `status` 가 돌아오고 **아무것도 복구할 것이 없다** — 자료는 처음부터 그대로 있다
 *
 * 🔴 **부르는 쪽이 `isAdmin()` 을 반드시 먼저 확인한다.** 이 함수는 운영자 열쇠로 읽으므로
 *   확인 없이 부르면 비공개 홈페이지가 통째로 새어 나간다. (`app/x/[slug]/page.tsx` 참고)
 */
export async function getSiteForAdmin(
  slug: string,
): Promise<(SiteData & { realStatus: string; businessName: string }) | null> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: site } = await admin
      .from("sites")
      /* ⚠ owner_id·anon_id 는 빼지 마라 — 09-13 사고의 그 두 칸이다(lib/premade.ts) */
      .select("id, slug, status, business_name, published, draft, settings, owner_id, anon_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!site) return null;

    /* 발행본이 없으면 작업본이라도 보여 준다 — 운영자는 «무엇이 들어 있는지»를 봐야 한다 */
    const raw = site.published ?? site.draft;
    if (!raw) return null;
    const parsed = SiteDoc.safeParse(raw);
    if (!parsed.success) return null;

    const { data: rows } = await admin
      .from("story_entries")
      .select("id, entry_type, title, body, photos, entry_date")
      .eq("site_id", site.id)
      .order("entry_date", { ascending: false })
      .limit(30);

    const stories: StoryEntryT[] = (rows ?? []).flatMap((r) => {
      const p = StoryEntry.safeParse({
        id: r.id, entryType: r.entry_type, title: r.title, body: r.body,
        photos: r.photos ?? [], entryDate: String(r.entry_date),
      });
      return p.success ? [p.data] : [];
    });

    const shorts = await loadShorts(admin, site.id);
    const logo = (site.settings as { logo?: unknown } | null)?.logo;
    return {
      slug,
      /* ⚠ 운영자 화면이라도 번호는 손님 화면과 같은 규칙으로 지운다 — 습관을 가르지 않는다 */
      doc: forVisitors(parsed.data, site.settings),
      stories,
      shorts,
      status: site.status === "active" ? "active" : "trial",
      realStatus: String(site.status),
      businessName: String(site.business_name ?? ""),
      logo: typeof logo === "string" && logo ? logo : undefined,
      settings: (site.settings as Record<string, unknown> | null) ?? {},
      sample: SAMPLE_SLUGS.has(slug),
    };
  } catch {
    return null;
  }
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
 *
 * ⚠ **견본(premade)은 「쉬고 있어요」 화면을 못 받는다 — 404 로 남는다.** (2026-09-13 · T-0014)
 *   견본은 **계약 안 한 남의 가게** 다. 그 상호가 우리 화면(「지금은 볼 수 없어요」)에 박히면
 *   안 된다. `getFromDb` 가 «보이기 판정»에서 쓰는 것과 **같은 판정**(`isPremade` + `SAMPLE_SLUGS`
 *   예외)을 여기서도 쓴다 — 그래서 `owner_id`·`anon_id`·`settings` 를 함께 읽는다.
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
      .select("business_name, status, owner_id, anon_id, settings")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    /* trial·active 인데 여기까지 왔다면 «발행 전»이다. 그건 쉬는 게 아니라 아직 없는 것 */
    if (data.status === "trial" || data.status === "active") return null;
    /* 견본(주인 없음)이면 «쉬는 화면» 대신 «없는 주소» 로 — 남의 상호를 우리 화면에 박지 않는다 */
    if (isPremade(data) && !SAMPLE_SLUGS.has(slug)) return null;
    return { businessName: (data.business_name as string) || "" };
  } catch {
    return null;
  }
}
