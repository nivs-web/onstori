/**
 * 시연·시험 사이트의 **손님에게 보이는 전화번호**를 «절대 안 걸리는 번호»로 통일한다.
 * (2026-09-12 상무님 지적 · 2026-09-13 회장님 지시 A3 로 확대)
 *
 * ★★ 왜 필요한가 — 위험이 **둘**이다:
 *   ① **본사 번호**(`config/company.ts` 의 BIZ.phone)가 시연 사이트에 박혀 있었다.
 *      `/sample-interior` 는 첫 화면의 대표 예시라 제일 많이 보이는 번호고,
 *      손님이 «그 가게»인 줄 알고 우리 고객센터로 전화한다.
 *   ② ★ **`010-1234-5678` 은 «가짜 번호»가 아니다.** 한국에는 미국의 555 같은
 *      «절대 안 걸리는 대역»이 없다. 저 번호는 **실제 가입자일 수 있고**, 그러면
 *      우리 시험 사이트를 본 손님이 **모르는 사람에게 전화를 건다.**
 *      `010-0000-0000` 은 가입자에게 배정되지 않는 꼴이라 안전하다.
 *
 * ★★ **바꾸지 않는 것 둘:**
 *   · `settings.notify.*` — 「문의가 오면 누가 받나」다. 시연 사이트의 주인이 우리라서
 *     **본사 번호가 맞다.** 여기까지 바꾸면 시연 사이트 문의를 아무도 못 받는다.
 *   · **진짜 사장님 사이트** — 아래 `TEST_SLUGS` 에 적힌 곳만 건드린다.
 *     사장님의 진짜 번호를 우리가 지우면 그 가게는 전화를 못 받는다.
 *
 * 순서 (뒤집지 마라 — DB 백업 규칙):
 *   ① 칸 이름 확인 → ② 백업 파일로 저장하고 **다시 읽어 검증** → ③ 그다음에 원본 변경 → ④ 대조
 *
 * 실행: `npx tsx scripts/fix-demo-phone.ts`         (무엇이 바뀔지 보여만 준다)
 *       `npx tsx scripts/fix-demo-phone.ts --write`  (실제로 바꾼다)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

/**
 * 손님에게 보이면 안 되는 번호들. 하이픈이 있든 없든 잡는다.
 * ⚠ 새 번호를 넣을 때는 **왜 위험한지**를 같이 적어라.
 */
const RISKY: { re: RegExp; why: string }[] = [
  { re: /050[- ]?6493[- ]?4537/g, why: "온스토리 본사 번호 — 손님이 우리 고객센터로 전화한다" },
  { re: /010[- ]?1234[- ]?5678/g, why: "실제 가입자일 수 있다 — 한국에는 «안 걸리는 대역»이 없다" },
];

/** 가입자에게 배정되지 않는 꼴. 저장소의 시연 자료(seeds/*.json)도 이미 이것을 쓴다 */
const FAKE = "010-0000-0000";

/**
 * ★★ **여기 적힌 곳만 건드린다.** 진짜 사장님 사이트를 실수로 바꾸지 않기 위한 유일한 방어다.
 * ⚠ 새 시험 사이트를 만들면 여기 **먼저** 적어라. 안 적으면 이 스크립트가 그 사이트를 건너뛴다
 *   (건너뛰는 쪽이 안전하다 — 남의 번호를 지우는 것보다 낫다).
 */
const TEST_SLUGS = new Set([
  "sample-interior", "moksu", "bls",
  "herotest1", "herotest2", "herotest3",
  "parkteamjang-test-cafe", "store-2", "kimteamjangverifycafe",
]);

const BACKUP = "backups/sites-demo-phone-2026-09-13.json";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

/** 깊은 곳까지 글자를 바꾼다. `skip` 에 든 열쇠 **아래는 건드리지 않는다** */
function swap(node: unknown, skip: string[]): unknown {
  if (typeof node === "string") {
    let out = node;
    for (const r of RISKY) out = out.replace(r.re, FAKE);
    return out;
  }
  if (Array.isArray(node)) return node.map((x) => swap(x, skip));
  if (node && typeof node === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      o[k] = skip.includes(k) ? v : swap(v, skip);
    }
    return o;
  }
  return node;
}

/** 위험한 번호가 **손님에게 보이는 자리**에 있는가 — `notify` 는 빼고 본다 */
function riskyShown(site: Record<string, unknown>): string[] {
  const settings = { ...((site.settings as Record<string, unknown>) ?? {}) };
  delete settings.notify;                       // ★ 여기가 「우리가 받는 자리」다
  const blob = JSON.stringify({ settings, d: site.draft, p: site.published });
  const hit: string[] = [];
  for (const r of RISKY) { r.re.lastIndex = 0; if (r.re.test(blob)) hit.push(r.why); }
  return hit;
}

const mask = (p?: string) => (p ? p.replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, "$1-$2-****") : "(없음)");

async function main() {
  const write = process.argv.includes("--write");

  const rows = await (await fetch(
    `${url}/rest/v1/sites?select=id,slug,business_name,settings,draft,published`, { headers: h },
  )).json();

  const hit = rows.filter((s: Record<string, unknown>) => riskyShown(s).length > 0);
  const mine = hit.filter((s: { slug: string }) => TEST_SLUGS.has(s.slug));
  const theirs = hit.filter((s: { slug: string }) => !TEST_SLUGS.has(s.slug));

  console.log(`전체 ${rows.length}곳 · 손님에게 보이는 자리에 위험한 번호가 있는 곳 ${hit.length}곳`);
  console.log(`  · 시험 사이트(고칠 것) ${mine.length}곳 · 그 밖(건드리지 않음) ${theirs.length}곳\n`);

  for (const s of theirs) {
    /* ⚠ 조용히 넘어가지 않는다 — 진짜 사장님 사이트에 위험한 번호가 있다면 **사람이 봐야 한다** */
    console.log(`  ⚠ ${s.business_name} (${s.slug}) — 시험 사이트 목록에 없어 건드리지 않습니다. 사람이 확인해 주세요`);
  }
  if (theirs.length) console.log("");

  if (!mine.length) { console.log("바꿀 것이 없습니다."); return; }

  /* ① 백업 — 바꾸기 «전»에. 그리고 **다시 읽어** 제대로 적혔는지 확인한다 */
  if (write) {
    if (existsSync(BACKUP)) { console.log(`⚠ 백업 파일이 이미 있어요: ${BACKUP} — 덮어쓰지 않고 멈춥니다.`); return; }
    writeFileSync(BACKUP, JSON.stringify(mine, null, 2), "utf8");
    const back = JSON.parse(readFileSync(BACKUP, "utf8"));
    const same = Array.isArray(back) && back.length === mine.length
      && back.every((b: { slug: string }) => mine.some((x: { slug: string }) => x.slug === b.slug));
    if (!same) { console.log("❌ 백업이 제대로 안 적혔어요. **아무것도 바꾸지 않고 멈춥니다.**"); return; }
    console.log(`✅ 백업 검증 완료 — ${BACKUP} (${back.length}곳)\n`);
  }

  for (const s of mine) {
    const settings = swap(s.settings, ["notify"]);     // ★ notify 아래는 그대로
    const draft = swap(s.draft, []);
    const published = swap(s.published, []);

    const beforeNotify = (s.settings as { notify?: { phone?: string } })?.notify?.phone;
    const afterNotify = (settings as { notify?: { phone?: string } })?.notify?.phone;

    console.log(`── ${s.business_name} (${s.slug})`);
    console.log(`   왜: ${riskyShown(s).join(" · ")}`);
    console.log(`   손님에게 보이는 번호 : ${mask((s.settings as { phone?: string })?.phone)} → ${mask((settings as { phone?: string })?.phone)}`);
    console.log(`   문의 알림 받을 번호   : ${mask(beforeNotify)} → ${mask(afterNotify)}  ${beforeNotify === afterNotify ? "(그대로 — 맞다)" : "🔴 바뀌면 안 된다!"}`);

    if (!write) { console.log("   (모의 실행 — 아무것도 안 바꿨습니다)\n"); continue; }

    const r = await fetch(`${url}/rest/v1/sites?id=eq.${s.id}`, {
      method: "PATCH", headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ settings, draft, published }),
    });
    console.log(`   저장: HTTP ${r.status}${r.ok ? " ✅" : " ❌ " + (await r.text()).slice(0, 120)}\n`);
  }

  if (!write) { console.log("실제로 바꾸려면 --write 를 붙여 주세요."); return; }

  /* ④ 대조 — 정말 사라졌나 */
  const again = await (await fetch(`${url}/rest/v1/sites?select=slug,settings,draft,published`, { headers: h })).json();
  const left = again.filter((s: Record<string, unknown>) => riskyShown(s).length > 0 && TEST_SLUGS.has(s.slug as string));
  console.log(left.length
    ? `❌ 아직 남았어요: ${left.map((x: { slug: string }) => x.slug).join(", ")}`
    : "✅ 시험 사이트의 «손님에게 보이는» 자리에서 위험한 번호가 전부 사라졌습니다.");
}

main();
