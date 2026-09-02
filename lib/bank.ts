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

/**
 * 갤러리처럼 여러 장이 필요한 자리 — 승인 이미지 중 태그 적중 우선으로 최대 n장(중복 없이).
 * hero 전용 로직(현재 사용 중인 이미지 제외)은 태우지 않는다 — 여러 장 자리는 hero가 아니고,
 * 갤러리는 사이트끼리 겹쳐도 치명적이지 않다(pickImage 주석의 역할별 규칙과 같은 판단).
 * 판박이 방지: 같은 점수끼리는 섞어서 뽑는다.
 *
 * pickImage와 달리 플레이스홀더로 폴백하지 않고 **빈 배열**을 준다. 히어로는 반드시 한 장이
 * 있어야 하지만 갤러리는 없으면 섹션을 안 만드는 편이 낫다 — 플레이스홀더로만 채운 갤러리는
 * 남의 사진을 자기 작업물처럼 보이게 해서 없느니만 못하다. 넣을지 말지는 호출부가 정한다.
 *
 * `widenMood`: 정확한 (업종,무드) 재고가 n장에 모자라면 **같은 업종의 다른 무드**에서 채운다.
 * 진행 과정처럼 칸 수가 정해진 자리는 일부만 사진이 붙으면 고장난 것처럼 보이는데, 셀당 재고가
 * 평균 3장이라 4스텝 중 55셀 가운데 38셀이 못 채운다(2026-09-02 실측). 업종까지 넓히면 최소 8장이라
 * 최대 6스텝도 채워진다. 56px 썸네일에서 무드(조명·색조) 차이는 거의 안 보이고 업종 적합성이 훨씬 중요하다.
 */
export async function pickImages(
  industry: string,
  mood: string,
  role: "gallery" | "about" | "process",
  n: number,
  opts?: { text?: string; widenMood?: boolean },
): Promise<string[]> {
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
      .limit(40);

    const rows = (data ?? []) as Row[];
    if (rows.length > 0) {
      const text = opts?.text ?? "";
      // 점수 tier별로 묶고 tier 안에서 섞는다 — 관련성은 지키되 사이트마다 다른 조합이 나오게
      const tiers = new Map<number, Row[]>();
      for (const r of rows) {
        const t = tagScore(r.tags, text);
        (tiers.get(t) ?? tiers.set(t, []).get(t)!).push(r);
      }
      const ordered: Row[] = [];
      for (const t of [...tiers.keys()].sort((a, b) => b - a)) {
        const bucket = tiers.get(t)!;
        for (let i = bucket.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
        }
        ordered.push(...bucket);
      }
      const chosen = ordered.slice(0, n);

      // 모자라면 같은 업종의 다른 무드에서 보충 (이미 고른 것 제외)
      if (opts?.widenMood && chosen.length < n) {
        const { data: wider } = await sb
          .from("image_bank")
          .select("id, url, tags, used_count")
          .eq("industry", industry)
          .eq("role", role)
          .eq("quality_ok", true)
          .eq("deleted", false)
          .order("used_count", { ascending: true })
          .limit(60);
        const have = new Set(chosen.map((c) => c.id));
        const extra = ((wider ?? []) as Row[]).filter((r) => !have.has(r.id));
        for (let i = extra.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [extra[i], extra[j]] = [extra[j], extra[i]];
        }
        chosen.push(...extra.slice(0, n - chosen.length));
      }

      if (chosen.length > 0) {
        // 카운터는 best-effort — 실패해도 이미지 선택은 진행 (pickImage와 같은 방침)
        await Promise.all(chosen.map((c) => sb.rpc("bump_bank_used", { bank_id: c.id }).then(() => {}, () => {})));
        return chosen.map((c) => c.url);
      }
    }
  } catch { /* 빈 배열로 */ }
  return [];
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
