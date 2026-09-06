import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { recomputeScore, markFunnel } from "@/lib/score";
import { captureSite } from "@/lib/site-shot";

/** 사이트 반영 — draft→published 복사 + 이전 발행본 스냅샷(롤백용) */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  if (!r.site.draft) return NextResponse.json({ error: "no-draft" }, { status: 400 });

  const sb = sbAdmin();
  if (r.site.published) {
    await sb.from("site_versions").insert({ site_id: r.site.id, snapshot: r.site.published });
  }
  const { error } = await sb
    .from("sites")
    .update({ published: r.site.draft, published_at: new Date().toISOString() })
    .eq("id", r.site.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ⚠ [slug] 는 ISR(revalidate 60)이다. 이 한 줄이 없으면 사장님이 발행하고도
  //   최대 60초 동안 옛 화면을 본다 — 발행 버튼을 다시 누르게 만드는 원인이 된다.
  revalidatePath(`/${r.site.slug}`);

  /* 첫 페이지 테마 카드용 스크린샷 다시 찍기.
     ⚠ 발행을 **막지 않는다** — 기다리지 않고 띄워만 두고, 실패해도 발행은 성공이다.
     ⚠ 크롬이 없는 곳(서버리스)에서는 조용히 no-browser 로 끝난다. lib/site-shot.ts 참조. */
  void (async () => {
    try {
      const origin = new URL(req.url).origin;
      const shot = await captureSite(r.site.slug, origin);
      if (!shot.ok) { console.warn(JSON.stringify({ evt: "site_shot_skip", slug: r.site.slug, reason: shot.reason })); return; }
      const { data: s } = await sb.from("sites").select("settings").eq("id", r.site.id).single();
      const settings = { ...((s?.settings as Record<string, unknown>) ?? {}), shots: { pc: shot.pc, phone: shot.phone, at: shot.at } };
      await sb.from("sites").update({ settings }).eq("id", r.site.id);
    } catch { /* 발행은 이미 끝났다 */ }
  })();

  await markFunnel(r.site.id, "published_at");
  const score = await recomputeScore(r.site.id);
  return NextResponse.json({ ok: true, score: score?.score ?? 0 });
}
