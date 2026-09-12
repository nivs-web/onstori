/**
 * 인스타 토큰 갱신 «판단»만 재는 검사. (2026-09-12)
 * 실행: npx tsx scripts/sns-refresh-test.ts   (열쇠·네트워크 필요 없음)
 *
 * ★ 왜 필요한가: 이 장치가 잘못돼도 **60일 뒤에야** 드러난다. 그때는 사장님 연결이
 *   이미 끊긴 뒤다. 그래서 시간이 걸리는 부분을 순수 함수로 떼어 여기서 미리 잰다.
 * ⚠ 네트워크 호출(실제 갱신)은 여기서 재지 않는다 — 그건 운영에서 로그(`ig_token_refreshed`)로 본다.
 */
import { isDue, verdictFor } from "../lib/sns/maintenance";

const NOW = new Date("2026-09-12T00:00:00Z").getTime();
const DAY = 86_400_000;
const at = (d: number) => new Date(NOW + d * DAY).toISOString();

let pass = 0;
const fails: string[] = [];
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) { pass++; return; }
  fails.push(`${name}\n    받은 값: ${String(got)}\n    바랐던 값: ${String(want)}`);
}

/* ── isDue — 「지금 밀어야 하나」 ── */
eq("60일 남았으면 아직 안 민다", isDue(at(60), NOW), false);
eq("15일 남았으면 아직 안 민다", isDue(at(15), NOW), false);
eq("14일 남았으면 민다(경계)", isDue(at(14), NOW), true);
eq("3일 남았으면 민다", isDue(at(3), NOW), true);
eq("이미 지났으면 민다", isDue(at(-1), NOW), true);
eq("만료를 «모르면» 민다 — 모르는 것이 가장 위험하다", isDue(null, NOW), true);

/* ── verdictFor — 부르기 «전» ── */
const tok = (expiresAt: string | null, accessToken: string | null = "T") => ({ accessToken, expiresAt });
eq("토큰이 없으면 부를 것도 없다", verdictFor(tok(at(3), null), NOW), "skip");
eq("이미 만료됐으면 갱신이 안 된다 → 끝", verdictFor(tok(at(-1)), NOW), "dead");
eq("만료 시각이 딱 지금이면 끝", verdictFor(tok(at(0)), NOW), "dead");
eq("아직 살아 있으면 불러 본다", verdictFor(tok(at(3)), NOW), "retry");
eq("만료를 모르면 불러 본다", verdictFor(tok(null), NOW), "retry");

/* ── verdictFor — 부른 «뒤» ── */
eq("401(토큰 죽음) → 끝", verdictFor(tok(at(3)), NOW, "AUTH_EXPIRED"), "dead");
eq("거절 → 끝", verdictFor(tok(at(3)), NOW, "REJECTED"), "dead");
eq("★ 잠깐 안 되는 것은 끊지 않는다", verdictFor(tok(at(3)), NOW, "TRANSIENT"), "retry");
eq("★ 한도 초과도 끊지 않는다", verdictFor(tok(at(3)), NOW, "QUOTA_EXCEEDED"), "retry");

/* ── 가장 무서운 실수: 멀쩡한 연결을 우리가 끊는 것 ── */
eq(
  "★★ 인스타가 잠깐 죽어(5xx→TRANSIENT) 있어도 사장님 연결은 살려 둔다",
  verdictFor(tok(at(10)), NOW, "TRANSIENT"),
  "retry",
);

const total = pass + fails.length;
if (fails.length) {
  console.error(`\n✖ ${fails.length}/${total} 실패\n`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✔ ${pass}/${total} 통과 — 인스타 토큰 갱신 판단`);
