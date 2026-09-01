/**
 * 서비스 계정 키 JSON → Vercel에 붙여넣을 base64를 클립보드로. 키 내용은 화면에 절대 출력하지 않는다.
 * 실행: npx tsx scripts/sa-key-to-clipboard.ts "C:\경로\키파일.json"
 *
 * `.env.local`에는 아무것도 쓰지 않는다 — 로컬 Vertex 인증은 ADC이고 장기 키는 Vercel Production에만
 * 둔다(DECISIONS 2026-09-01). 2026-09-01 키 유출도 `.env.local`을 읽다 났다.
 * 로컬 확인: `npx tsx --env-file=.env.local scripts/vertex-preflight.ts` — 모드가 `ADC`로 찍혀야 정상.
 */
import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const keyPath = process.argv[2];
if (!keyPath) { console.error('사용법: npx tsx scripts/sa-key-to-clipboard.ts "C:\\경로\\키파일.json"'); process.exit(1); }
if (!existsSync(keyPath)) { console.error(`파일 없음: ${keyPath}`); process.exit(1); }

const bytes = readFileSync(keyPath);
let sa: { type?: string; project_id?: string; client_email?: string; private_key?: string; private_key_id?: string };
try { sa = JSON.parse(bytes.toString("utf8")); } catch { console.error("JSON 파싱 실패 — 서비스 계정 키 파일이 맞나요?"); process.exit(1); }
if (sa.type !== "service_account" || !sa.private_key || !sa.client_email || !sa.project_id) {
  console.error("서비스 계정 키 형식이 아닙니다 (type/private_key/client_email/project_id 확인)");
  process.exit(1);
}

// lib/vertex.ts가 base64를 utf8로 디코드하므로 파일 바이트를 그대로 인코딩한다
const b64 = bytes.toString("base64");

function copy(text: string): void {
  const r = process.platform === "win32" ? spawnSync("cmd", ["/c", "clip"], { input: text })
    : process.platform === "darwin" ? spawnSync("pbcopy", [], { input: text })
    : spawnSync("xclip", ["-selection", "clipboard"], { input: text });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`클립보드 명령이 ${r.status}로 종료`);
}

/** 되읽기 — 조용히 실패하는 경우가 있다(다른 세션의 클립보드에 들어감). 눈으로 확인시킨다. */
function readBack(): string | null {
  const r = process.platform === "win32"
    ? spawnSync("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    : process.platform === "darwin"
      ? spawnSync("pbpaste", [], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
      : null;
  return r && r.status === 0 ? r.stdout : null;
}

try { copy(b64); } catch (e) {
  console.error(`❌ 클립보드 복사 실패: ${(e as Error).message}`);
  process.exit(1);
}

console.log(`✅ 클립보드에 복사됨 — base64 ${b64.length}자 (내용 미출력)`);
console.log(`   project_id     : ${sa.project_id}`);
console.log(`   client_email   : ${sa.client_email}`);
console.log(`   private_key_id : ${sa.private_key_id ?? "(없음)"}`);

const back = readBack();
if (back === null) console.log("\n⚠ 되읽기 확인 불가 — 붙여넣어 보고 비어 있으면 이 창에서 직접 다시 실행할 것");
else if (back.trim() === b64) console.log("\n✅ 되읽기 일치 — 붙여넣기 준비 완료");
else console.log(`\n⚠ 되읽기 불일치(${back.trim().length}자) — 클립보드가 다른 세션에 들어갔을 수 있다. 이 창에서 직접 다시 실행할 것`);

console.log(`
다음:
  1. Vercel > onstori-pwk2 > Settings > Environment Variables
     GOOGLE_SERVICE_ACCOUNT_JSON (Production, Secret) 값 전체 교체 → Save
  2. Deployments > 최신 배포 > Redeploy
     ← 환경변수는 배포 시점에 주입된다. 빼먹으면 저장해도 반영되지 않는다(두 번 걸렸다)
  3. 검증 — 구 키를 먼저 disable 한 상태에서 프로덕션 사이트 생성이 200인지 본다.
     비활성 키는 토큰을 발급하지 못하므로, 200이면 새 키로 도는 것이 증명된다. 실패하면 enable로 즉시 복구.
       gcloud iam service-accounts keys disable <구 키 ID> --iam-account=${sa.client_email}
     (gcloud은 PATH에 없다 — "%LOCALAPPDATA%\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd")
  4. 통과 후 구 키 delete → 이 키 파일(${keyPath})을 삭제하고 클립보드도 비운다`);
