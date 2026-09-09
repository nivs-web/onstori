import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULTS, MODE_TOKENS } from "../config/design";
import { themeVarsFull } from "../lib/design-tokens";

/**
 * 테마 **기본값과 어두운 값을 globals.css 에 박아 넣는다** (2026-09-08~09, S1·S2).
 *
 * 왜 필요한가: 기본 설정인데도 값 78개를 페이지마다 다시 보내면 첫 페이지가
 * **1,292 B** 무거워진다(2026-09-08 프로덕션 실측). 기본값을 CSS 에 한 번 두면
 * — CSS 는 한 번 받아 캐시된다 — 페이지는 **기본과 다른 것만** 실어 나른다.
 * 기본이면 0 바이트다.
 *
 * 어두운 값도 같은 이유로 CSS 에 둔다. 그러면 어두운 화면도 **나르는 양이 0** 이고,
 * 화면은 `data-mode="dark"` 표시만 바꾸면 된다.
 *
 * ⚠ 그래서 이 블록과 `config/design.ts` 가 **어긋나면 안 된다.**
 *   어긋나면 화면이 설정과 다르게 뜨는데 아무도 눈치채지 못한다.
 *   `--check` 로 돌리면 어긋났을 때 종료 코드 1 로 죽는다. **prebuild 에 걸려 있다.**
 *
 * 실행: `npx tsx scripts/design-sync-css.ts`         (다시 써 넣기)
 *      `npx tsx scripts/design-sync-css.ts --check`  (어긋났는지 검사만)
 */

const CSS = "app/globals.css";
const START = "/* THEME-DEFAULTS:START — scripts/design-sync-css.ts 가 생성한다. 손으로 고치지 마라 */";
const END = "/* THEME-DEFAULTS:END */";

function render(): string {
  const vars = themeVarsFull(DEFAULTS.site);
  const light = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  const dark = Object.entries(MODE_TOKENS.dark).map(([k, v]) => `  ${k}: ${v};`);
  const lightMode = Object.entries(MODE_TOKENS.light).map(([k, v]) => `  ${k}: ${v};`);
  return [
    START,
    "/* 테마 엔진 기본값 = config/design.ts 의 기본 · 밝은 · 온스토리초록.",
    "   서버는 이 기본과 **다른 값만** 화면에 심는다(lib/design-tokens.ts).",
    `   ${light.length}개. 값을 고치려면 config/design.ts 를 고치고 이 스크립트를 다시 돌린다. */`,
    ":root {",
    ...light,
    "}",
    "",
    "/* 밝은/어두운 값 — CSS 에 한 벌씩 둔다. 화면은 표시(data-mode)만 바꾸면 된다.",
    "   ★ 그래서 어두운 화면도 서버가 나르는 양이 0 이다.",
    "   ★ 이 표시는 `<html>` 에도, 화면 일부를 감싼 상자에도 붙일 수 있다.",
    "     어드민은 **상자에** 붙인다 — 안에 띄우는 손님 미리보기까지 어두워지면 안 되기 때문이다.",
    "",
    '   ⚠ `[data-mode="light"]` 를 **반드시 같이 둬야 한다.** 없으면 바깥이 어두울 때',
    "     안쪽 상자를 밝게 해도 **되돌아오지 않는다** — 어두운 값이 그대로 물려 내려온다.",
    "     (홈을 어둡게 하고 어드민만 밝게 하는 조합에서 2026-09-09 조사가 잡아냈다.)",
    `   각 ${dark.length}개. MODE_TOKENS 에서 생성한다. */`,
    '[data-mode="light"] {',
    ...lightMode,
    "}",
    "",
    '[data-mode="dark"] {',
    ...dark,
    "}",
    END,
  ].join("\n");
}

const css = readFileSync(CSS, "utf8");
/* ⚠ 이 저장소의 파일은 윈도우 줄바꿈(CRLF)이다. 스크립트가 LF 로 쓰면 **내용은 같은데
   모든 줄이 달라져** `--check` 가 매번 「어긋났다」고 한다. 파일의 방식을 그대로 따른다. */
const EOL = css.includes("\r\n") ? "\r\n" : "\n";
const block = render().split("\n").join(EOL);
const i = css.indexOf(START);
const j = css.indexOf(END);

let next: string;
if (i >= 0 && j > i) {
  next = css.slice(0, i) + block + css.slice(j + END.length);
} else {
  /* 아직 블록이 없다 — 첫 `:root` 블록이 **끝난 뒤**에 넣는다.
     ⚠ `:root` 안에 넣으면 안 된다. 어두운 블록은 최상위 선택자라 중첩이 필요해지고,
       중첩이 처리되지 않으면 **조용히 아무 일도 일어나지 않는다.** */
  const rootStart = css.indexOf(":root {");
  const rootEnd = css.indexOf("\n}", rootStart);
  if (rootStart < 0 || rootEnd < 0) throw new Error("globals.css 에서 :root 를 못 찾았다");
  const after = rootEnd + 2;
  next = css.slice(0, after) + EOL + EOL + block + EOL + css.slice(after);
}

if (process.argv.includes("--check")) {
  if (next === css) {
    console.log("✅ globals.css 의 테마 값이 config/design.ts 와 같다");
    process.exit(0);
  }
  console.log("❌ globals.css 의 테마 값이 config/design.ts 와 어긋났다.");
  console.log("   `npx tsx scripts/design-sync-css.ts` 를 돌려 맞춘 뒤 커밋해라.");
  process.exit(1);
}

if (next === css) {
  console.log("변경 없음 — 이미 같다");
} else {
  writeFileSync(CSS, next);
  console.log(`globals.css 갱신 — 밝은 ${Object.keys(themeVarsFull(DEFAULTS.site)).length}개 · 어두운 ${Object.keys(MODE_TOKENS.dark).length}개`);
}
