/**
 * 유튜브 «문» 검사 — ★ **되돌릴 수 없는 일**을 막는 자리라 검사가 제일 촘촘해야 한다.
 * (2026-09-12 상무님 지적) 실패하면 종료코드 1.
 *
 * 지켜야 하는 사실 하나:
 *   감사 통과 «전»에 올린 영상은 유튜브가 비공개로 잠그고, **그 잠김은 항소할 수 없다.**
 *   그러니 이 검사가 초록이 아니면 **유튜브를 열면 안 된다.**
 */
import { canUpload, canSaveGate, readGateValue, GATE_DEFAULT } from "../lib/sns/youtube-gate";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ❌ ${name}\n       기대 ${w}\n       실제 ${g}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

const OURS = "site-onstori-official";
const BOSS = "site-사장님";

console.log("── 저장된 값 읽기 — 애매하면 «닫힘» ──");
t("줄이 없으면 닫힘", readGateValue(null), GATE_DEFAULT);
t("빈 값도 닫힘", readGateValue({}), GATE_DEFAULT);
t("모르는 mode 는 닫힘", readGateValue({ mode: "OPEN" }).mode, "off");
/* ⚠ 실수로 켜지는 길을 막는다 — 문자열 "true" 나 1 로는 안 켜진다 */
t("auditPassed 는 진짜 true 만 인정", readGateValue({ auditPassed: "true" }).auditPassed, false);
t("auditPassed 1 도 안 켠다", readGateValue({ auditPassed: 1 }).auditPassed, false);
t("auditPassed true 는 켜진다", readGateValue({ auditPassed: true }).auditPassed, true);
t("allowSites 가 배열이 아니면 빈 목록", readGateValue({ allowSites: "a,b" }).allowSites, []);
t("allowSites 안의 쓰레기는 버린다", readGateValue({ allowSites: [OURS, "", 3, null] }).allowSites, [OURS]);

console.log("\n── off — 아무도 못 올린다 ──");
t("off 는 우리도 못 올린다", canUpload(readGateValue({ mode: "off", allowSites: [OURS] }), OURS).ok, false);

console.log("\n── review — ★ 허용 목록에 «있는 곳만» ──");
const review = readGateValue({ mode: "review", allowSites: [OURS] });
t("우리 사이트는 올린다 — 비공개로", canUpload(review, OURS), {
  ok: true, privacy: "private",
  note: "지금은 준비 기간이라 «비공개»로 올라갔어요. 사장님 유튜브에서는 보이지만 손님에게는 아직 안 보입니다.",
});
/* ★★★ 이 한 줄이 이번 지시의 핵심이다. 여기가 뚫려 있었다 —
   고치기 «전»에는 allowSites 를 아예 안 봐서, review 로 켜는 순간 모든 사장님이 올릴 수 있었다. */
t("★★ 사장님 사이트는 **못 올린다** (올리면 그 영상이 영영 죽는다)", canUpload(review, BOSS).ok, false);
t("사장님에게는 「준비 중」이라고만 말한다", canUpload(review, BOSS).ok === false && canUpload(review, BOSS).why.startsWith("유튜브는 준비 중"), true);
t("운영자에게는 진짜 이유를 남긴다", !!(canUpload(review, BOSS) as { operator?: string }).operator, true);
t("허용 목록이 비어 있으면 아무도 못 올린다", canUpload(readGateValue({ mode: "review" }), OURS).ok, false);

console.log("\n── on — ★ 감사 통과 표시가 없으면 «아무도» 못 올린다 ──");
const onNoAudit = readGateValue({ mode: "on" });
/* ★★★ 상무님이 찾은 자리. 게이트만 켜고 감사 표시를 안 켜면 올라간 영상이 전부 죽는다 */
t("★★ on 인데 감사 표시가 없으면 막는다", canUpload(onNoAudit, BOSS).ok, false);
t("그때도 운영자에게 이유를 남긴다", !!(canUpload(onNoAudit, BOSS) as { operator?: string }).operator, true);
t("허용 목록에 있어도 막는다 (감사가 먼저다)",
  canUpload(readGateValue({ mode: "on", allowSites: [OURS] }), OURS).ok, false);

const onAudited = readGateValue({ mode: "on", auditPassed: true });
t("감사 통과 표시가 있으면 공개로 올린다", canUpload(onAudited, BOSS), { ok: true, privacy: "public" });
t("그때는 허용 목록이 없어도 모두에게 열린다", canUpload(onAudited, "아무나").ok, true);

console.log("\n── ★ 저장 자체를 막는다 (2026-09-13 지시 2) ──");
/* ⚠ 「정식 공개」인데 감사 표시가 없으면 **저장도 안 된다.** 업로드만 막으면
   화면에 «정식 공개»라고 적힌 채 아무도 못 올리는 이상한 상태가 남고,
   그것을 본 사람이 «감사 표시를 확인 없이 켜는» 사고를 낸다. */
t("on + 감사 없음 → 저장 거절", canSaveGate(readGateValue({ mode: "on" })).ok, false);
t("on + 감사 통과 → 저장된다", canSaveGate(readGateValue({ mode: "on", auditPassed: true })).ok, true);
t("off 는 언제나 저장된다", canSaveGate(readGateValue({ mode: "off" })).ok, true);
/* ★ review 는 «비공개로만» 올리므로 이 위험과 무관하다 (2026-09-13 김팀장 확인) */
t("review 는 감사 없이도 저장된다 — 비공개라 안전하다",
  canSaveGate(readGateValue({ mode: "review", allowSites: [OURS] })).ok, true);
/* ★ 거절 문구가 「냈다 ≠ 통과했다」를 말해야 한다 — 그 착각이 사고의 8할이다 */
const no = canSaveGate(readGateValue({ mode: "on" }));
t("거절 문구가 «낸 것»과 «통과»를 구분해 말한다", !no.ok && no.why.includes("낸 것"), true);

console.log("\n── ★ 열리는 길은 «딱 두 갈래»뿐이다 ──");
/* 어떤 값 조합에서도 ok:true 가 나오는 경우를 전부 세어 본다. 늘어나면 검사가 잡는다 */
const MODES = ["off", "review", "on", "이상한값"];
const ALLOWS = [[], [OURS]];
const AUDITS = [true, false, "true", 1, undefined];
const opened: string[] = [];
for (const mode of MODES) for (const allowSites of ALLOWS) for (const auditPassed of AUDITS) {
  for (const who of [OURS, BOSS]) {
    const v = canUpload(readGateValue({ mode, allowSites, auditPassed }), who);
    if (v.ok) opened.push(`${mode}/${allowSites.length}/${String(auditPassed)}/${who === OURS ? "우리" : "사장님"}→${v.privacy}`);
  }
}
console.log("  열린 조합:", opened.join(" · ") || "(없음)");
t("열리는 조합은 «review+허용목록=비공개» 와 «on+감사통과=공개» 뿐",
  opened.every((x) => x.endsWith("우리→private") || (x.startsWith("on/") && x.includes("/true/") && x.endsWith("→public"))), true);
t("사장님 사이트가 비공개로 열리는 조합은 하나도 없다",
  opened.some((x) => x.includes("사장님→private")), false);

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
