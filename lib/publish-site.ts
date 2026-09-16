import { revalidatePath } from "next/cache";
import { sbAdmin } from "@/lib/db-admin";
import { recomputeScore, markFunnel } from "@/lib/score";
import { captureSite } from "@/lib/site-shot";

type PublishTarget = { id: string; slug: string; published: unknown };

/**
 * draft → published 반영의 «단 하나의 길» (CLAUDE.md 불변 규칙 5).
 * `app/api/site/publish`(사장님이 누르는 [발행] 버튼)와
 * `app/api/site/photos`(가입 직후 사진 자동 반영, T-0031)가 함께 쓴다.
 * ⚠ 이 함수 밖에서 `sites.published` 를 직접 update 하지 마라 — 그러면 스냅샷·캐시
 *   새로고침·완성도 재계산 중 하나가 빠진 채로 published 만 바뀌는 사고가 반복된다.
 */
export async function applyPublish(
  site: PublishTarget,
  nextPublished: unknown,
  origin: string
): Promise<{ ok: true; score: number } | { ok: false; error: string }> {
  const sb = sbAdmin();

  if (site.published) {
    await sb.from("site_versions").insert({ site_id: site.id, snapshot: site.published });
  }
  const { error } = await sb
    .from("sites")
    .update({ published: nextPublished, published_at: new Date().toISOString() })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  // ⚠ [slug] 는 ISR(revalidate 60)이다. 이 한 줄이 없으면 방금 반영한 내용이
  //   최대 60초 동안 옛 화면 그대로 보인다.
  revalidatePath(`/${site.slug}`);

  /* 첫 페이지 테마 카드용 스크린샷 다시 찍기.
     ⚠ 반영을 **막지 않는다** — 기다리지 않고 띄워만 두고, 실패해도 반영은 성공이다.
     ⚠ 크롬이 없는 곳(서버리스)에서는 조용히 no-browser 로 끝난다. lib/site-shot.ts 참조. */
  void (async () => {
    try {
      const shot = await captureSite(site.slug, origin);
      if (!shot.ok) { console.warn(JSON.stringify({ evt: "site_shot_skip", slug: site.slug, reason: shot.reason })); return; }
      const { data: s } = await sb.from("sites").select("settings").eq("id", site.id).single();
      const settings = { ...((s?.settings as Record<string, unknown>) ?? {}), shots: { pc: shot.pc, phone: shot.phone, at: shot.at } };
      await sb.from("sites").update({ settings }).eq("id", site.id);
    } catch { /* 반영은 이미 끝났다 */ }
  })();

  await markFunnel(site.id, "published_at");
  const score = await recomputeScore(site.id);
  return { ok: true, score: score?.score ?? 0 };
}
