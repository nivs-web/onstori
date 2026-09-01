/**
 * 서비스 계정 JSON 키 → .env.local 주입 (base64). 키 내용은 화면에 절대 출력하지 않는다.
 * 실행: npx tsx scripts/set-sa-env.ts "C:\경로\키파일.json"
 *
 * GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION / GOOGLE_SERVICE_ACCOUNT_JSON 3개를
 * 기존 값이 있으면 교체, 없으면 추가한다. 실행 후 키 파일은 저장소 밖으로 옮기거나 삭제할 것.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const keyPath = process.argv[2];
if (!keyPath) { console.error('사용법: npx tsx scripts/set-sa-env.ts "C:\\경로\\키파일.json"'); process.exit(1); }
if (!existsSync(keyPath)) { console.error(`파일 없음: ${keyPath}`); process.exit(1); }

const raw = readFileSync(keyPath, "utf8");
let sa: { type?: string; project_id?: string; client_email?: string; private_key?: string };
try { sa = JSON.parse(raw); } catch { console.error("JSON 파싱 실패 — 서비스 계정 키 파일이 맞나요?"); process.exit(1); }
if (sa.type !== "service_account" || !sa.private_key || !sa.client_email || !sa.project_id) {
  console.error("서비스 계정 키 형식이 아닙니다 (type/private_key/client_email/project_id 확인)");
  process.exit(1);
}

const vars: Record<string, string> = {
  GOOGLE_CLOUD_PROJECT: sa.project_id,
  GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || "global",
  GOOGLE_SERVICE_ACCOUNT_JSON: Buffer.from(raw, "utf8").toString("base64"),
};

const envPath = resolve(".env.local");
const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
for (const [k, v] of Object.entries(vars)) {
  const i = lines.findIndex((l) => l.startsWith(`${k}=`));
  if (i > -1) lines[i] = `${k}=${v}`;
  else lines.push(`${k}=${v}`);
}
writeFileSync(envPath, lines.join("\n").replace(/\n+$/, "\n"), "utf8");

console.log(`✅ .env.local 갱신 (키 내용은 출력하지 않음)`);
console.log(`   GOOGLE_CLOUD_PROJECT=${sa.project_id}`);
console.log(`   GOOGLE_CLOUD_LOCATION=${vars.GOOGLE_CLOUD_LOCATION}`);
console.log(`   GOOGLE_SERVICE_ACCOUNT_JSON=<base64 ${vars.GOOGLE_SERVICE_ACCOUNT_JSON.length}자>`);
console.log(`   서비스 계정: ${sa.client_email}`);
console.log(`\n다음: npx tsx --env-file=.env.local scripts/vertex-preflight.ts`);
console.log(`⚠ Vercel Production에도 위 3개를 등록해야 프로덕션 사이트 생성이 동작합니다.`);
console.log(`⚠ 키 파일(${keyPath})은 저장소 밖으로 옮기거나 삭제하세요.`);
