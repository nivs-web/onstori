/**
 * Gemini 프리플라이트 — 이미지 웨이브(500장) 돌리기 전에 키·티어·크레딧을 무과금으로 확인.
 * 실행: npx tsx --env-file=.env.local scripts/gemini-preflight.ts
 *
 * models.list(무과금)로 키 유효성을, 텍스트 1콜로 결제 상태를 본다.
 * 텍스트가 200이면 크레딧 살아있음 → bank-generate --limit 5 로 진행.
 * "prepayment credits are depleted" = 선불 크레딧 소진(충전 필요), FreeTier limit:0 = 결제 미설정.
 */
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("GEMINI_API_KEY 없음 — .env.local 확인"); process.exit(1); }
console.log(`key: length=${key.length} prefix=${key.slice(0, 6)}… suffix=…${key.slice(-4)}\n`);

const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function main() {
  const lr = await fetch(`${BASE}/models?key=${key}&pageSize=100`);
  const lj = await lr.json().catch(() => null);
  console.log(`[1] models.list status ${lr.status}`);
  if (lj?.error) { console.log(`  ${lj.error.status}: ${String(lj.error.message).slice(0, 200)}`); process.exit(1); }
  const names: string[] = (lj?.models ?? []).map((m: { name: string }) => m.name.replace("models/", ""));
  console.log(`  키 유효 · 모델 ${names.length}개 · 이미지: ${names.filter((n) => n.includes("image")).join(", ") || "(없음)"}`);

  const tr = await fetch(`${BASE}/models/gemini-3.5-flash:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "say OK" }] }] }),
  });
  const tj = await tr.json().catch(() => null);
  console.log(`\n[2] 텍스트 1콜 status ${tr.status}`);
  if (tr.status === 200) {
    console.log("  ✅ 크레딧 살아있음 — bank-generate --limit 5 로 진행 가능");
    process.exit(0);
  }
  const msg = String(tj?.error?.message ?? "");
  console.log(`  ❌ ${tj?.error?.status}: ${msg.slice(0, 240)}`);
  if (msg.includes("prepayment credits")) console.log("  → 선불 크레딧 소진. AI Studio 결제에서 충전 후 재실행.");
  else if (msg.includes("free_tier")) console.log("  → 결제 미설정(무료 티어). 이미지 모델 일일 쿼터는 0.");
  process.exit(1);
}
main().catch((e) => { console.error("요청 실패:", e); process.exit(1); });
