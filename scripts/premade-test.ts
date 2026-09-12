/**
 * **미리 만들어 둔 홈페이지에 문자가 안 나가는지** 검사한다. (2026-09-13 지시 A4)
 *
 * ★★ 왜 이 검사가 제일 중요한가: 위저드가 네이버·카카오에서 **그 가게의 진짜 번호**를
 *   불러와 넣는다. 자물쇠가 하나라도 새면 **계약도 안 한 가게에 우리 이름으로 문자**가 간다.
 *   되돌릴 수 없는 일이라, 이 검사가 초록이 아니면 크론을 켜면 안 된다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다. 순수 함수만 잰다 — 몇 번이고 돌려도 안전하다.
 */
import { isPremade, premadeReason } from "../lib/premade";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`  ❌ ${name}\n       기대 ${JSON.stringify(want)}\n       실제 ${JSON.stringify(got)}`); bad++;
  } else console.log(`  ✅ ${name}`);
};

console.log("── ★ 자물쇠 ① 운영자 표시 (진짜 자물쇠) ──");
/* ★★ 이것이 핵심이다. 회장님이 브라우저로 만들면 anon_id 가 붙어서
   「주인이 아무도 없다」 조건에는 **안 걸린다**. 그래서 표시가 필요하다. */
t("★ 운영자가 만든 것 — 익명표가 있어도 막는다",
  isPremade({ owner_id: null, anon_id: "브라우저표", settings: { premade: true, phone: "010-1111-2222" } }), true);
t("그 이유를 말한다",
  premadeReason({ owner_id: null, anon_id: "브라우저표", settings: { premade: true } }), "운영자가 미리 만든 곳(premade)");

console.log("\n── 자물쇠 ② 주인이 아무도 없는 곳 (씨앗 스크립트) ──");
t("둘 다 없으면 막는다", isPremade({ owner_id: null, anon_id: null, settings: {} }), true);
t("그 이유를 말한다", premadeReason({ owner_id: null, anon_id: null }), "주인이 아무도 없는 곳");

console.log("\n── 진짜 사장님에게는 그대로 나간다 ──");
t("익명표만 있는 진짜 사장님 — 나간다",
  isPremade({ owner_id: null, anon_id: "사장님브라우저", settings: { phone: "010-9999-8888" } }), false);
t("계정이 붙은 사장님 — 나간다",
  isPremade({ owner_id: "계정", anon_id: null, settings: {} }), false);
/* ★ 사장님이 가져가면(claim) owner_id 가 붙고 표시를 뗀다 → 그때부터 나간다 */
t("가져간 뒤(표시를 뗌) — 나간다",
  isPremade({ owner_id: "계정", anon_id: "브라우저표", settings: { premade: false } }), false);

console.log("\n── 애매하면 «안 보내는 쪽» ──");
t("설정이 아예 없어도 주인이 없으면 막는다", isPremade({ settings: null }), true);
/* ⚠ 문자열 "true" 로는 안 켜진다 — 실수로 막히는 것은 괜찮지만 실수로 «열리면» 안 된다 */
t("표시가 문자열이면 그 조건으론 안 막지만, 주인이 있으면 나간다",
  isPremade({ owner_id: "계정", anon_id: null, settings: { premade: "true" } }), false);

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
