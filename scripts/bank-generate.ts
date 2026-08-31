/**
 * 이미지뱅크 배치 생성 — 고품질·비중복 파이프라인
 * 실행: npx tsx --env-file=.env.local scripts/bank-generate.ts [옵션]
 *   --model gemini-3-pro-image | gemini-3.1-flash-image  (기본 3.1-flash-image)
 *   --count 20            생성 목표 장수
 *   --industries interior,cafe   (기본: 전체 14)
 *   --roles hero,gallery  (기본: hero,gallery,about,process)
 *   --moods clean,warm    (기본: 4종)
 *   --sleep 7000          호출 간격 ms (레이트리밋 보호)
 *   --dry                 API 호출 없이 프롬프트만 출력
 *
 * 파이프라인: 프롬프트 조합(셔플) → 생성 → dHash 중복검사(해밍≤6 스킵)
 *   → WebP 변환(hero 1920w/기타 1200w, q85) → bank 버킷 업로드 → 카탈로그(검수 대기) 등록
 * 429(쿼터 소진) 3연속 시 우아하게 중단하고 요약 출력.
 */
import sharp from "sharp";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
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

const key = process.env.GEMINI_API_KEY!;
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (res.status === 429) return { err: "quota", quota: true };
  const data = await res.json().catch(() => null);
  const b64 = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData?.data;
  if (!b64) return { err: `no-image (${res.status} ${data?.error?.message?.slice(0, 100) ?? data?.candidates?.[0]?.finishReason ?? ""})` };
  return { buf: Buffer.from(b64, "base64") };
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
  console.log(`기존 뱅크 해시 ${hashes.length}개 로드 · 목표 ${COUNT}장 · 모델 ${MODEL}`);

  let created = 0, dups = 0, fails = 0, quotaStrikes = 0;
  for (const j of jobs) {
    if (created >= COUNT) break;
    const prompt = buildPrompt(j.ind, j.mood, j.role, j.scene, j.vari);
    if (DRY) { console.log(`[dry] ${j.ind}/${j.mood}/${j.role} :: ${prompt.slice(0, 110)}…`); created++; continue; }

    const r = await generateOne(prompt);
    if ("err" in r) {
      if (r.quota) { quotaStrikes++; console.log(`429 쿼터 (${quotaStrikes}/3)`); if (quotaStrikes >= 3) break; await new Promise((s) => setTimeout(s, 30000)); continue; }
      fails++; console.log(`실패: ${j.ind}/${j.role} — ${r.err}`);
    } else {
      quotaStrikes = 0;
      const hash = await dhash(r.buf);
      if (hashes.some((h) => hamming(h, hash) <= 6)) { dups++; console.log(`중복 스킵: ${j.ind}/${j.mood}/${j.role}`); }
      else {
        const meta = await sharp(r.buf).metadata();
        const width = j.role === "hero" ? 1920 : 1200;
        const webp = await sharp(r.buf).resize({ width, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        const path = `${j.ind}/${j.mood}/${j.role}/${randomUUID()}.webp`;
        const { error: upErr } = await sb.storage.from("bank").upload(path, webp, { contentType: "image/webp" });
        if (upErr) { fails++; console.log(`업로드 실패: ${upErr.message}`); }
        else {
          const { data: pub } = sb.storage.from("bank").getPublicUrl(path);
          const orientation = (meta.width ?? 0) >= (meta.height ?? 0) ? "landscape" : "portrait";
          const { error: dbErr } = await sb.from("image_bank").insert({
            industry: j.ind, mood: j.mood, role: j.role, orientation,
            url: pub.publicUrl, storage_path: path, source: `ai:${MODEL}`,
            tags: [j.ind, j.mood, j.role], prompt, model: MODEL, phash: hash,
            width: meta.width, height: meta.height, batch_id: BATCH,
          });
          if (dbErr) { fails++; console.log(`DB 실패: ${dbErr.message}`); }
          else { hashes.push(hash); created++; console.log(`✓ ${created}/${COUNT} ${j.ind}/${j.mood}/${j.role} (${meta.width}x${meta.height})`); }
        }
      }
    }
    await new Promise((s) => setTimeout(s, SLEEP));
  }
  console.log(JSON.stringify({ batch: BATCH, model: MODEL, created, dups, fails, quotaExhausted: quotaStrikes >= 3 }));
}

main();
