/**
 * **넘겨주기 열쇠가 아무에게나 안 열리는지** 검사한다. (2026-09-13 지시 B3)
 *
 * ★★ 왜 중요한가: 이 열쇠를 아는 사람이 곧 **그 홈페이지의 주인**이 된다.
 *   서명이 새면 남의 홈페이지를 가져갈 수 있다. 되돌리기 어려운 일이라 꼼꼼히 잰다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다 — 서명 계산만 잰다.
 */
process.env.STORY_LINK_SECRET ||= "test-secret-for-handover-check";

import { HANDOVER_DAYS, dayIndex, handoverUrl, signHandover, verifyHandover } from "../lib/handover";
import { signStoryLink } from "../lib/story-link";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`  ❌ ${name}\n       기대 ${JSON.stringify(want)}\n       실제 ${JSON.stringify(got)}`); bad++;
  } else console.log(`  ✅ ${name}`);
};

const today = dayIndex();

console.log("── 제대로 된 열쇠는 연다 ──");
t("오늘 뽑은 열쇠", verifyHandover("interior2", signHandover("interior2")), true);
t(`${HANDOVER_DAYS}일 전 열쇠 — 아직 산다`,
  verifyHandover("interior2", signHandover("interior2", today - HANDOVER_DAYS)), true);

console.log("\n── 기간이 지나면 죽는다 ──");
t(`${HANDOVER_DAYS + 1}일 전 열쇠 — 죽었다`,
  verifyHandover("interior2", signHandover("interior2", today - HANDOVER_DAYS - 1)), false);
/* ⚠ 서버 시계가 앞서면 «영원히 사는 열쇠»가 나온다. 앞날짜는 무조건 막는다 */
t("★ 앞날짜로 뽑은 열쇠 — 막는다", verifyHandover("interior2", signHandover("interior2", today + 1)), false);

console.log("\n── 남의 열쇠로는 못 연다 ──");
t("★ 다른 홈페이지의 열쇠", verifyHandover("interior2", signHandover("banchan")), false);
t("서명을 한 글자 바꾼 것", verifyHandover("interior2", signHandover("interior2").slice(0, -1) + "0"), false);
t("서명이 아예 없다", verifyHandover("interior2", ""), false);
t("열쇠가 null", verifyHandover("interior2", null), false);
t("날짜만 있고 서명이 없다", verifyHandover("interior2", `${today}.`), false);
t("서명 길이가 짧다", verifyHandover("interior2", `${today}.abc`), false);

console.log("\n── 녹화 링크와 섞이지 않는다 ──");
/* ★★ 둘이 같은 비밀을 쓴다. 서명 문구가 같으면 **녹화 링크가 넘겨주기 열쇠로 둔갑**한다.
   녹화 링크는 사장님께 매주 문자로 나간다 — 섞이면 그 문자가 곧 소유권 양도 링크가 된다. */
t("★ 녹화 링크로는 못 가져간다", verifyHandover("interior2", signStoryLink("interior2")), false);

console.log("\n── 주소가 이상하면 아예 안 본다 ──");
t("대문자 slug", verifyHandover("Interior2", signHandover("Interior2")), false);
t("경로 문자가 섞인 slug", verifyHandover("../admin", signHandover("../admin")), false);
t("빈 slug", verifyHandover("", "x"), false);

console.log("\n── 링크 모양 ──");
t("주소가 /claim 로 간다", handoverUrl("interior2").startsWith("https://onstori.com/claim/interior2?k="), true);

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
