/**
 * 이미지 모델 벤치 — 상태·해상도·용량 확인 + 파일 저장 (품질은 파일 열어 육안 평가). Vertex AI 경유.
 * 실행: npx tsx --env-file=.env.local scripts/bench-image.ts [model] [outname] ["prompt"]
 */
import { writeFileSync, mkdirSync } from "fs";
import sharp from "sharp";
import { vertexGenerate, imageOf } from "../lib/vertex";

const model = process.argv[2] ?? "gemini-3.1-flash-image";
const out = process.argv[3] ?? "bench";
const prompt = process.argv[4] ?? `Professional interior photography of a modern renovated Korean apartment living room, bright natural window light, clean white walls with warm wood flooring, minimal styling, wide-angle shot, photorealistic, high detail, no people, no text, no watermark. 16:9 landscape.`;

const r = await vertexGenerate(model, {
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: { responseModalities: ["IMAGE"] },
});
if (!r.ok) {
  console.log(JSON.stringify({ model, status: r.status, error: r.error.slice(0, 300) }));
  process.exit(0);
}
const buf = imageOf(r.data);
if (!buf) {
  const finish = (r.data as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
  console.log(JSON.stringify({ model, error: "no image in response", finish }));
  process.exit(0);
}
mkdirSync("bench-out", { recursive: true });
const meta = await sharp(buf).metadata();
const file = `bench-out/${out}.${meta.format ?? "png"}`;
writeFileSync(file, buf);
console.log(JSON.stringify({
  model, file, width: meta.width, height: meta.height, kb: Math.round(buf.length / 1024),
  usage: (r.data as { usageMetadata?: unknown })?.usageMetadata,
}));
