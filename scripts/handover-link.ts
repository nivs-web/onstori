/**
 * **사장님께 보낼 「가져가기」 링크를 뽑는다.** (2026-09-13 회장님 지시 B3)
 *
 * 쓰는 법
 *   npx tsx scripts/handover-link.ts                 → 넘겨줄 수 있는 곳 전부 보여 준다
 *   npx tsx scripts/handover-link.ts interior2       → 그 곳의 링크를 뽑는다
 *
 * ★ 뽑은 링크를 사장님께 문자·카톡으로 보내시면 됩니다. 그 링크로 들어와 로그인하면
 *   그 홈페이지의 주인이 됩니다.
 * ⚠ **한 번 쓰이면 그 링크는 죽습니다.** 다른 사람이 같은 링크를 열어도 아무 일도 안 납니다
 *   (주인이 이미 있으면 안 바꾸기 때문 — `app/api/auth/handover`).
 * ⚠ 링크는 {@link HANDOVER_DAYS}일만 삽니다. 지나면 여기서 다시 뽑으세요.
 * ⚠ 아무에게나 뿌리지 마세요. 링크를 아는 사람이 곧 주인이 됩니다.
 */
import { readFileSync } from "node:fs";
import { HANDOVER_DAYS, handoverUrl } from "../lib/handover";
import { isPremade } from "../lib/premade";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
for (const key of ["STORY_LINK_SECRET", "INQUIRY_SALT", "ADMIN_KEY"]) {
  if (env[key] && !process.env[key]) process.env[key] = env[key];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

type Row = { slug: string; business_name: string; owner_id: string | null; anon_id: string | null; settings: unknown };

async function main() {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  const rows: Row[] = await (await fetch(
    `${url}/rest/v1/sites?select=slug,business_name,owner_id,anon_id,settings`, { headers: h },
  )).json();

  if (!want.length) {
    console.log("★ 넘겨줄 수 있는 곳 — 아직 주인이 없는 홈페이지\n");
    const free = rows.filter((r) => !r.owner_id);
    if (!free.length) { console.log("  (없습니다 — 전부 주인이 있어요)"); return; }
    for (const r of free) {
      console.log(`  ${r.slug.padEnd(20)} ${r.business_name ?? ""}${isPremade(r) ? "  (미리 만든 곳)" : ""}`);
    }
    console.log(`\n링크를 뽑으려면: npx tsx scripts/handover-link.ts <slug>`);
    return;
  }

  for (const slug of want) {
    const row = rows.find((r) => r.slug === slug);
    if (!row) { console.log(`❌ ${slug} — 그런 홈페이지가 없어요`); continue; }
    if (row.owner_id) { console.log(`❌ ${slug} — 이미 주인이 계세요. 링크를 뽑지 않습니다`); continue; }
    console.log(`\n■ ${row.business_name ?? slug} (${slug})`);
    console.log(`  ${handoverUrl(slug)}`);
    /* ★ 견본은 /g/ 에 있다 — 손님 주소(/{상호})로는 안 열린다(lib/sites.ts PremadeMode) */
    console.log(`  미리 보기: https://onstori.com/g/${slug}`);
    console.log(`  ⚠ ${HANDOVER_DAYS}일간 유효 · 한 번 쓰이면 죽습니다 · 아는 사람이 주인이 됩니다`);
  }
  console.log("");
}

main();
