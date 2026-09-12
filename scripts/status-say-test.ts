/**
 * SNS 상태 번역 검사 — ★ **영어가 한 글자도 안 새는지**가 이 검사의 핵심이다.
 * (2026-09-12 회장님 지시 D4). 실패하면 종료코드 1.
 */
import { sayPost, josa, AUTO_RETRIES } from "../lib/sns/status-say";
import { ERROR_KINDS, ERROR_SAY } from "../lib/sns/types";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ❌ ${name}\n       기대 ${w}\n       실제 ${g}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

console.log("── 줄을 그릴까 말까 ──");
/* ★ 「안 올림」과 「안 됨」은 다르다. 기록이 없으면 줄 자체를 안 그린다 —
   회색으로 「안 올림」이라 쓰면 그것이 실패처럼 읽힌다 */
t("기록이 없으면 줄을 안 그린다", sayPost({ provider: "instagram" }), null);
t("취소된 것도 안 그린다", sayPost({ provider: "instagram", status: "canceled" }), null);

console.log("\n── 잘된 것 ──");
t("올라갔고 주소가 있으면 [보기]",
  sayPost({ provider: "instagram", status: "published", url: "https://x" }),
  { tone: "good", text: "올라갔어요", action: "보기" });
t("주소가 없으면 [보기]를 안 준다 — 없는 링크를 보여 주지 않는다",
  sayPost({ provider: "instagram", status: "published", url: null }),
  { tone: "good", text: "올라갔어요", action: undefined });
/* ★ 「지워졌다」는 **확인된 것만** 말한다. 확인 못 한 것은 아무 말도 하지 않는다 */
t("그쪽에서 지워진 것이 확인되면 그렇게 말한다",
  sayPost({ provider: "instagram", status: "published", deletedAt: "2026-09-12T00:00:00Z" }),
  { tone: "wait", text: "올렸는데, 지금은 그쪽에서 지워졌어요" });

console.log("\n── 기다리는 것 ──");
t("순서 대기", sayPost({ provider: "youtube", status: "queued" }), { tone: "wait", text: "순서를 기다리고 있어요" });
/* ★ processing 과 uploading 을 합친다 — 사장님에게 둘의 차이는 없다 */
t("uploading 은 「올리는 중…」", sayPost({ provider: "youtube", status: "uploading" })?.text, "올리는 중…");
t("processing 도 같은 말", sayPost({ provider: "youtube", status: "processing" })?.text, "올리는 중…");

console.log("\n── 실패 네 갈래 ──");
t("연결 풀림 → 버튼 이름이 화면과 «글자까지» 같아야 한다",
  sayPost({ provider: "instagram", status: "failed", errorKind: "AUTH_EXPIRED" }),
  { tone: "bad", text: "연결이 풀렸어요", action: "다시 연결하기" });
t("한도 초과는 «나쁨»이 아니라 «기다림»이다",
  sayPost({ provider: "youtube", status: "failed", errorKind: "QUOTA_EXCEEDED" }),
  { tone: "wait", text: "오늘 자리가 차서 내일 올라갑니다" });
t("거절은 SNS 이름을 넣어 말한다",
  sayPost({ provider: "instagram", status: "failed", errorKind: "REJECTED" })?.text,
  "인스타그램 릴스가 이 영상을 받지 않았어요");
t("잠깐 그런 것은 «다시 해보는 중»",
  sayPost({ provider: "instagram", status: "failed", errorKind: "TRANSIENT", attempts: 1 })?.text,
  `다시 해보는 중 (1/${AUTO_RETRIES})`);
t("세 번을 넘기면 사람이 눌러야 한다",
  sayPost({ provider: "instagram", status: "failed", errorKind: "TRANSIENT", attempts: 3 }),
  { tone: "bad", text: "안 올라갔어요", action: "다시 시도" });
/* ⚠ 모르는 이유가 와도 영어를 보여 주면 안 된다 */
t("모르는 실패 이유는 «잠깐 그런 것»으로 다룬다",
  sayPost({ provider: "instagram", status: "failed", errorKind: "SOMETHING_NEW", attempts: 0 })?.text,
  `다시 해보는 중 (1/${AUTO_RETRIES})`);
t("모르는 상태 글자도 그대로 안 보여 준다",
  sayPost({ provider: "instagram", status: "weird_new_status" })?.text, "확인 중이에요");

console.log("\n── 조사 (받침) ──");
t("받침 없으면 «가»", josa("인스타그램 릴스", "이/가"), "가");
t("받침 있으면 «이»", josa("틱톡", "이/가"), "이");
/* ⚠ 한글이 아닌 이름(X)으로 끝나면 받침 없음으로 본다 — 「X가」가 자연스럽다 */
t("한글이 아니면 받침 없음", josa("X", "이/가"), "가");
t("은/는 도 같은 규칙", josa("유튜브 쇼츠", "은/는"), "는");
t("을/를 도 같은 규칙", josa("틱톡", "을/를"), "을");

console.log("\n── ★★ 영어가 새는지 (이 검사가 핵심이다) ──");
const HANGUL_OK = /^[^A-Za-z]*$/;                 // 영문자가 하나도 없어야 한다
const cases = [
  { provider: "instagram", status: "published" },
  { provider: "instagram", status: "published", deletedAt: "z" },
  { provider: "instagram", status: "queued" },
  { provider: "instagram", status: "uploading" },
  { provider: "instagram", status: "processing" },
  { provider: "instagram", status: "weird_new_status" },
  ...ERROR_KINDS.map((k) => ({ provider: "instagram", status: "failed", errorKind: k, attempts: 9 })),
  ...ERROR_KINDS.map((k) => ({ provider: "youtube", status: "failed", errorKind: k, attempts: 0 })),
  ...ERROR_KINDS.map((k) => ({ provider: "tiktok", status: "failed", errorKind: k, attempts: 9 })),
  { provider: "instagram", status: "failed", errorKind: "TOTALLY_UNKNOWN", attempts: 5 },
];
let leaked = 0;
for (const c of cases) {
  const said = sayPost(c);
  if (!said) continue;
  if (!HANGUL_OK.test(said.text)) { console.log(`  ❌ 영어가 샜다: «${said.text}»`); leaked++; }
  if (said.action && !HANGUL_OK.test(said.action)) { console.log(`  ❌ 버튼에 영어: «${said.action}»`); leaked++; }
}
t(`상태 ${cases.length}가지 어디에도 영문자가 없다`, leaked, 0);

/* ★ 실패 이유 넷의 «긴 설명»에도 영어가 없어야 한다 */
let longLeak = 0;
for (const k of ERROR_KINDS) if (!HANGUL_OK.test(ERROR_SAY[k])) longLeak++;
t("실패 이유 네 문장에도 영문자가 없다", longLeak, 0);

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
