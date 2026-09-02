/**
 * 이미지뱅크 웨이브 러너 — bank-generate.ts를 (역할×업종) 셀 단위로 나눠 돌린다.
 * 실행: npx tsx scripts/bank-wave.ts [옵션]        (자식이 --env-file로 .env.local을 읽는다)
 *
 * 왜 나눠 도는가: bank-generate는 전체 조합을 셔플해 앞에서부터 뽑으므로, 업종마다
 * scene 수가 1~5로 달라 interior가 rental보다 5배 뽑힌다. 셀마다 같은 장수를 지정하면
 * 역할·업종 양쪽이 정확히 균등해진다. bank-generate 자체는 수정하지 않는다.
 *
 *   --total 500        전체 목표 등록 장수
 *   --roles gallery,about,process
 *   --industries ...   (기본: config/industries.ts 전체)
 *   --per-cell 12      셀당 목표 장수
 *   --call-budget 560  전체 API 호출(과금) 상한 — 셀 --limit의 합이 이걸 못 넘는다
 *   --headroom 6       셀당 여유 호출(중복 스킵·실패분). 셀 limit = count + headroom
 *   --model gemini-3.1-flash-image
 *   --sleep 7000       자식에게 넘기는 호출 간격 ms
 *   --log wave-progress.log     한눈에 보는 진행 로그
 *   --full-log wave-full.log    자식 원문 전체
 *   --dry              API 호출 없이 오케스트레이션만 확인
 *
 * 안전장치: 자식의 3종(--limit·연속 실패 5회·429 3연속)을 그대로 쓰고, 자식이 그 사유로
 * 중단하면 웨이브 전체를 멈춘다. 전체 호출 예산도 별도로 건다.
 * 종료 기록: 정상 완료·자식 중단·예산 소진·예외·강제 종료(SIGINT/SIGTERM) 전부 로그에 남는다.
 */
import { spawn } from "child_process";
import { appendFileSync, writeFileSync } from "fs";
import { INDUSTRIES } from "../config/industries";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(`--${n}`);

const TOTAL = parseInt(arg("total", "500"), 10);
const ROLES = arg("roles", "gallery,about,process").split(",");
const INDS = arg("industries", INDUSTRIES.map((i) => i.id).join(",")).split(",");
const PER_CELL = parseInt(arg("per-cell", "12"), 10);
const CALL_BUDGET = parseInt(arg("call-budget", "560"), 10);
const HEADROOM = parseInt(arg("headroom", "6"), 10);
const MODEL = arg("model", "gemini-3.1-flash-image");
const SLEEP = arg("sleep", "7000");
const LOG = arg("log", "wave-progress.log");
const FULL = arg("full-log", "wave-full.log");
const DRY = has("dry");
const COST_PER_CALL = MODEL.includes("pro") ? 0.134 : 0.039;

const started = Date.now();
// 로그는 아침에 사람이 읽는다 — UTC가 아니라 현지 시각으로 찍는다
const stamp = () => new Date().toLocaleString("sv");
function log(line: string) { const s = `[${stamp()}] ${line}`; console.log(s); appendFileSync(LOG, s + "\n", "utf8"); }
function full(chunk: string) { appendFileSync(FULL, chunk, "utf8"); }

let created = 0, dups = 0, fails = 0, calls = 0, cellsDone = 0, lastMilestone = 0;
let finished = false;
// 부모만 죽으면 자식이 살아남아 집계 없이 계속 과금된다(2026-09-02 실제로 겪음). 종료 시 같이 정리한다.
let child: import("child_process").ChildProcess | null = null;

/** 어떤 경로로 끝나든 마지막 줄은 반드시 남는다 — 아침에 이 줄만 보면 된다. */
function finish(status: string, detail: string) {
  if (finished) return;
  finished = true;
  if (child && child.pid && child.exitCode === null) {
    try { process.platform === "win32" ? spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true }) : child.kill("SIGTERM"); } catch {}
  }
  const mins = Math.round((Date.now() - started) / 60000);
  log("─".repeat(60));
  log(`${status} · ${detail}`);
  log(`등록 ${created}/${TOTAL}장 · 중복스킵 ${dups} · 실패 ${fails} · API호출 ${calls}/${CALL_BUDGET} · 예상비용 $${(calls * COST_PER_CALL).toFixed(2)} · 소요 ${mins}분 · 셀 ${cellsDone}/${ROLES.length * INDS.length}`);
  if (created < TOTAL) log(`남은 ${TOTAL - created}장을 이어서 하려면: npx tsx scripts/bank-wave.ts --total ${TOTAL - created} (중복은 자동으로 걸러진다)`);
  log(`상세 원문: ${FULL} · 승인은 /admin/bank 에서`);
}

process.on("SIGINT", () => { finish("⛔ 중단", "사용자 강제 종료(SIGINT)"); process.exit(130); });
process.on("SIGTERM", () => { finish("⛔ 중단", "종료 신호(SIGTERM)"); process.exit(143); });
process.on("uncaughtException", (e) => { finish("⛔ 중단", `러너 예외 — ${(e as Error).message}`); process.exit(1); });

type CellResult = { created: number; dups: number; fails: number; apiCalls: number; abort: string | null };

function runCell(ind: string, role: string, count: number, limit: number): Promise<CellResult> {
  return new Promise((resolve) => {
    const args = ["tsx", "--env-file=.env.local", "scripts/bank-generate.ts",
      "--model", MODEL, "--industries", ind, "--roles", role,
      "--count", String(count), "--sleep", SLEEP];
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
  // 셀 순서: 업종을 바깥으로 돌려 중간에 멈춰도 역할 3종이 고르게 남는다
  const cells: { ind: string; role: string }[] = [];
  for (const ind of INDS) for (const role of ROLES) cells.push({ ind, role });

  writeFileSync(LOG, "", "utf8"); writeFileSync(FULL, "", "utf8");
  log(`웨이브 시작 — 목표 ${TOTAL}장 · 모델 ${MODEL}${DRY ? " · [DRY]" : ""}`);
  log(`역할 ${ROLES.join("/")} × 업종 ${INDS.length}종 = ${cells.length}셀 · 셀당 ${PER_CELL}장(호출상한 ${PER_CELL + HEADROOM})`);
  log(`전체 호출 예산 ${CALL_BUDGET}회 = 최대 약 ${(CALL_BUDGET * COST_PER_CALL).toFixed(2)} · 예상 소요 약 ${Math.round((TOTAL * (parseInt(SLEEP, 10) + 12000)) / 60000)}분`);
  log(`[쿼터] Vertex 이미지 생성은 프로젝트당 분당 2회가 상한이다(global·region 동일, 2026-09-02 gcloud 확인). 그래서 느리다 — 설정 문제가 아니다. 상향은 GCP 콘솔에서 신청 가능(eligible).`);
  log(`안전장치: 자식 연속실패 5회 / 429 3연속 시 웨이브 전체 중단 · 호출 예산 초과 시 중단`);
  // 아침에 이 로그만 보고 상태를 판단할 수 있어야 한다 — 비정상 종료를 알아보는 법까지 적어둔다
  log(`[읽는 법] 맨 아래 "✅ 완료" 또는 "⛔ 중단" 블록이 결론이다. 진행 줄은 50장마다 찍힌다.`);
  log(`[읽는 법] 종료 블록 없이 끊겨 있으면 프로세스가 강제로 죽은 것(절전·터미널 종료). 만들어진 장수는 DB에 남아 있고, 이어서 돌리면 중복은 자동으로 걸러진다.`);
  log(`[읽는 법] 생성분은 전부 검수 대기 상태다 — /admin/bank 에서 승인해야 사이트에 쓰인다.`);
  log("─".repeat(60));

  for (const { ind, role } of cells) {
    if (created >= TOTAL) { finish("✅ 완료", `목표 ${TOTAL}장 달성`); return; }
    const remainingBudget = CALL_BUDGET - calls;
    if (!DRY && remainingBudget <= 0) { finish("⛔ 중단", `호출 예산 ${CALL_BUDGET}회 소진`); return; }

    const count = Math.min(PER_CELL, TOTAL - created);
    const limit = Math.min(count + HEADROOM, remainingBudget);
    if (!DRY && limit < 1) { finish("⛔ 중단", `호출 예산 부족(남은 ${remainingBudget}회)`); return; }

    const r = await runCell(ind, role, count, limit);
    created += r.created; dups += r.dups; fails += r.fails; calls += r.apiCalls; cellsDone++;

    // 자식이 안전장치로 멈췄으면 웨이브 전체를 멈춘다. '--limit 도달'은 그 셀의 정상 종료다.
    if (r.abort && !r.abort.includes("--limit")) {
      log(`셀 ${ind}/${role}에서 자식 중단: ${r.abort}`);
      finish("⛔ 중단", `안전장치 발동 — ${r.abort} (${ind}/${role})`);
      return;
    }

    // 매 50장마다 진행 기록
    if (Math.floor(created / 50) > lastMilestone) {
      lastMilestone = Math.floor(created / 50);
      const mins = (Date.now() - started) / 60000;
      const eta = created > 0 ? Math.round((mins / created) * (TOTAL - created)) : 0;
      log(`진행 ${created}/${TOTAL}장 (${Math.round((created / TOTAL) * 100)}%) · 셀 ${cellsDone}/${cells.length} · 중복 ${dups} · 실패 ${fails} · 호출 ${calls} · $${(calls * COST_PER_CALL).toFixed(2)} · 경과 ${Math.round(mins)}분 · 남은시간 약 ${eta}분`);
    }
  }
  finish(created >= TOTAL ? "✅ 완료" : "⚠️ 조합 소진", created >= TOTAL ? `목표 ${TOTAL}장 달성` : `모든 셀을 돌았으나 ${created}장에서 끝남(조합 부족 또는 중복 과다)`);
}

main();
