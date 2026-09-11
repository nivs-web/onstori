import { RULES } from "@/config/completeness";
import { sbAdmin } from "./db-admin";
import { isValidPhone } from "./phone";
import type { SiteDocT } from "./schema";

/**
 * 완성도 점수 계산 (서버 전용) — config/completeness.ts 규칙표를 사이트 상태에 대입.
 * v1 판정 가능 규칙만 채점(로고·위젯은 기능 도입 시 활성). 저장·발행·스토리 작성 시 재계산.
 */

type Ctx = {
  doc: SiteDocT | null;
  settings: Record<string, unknown>;
  storyCount: number;
  storyPhotoCount: number;
  /** 찍어서 올린 영상이 몇 편인가 — 완성도 「첫 영상」의 판정값 */
  videoCount: number;
  publishedAt: boolean;
};

const CHECKS: Record<string, (c: Ctx) => boolean> = {
  hero_text: (c) => {
    const h = c.doc?.sections.find((s) => s.type === "hero");
    return !!h && "headline" in h && h.headline.trim().length >= 8;
  },
  photo_real: (c) => c.storyPhotoCount >= 3,
  hours: (c) => typeof c.settings.hours === "string" && (c.settings.hours as string).length > 0,
  contact: (c) => isValidPhone(typeof c.settings.phone === "string" ? c.settings.phone : ""),
  story_1: (c) => c.storyCount >= 1,
  /* ★ 2026-09-12 신설 — 「첫 영상 찍기」(회장님 지시 7).
     ★★ 규칙 12 의 셋이 같은지 확인하고 넣었다:
       · 판정하는 값 — 찍어 올린 영상이 한 편이라도 있나 (story_entries.video_key)
       · 화면이 채우는 값 — 「영상」 메뉴에 녹화 링크 버튼이 실제로 있다(videos-panel)
       · 힌트가 데려가는 곳 — `panel-video` (tours.ts 에 등록 → anchors.ts 가 「영상」 메뉴로 연다)
     ⚠ **«홈페이지에 걸었나»가 아니라 «찍었나»로 판정한다.** 회장님 지시가 「첫 영상」이고,
       라벨·힌트도 「찍어 보세요」다. 셋이 어긋나면 안 된다. */
  first_video: (c) => c.videoCount >= 1,
  cta_form: (c) => !!c.doc?.sections.some((s) => s.type === "quoteForm"),
  /* ★ 2026-09-10 — 켰다. 값은 **이미 쌓이고 있었다**(온보딩 3단계 → /api/site/logo → settings.logo).
     판정만 `false` 로 못 박혀 있어서, 로고를 넣은 사장님이 5점을 손해 보고
     만점도 사실상 95점이었다 — 화면이 「100점 만점」이라고 말하는데 거짓이었다. */
  logo: (c) => typeof c.settings.logo === "string" && (c.settings.logo as string).length > 0,
  published: (c) => c.publishedAt,
  // c.doc 은 zod 검증 없이 캐스팅한 draft 라 ?. 가 필수다. 판정 대상이 draft 이므로 저장 즉시 오른다(발행 전)
  widget_1: (c) => (c.doc?.widgets?.length ?? 0) > 0,
};

export async function recomputeScore(siteId: string) {
  const sb = sbAdmin();
  const [{ data: site }, { data: stories }] = await Promise.all([
    sb.from("sites").select("draft, settings, published_at").eq("id", siteId).single(),
    sb.from("story_entries").select("photos").eq("site_id", siteId).eq("visible", true),
  ]);
  /* ⚠ 영상은 **visible 과 무관하게** 센다. 녹화 직후에는 visible=false 로 들어오는데
     (api/story/submit), 그때도 사장님은 이미 «찍었다». 여기서 visible 을 걸면
     찍자마자 점수가 안 붙어 「시키는 대로 했는데 안 오른다」가 된다 — 규칙 12 가 경계하는 바로 그것. */
  const { data: vids } = await sb.from("story_entries")
    .select("id").eq("site_id", siteId).not("video_key", "is", null).limit(1);
  if (!site) return null;

  const ctx: Ctx = {
    doc: (site.draft as SiteDocT) ?? null,
    settings: (site.settings as Record<string, unknown>) ?? {},
    storyCount: stories?.length ?? 0,
    storyPhotoCount: (stories ?? []).reduce((n, s) => n + ((s.photos as unknown[])?.length ?? 0), 0),
    videoCount: vids?.length ?? 0,
    publishedAt: !!site.published_at,
  };

  const done = RULES.filter((r) => CHECKS[r.id]?.(ctx));
  const score = done.reduce((s, r) => s + r.pts, 0);
  await sb.from("site_progress").upsert(
    { site_id: siteId, score, rules_done: done.map((r) => r.id), updated_at: new Date().toISOString() },
    { onConflict: "site_id" },
  );
  return { score, done: done.map((r) => r.id) };
}

/** funnel 이정표 기록 (최초 1회만) */
export async function markFunnel(siteId: string, key: "first_edit_at" | "first_story_at" | "published_at" | "activated_at") {
  const sb = sbAdmin();
  const { data } = await sb.from("site_progress").select("funnel").eq("site_id", siteId).maybeSingle();
  const funnel = (data?.funnel as Record<string, string>) ?? {};
  if (funnel[key]) return;
  funnel[key] = new Date().toISOString();
  await sb.from("site_progress").upsert({ site_id: siteId, funnel }, { onConflict: "site_id" });
}
