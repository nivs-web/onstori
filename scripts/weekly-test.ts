import { shouldSend, nowInSeoul, type Weekly } from "../lib/weekly";

/** 주 1회 알림 판정 검사 — 실패하면 종료코드 1 (2026-09-12) */
const KST = (iso: string) => new Date(iso);   // iso 에 +09:00 을 직접 적는다
let bad = 0;
const t = (name: string, got: boolean, want: boolean) => {
  if (got !== want) { console.log(`  ❌ ${name} — 기대 ${want}, 실제 ${got}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

const base: Weekly = { on: true, channel: "kakao", weekday: 2, hour: 15 }; // 화요일 오후 3시

console.log("── 기본 동작 ──");
t("화 14시 — 아직 안 됨", shouldSend(base, KST("2026-09-15T14:00:00+09:00")), false);
t("화 15시 — 보낸다", shouldSend(base, KST("2026-09-15T15:00:00+09:00")), true);
t("화 16시 — (하루1회 크론 대비) 지났으니 보낸다", shouldSend(base, KST("2026-09-15T16:00:00+09:00")), true);
t("수 07시 — 지났으니 보낸다(하루1회 크론)", shouldSend(base, KST("2026-09-16T07:00:00+09:00")), true);
t("월 23시 — 아직 그 요일 전", shouldSend(base, KST("2026-09-14T23:00:00+09:00")), false);

console.log("\n── 두 번 보내지 않는다 ──");
const sent: Weekly = { ...base, lastSentAt: "2026-09-15T15:00:00+09:00" };
t("보낸 1시간 뒤 — 안 보낸다", shouldSend(sent, KST("2026-09-15T16:00:00+09:00")), false);
t("보낸 다음날 — 안 보낸다", shouldSend(sent, KST("2026-09-16T07:00:00+09:00")), false);
t("보낸 5일 뒤 — 아직 안 보낸다", shouldSend(sent, KST("2026-09-20T07:00:00+09:00")), false);
t("보낸 7일 뒤(다음 주 화) — 보낸다", shouldSend(sent, KST("2026-09-22T15:00:00+09:00")), true);

console.log("\n── 거부·미설정 ──");
t("거부(on:false) — 안 보낸다", shouldSend({ ...base, on: false }, KST("2026-09-15T15:00:00+09:00")), false);
t("설정 없음(undefined) — 안 보낸다", shouldSend(undefined, KST("2026-09-15T15:00:00+09:00")), false);

console.log("\n── 한국 시각 계산 ──");
const n = nowInSeoul(KST("2026-09-15T15:30:00+09:00"));
t("화요일로 읽는다", n.weekday === 2, true);
t("15시로 읽는다", n.hour === 15, true);
const utc = nowInSeoul(new Date("2026-09-15T22:00:00Z")); // = 한국 16일 07시(수)
t("UTC 22시 → 한국 수요일", utc.weekday === 3, true);
t("UTC 22시 → 한국 07시", utc.hour === 7, true);

console.log(`\n검사 ${15}건 · 실패 ${bad}건`);
process.exit(bad ? 1 : 0);
