import { shouldSend, nowInSeoul, type Weekly } from "../lib/weekly";

/** 주 1회 알림 판정 검사 — 실패하면 종료코드 1 (2026-09-12) */
const KST = (iso: string) => new Date(iso);   // iso 에 +09:00 을 직접 적는다
let bad = 0;
let done = 0;
const t = (name: string, got: boolean, want: boolean) => {
  done++;
  if (got !== want) { console.log(`  ❌ ${name} — 기대 ${want}, 실제 ${got}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

const base: Weekly = { on: true, channel: "kakao", weekday: 2, hour: 15 }; // 화요일 오후 3시

console.log("── 기본 동작 ──");
/* ★ 2026-09-12 규칙이 바뀌었다 — 「그 시각이 지났는가」가 아니라 「오늘이 그 요일인가」다.
   크론이 하루 한 번(한국 09:00)만 돌기 때문이다. 시각은 지킬 수 없는 약속이라 보지 않는다. */
t("화 09시(크론 시각) — 그날이니 보낸다", shouldSend(base, KST("2026-09-15T09:00:00+09:00")), true);
t("화 14시 — 그날이니 보낸다", shouldSend(base, KST("2026-09-15T14:00:00+09:00")), true);
t("화 16시 — 그날이니 보낸다", shouldSend(base, KST("2026-09-15T16:00:00+09:00")), true);
t("수 09시 — 지났으니 따라잡는다", shouldSend(base, KST("2026-09-16T09:00:00+09:00")), true);
t("월 23시 — 아직 그 요일 전", shouldSend(base, KST("2026-09-14T23:00:00+09:00")), false);

console.log("\n── ★ 고친 결함 둘 (2026-09-12 회장님 지적) ──");
/* ① 고른 요일보다 «하루 늦게» 가던 것.
   화요일 15시를 골랐는데 크론은 화요일 09:00 에 돈다 —
   옛 규칙은 「아직 15시가 안 됐다」며 건너뛰고 **수요일**에 보냈다. */
t("★① 화요일 09시 크론에서 «그 주 화요일»에 나간다", shouldSend(base, KST("2026-09-15T09:00:00+09:00")), true);

/* ② 토요일 늦은 시각을 고른 사장님에게 «영영» 안 가던 것.
   그 주 마지막 실행은 토 09:00 인데 아직 10시가 아니라 건너뛰고,
   다음 실행(일 09:00)에는 주가 바뀌어 계산이 0부터 다시 시작했다. */
const sat: Weekly = { on: true, channel: "kakao", weekday: 6, hour: 10 };  // 토요일 오전 10시
t("★② 토요일 09시 크론에서 나간다 (전에는 영영 안 갔다)", shouldSend(sat, KST("2026-09-19T09:00:00+09:00")), true);
const satLate: Weekly = { on: true, channel: "kakao", weekday: 6, hour: 23 }; // 토요일 밤 11시
t("★② 토요일 밤 시각을 골라도 그 주에 나간다", shouldSend(satLate, KST("2026-09-19T09:00:00+09:00")), true);
t("★② 금요일에는 아직 안 나간다", shouldSend(sat, KST("2026-09-18T09:00:00+09:00")), false);

console.log("\n── 주 경계 (일요일 00:00 KST) ──");
const sunPick: Weekly = { on: true, channel: "kakao", weekday: 0, hour: 9 };  // 일요일
t("일요일 — 그날이니 보낸다", shouldSend(sunPick, KST("2026-09-20T09:00:00+09:00")), true);
const sunSent: Weekly = { ...sunPick, lastSentAt: "2026-09-20T09:00:00+09:00" };
t("같은 주 토요일 — 이미 보냈으니 안 보낸다", shouldSend(sunSent, KST("2026-09-26T09:00:00+09:00")), false);
t("다음 주 일요일 — 주가 바뀌었으니 보낸다", shouldSend(sunSent, KST("2026-09-27T09:00:00+09:00")), true);

console.log("\n── 두 번 보내지 않는다 ──");
const sent: Weekly = { ...base, lastSentAt: "2026-09-15T09:00:00+09:00" };
t("보낸 1시간 뒤 — 안 보낸다", shouldSend(sent, KST("2026-09-15T10:00:00+09:00")), false);
t("보낸 다음날 — 안 보낸다", shouldSend(sent, KST("2026-09-16T09:00:00+09:00")), false);
t("보낸 4일 뒤(같은 주 토) — 안 보낸다", shouldSend(sent, KST("2026-09-19T09:00:00+09:00")), false);
/* ★ 주는 바뀌었지만 «고른 요일(화)»이 아직 안 왔다 — 안 보내는 것이 맞다.
   ⚠ 이 줄은 내가 처음에 기대값을 true 로 잘못 적었다가 검사에 걸린 자리다. 검사가 사람을 잡았다. */
t("다음 주 일요일 — 주는 바뀌었지만 아직 화요일 전이라 안 보낸다", shouldSend(sent, KST("2026-09-20T09:00:00+09:00")), false);
t("★ 다음 주 화요일 — 보낸다 (옛 6일 규칙에서도 됐지만, 주 경계로도 맞다)", shouldSend(sent, KST("2026-09-22T09:00:00+09:00")), true);
t("보낸 7일 뒤(다음 주 화) — 보낸다", shouldSend(sent, KST("2026-09-22T09:00:00+09:00")), true);

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

/* ⚠ 개수를 손으로 적지 않는다 — 검사를 늘려 놓고 숫자를 안 고치면 그 숫자가 거짓말한다.
   실제로 2026-09-12 에 그랬다(9건을 더했는데 「15건」이라고 찍혔다). */
console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exit(bad ? 1 : 0);
