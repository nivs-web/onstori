/**
 * **이미 있는 사이트에 「미리 만든 곳」 표시를 붙인다/뗀다.** (2026-09-13 지시 A · 결정 3)
 *
 * ★★ 왜 필요한가: `premade` 표시는 **지금부터 만드는 것**에만 자동으로 붙는다.
 *   그런데 **이미 있는 사이트 중에 회장님이 콜드콜용으로 미리 만들어 둔 것**이 섞여 있을 수 있다.
 *   그 사이트의 `settings.phone` 은 네이버·카카오에서 불러온 **그 가게의 진짜 번호**다 —
 *   9/15 화요일 아침 9시에 **계약도 안 한 가게로 문자가 나간다.**
 *
 * ★ 표시를 붙이면 주간 크론·만료 크론이 **둘 다** 건너뛴다(lib/premade.ts).
 *   사장님이 나중에 가져가면 표시를 떼고 다시 켜면 된다.
 *
 * 쓰는 법
 *   npx tsx scripts/mark-premade.ts                      → 지금 상태만 보여 준다
 *   npx tsx scripts/mark-premade.ts --on  slugA slugB     → 그 곳들에 표시를 붙인다(문자 멈춤)
 *   npx tsx scripts/mark-premade.ts --off slugA           → 표시를 뗀다(문자 다시 나감)
 *
 * ⚠ 바꾸기 전에 **백업을 먼저** 뜬다. 못 뜨면 아무것도 안 바꾼다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { isPremade, premadeReason } from "../lib/premade";
import { readWeekly } from "../lib/weekly";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const BACKUP = "backups/premade-mark-2026-09-13.json";

const mask = (p?: string) => (p ? p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3") : "(없음)");

async function main() {
  const mode = process.argv.includes("--on") ? "on" : process.argv.includes("--off") ? "off" : "show";
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  const rows = await (await fetch(
    `${url}/rest/v1/sites?select=id,slug,business_name,settings,owner_id,anon_id,status`, { headers: h },
  )).json();

  if (mode === "show") {
    console.log("slug                  | 주인   | 표시 | 주1회 | 번호            | 문자가 나가나");
    console.log("-".repeat(88));
    for (const s of rows) {
      const w = readWeekly(s.settings ?? {});
      const phone = (w?.phone?.trim() || s.settings?.phone || "").trim();
      const owner = s.owner_id ? "계정" : s.anon_id ? "익명표" : "없음";
      const blocked = isPremade(s);
      const on = w?.on !== false;
      const goes = !blocked && on && !!phone;
      console.log(
        s.slug.padEnd(22) + "| " + owner.padEnd(6) + "| " +
        (s.settings?.premade === true ? " 있음" : " 없음") + " | " +
        (on ? " 켬 " : " 끔 ") + " | " + mask(phone).padEnd(16) + "| " +
        (goes ? "🔴 나간다" : "✅ 안 나간다" + (blocked ? ` (${premadeReason(s)})` : " (꺼짐)")),
      );
    }
    console.log("\n★ 미리 만들어 둔 곳이라면 표시를 붙여 멈춥니다:");
    console.log("   npx tsx scripts/mark-premade.ts --on <slug> <slug> …");
    return;
  }

  if (!slugs.length) { console.log("어느 사이트인지 주소(slug)를 적어 주세요."); return; }
  const targets = rows.filter((s: { slug: string }) => slugs.includes(s.slug));
  const missing = slugs.filter((x) => !targets.some((t: { slug: string }) => t.slug === x));
  if (missing.length) console.log(`⚠ 못 찾은 주소: ${missing.join(", ")}`);
  if (!targets.length) return;

  /* 백업 — 바꾸기 «전»에. 다시 읽어 검증한다 */
  if (!existsSync(BACKUP)) {
    writeFileSync(BACKUP, JSON.stringify(targets, null, 2), "utf8");
    const back = JSON.parse(readFileSync(BACKUP, "utf8"));
    if (!Array.isArray(back) || back.length !== targets.length) {
      console.log("❌ 백업이 제대로 안 적혔어요. 아무것도 바꾸지 않고 멈춥니다."); return;
    }
    console.log(`✅ 백업 — ${BACKUP} (${back.length}곳)\n`);
  } else console.log(`(백업 파일이 이미 있어 그대로 둡니다: ${BACKUP})\n`);

  for (const s of targets) {
    const settings = { ...(s.settings ?? {}) };
    /**
     * ★★ **자물쇠를 «둘» 건다.** (2026-09-13 회장님 지시)
     *   ① `premade` 표시 — 크론이 건너뛴다
     *   ② `weekly.on = false` — 표시를 실수로 떼도 문자가 안 나간다
     * ⚠ 전에는 ①만 걸었다. 자물쇠 하나는 자물쇠가 아니다.
     * ★ 사장님이 가져가시면(`api/auth/handover`) 둘 다 원래대로 돌아온다 —
     *   표시를 떼고 주 1회를 기본값으로 켠다. 그러니 여기서 꺼도 잃는 것이 없다.
     */
    const weekly = { ...((settings.weekly as Record<string, unknown>) ?? {}) };
    if (mode === "on") {
      settings.premade = true;
      weekly.on = false;
    } else {
      delete settings.premade;
      weekly.on = true;
    }
    settings.weekly = weekly;
    const r = await fetch(`${url}/rest/v1/sites?id=eq.${s.id}`, {
      method: "PATCH", headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ settings }),
    });
    console.log(`${s.business_name} (${s.slug}) — 표시 ${mode === "on" ? "붙임" : "뗌"}: HTTP ${r.status}${r.ok ? " ✅" : " ❌"}`);
  }
  console.log("\n다시 확인: npx tsx scripts/mark-premade.ts");
}

main();
