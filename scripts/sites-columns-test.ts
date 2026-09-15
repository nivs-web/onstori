/**
 * **「견본인가」를 판정하는 곳이 그 판정에 필요한 칸을 읽어 오는지** 검사한다.
 * (2026-09-13 사고로 신설 · 2026-09-15 강화)
 *
 * ★★★ **왜 이 검사가 생겼나 — 같은 사고가 두 번 났다.**
 *
 *   `isPremade(s)` 는 `s.settings` · `s.owner_id` · `s.anon_id` 셋을 본다.
 *   그런데 Supabase 의 `select` 는 **글자열**이라, 칸을 빠뜨려도 컴파일 오류가 나지 않고
 *   **조용히 `undefined`** 로 온다. 그러면 자물쇠 ②(「주인이 아무도 없다」)가 발동해
 *   **모든 사이트가 견본으로 판정된다.**
 *
 *   · 2026-09-13 — `lib/sites.ts` 에서 두 칸을 빠뜨려 **손님 사이트가 전부 404** 가 됐다.
 *   · 2026-09-15 — `app/api/cron/expire/route.ts` ④번 구간에서 같은 실수. 그대로 갔으면
 *     계약하신 진짜 사장님께 **삭제 예고 문자가 한 통도 안 갈** 뻔했다.
 *
 * ★★ **2026-09-15 강화 — 왜 첫 판이 두 번째 사고를 못 잡았나.**
 *   첫 판은 「파일 안 **어느 하나의** select 가 두 칸을 가지면 통과」였다.
 *   `expire/route.ts` 는 ①번 구간이 갖고 있어서 **④번이 비어 있는데도 초록불**이었다.
 *   ⇒ 이제 그 파일의 **모든** «sites + settings» 조회를 하나씩 본다.
 *
 * ★ 검사 범위를 «`isPremade` 를 부르는 파일»로 좁힌 이유:
 *   `settings` 를 읽는 조회는 저장소에 22곳 있는데 대부분 점수 계산·사이트맵·관리자 화면이라
 *   견본 판정과 무관하다. 전부에 두 칸을 요구하면 **오탐 16건**이 나 검사가 못 쓰게 된다.
 *
 * ⚠ 정말 필요 없는 자리는 **그 줄 위 6줄 안에 `견본-걸름-불필요`** 를 적으면 빠진다.
 *   ⚠ 왜 안전한지를 **반드시 함께** 적어라. 「필요 없어 보여서」는 이유가 아니다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다 — 소스 글자만 읽는다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let bad = 0, done = 0;
const t = (name: string, ok: boolean, detail = "") => {
  done++;
  if (!ok) { console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ""}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

/** 판정에 꼭 필요한 칸 — 하나라도 빠지면 판정이 거꾸로 돈다 */
const NEEDED = ["owner_id", "anon_id"] as const;
/** 이 말이 조회 바로 위에 있으면 뺀다 — 왜 안전한지도 함께 적혀 있어야 한다 */
const EXEMPT = "견본-걸름-불필요";

const ROOTS = ["app", "lib", "scripts", "components"];
const SKIP = new Set(["node_modules", ".next", ".git", ".claude"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) sources(p, out); continue; }
    if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const all = ROOTS.filter((r) => { try { return statSync(r).isDirectory(); } catch { return false; } })
  .flatMap((r) => sources(r));

/** `isPremade(` 를 실제로 «부르는» 파일만 — 정의한 파일(lib/premade.ts)은 뺀다 */
const callers = all.filter((f) => {
  const src = readFileSync(f, "utf8");
  return /\bisPremade\s*\(/.test(src) && !/export function isPremade/.test(src);
});

console.log("── isPremade 를 부르는 파일을 찾았다 ──");
t(`한 곳 이상 찾았다 (찾은 것 ${callers.length}개)`, callers.length > 0,
  callers.length ? callers.map((f) => `  · ${f.replace(/\\/g, "/")}`).join("\n       ") : "한 곳도 못 찾았다 — 검사가 헛돌고 있다");

console.log("\n── ★ 그 파일들의 «모든» sites 조회를 하나씩 본다 ──");
let looked = 0;
for (const f of callers) {
  const lines = readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n");
  const rel = f.replace(/\\/g, "/");

  for (let i = 0; i < lines.length; i++) {
    if (!/\.from\(\s*["']sites["']\s*\)/.test(lines[i])) continue;

    /**
     * `.from("sites")` 가 속한 **그 문장이 끝날 때까지** 보면서 첫 `.select("…")` 를 찾는다.
     *
     * ⚠ **전에는 「뒤 8줄」이었다. 그것이 실제로 뚫렸다** (2026-09-15):
     *   `app/api/cron/expire/route.ts` 의 `.from("sites")` 와 `.select(` 사이에
     *   **경고 주석 7줄**이 들어가면서 창을 넘겼고, 검사가 그 조회를 **찾지도 못한 채**
     *   초록불을 냈다. 하필 그 주석이 「이 칸을 꼭 읽어라」는 경고였다.
     * ★ 줄 수로 창을 잡으면 주석 하나로 뚫린다. Supabase 체인은 **한 문장**이므로
     *   «세미콜론까지»로 잡는다 — 주석이 몇 줄이든 상관없다.
     * ⚠ 60줄은 안전장치다(문장이 안 끝나는 이상한 파일에서 무한정 읽지 않게).
     */
    let sel: string | null = null, at = -1;
    for (let j = i; j < Math.min(i + 60, lines.length); j++) {
      const m = lines[j].match(/\.select\(\s*["']([^"']*)["']/);
      if (m) { sel = m[1]; at = j; break; }
      /* 주석 안의 세미콜론에 속지 않는다 — 주석 줄은 문장 끝으로 치지 않는다 */
      const code = lines[j].replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
      if (/;\s*$/.test(code)) break;          // 이 문장은 select 없이 끝났다
    }
    /* settings 를 안 읽는 조회는 견본 판정에 쓸 수 없다 — 검사 대상이 아니다 */
    if (sel === null || !/\bsettings\b/.test(sel)) continue;

    /* 빼 달라는 표시가 위 6줄 안에 있나 */
    const near = lines.slice(Math.max(0, at - 6), at).join("\n");
    if (near.includes(EXEMPT)) {
      console.log(`  ⏭ ${rel}:${at + 1} — 「${EXEMPT}」 표시가 있어 건너뜀`);
      continue;
    }

    looked++;
    const missing = NEEDED.filter((c) => !new RegExp(`\\b${c}\\b`).test(sel));
    t(`${rel}:${at + 1}`, missing.length === 0,
      missing.length ? `읽고 있는 칸: "${sel}"\n       빠진 칸: ${missing.join(", ")}` : "");
  }
}

t(`★ 실제로 본 조회가 하나 이상이다 (본 것 ${looked}개)`, looked > 0,
  "하나도 못 봤다 — 검사가 아무것도 안 하고 초록불을 내고 있다");

console.log("\n── 자물쇠 자체가 그 두 칸에 기대고 있는지 ──");
const premade = readFileSync("lib/premade.ts", "utf8");
for (const c of NEEDED) t(`isPremade 가 ${c} 를 본다`, premade.includes(c));

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
