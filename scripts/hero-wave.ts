/**
 * 히어로 웨이브 — 방(현관·거실·주방·침실·욕실)별로 장수를 정확히 맞춰 히어로를 뽑는다.
 * 실행: npx tsx scripts/hero-wave.ts   (자식이 --env-file 로 .env.local 을 읽는다)
 *
 * bank-wave.ts 와 다른 점: 셀의 축이 (역할×업종) 이 아니라 **interior 의 씬(=방)** 이다.
 * 히어로는 업종을 가리지 않고 "한국 아파트 인테리어 결과물"만 보여주면 되고,
 * 대신 방 종류의 비율이 중요하다(현관 12 / 거실 12 / 주방 10 / 침실 8 / 욕실 8).
 *
 *   --total 50        전체 목표 장수
 *   --call-budget 50  전체 API 호출(과금) 상한. 이 값을 넘는 호출은 절대 하지 않는다.
 *   --model gemini-3-pro-image
 *   --imagesize 2K    2K 는 1K 와 장당 단가가 같다(2026-09-06 실측)
 *   --sleep 7000
 *   --dry             과금 없이 조합만 확인
 *
 * ⚠ 예산에 여유분이 없다(50장 목표 · 50호출 상한). 중복 스킵이 나면 그만큼 덜 나온다 —
 *   정상이다. 끝나고 실제 등록 장수를 보고 모자라면 이어서 돌리면 된다(중복은 자동으로 걸러진다).
 */
import { spawn } from "child_process";
import { appendFileSync, writeFileSync } from "fs";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(`--${n}`);

const TOTAL = parseInt(arg("total", "50"), 10);
const CALL_BUDGET = parseInt(arg("call-budget", "50"), 10);
const MODEL = arg("model", "gemini-3-pro-image");
const IMAGE_SIZE = arg("imagesize", "2K");
const SLEEP = arg("sleep", "7000");
const LOG = arg("log", "hero-wave.log");
const FULL = arg("full-log", "hero-wave-full.log");
const DRY = has("dry");
const COST_PER_CALL = MODEL.includes("pro") ? 0.134 : 0.039;

/** config/bank-prompts.ts 의 INDUSTRY_SCENES.interior 순서. 바뀌면 여기도 고쳐야 한다. */
const ROOMS = [
  { scene: 4, label: "현관·복도", count: 12 },
  { scene: 0, label: "거실", count: 12 },
  { scene: 1, label: "주방", count: 10 },
  { scene: 2, label: "침실", count: 8 },
  { scene: 3, label: "욕실", count: 8 },
];
// 밝은·따뜻한·차분한 — 자식이 셔플해 한 방 안에서 섞인다
const MOODS = "clean,warm,premium";

const started = Date.now();
const stamp = () => new Date().toLocaleString("sv");
function log(line: string) { const s = `[${stamp()}] ${line}`; console.log(s); appendFileSync(LOG, s + "\n", "utf8"); }
function full(chunk: string) { appendFileSync(FULL, chunk, "utf8"); }

let created = 0, dups = 0, fails = 0, calls = 0, cellsDone = 0;
let finished = false;
let child: import("child_process").ChildProcess | null = null;
const perRoom: string[] = [];

function finish(status: string, detail: string) {
  if (finished) return;
  finished = true;
  if (child && child.pid && child.exitCode === null) {
    try {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
      else child.kill("SIGTERM");
    } catch { /* 이미 죽었으면 무시 */ }
  }
  const mins = Math.round((Date.now() - started) / 60000);
  log("─".repeat(60));
  log(`${status} · ${detail}`);
  for (const r of perRoom) log(`  ${r}`);
  log(`등록 ${created}/${TOTAL}장 · 중복스킵 ${dups} · 실패 ${fails} · API호출 ${calls}/${CALL_BUDGET} · 실비용 $${(calls * COST_PER_CALL).toFixed(2)} · 소요 ${mins}분 · 셀 ${cellsDone}/${ROOMS.length}`);
  log(`상세 원문: ${FULL} · 승인은 /admin/bank 에서 (전부 검수 대기 상태다)`);
}

process.on("SIGINT", () => { finish("⛔ 중단", "사용자 강제 종료(SIGINT)"); process.exit(130); });
process.on("SIGTERM", () => { finish("⛔ 중단", "종료 신호(SIGTERM)"); process.exit(143); });
process.on("uncaughtException", (e) => { finish("⛔ 중단", `러너 예외 — ${(e as Error).message}`); process.exit(1); });

type CellResult = { created: number; dups: number; fails: number; apiCalls: number; abort: string | null };

function runCell(scene: number, count: number, limit: number): Promise<CellResult> {
  return new Promise((resolve) => {
    const args = ["tsx", "--env-file=.env.local", "scripts/bank-generate.ts",
      "--model", MODEL, "--imagesize", IMAGE_SIZE,
      "--industries", "interior", "--roles", "hero", "--moods", MOODS,
      "--scenes", String(scene), "--count", String(count), "--sleep", SLEEP];
    if (DRY) args.push("--dry"); else args.push("--limit", String(limit));
    const p = spawn("npx", args, { shell: true });
    child = p;
    let out = "";
    p.stdout.on("data", (d) => { out += d; full(d.toString()); });
    p.stderr.on("data", (d) => { out += d; full(d.toString()); });
    p.on("close", (code) => {
      child = null;
      const jsonLine = out.trim().split("\n").reverse().find((l) => l.trim().startsWith("{"));
      if (!jsonLine) { resolve({ created: 0, dups: 0, fails: 1, apiCalls: 0, abort: `요약 없음(exit ${code})` }); return; }
      try {
        const r = JSON.parse(jsonLine.trim());
        resolve({ created: r.created ?? 0, dups: r.dups ?? 0, fails: r.fails ?? 0, apiCalls: r.apiCalls ?? 0, abort: r.abort ?? null });
      } catch { resolve({ created: 0, dups: 0, fails: 1, apiCalls: 0, abort: `요약 파싱 실패(exit ${code})` }); }
    });
  });
}

async function main() {
  writeFileSync(LOG, "", "utf8"); writeFileSync(FULL, "", "utf8");
  log(`히어로 웨이브 시작 — 목표 ${TOTAL}장 · 모델 ${MODEL} · ${IMAGE_SIZE} · 16:9 가로${DRY ? " · [DRY]" : ""}`);
  log(`방 구성: ${ROOMS.map((r) => `${r.label} ${r.count}`).join(" / ")} · 무드 ${MOODS}`);
  log(`호출 예산 ${CALL_BUDGET}회 = 최대 $${(CALL_BUDGET * COST_PER_CALL).toFixed(2)}`);
  log(`[쿼터] Vertex 이미지 생성은 프로젝트당 분당 2회가 상한이다 — 느린 건 설정 문제가 아니다. 50장에 40~60분 걸린다.`);
  log(`[읽는 법] 맨 아래 "✅ 완료" 또는 "⛔ 중단" 블록이 결론이다. 방마다 한 줄씩 찍힌다.`);
  log("─".repeat(60));

  for (const room of ROOMS) {
    if (created >= TOTAL) { finish("✅ 완료", `목표 ${TOTAL}장 달성`); return; }
    const remainingBudget = CALL_BUDGET - calls;
    if (!DRY && remainingBudget <= 0) { finish("⛔ 중단", `호출 예산 ${CALL_BUDGET}회 소진`); return; }

    const count = Math.min(room.count, TOTAL - created);
    const limit = Math.min(count, remainingBudget);
    if (!DRY && limit < 1) { finish("⛔ 중단", `호출 예산 부족(남은 ${remainingBudget}회)`); return; }

    log(`▶ ${room.label} — 목표 ${count}장 (호출 상한 ${DRY ? "-" : limit})`);
    const r = await runCell(room.scene, count, limit);
    created += r.created; dups += r.dups; fails += r.fails; calls += r.apiCalls; cellsDone++;
    perRoom.push(`${room.label}: ${r.created}/${count}장 · 중복 ${r.dups} · 실패 ${r.fails} · 호출 ${r.apiCalls}`);
    log(`◀ ${room.label} 끝 — ${r.created}장 · 중복 ${r.dups} · 실패 ${r.fails} · 누적 ${created}/${TOTAL}장 · 호출 ${calls}/${CALL_BUDGET} · $${(calls * COST_PER_CALL).toFixed(2)}`);

    // 자식이 안전장치로 멈췄으면 웨이브 전체를 멈춘다. '--limit 도달'은 그 셀의 정상 종료다.
    if (r.abort && !r.abort.includes("--limit")) {
      finish("⛔ 중단", `안전장치 발동 — ${r.abort} (${room.label})`);
      return;
    }
  }
  finish(created >= TOTAL ? "✅ 완료" : "⚠️ 예산 내 종료", created >= TOTAL ? `목표 ${TOTAL}장 달성` : `${created}장에서 끝남(중복 ${dups}장만큼 덜 나왔다 — 이어서 돌리면 채워진다)`);
}

main();
