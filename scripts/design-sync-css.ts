import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULTS } from "../config/design";
import { themeVarsFull } from "../lib/design-tokens";

/**
 * 테마 **기본값을 globals.css 에 박아 넣는다** (2026-09-08, S1).
 *
 * 왜 필요한가: 기본 설정(기본/밝은/온스토리초록)인데도 값 78개를 페이지마다 다시
 * 보내면 첫 페이지가 **1,292 B** 무거워진다(2026-09-08 프로덕션 실측).
 * 기본값을 CSS 에 한 번 두면 — CSS 는 한 번 받아 캐시된다 — 페이지는
 * **기본과 다른 것만** 실어 나른다. 기본이면 0 바이트다.
 *
 * ⚠ 그래서 이 블록과 `config/design.ts` 가 **어긋나면 안 된다.**
 *   어긋나면 화면이 기본값과 다르게 뜨는데 아무도 눈치채지 못한다.
 *   `--check` 로 돌리면 어긋났을 때 종료 코드 1 로 죽는다. 빌드 전에 돌린다.
 *
 * 실행: `npx tsx scripts/design-sync-css.ts`         (다시 써 넣기)
 *      `npx tsx scripts/design-sync-css.ts --check`  (어긋났는지 검사만)
 */

const CSS = "app/globals.css";
const START = "  /* THEME-DEFAULTS:START — scripts/design-sync-css.ts 가 생성한다. 손으로 고치지 마라 */";
const END = "  /* THEME-DEFAULTS:END */";

function render(): string {
  const vars = themeVarsFull(DEFAULTS.site);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return [
    START,
    "  /* 테마 엔진 기본값 = config/design.ts 의 기본/밝은/온스토리초록.",
    "     서버는 이 기본과 **다른 값만** 화면에 심는다(lib/design-tokens.ts).",
    `     ${lines.length}개. 값을 고치려면 config/design.ts 를 고치고 이 스크립트를 다시 돌린다. */`,
    ...lines,
    END,
  ].join("\n");
}

const css = readFileSync(CSS, "utf8");
const block = render();
const i = css.indexOf(START);
const j = css.indexOf(END);

let next: string;
if (i >= 0 && j > i) {
  next = css.slice(0, i) + block + css.slice(j + END.length);
} else {
  // 아직 블록이 없다 — :root 의 닫는 괄호 바로 앞에 넣는다
  const rootStart = css.indexOf(":root {");
  const rootEnd = css.indexOf("\n}", rootStart);
  if (rootStart < 0 || rootEnd < 0) throw new Error("globals.css 에서 :root 를 못 찾았다");
  next = css.slice(0, rootEnd + 1) + "\n" + block + "\n" + css.slice(rootEnd + 1);
}

if (process.argv.includes("--check")) {
  if (next === css) {
    console.log("✅ globals.css 기본값이 config/design.ts 와 같다");
    process.exit(0);
  }
  console.log("❌ globals.css 기본값이 config/design.ts 와 어긋났다.");
  console.log("   `npx tsx scripts/design-sync-css.ts` 를 돌려 맞춘 뒤 커밋해라.");
  process.exit(1);
}

if (next === css) {
  console.log("변경 없음 — 이미 같다");
} else {
  writeFileSync(CSS, next);
  console.log(`globals.css 갱신 — 기본값 ${Object.keys(themeVarsFull(DEFAULTS.site)).length}개`);
}
