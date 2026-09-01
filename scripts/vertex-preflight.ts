/**
 * Vertex AI 프리플라이트 — 500장 웨이브 전에 인증·API·모델을 최소 비용으로 확인.
 * 실행: npx tsx --env-file=.env.local scripts/vertex-preflight.ts [--image]
 *
 * [1] 인증 모드·프로젝트  [2] 토큰(무과금)  [3] 텍스트 1콜(수 원 미만)
 * --image 를 붙이면 이미지 모델 후보를 1장씩 실제 생성해 사용 가능 모델을 가려낸다(장당 ~$0.04).
 */
import { vertexProject, vertexLocation, vertexToken, vertexGenerate, textOf, imageOf, authMode } from "../lib/vertex";

const PROBE_IMAGE = process.argv.includes("--image");
const TEXT_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"];
const IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];

async function main() {
  console.log("[1] 인증");
  const mode = authMode();
  console.log(`  모드: ${mode === "adc" ? "ADC (gcloud application-default)" : "서비스 계정 JSON"}`);
  console.log(`  project=${await vertexProject()} location=${vertexLocation()}`);

  console.log("\n[2] 토큰");
  const tok = await vertexToken();
  console.log(`  ✅ 발급됨 (${tok.slice(0, 8)}…)`);

  console.log("\n[3] 텍스트 1콜");
  let textOk = false;
  for (const m of TEXT_MODELS) {
    const r = await vertexGenerate(m, {
      contents: [{ role: "user", parts: [{ text: "say OK" }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });
    if (r.ok) { console.log(`  ✅ ${m} — ${String(textOf(r.data)).slice(0, 40)}`); textOk = true; break; }
    console.log(`  ❌ ${m} — HTTP ${r.status} ${r.error.slice(0, 160)}`);
  }
  if (!textOk) { console.log("\n실패 — docs/vertex-setup.md 확인 (API 사용 설정·역할 부여)"); process.exit(1); }

  if (!PROBE_IMAGE) {
    console.log("\n✅ 텍스트 경로 정상. 이미지 모델 확인은 --image (장당 ~$0.04 과금)");
    return;
  }

  console.log("\n[4] 이미지 모델 후보 (각 1장 실제 생성 — 과금)");
  const usable: string[] = [];
  for (const m of IMAGE_MODELS) {
    const r = await vertexGenerate(m, {
      contents: [{ role: "user", parts: [{ text: "a single green leaf on a white background, product photo" }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    });
    if (!r.ok) { console.log(`  ❌ ${m} — HTTP ${r.status} ${r.error.slice(0, 140)}`); continue; }
    const buf = imageOf(r.data);
    if (!buf) { console.log(`  ⚠ ${m} — 응답은 왔으나 이미지 없음`); continue; }
    console.log(`  ✅ ${m} — ${(buf.length / 1024).toFixed(0)}KB`);
    usable.push(m);
  }
  console.log(`\n사용 가능 이미지 모델: ${usable.join(", ") || "(없음)"}`);
  if (!usable.length) process.exit(1);
  console.log(`다음: npx tsx --env-file=.env.local scripts/bank-generate.ts --model ${usable[0]} --limit 1 --count 1`);
}

main().catch((e) => { console.error("실패:", e instanceof Error ? e.message : e); process.exit(1); });
