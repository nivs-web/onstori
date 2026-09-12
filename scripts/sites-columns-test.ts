/**
 * **자료를 읽을 때 «주인 정보»를 빠뜨리지 않았는지** 검사한다. (2026-09-13 사고로 신설)
 *
 * ★★★ **왜 이 검사가 생겼나 — 손님 사이트가 통째로 404 가 됐다.**
 *
 *   견본(`premade`)을 손님 주소에서 가리는 일을 `lib/sites.ts` 의 `getFromDb` 에 넣었다.
 *   그런데 그 함수의 `select` 에 **`owner_id`·`anon_id` 가 없었다.** 그러면 `isPremade` 가
 *   「주인이 아무도 없다」(자물쇠 ②)로 읽어 **모든 사이트를 견본으로 판정**한다.
 *   ⇒ 배포 직후 `/moksu`·`/bls` 같은 멀쩡한 사이트가 404 가 됐다.
 *
 * ★ 타입 검사도 빌드도 이것을 못 잡는다. Supabase 의 `select` 는 **글자열**이라
 *   빠진 칸이 컴파일 오류가 되지 않고 `undefined` 로 조용히 온다. 그래서 검사로 못 박는다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다 — 소스 글자만 읽는다.
 */
import { readFileSync } from "node:fs";

let bad = 0, done = 0;
const t = (name: string, ok: boolean, detail = "") => {
  done++;
  if (!ok) { console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ""}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

/** isPremade 를 부르는 곳은 반드시 이 두 칸을 읽어 와야 한다 */
const NEEDED = ["owner_id", "anon_id"];

const FILES = [
  "lib/sites.ts",
  "app/api/cron/weekly/route.ts",
  "app/api/cron/expire/route.ts",
  "app/api/inquiry/route.ts",
  "app/[slug]/preview/page.tsx",
];

console.log("── isPremade 를 쓰는 파일은 주인 정보를 읽어야 한다 ──");
for (const f of FILES) {
  const src = readFileSync(f, "utf8");
  if (!/isPremade\s*\(/.test(src)) {
    t(`${f} — isPremade 를 쓰지 않는다(검사 대상 아님)`, true);
    continue;
  }
  /* 그 파일 안의 모든 select("…") 를 모아, 어느 하나라도 두 칸을 다 갖고 있으면 통과 */
  const selects = [...src.matchAll(/\.select\(\s*"([^"]*)"/g)].map((m) => m[1]);
  const ok = selects.some((sel) => NEEDED.every((c) => sel.includes(c)));
  t(
    `${f} — select 에 owner_id·anon_id 가 있다`,
    ok,
    ok ? "" : `읽고 있는 칸: ${selects.map((s) => `"${s}"`).join(" / ") || "(select 없음)"}`,
  );
}

console.log("\n── 자물쇠 자체가 두 칸에 기대고 있는지 ──");
const premade = readFileSync("lib/premade.ts", "utf8");
t("isPremade 가 owner_id 를 본다", premade.includes("owner_id"));
t("isPremade 가 anon_id 를 본다", premade.includes("anon_id"));

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
