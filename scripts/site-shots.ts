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

  /**
   * 🔴🔴 **`--slug` 를 주면 showcase 를 «거치지 않는다».** (2026-09-18 토스 심사 건)
   *
   * ⚠⚠ **왜 고쳤나:** 전에는 대상 목록을 **언제나 `showcase` 에서** 가져오고 `--slug` 는
   *   그 목록을 «거르는» 데만 썼다. 그래서 showcase 에 없는 사이트는 `--slug` 를 줘도
   *   **「찍을 사이트가 없다」로 조용히 끝났다.**
   * 🔴 **showcase 에 넣어서 푸는 방법을 쓰면 안 된다** — showcase 는
   *   **첫 페이지 「온스토리로 만든 홈페이지」 목록**이다. 넣는 순간
   *   `sample-toss`(토스 심사용 예시)가 **손님들 첫 화면에 걸린다.**
   * ⇒ 이름을 «집어» 주면 그것만 찍는다. 목록에 있든 없든 상관없다.
   * ⚠ 다만 **그 사이트가 실제로 있는지는 확인한다** — 오타로 엉뚱한 이름을 주면
   *   크롬을 띄우고 나서야 「사이트 없음」이 된다. 먼저 묻는 것이 싸다.
   */
  let slugs: string[];
  if (ONLY) {
    const { data: one } = await sb.from("sites").select("slug").eq("slug", ONLY).maybeSingle();
    if (!one) { console.log(`그런 홈페이지가 없다: ${ONLY}`); return; }
    slugs = [ONLY];
    console.log(`«이름을 집어» 찍는다 — showcase 는 보지 않는다`);
  } else {
    // 이름을 안 주면 예전 그대로 — 첫 페이지에 걸린 것만 찍는다(안 쓰는 사이트를 찍을 이유가 없다)
    const { data: show } = await sb.from("showcase").select("slug").order("sort");
    slugs = (show ?? []).map((r) => r.slug as string);
    if (!slugs.length) { console.log("찍을 사이트가 없다 (showcase 가 비었나?)"); return; }
  }

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
