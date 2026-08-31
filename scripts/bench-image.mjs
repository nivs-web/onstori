/**
 * 이미지 모델 벤치 — 상태·해상도·용량 확인 (품질은 파일 열어 육안 평가)
 * 실행: node --env-file=.env.local scripts/bench-image.mjs [model] [outname] ["prompt"]
 */
import { writeFileSync, mkdirSync } from "fs";

const key = process.env.GEMINI_API_KEY;
const model = process.argv[2] ?? "gemini-3.1-flash-image";
const out = process.argv[3] ?? "bench";
const prompt = process.argv[4] ?? `Professional interior photography of a modern renovated Korean apartment living room, bright natural window light, clean white walls with warm wood flooring, minimal styling, wide-angle shot, photorealistic, high detail, no people, no text, no watermark. 16:9 landscape.`;

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  },
);

const status = res.status;
const data = await res.json().catch(() => null);
if (status !== 200 || !data) {
  console.log(JSON.stringify({ model, status, error: data?.error?.message?.slice(0, 300) ?? "no body" }));
  process.exit(0);
}
const parts = data?.candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData);
if (!img) {
  console.log(JSON.stringify({ model, status, error: "no image in response", finish: data?.candidates?.[0]?.finishReason }));
  process.exit(0);
}
const buf = Buffer.from(img.inlineData.data, "base64");
mkdirSync("bench-out", { recursive: true });
const file = `bench-out/${out}.png`;
writeFileSync(file, buf);
// PNG 해상도 파싱 (IHDR)
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
console.log(JSON.stringify({ model, status, file, width: w, height: h, kb: Math.round(buf.length / 1024), usage: data.usageMetadata }));
