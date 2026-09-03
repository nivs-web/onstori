/**
 * 이미지뱅크 수동 수집 — Gemini 앱(AI Pro 구독)·기타 경로로 만든 이미지를 뱅크에 등록.
 * API 결제 전 "무료 생성" 워크플로: 앱에서 생성 → 폴더에 저장 → 이 스크립트로 일괄 등록.
 *
 * 실행: npx tsx --env-file=.env.local scripts/bank-ingest.ts --dir <폴더> --industry interior --mood clean --role hero [--source app:gemini]
 *  - 폴더 안 png/jpg/jpeg/webp 전부 처리
 *  - dHash 중복검사(해밍≤6, DB+이번 배치) → WebP 변환(hero 1920w/기타 1200w) → 업로드 → 검수대기 등록
 */
import { readdirSync, readFileSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import * as storage from "../lib/storage";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const DIR = arg("dir");
const INDUSTRY = arg("industry");
const MOOD = arg("mood", "clean")!;
const ROLE = arg("role", "gallery")!;
const SOURCE = arg("source", "app:gemini")!;
if (!DIR || !INDUSTRY) {
  console.log("사용법: npx tsx --env-file=.env.local scripts/bank-ingest.ts --dir <폴더> --industry <업종id> [--mood clean] [--role hero] [--source app:gemini]");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function dhash(buf: Buffer): Promise<string> {
  const raw = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += raw[y * 9 + x] < raw[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}
function hamming(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (x) { n += Number(x & BigInt(1)); x >>= BigInt(1); }
  return n;
}

async function main() {
  const files = readdirSync(DIR!).filter((f) => [".png", ".jpg", ".jpeg", ".webp"].includes(extname(f).toLowerCase()));
  const { data: existing } = await sb.from("image_bank").select("phash").not("phash", "is", null).eq("deleted", false);
  const hashes: string[] = (existing ?? []).map((r) => r.phash as string);
  const batch = "ingest-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  let ok = 0, dup = 0, fail = 0;

  for (const f of files) {
    try {
      const buf = readFileSync(join(DIR!, f));
      const hash = await dhash(buf);
      if (hashes.some((h) => hamming(h, hash) <= 6)) { dup++; console.log(`중복: ${f}`); continue; }
      const meta = await sharp(buf).metadata();
      const width = ROLE === "hero" ? 1920 : 1200;
      const webp = await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      const path = `${INDUSTRY}/${MOOD}/${ROLE}/${randomUUID()}.webp`;
      const { key } = await storage.put("media", `bank/${path}`, webp, "image/webp");
      const { error: dbErr } = await sb.from("image_bank").insert({
        industry: INDUSTRY, mood: MOOD, role: ROLE,
        orientation: (meta.width ?? 0) >= (meta.height ?? 0) ? "landscape" : "portrait",
        url: storage.publicUrl(key), storage_path: path, source: SOURCE,
        tags: [INDUSTRY!, MOOD, ROLE], phash: hash, width: meta.width, height: meta.height, batch_id: batch,
      });
      if (dbErr) throw new Error(dbErr.message);
      hashes.push(hash); ok++; console.log(`✓ ${f} (${meta.width}x${meta.height})`);
    } catch (e) { fail++; console.log(`실패: ${f} — ${String(e).slice(0, 120)}`); }
  }
  console.log(JSON.stringify({ batch, dir: DIR, industry: INDUSTRY, mood: MOOD, role: ROLE, ok, dup, fail }));
}
main();
