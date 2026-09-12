/**
 * 한도·규격 표가 **실제로 무엇을 돌려주는지** 눈으로 본다. (2026-09-12 지시 B4·B5)
 * ⚠ DB 를 건드리지 않는다 — 표(상수)만 읽는다. 아무거나 몇 번이고 돌려도 안전하다.
 */
import { limitsOf, TEXT_LIMITS, MAX_DURATION_SEC, APP_DAILY_UPLOADS, PER_SITE_DAILY_UPLOADS, YOUTUBE_SPEC } from "../lib/sns/limits";
import { SNS_LIMITS } from "../lib/sns/db";

let bad = 0, done = 0;
const t = (name: string, ok: boolean) => { done++; if (!ok) { console.log(`  ❌ ${name}`); bad++; } else console.log(`  ✅ ${name}`); };

console.log("── 유튜브 규격 (공식 문서 실측) ──");
console.log("  getLimits('youtube') =", limitsOf("youtube"));
t("쇼츠 선이 3분(180초)으로 들어갔다", MAX_DURATION_SEC.youtube === 180);
t("페이스북 90초가 여전히 가장 짧다", Math.min(...Object.values(MAX_DURATION_SEC).filter((v): v is number => v !== null)) === 90);
t("제목 100자 · 설명 5000자", YOUTUBE_SPEC.maxTitleChars === 100 && TEXT_LIMITS.youtube.chars === 5000);
t("우리 녹화가 세로(1080×1920)라 쇼츠 조건을 만족한다", YOUTUBE_SPEC.recommended.height > YOUTUBE_SPEC.recommended.width);

console.log("\n── 하루 한도 단일 출처 ──");
console.log("  SNS_LIMITS.youtube =", SNS_LIMITS.youtube.map((r) => ({ scope: r.scope, key: r.key("SITE"), max: r.max })));
t("사장님당 1건 · 앱 전체 100건 둘 다 있다", SNS_LIMITS.youtube.length === 2);
t("숫자가 limits.ts 에서 온다 (손으로 박히지 않았다)",
  SNS_LIMITS.youtube.find((r) => r.scope === "app")?.max === APP_DAILY_UPLOADS.youtube
  && SNS_LIMITS.youtube.find((r) => r.scope === "site")?.max === PER_SITE_DAILY_UPLOADS.youtube);
t("scope 가 갈려 있다 — 되돌릴 수 있는 것과 없는 것",
  SNS_LIMITS.youtube.some((r) => r.scope === "site") && SNS_LIMITS.youtube.some((r) => r.scope === "app"));
t("열쇠 모양이 지시문 그대로다 (yt:{site} · yt:app)",
  SNS_LIMITS.youtube.map((r) => r.key("S")).join(",") === "yt:S,yt:app");
t("인스타·틱톡은 사장님 몫만 있다 (앱 전체 한도가 없다)",
  SNS_LIMITS.instagram.every((r) => r.scope === "site") && SNS_LIMITS.tiktok.every((r) => r.scope === "site"));
/* ★ 사장님 100명 × 1건 = 앱 전체 100건. 2건으로 올리면 100명에서 이미 넘친다 */
t("★ 사장님당 × 100명이 앱 한도를 넘지 않는다",
  (PER_SITE_DAILY_UPLOADS.youtube ?? 0) * 100 <= (APP_DAILY_UPLOADS.youtube ?? 0));

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
