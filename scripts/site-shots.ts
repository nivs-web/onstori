/**
 * 손님 사이트 스크린샷 일괄 촬영 — 첫 페이지 테마 카드용.
 * 실행: npx tsx --env-file=.env.local scripts/site-shots.ts [--slug barun] [--origin http://localhost:3001]
 *
 * 크롬이 있는 기계에서 돈다(서버리스에는 없다 — lib/site-shot.ts 머리 주석 참조).
 * 결과 URL 은 sites.settings.shots 에 넣는다. 마이그레이션이 필요 없다.
 */
import { createClient } from "@supabase/supabase-js";
import { captureSite } from "../lib/site-shot";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const ORIGIN = arg("origin", "http://localhost:3001");
const ONLY = arg("slug", "");

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // 첫 페이지에 걸린 것만 찍는다 — 안 쓰는 사이트를 찍을 이유가 없다
  const { data: show } = await sb.from("showcase").select("slug").order("sort");
  const slugs = (show ?? []).map((r) => r.slug as string).filter((s) => !ONLY || s === ONLY);
  if (!slugs.length) { console.log("찍을 사이트가 없다 (showcase 가 비었나?)"); return; }

  console.log(`대상 ${slugs.length}곳 · 기준 주소 ${ORIGIN}`);
  let ok = 0, fail = 0;
  for (const slug of slugs) {
    const t0 = Date.now();
    const r = await captureSite(slug, ORIGIN);
    if (!r.ok) { fail++; console.log(`  ❌ ${slug} — ${r.reason}`); continue; }

    const { data: site } = await sb.from("sites").select("id, settings").eq("slug", slug).single();
    if (!site) { fail++; console.log(`  ❌ ${slug} — 사이트 없음`); continue; }
    const settings = { ...((site.settings as Record<string, unknown>) ?? {}), shots: { pc: r.pc, phone: r.phone, at: r.at } };
    const { error } = await sb.from("sites").update({ settings }).eq("id", site.id);
    if (error) { fail++; console.log(`  ❌ ${slug} — ${error.message}`); continue; }
    ok++;
    const kb = r.kb ? ` · PC ${r.kb.pc}KB · 폰 ${r.kb.phone}KB` : "";
    console.log(`  ✅ ${slug} (${Math.round((Date.now() - t0) / 1000)}초)${kb}`);
  }
  console.log(`\n완료 ${ok}곳 · 실패 ${fail}곳`);
}

main();
