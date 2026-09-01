/**
 * 이미지뱅크 배치 생성 — 고품질·비중복 파이프라인 (Vertex AI 경유, GCP 크레딧 사용)
 * 실행: npx tsx --env-file=.env.local scripts/bank-generate.ts [옵션]
 *   사전조건: GOOGLE_CLOUD_PROJECT · GOOGLE_SERVICE_ACCOUNT_JSON — docs/vertex-setup.md
 *   --limit 5             [필수] 이 실행에서 허용할 최대 API 호출(=과금) 수. 처음은 5로 돌려
 *                         결과 확인 후 늘릴 것. 중복 스킵도 호출은 과금되므로 등록 장수가 아니라 호출 수를 제한.
 *   --model gemini-3-pro-image | gemini-3.1-flash-image  (기본 3.1-flash-image, Vertex 게시자 모델 ID)
 *   --count 20            생성 목표 장수 (뱅크 등록 기준 — limit보다 먼저 차면 거기서 종료)
 *   --cost 0.039          장당 예상 단가 USD (기본: 모델별 추정표 — 실제 단가 확인 후 조정)
 *   --industries interior,cafe   (기본: 전체 14)
 *   --roles hero,gallery  (기본: hero,gallery,about,process)
 *   --moods clean,warm    (기본: 4종)
 *   --sleep 7000          호출 간격 ms (레이트리밋 보호)
 *   --dry                 API 호출 없이 프롬프트만 출력 (--limit 없이 실행 가능)
 *
 * 파이프라인: 프롬프트 조합(셔플) → 생성 → dHash 중복검사(해밍≤6 스킵)
 *   → WebP 변환(hero 1920w/기타 1200w, q85) → bank 버킷 업로드 → 카탈로그(검수 대기) 등록
 * 안전장치: --limit 호출 상한 · 연속 실패 5회 즉시 중단 · 429 3연속 중단 · 매 호출 누적 장수/예상 비용 출력.
 */
import sharp from "sharp";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { vertexGenerate, imageOf } from "../lib/vertex";
import { buildPrompt, INDUSTRY_SCENES, VARIATIONS } from "../config/bank-prompts";
import { INDUSTRIES } from "../config/industries";

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const has = (name: string) => process.argv.includes(`--${name}`);

const MODEL = arg("model", "gemini-3.1-flash-image");
const COUNT = parseInt(arg("count", "20"), 10);
const ROLES = arg("roles", "hero,gallery,about,process").split(",");
const MOODS = arg("moods", "clean,warm,premium,lively").split(",");
const INDS = arg("industries", INDUSTRIES.map((i) => i.id).join(",")).split(",");
const SLEEP = parseInt(arg("sleep", "7000"), 10);
const DRY = has("dry");
const BATCH = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

// 안전장치 1: 실행당 API 호출(과금) 상한 — 명시 필수 (dry 제외)
const LIMIT = parseInt(arg("limit", ""), 10);
if (!DRY && (!Number.isFinite(LIMIT) || LIMIT <= 0)) {
  console.error("--limit N 이 필요해요 (이 실행에서 허용할 최대 API 호출 수). 처음은 --limit 5 로 돌려 결과를 확인한 뒤 늘리세요.");
  process.exit(1);
}

// 장당 예상 단가 USD — 추정표. 실제 청구 단가 확인 후 --cost 로 조정할 것.
const COST_TABLE: Record<string, number> = {
  "gemini-3.1-flash-image": 0.039,
  "gemini-3-pro-image": 0.134,
};
const COST = parseFloat(arg("cost", String(COST_TABLE[MODEL] ?? 0.05)));
const MAX_CONSEC_FAILS = 5;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/* dHash 64bit — 9x8 그레이스케일 인접 비교 */
async function dhash(buf: Buffer): Promise<string> {
  const raw = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += raw[y * 9 + x] < raw[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}
function hamming(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

async function generateOne(prompt: string): Promise<{ buf: Buffer } | { err: string; quota?: boolean }> {
  const r = await vertexGenerate(MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });
  if (!r.ok) {
    if (r.status === 429) return { err: "quota", quota: true };
    return { err: `HTTP ${r.status} ${r.error.slice(0, 120)}` };
  }
  const buf = imageOf(r.data);
  if (!buf) {
    const reason = (r.data as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
    return { err: `no-image (${reason ?? "unknown"})` };
  }
  return { buf };
}

async function main() {
  // 조합 만들기 (셔플)
  type Job = { ind: string; mood: string; role: string; scene: number; vari: number };
  const jobs: Job[] = [];
  for (const ind of INDS) for (const mood of MOODS) for (const role of ROLES) {
    const scenes = INDUSTRY_SCENES[ind]?.length ?? 3;
    for (let s = 0; s < scenes; s++) for (let v = 0; v < VARIATIONS.length; v++) jobs.push({ ind, mood, role, scene: s, vari: v });
  }
  jobs.sort(() => Math.random() - 0.5);

  // 기존 해시 로드 (중복 방지)
  const { data: existing } = await sb.from("image_bank").select("phash").not("phash", "is", null).eq("deleted", false);
  const hashes: string[] = (existing ?? []).map((r) => r.phash as string);
  console.log(`기존 뱅크 해시 ${hashes.length}개 로드 · 목표 ${COUNT}장 · 호출 상한 ${DRY ? "-(dry)" : LIMIT} · 모델 ${MODEL} · 장당 추정 $${COST}`);

  let created = 0, dups = 0, fails = 0, quotaStrikes = 0, apiCalls = 0, consecFails = 0;
  let abort = ""; // 채워지면 즉시 중단
  // 안전장치 3: 매 호출마다 누적 현황 — 등록/호출/예상 비용
  const tally = () => `등록 ${created} · 호출 ${apiCalls}/${LIMIT} · 예상 누적 $${(apiCalls * COST).toFixed(2)}`;
  // 안전장치 2: 생성·업로드·DB 실패가 연속 5회면 중단 (성공·중복 시 리셋)
  const noteFail = (msg: string) => {
    fails++; consecFails++;
    console.log(`실패: ${msg} · ${tally()}`);
    if (consecFails >= MAX_CONSEC_FAILS) abort = `연속 실패 ${MAX_CONSEC_FAILS}회`;
  };

  for (const j of jobs) {
    if (created >= COUNT) break;
    if (!DRY && apiCalls >= LIMIT) { abort = `호출 상한 --limit ${LIMIT} 도달`; break; }
    const prompt = buildPrompt(j.ind, j.mood, j.role, j.scene, j.vari);
    if (DRY) { console.log(`[dry] ${j.ind}/${j.mood}/${j.role} :: ${prompt.slice(0, 110)}…`); created++; continue; }

    const r = await generateOne(prompt);
    if ("err" in r && r.quota) {
      quotaStrikes++; console.log(`429 쿼터 (${quotaStrikes}/3)`);
      if (quotaStrikes >= 3) { abort = "429 쿼터 3연속"; break; }
      await new Promise((s) => setTimeout(s, 30000)); continue;
    }
    apiCalls++; // 429 외에는 과금으로 간주 (no-image 응답 포함 — 보수적 추정)
    if ("err" in r) {
      noteFail(`${j.ind}/${j.role} — ${r.err}`);
    } else {
      quotaStrikes = 0;
      const hash = await dhash(r.buf);
      if (hashes.some((h) => hamming(h, hash) <= 6)) { dups++; consecFails = 0; console.log(`중복 스킵: ${j.ind}/${j.mood}/${j.role} · ${tally()}`); }
      else {
        const meta = await sharp(r.buf).metadata();
        const width = j.role === "hero" ? 1920 : 1200;
        const webp = await sharp(r.buf).resize({ width, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        const path = `${j.ind}/${j.mood}/${j.role}/${randomUUID()}.webp`;
        const { error: upErr } = await sb.storage.from("bank").upload(path, webp, { contentType: "image/webp" });
        if (upErr) { noteFail(`업로드 — ${upErr.message}`); }
        else {
          const { data: pub } = sb.storage.from("bank").getPublicUrl(path);
          const orientation = (meta.width ?? 0) >= (meta.height ?? 0) ? "landscape" : "portrait";
          const { error: dbErr } = await sb.from("image_bank").insert({
            industry: j.ind, mood: j.mood, role: j.role, orientation,
            url: pub.publicUrl, storage_path: path, source: `ai:${MODEL}`,
            tags: [j.ind, j.mood, j.role], prompt, model: MODEL, phash: hash,
            width: meta.width, height: meta.height, batch_id: BATCH,
          });
          if (dbErr) { noteFail(`DB — ${dbErr.message}`); }
          else { hashes.push(hash); created++; consecFails = 0; console.log(`✓ ${created}/${COUNT} ${j.ind}/${j.mood}/${j.role} (${meta.width}x${meta.height}) · ${tally()}`); }
        }
      }
    }
    if (abort) break;
    await new Promise((s) => setTimeout(s, SLEEP));
  }
  if (abort) console.log(`중단: ${abort}`);
  console.log(JSON.stringify({ batch: BATCH, model: MODEL, created, dups, fails, apiCalls, estCostUsd: +(apiCalls * COST).toFixed(2), abort: abort || null }));
}

main();
