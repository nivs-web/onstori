/**
 * 시연 사이트에 박힌 **본사 번호**를 가짜 번호로 바꾼다. (2026-09-12 상무님 지적)
 *
 * ★★ 왜: `/sample-interior` 는 첫 화면의 대표 예시라 **제일 많이 보이는 번호**다.
 *   거기에 온스토리 본사 번호가 박혀 있어, 손님이 «그 가게»인 줄 알고 우리 고객센터로 전화한다.
 *
 * ★★ **바꾸지 않는 것 하나 — `settings.notify.phone`.**
 *   그건 「문의가 오면 누구에게 알릴까」다. 이 사이트의 주인이 우리라서 **본사 번호가 맞다.**
 *   여기까지 바꾸면 시연 사이트로 들어온 문의를 **아무도 못 받는다.**
 *
 * 순서 (뒤집지 마라 — DB 백업 규칙):
 *   ① 칸 이름 확인 → ② 백업 파일로 저장하고 **다시 읽어 검증** → ③ 그다음에 원본 변경 → ④ 대조
 *
 * 실행: `npx tsx scripts/fix-demo-phone.ts`        (무엇이 바뀔지 보여만 준다)
 *       `npx tsx scripts/fix-demo-phone.ts --write` (실제로 바꾼다)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

/** 본사 번호 — 하이픈이 있든 없든 잡는다 */
const HQ = /050[- ]?6493[- ]?4537/g;
/** 저장소의 다른 시연 자료(seeds/*.json)가 쓰는 «예시» 번호 */
const FAKE = "010-0000-0000";
const BACKUP = "backups/sites-demo-phone-2026-09-12.json";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

/** 깊은 곳까지 글자를 바꾼다. `skip` 에 든 열쇠 **아래는 건드리지 않는다** */
function swap(node: unknown, skip: string[]): unknown {
  if (typeof node === "string") return node.replace(HQ, FAKE);
  if (Array.isArray(node)) return node.map((x) => swap(x, skip));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = skip.includes(k) ? v : swap(v, skip);
    }
    return out;
  }
  return node;
}

const has = (x: unknown) => HQ.test(JSON.stringify(x ?? null));

async function main() {
  const write = process.argv.includes("--write");

  const rows = await (await fetch(
    `${url}/rest/v1/sites?select=id,slug,business_name,settings,draft,published`, { headers: h },
  )).json();

  const hit = rows.filter((s: Record<string, unknown>) => has(s.settings) || has(s.draft) || has(s.published));
  console.log(`전체 ${rows.length}곳 · 본사 번호가 박힌 곳 ${hit.length}곳\n`);
  if (!hit.length) { console.log("바꿀 것이 없습니다."); return; }

  /* ① 백업 — 바꾸기 «전»에. 그리고 **다시 읽어** 제대로 적혔는지 확인한다 */
  if (write) {
    if (existsSync(BACKUP)) { console.log(`⚠ 백업 파일이 이미 있어요: ${BACKUP} — 덮어쓰지 않고 멈춥니다.`); return; }
    writeFileSync(BACKUP, JSON.stringify(hit, null, 2), "utf8");
    const back = JSON.parse(readFileSync(BACKUP, "utf8"));
    if (!Array.isArray(back) || back.length !== hit.length || !back.every((b: { slug: string }) => hit.some((x: { slug: string }) => x.slug === b.slug))) {
      console.log("❌ 백업이 제대로 안 적혔어요. **아무것도 바꾸지 않고 멈춥니다.**");
      return;
    }
    console.log(`✅ 백업 검증 완료 — ${BACKUP} (${back.length}곳)\n`);
  }

  for (const s of hit) {
    /* ★ settings 안에서 `notify` 아래만 남긴다 — 문의 알림은 우리가 받아야 한다 */
    const settings = swap(s.settings, ["notify"]);
    const draft = swap(s.draft, []);
    const published = swap(s.published, []);

    const before = {
      shown: (s.settings as { phone?: string })?.phone ?? "(없음)",
      notify: ((s.settings as { notify?: { phone?: string } })?.notify?.phone) ?? "(없음)",
    };
    const after = {
      shown: (settings as { phone?: string })?.phone ?? "(없음)",
      notify: ((settings as { notify?: { phone?: string } })?.notify?.phone) ?? "(없음)",
    };
    console.log(`── ${s.business_name} (${s.slug})`);
    console.log(`   손님에게 보이는 번호 : ${before.shown} → ${after.shown}`);
    console.log(`   문의 알림 받을 번호   : ${before.notify} → ${after.notify}  ${before.notify === after.notify ? "(그대로 — 맞다)" : "🔴 바뀌면 안 된다!"}`);

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
  const left = again.filter((s: Record<string, unknown>) => has(s.draft) || has(s.published)
    || HQ.test(JSON.stringify({ ...(s.settings as object), notify: undefined })));
  console.log(left.length
    ? `❌ 아직 남았어요: ${left.map((x: { slug: string }) => x.slug).join(", ")}`
    : "✅ 손님에게 보이는 자리에서 본사 번호가 전부 사라졌습니다.");
}

main();
