import { sbAdmin } from "./db-admin";
import { placeholderFor } from "@/config/placeholder-images";
import { loadImageUsage, heroUrls } from "./image-usage";

/**
 * 이미지 뱅크 매칭 — 승인(quality_ok) 이미지 중 태그 적중 → 점수 높고 덜 쓰인 것 우선.
 * 후보 상위권에서 랜덤(사이트 판박이 방지) + used_count 증가. 뱅크가 비면 플레이스홀더 폴백.
 *
 * 역할별 규칙:
 * - hero: **지금 다른 발행 사이트가 hero로 쓰는 이미지는 후보에서 제외** (첫인상이 겹치면 안 됨).
 *   기준은 누적 used_count가 아니라 현재 상태(lib/image-usage)라 히어로를 교체하면 다시 후보가 된다.
 * - 그 외: 제외하지 않고 used_count 가중치로만 배분 (갤러리는 겹쳐도 치명적이지 않음).
 */

/** hero 재고가 이 수 미만이면 경고 + 중복 허용 폴백 */
export const HERO_STOCK_MIN = 5;

type Row = { id: string; url: string; tags: string[] | null; used_count: number };

/** 업체 소개 문장과 태그가 겹치는 개수 — 겹칠수록 그 업체에 어울리는 사진일 확률이 높다 */
function tagScore(tags: string[] | null, text: string): number {
  if (!tags?.length || !text) return 0;
  const hay = text.toLowerCase();
  return tags.filter((t) => t && t.length >= 2 && hay.includes(t.toLowerCase())).length;
}

export async function pickImage(
  industry: string,
  mood: string,
  role: "hero" | "gallery" | "about" | "process",
  opts?: { text?: string },
): Promise<string> {
  try {
    const sb = sbAdmin();
    const { data } = await sb
      .from("image_bank")
      .select("id, url, tags, used_count")
      .eq("industry", industry)
      .eq("mood", mood)
      .eq("role", role)
      .eq("quality_ok", true)
      .eq("deleted", false)
      .order("quality_score", { ascending: false })
      .order("used_count", { ascending: true })
      .limit(40); // 태그·사용중 필터를 태우려면 후보 풀이 넉넉해야 한다

    let rows = (data ?? []) as Row[];
    if (rows.length > 0) {
      if (role === "hero") {
        const inUse = heroUrls(await loadImageUsage());
        const free = rows.filter((r) => !inUse.has(r.url));
        if (free.length < HERO_STOCK_MIN) {
          // 안전장치: 에러 내지 않고 진행하되 보충이 필요하다는 신호를 남긴다
          console.warn(JSON.stringify({
            evt: "hero_stock_low", msg: "hero 이미지 재고 부족, 뱅크 보충 필요",
            industry, mood, free: free.length, min: HERO_STOCK_MIN, total: rows.length,
          }));
        }
        // 여유가 있으면 미사용분만, 부족하면 used_count 낮은 순 전체에서 (정렬은 이미 used_count asc)
        rows = free.length > 0 ? free : rows;
      }

      const text = opts?.text ?? "";
      const scored = rows
        .map((r) => ({ r, t: tagScore(r.tags, text) }))
        .sort((a, b) => b.t - a.t); // 동점이면 DB 정렬(점수 desc, used_count asc) 유지
      const best = scored[0].t;
      // 태그가 적중한 게 있으면 그 그룹에서만, 없으면 상위 5장에서 랜덤
      const pool = best > 0 ? scored.filter((s) => s.t === best).map((s) => s.r) : scored.slice(0, 5).map((s) => s.r);

      const chosen = pool[Math.floor(Math.random() * pool.length)];
      await sb.rpc("bump_bank_used", { bank_id: chosen.id }).then(
        () => {},
        () => {}, // 카운터는 best-effort — 실패해도 이미지 선택은 진행
      );
      return chosen.url;
    }
  } catch { /* 폴백으로 */ }
  const ph = placeholderFor(industry);
  return role === "hero" ? ph.hero : ph.gallery[0] ?? ph.hero;
}

/** 어드민 재고 표시용 — (업종,분위기)별 hero 승인 수와 그중 지금 안 쓰이는 수 */
export async function heroStock(): Promise<{ industry: string; mood: string; total: number; free: number }[]> {
  const { data } = await sbAdmin()
    .from("image_bank")
    .select("industry, mood, url")
    .eq("role", "hero")
    .eq("quality_ok", true)
    .eq("deleted", false);
  const inUse = heroUrls(await loadImageUsage());
  const acc = new Map<string, { industry: string; mood: string; total: number; free: number }>();
  for (const r of data ?? []) {
    const key = `${r.industry}|${r.mood}`;
    const cur = acc.get(key) ?? { industry: r.industry, mood: r.mood, total: 0, free: 0 };
    cur.total++;
    if (!inUse.has(r.url)) cur.free++;
    acc.set(key, cur);
  }
  return [...acc.values()].sort((a, b) => a.free - b.free);
}
