import { sbAdmin } from "./db-admin";

/**
 * "이 이미지를 지금 어느 발행 사이트가 참조 중인가" — 어드민 배지와 pickImage 히어로 중복 방지의 공용 출처.
 *
 * 기준은 `sites.published`(라이브 문서)뿐이다. draft만 고친 상태는 아직 손님에게 안 나갔으므로 세지 않는다.
 * 누적치(used_count)가 아니라 **현재 상태**라서, 사장님이 히어로를 다른 이미지로 바꾸면
 * 이전 이미지는 자동으로 다시 후보가 된다.
 */

export type UsageRole = "hero" | "gallery" | "portfolio" | "about" | "process";
export type UsageRef = { slug: string; businessName: string; role: UsageRole };

type Section = {
  type?: string;
  image?: unknown;
  photos?: unknown;
  items?: unknown;
  steps?: unknown;
};

/** 한 섹션이 참조하는 이미지 URL과 그 역할 */
function refsInSection(s: Section): { url: string; role: UsageRole }[] {
  if (s?.type === "hero" && typeof s.image === "string" && s.image) {
    return [{ url: s.image, role: "hero" }];
  }
  if (s?.type === "about" && typeof s.image === "string" && s.image) {
    return [{ url: s.image, role: "about" }];
  }
  if (s?.type === "gallery" && Array.isArray(s.photos)) {
    return s.photos.filter((u): u is string => typeof u === "string" && !!u).map((url) => ({ url, role: "gallery" as const }));
  }
  if (s?.type === "processSteps" && Array.isArray(s.steps)) {
    return (s.steps as { image?: unknown }[])
      .filter((st) => typeof st?.image === "string" && st.image)
      .map((st) => ({ url: st.image as string, role: "process" as const }));
  }
  if (s?.type === "portfolioGallery" && Array.isArray(s.items)) {
    return (s.items as { image?: unknown }[])
      .filter((it) => typeof it?.image === "string" && it.image)
      .map((it) => ({ url: it.image as string, role: "portfolio" as const }));
  }
  return [];
}

/** URL → 그 URL을 쓰고 있는 발행 사이트 목록 */
export async function loadImageUsage(): Promise<Map<string, UsageRef[]>> {
  const map = new Map<string, UsageRef[]>();
  const { data, error } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, published")
    .not("published", "is", null);
  if (error || !data) return map;

  for (const site of data) {
    const sections = (site.published as { sections?: Section[] } | null)?.sections;
    if (!Array.isArray(sections)) continue;
    for (const sec of sections) {
      for (const { url, role } of refsInSection(sec)) {
        const list = map.get(url) ?? [];
        // 같은 사이트가 같은 역할로 여러 번 써도 1건으로 (갤러리 중복 방지)
        if (!list.some((r) => r.slug === site.slug && r.role === role)) {
          list.push({ slug: site.slug, businessName: site.business_name ?? site.slug, role });
        }
        map.set(url, list);
      }
    }
  }
  return map;
}

/** 지금 어딘가에서 hero로 쓰이고 있는 URL 집합 — pickImage의 히어로 중복 방지용 */
export function heroUrls(usage: Map<string, UsageRef[]>): Set<string> {
  const set = new Set<string>();
  for (const [url, refs] of usage) if (refs.some((r) => r.role === "hero")) set.add(url);
  return set;
}
