/**
 * **글자 로고가 제대로 만들어지는지** 검사한다. (2026-09-16 지시 [5])
 *
 * ★★ 왜 검사가 필요한가: 로고는 **사장님이 아무것도 안 골라도 나가는** 것이다(대표님 지시).
 *   그 기본값이 깨지면 «로고 없는 홈페이지»가 아니라 **깨진 로고**가 나간다. 그게 더 나쁘다.
 *
 * ⚠ DB 도 네트워크도 안 쓴다 — 순수 함수만 잰다.
 */
import { FONTS, LOGO_DEFAULT, SHAPES, SYMBOLS, makeLogoSvg } from "../lib/logo-maker";

let bad = 0, done = 0;
const t = (name: string, ok: boolean, detail = "") => {
  done++;
  if (!ok) { console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ""}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

const ACC = "#005B2A";
const mk = (over: Partial<Parameters<typeof makeLogoSvg>[0]> = {}) =>
  makeLogoSvg({ name: "온스토리", accent: ACC, ...LOGO_DEFAULT, ...over });

console.log("── 기본값 — 아무것도 안 골라도 나오는 로고 ──");
{
  const s = mk();
  t("SVG 로 시작하고 끝난다", s.startsWith("<svg") && s.endsWith("</svg>"));
  t("★ 상호가 들어 있다", s.includes("온스토리"));
  t("강조색이 들어 있다", s.includes(ACC));
  t("기본 모양은 «최대 굵은 워드»", LOGO_DEFAULT.shape === "ultra");
  t("기본 글꼴은 Pretendard (자체 호스팅 중인 유일한 글꼴)", LOGO_DEFAULT.font === "pretendard");
  t("★ 기본 로고에 Pretendard 가 박혀 있다 — 그래야 글꼴을 심을 수 있다", /Pretendard/.test(s));
}

console.log("\n── 모양 5종·글꼴 5종이 전부 만들어진다 ──");
for (const sh of SHAPES) {
  const s = mk({ shape: sh.id, symbol: SYMBOLS[0].id, initials: "OS" });
  t(`모양 「${sh.label}」`, s.startsWith("<svg") && s.length > 200);
}
for (const f of FONTS) {
  const s = mk({ font: f.id });
  t(`글꼴 「${f.label}」 — 그 글꼴 이름이 박힌다`, s.includes(f.stack.split(",")[0].replace(/"/g, "")));
}

console.log("\n── ★ 긴 상호가 넘치지 않는다 (박팀장이 옛 로고에서 찾았던 결함) ──");
{
  /* 옛 로고는 글자 크기를 못 박아 8자 이상이면 테두리를 뚫고 나갔다 */
  const long = mk({ name: "우리동네 반찬가게 본점" });
  const sizes = [...long.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));
  t("글자 크기가 나온다", sizes.length > 0);
  t("★ 긴 이름은 크기가 줄거나 두 줄이 된다",
    sizes.every((n) => n <= 150) && (sizes.some((n) => n < 150) || (long.match(/<text/g) ?? []).length >= 2),
    `크기: ${sizes.join(", ")} · 줄 수: ${(long.match(/<text/g) ?? []).length}`);
  const short = mk({ name: "온" });
  t("짧은 이름은 크게 나온다", Math.max(...[...short.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))) >= 100);
}

console.log("\n── 사장님이 친 글자가 SVG 를 깨뜨리지 않는다 ──");
{
  /* ⚠ 상호는 사장님이 직접 치는 값이다. < 나 & 가 그대로 들어가면 그림이 깨진다 */
  const evil = mk({ name: '김&박 <b>철물점</b>' });
  t("★ 원문에 날것의 '<' 가 없다", !/>\s*[^<]*<b>/.test(evil), "이스케이프가 안 됐다");
  t("&amp; 로 바뀌어 있다", evil.includes("&amp;"));
  t("그래도 그림은 온전하다", evil.startsWith("<svg") && evil.endsWith("</svg>"));
}

console.log("\n── 심볼 15개가 전부 그려진다 ──");
{
  t(`심볼이 15개다 (지금 ${SYMBOLS.length}개)`, SYMBOLS.length === 15);
  const broken = SYMBOLS.filter((s) => !/^[Mm]/.test(s.d.trim()) || s.d.length < 10);
  t("★ 모든 심볼이 제대로 된 path 다", broken.length === 0,
    broken.length ? `이상한 것: ${broken.map((b) => b.id).join(", ")}` : "");
  const dup = SYMBOLS.map((s) => s.id).filter((v, i, a) => a.indexOf(v) !== i);
  t("겹치는 심볼 이름이 없다", dup.length === 0, dup.join(", "));
}

console.log("\n── 빈 값·이상한 값에도 안 깨진다 ──");
{
  t("이름이 비어도 로고가 나온다", mk({ name: "" }).includes("<text"));
  t("강조색이 이상하면 기본색으로", mk({ accent: "빨강" as string }).includes("#005B2A"));
  t("엠블럼에 이니셜이 없으면 OS", mk({ shape: "emblem", initials: "" }).includes("OS"));
  t("모르는 심볼이면 첫 번째로", mk({ shape: "symbol", symbol: "없는것" }).includes(SYMBOLS[0].d));
}

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
