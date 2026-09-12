/**
 * `checkPublishedAlive` 만 **따로** 돌려 본다 — 문자는 한 통도 안 나간다. (2026-09-12 지시 E2)
 *
 * ★ 왜 따로 도나: 이 일은 매일 도는 `/api/cron/weekly` 에 얹혀 있다. 그 크론을 부르면
 *   **주 1회 촬영 문자가 실제로 나간다.** 확인하자고 실문자를 쏠 수는 없다.
 *
 * ⚠ 인스타 API 를 **진짜로** 부른다(읽기만). 토큰이 죽어 있으면 `unknown` 으로 나온다 —
 *   그때는 「안 도는 것」이 아니라 「못 물어본 것」이다. 둘을 구분해서 읽어라.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] ??= m[2];
}

async function main() {
  const { checkPublishedAlive } = await import("../lib/sns/maintenance");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const q = "select=id,provider,status,remote_post_id,remote_deleted_at,remote_checked_at&status=eq.published";

  const before = await (await fetch(`${url}/rest/v1/sns_posts?${q}`, { headers: h })).json();
  console.log("── 돌리기 전 ──");
  for (const p of before) console.log(`  ${p.provider} ${p.id.slice(0, 8)} checked=${p.remote_checked_at ?? "-"} deleted=${p.remote_deleted_at ?? "-"}`);

  const out = await checkPublishedAlive();
  console.log("\n── 결과 ──");
  console.log(`  본 것 ${out.looked} · 살아있음 ${out.alive} · 지워짐 ${out.gone} · 못 물어봄 ${out.unknown}`);

  const after = await (await fetch(`${url}/rest/v1/sns_posts?${q}`, { headers: h })).json();
  console.log("\n── 돌린 뒤 ──");
  let wrote = 0;
  for (const p of after) {
    const b = before.find((x: { id: string }) => x.id === p.id);
    const changed = b?.remote_checked_at !== p.remote_checked_at || b?.remote_deleted_at !== p.remote_deleted_at;
    if (changed) wrote++;
    console.log(`  ${p.provider} ${p.id.slice(0, 8)} checked=${p.remote_checked_at ?? "-"} deleted=${p.remote_deleted_at ?? "-"} ${changed ? "← 바뀜" : ""}`);
  }

  console.log("\n── 판정 ──");
  if (out.looked === 0) console.log("  ⚠ 볼 것이 없었다 — 「도는지」를 확인하지 못했다 (published 인스타 글이 없거나 칸이 없다)");
  else if (wrote > 0) console.log(`  ✅ 표에 실제로 썼다 (${wrote}줄). remote_checked_at / remote_deleted_at 이 살아 있다`);
  else if (out.unknown === out.looked) console.log("  ⚠ 전부 «못 물어봄» — 토큰이 죽었다. 칸의 문제가 아니다");
  else console.log("  ❌ 봤는데 아무것도 안 썼다 — 여기가 이상하다");
}

main();
