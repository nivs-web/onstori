/**
 * 주 1회 문자 **모의 발송** — 실제로는 한 통도 보내지 않는다. (2026-09-12)
 *
 * ★ 왜 만들었나: 「9/15 아침에 누구에게 무슨 글자가 가는가」를 **미리 눈으로** 보기 위해서다.
 *   크론을 직접 돌려 확인하면 그 순간 실문자가 나간다 — 돌이킬 수 없다.
 *
 * ⚠ 이 파일은 `sendSmsRaw` 를 **import 하지 않는다.** 실수로도 못 보내게 하기 위해서다.
 *
 * 쓰는 법: `npx tsx scripts/weekly-dryrun.ts [기준시각 ISO]`
 *   예) `npx tsx scripts/weekly-dryrun.ts 2026-09-15T09:00:00+09:00`
 */
import { readFileSync } from "node:fs";
import {
  readWeekly, shouldSend, deadlineText, hasBannedPhrase, withOptOut, pickOnePerPhone, phoneKey,
  type Weekly,
} from "../lib/weekly";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

/**
 * ★★ 가림표. **끝 네 자리만 보여 주면 안 된다.**
 *
 * ⚠ 2026-09-12 에 클코가 바로 여기서 틀렸다. 처음 만든 가림표가 **가운데** 네 자리를 가려
 *   `010-****-7025` 를 만들었고, 끝 네 자리만 우연히 같은 **서로 다른 두 번호**를 같은 번호로
 *   읽어 회장님께 「같은 번호로 두 통이 간다」고 **틀린 보고**를 했다.
 *
 * ★ 가림표는 사람을 속이면 안 된다. 그래서 **번호마다 다른 이름표(번호#1·번호#2…)**를 붙인다.
 *   이름표가 같으면 같은 번호, 다르면 다른 번호다 — 가린 채로도 눈으로 갈린다.
 */
const tags = new Map<string, string>();
function mask(p: string): string {
  const k = phoneKey(p);
  if (!tags.has(k)) tags.set(k, String(tags.size + 1));
  return `${p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3")} 번호#${tags.get(k)}`;
}

type Cand = { slug: string; businessName: string; phone: string; status: string | null; updatedAt: string | null; w: Weekly };

async function main() {
  const at = process.argv[2] ? new Date(process.argv[2]) : new Date();

  const r = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sites?select=id,slug,business_name,settings,status,trial_ends_at,suspended_at,updated_at&status=in.(trial,active)`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
  );
  const sites = await r.json();

  const cands: Cand[] = [];
  const skipped: string[] = [];

  for (const s of sites) {
    const settings = s.settings ?? {};
    const w = readWeekly(settings);
    if (!shouldSend(w, at)) { skipped.push(`${s.slug} — 때가 아님 (on=${w?.on} · 요일=${w?.weekday})`); continue; }
    const phone = (w?.phone?.trim() || settings.phone || "").trim();
    if (!phone) { skipped.push(`${s.slug} — 번호 없음`); continue; }
    cands.push({ slug: s.slug, businessName: s.business_name, phone, status: s.status, updatedAt: s.updated_at, w: w as Weekly });
  }

  const { chosen, dropped } = pickOnePerPhone(cands);

  const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full", timeStyle: "short" }).format(at);
  console.log(`기준 시각: 한국 ${kst}`);
  console.log(`살아있는 사이트 ${sites.length} · 보낼 때가 된 곳 ${cands.length} · 같은 번호라 건너뜀 ${dropped.length} · **실제 발송 ${chosen.length}통**\n`);

  for (const d of dropped) console.log(`  ⏭ ${d.slug} — 같은 번호의 ${d.inFavorOf} 로 한 통만 간다`);
  if (dropped.length) console.log("");

  let bad = 0;
  for (const c of chosen) {
    const body = `[온스토리] ${c.businessName} 사장님, 이번 주 질문이 도착했어요.\n"(이번 주 질문이 여기 들어간다)"\n${deadlineText(at)}까지 열어 보실 수 있어요.\nhttps://onstori.com/s/${c.slug}`;
    const text = withOptOut(body, !c.w.lastSentAt);
    const banned = hasBannedPhrase(text);
    if (banned) bad++;
    console.log(`── ${c.businessName} (${c.slug}) → ${mask(c.phone)}${c.w.lastSentAt ? "" : " · ★첫 통"}`);
    console.log(text.split("\n").map((l) => `   │ ${l}`).join("\n"));
    console.log(`   └ 금지어 검사: ${banned ? `❌ «${banned}» 에 걸린다 — 이 문자는 안 나간다` : "✅ 통과"}\n`);
  }

  console.log(`건너뛴 곳 ${skipped.length}:`);
  for (const s of skipped) console.log(`  · ${s}`);
  process.exitCode = bad ? 1 : 0;
}

main();
