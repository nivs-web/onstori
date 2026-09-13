/**
 * **아침에 한 줄. 「지금 어디까지 됐나」를 보여 준다.** (2026-09-13 신설)
 *
 * ★★ 왜 만들었나: 인수인계 기록이 네 곳에 나뉘어 있어서(대기표·진행·결정·팀장님들),
 *   회장님이 아침마다 그 네 곳을 손으로 열어 보셔야 했다. 한 곳이라도 빠지면
 *   「코드는 다 됐는데 열쇠를 안 넣어 안 도는」 일이 며칠씩 묻힌다.
 *
 * ⚠ **아무것도 바꾸지 않는다. 읽기만 한다.** 몇 번을 돌려도 안전하다.
 * ⚠ 네트워크가 끊겨 있어도 죽지 않는다 — 운영 확인만 건너뛴다.
 *
 * 쓰는 법:  npm run 아침
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const C = { dim: "[2m", b: "[1m", r: "[0m", y: "[33m", g: "[32m", red: "[31m" };
const line = (s = "") => console.log(s);
const head = (s) => { line(""); line(`${C.b}${s}${C.r}`); line("─".repeat(64)); };

/** 파일을 읽되, 없으면 죽지 않고 빈 글자를 준다 */
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/* ═══════════ ① 사람의 손을 기다리는 일 — 가장 먼저 ═══════════ */
head("① 지금 막혀 있는 것  (docs/WAITING.md)");
{
  const w = read("docs/WAITING.md");
  if (!w) {
    line(`${C.red}⚠ docs/WAITING.md 가 없습니다. START-HERE.md 를 보세요.${C.r}`);
  } else {
    /* 「🔴 지금 막혀 있는 것」부터 「✅ 끝난 일」 직전까지만 보여 준다 */
    const from = w.indexOf("## 🔴");
    const to = w.indexOf("## ✅");
    const body = from >= 0 ? w.slice(from, to > from ? to : undefined) : w;
    const rows = body.split("\n").filter((l) => l.startsWith("| ") && !l.includes("---") && !/^\|\s*무엇\s*\|/.test(l));
    if (!rows.length) line(`${C.g}막힌 일이 없습니다.${C.r}`);
    for (const l of body.split("\n")) {
      if (l.startsWith("### ")) line(`\n${C.y}${l.replace("### ", "▸ ")}${C.r}`);
      else if (l.startsWith("| ") && !l.includes("---") && !/^\|\s*무엇\s*\|/.test(l)) {
        const cols = l.split("|").map((x) => x.trim()).filter(Boolean);
        line(`  · ${cols[0]}`);
        if (cols[1]) line(`    ${C.dim}${cols[1]}${C.r}`);
      }
    }
  }
}

/* ═══════════ ② 어젯밤까지 무엇이 끝났나 ═══════════ */
head("② 마지막 마디  (docs/PROGRESS.md 맨 위)");
{
  const p = read("docs/PROGRESS.md").split("\n");
  const i = p.findIndex((l) => l.startsWith("## "));
  if (i < 0) line(`${C.dim}(기록 없음)${C.r}`);
  else {
    line(`${C.b}${p[i].replace("## ", "")}${C.r}`);
    /* 그 마디의 소제목만 훑어 준다 — 본문은 파일에서 읽으시라고 안내 */
    const next = p.findIndex((l, k) => k > i && l.startsWith("## "));
    const chapter = p.slice(i + 1, next > i ? next : i + 60);
    for (const l of chapter.filter((l) => l.startsWith("### ")).slice(0, 8)) {
      line(`  ${l.replace("### ", "· ")}`);
    }
  }
}

/* ═══════════ ③ 팀장님들 최신 ═══════════ */
head("③ 다른 팀 최신 기록  (읽기만 합니다)");
{
  const base = "../../fable51plandept/AI_Context";
  const names = { KIM: "김팀장", PARK: "박팀장", SANGMU: "상무님", TECH: "기술참모님", VICE: "부회장님" };
  if (!existsSync(base)) {
    line(`${C.dim}(AI_Context 폴더를 못 찾았습니다 — 경로: ${base})${C.r}`);
  } else {
    for (const dir of readdirSync(base)) {
      const f = `${base}/${dir}/LATEST.md`;
      const txt = read(f);
      if (!txt) { line(`  ${(names[dir] ?? dir).padEnd(8)} ${C.dim}(LATEST.md 없음)${C.r}`); continue; }
      /* 첫 제목 한 줄만 — 자세한 것은 파일을 열어 본다 */
      const title = txt.split("\n").find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") ?? "";
      line(`  ${(names[dir] ?? dir).padEnd(8)} ${title.slice(0, 50)}`);
    }
  }
}

/* ═══════════ ④ 저장소가 깨끗한가 ═══════════ */
head("④ 저장소 상태");
{
  try {
    const st = execSync("git status --short", { encoding: "utf8" }).trim();
    const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
    const ahead = execSync("git rev-list --count @{u}..HEAD 2>/dev/null || echo 0", { encoding: "utf8", shell: "bash" }).trim();
    line(`  가지(branch): ${branch}`);
    line(`  아직 안 올린 커밋: ${ahead === "0" ? `${C.g}없음${C.r}` : `${C.y}${ahead}개 — push 하세요${C.r}`}`);
    if (!st) line(`  고친 파일: ${C.g}없음 (깨끗합니다)${C.r}`);
    else {
      const files = st.split("\n");
      line(`  고친 파일: ${C.y}${files.length}개${C.r}`);
      for (const f of files.slice(0, 8)) line(`    ${C.dim}${f}${C.r}`);
      if (files.length > 8) line(`    ${C.dim}… 그 밖 ${files.length - 8}개${C.r}`);
    }
  } catch {
    line(`${C.dim}(git 정보를 못 읽었습니다)${C.r}`);
  }
}

/* ═══════════ ⑤ 운영이 살아 있나 — 읽기만 한다 ═══════════ */
head("⑤ 운영 확인  (읽기만 합니다 · 몇 초 걸립니다)");
{
  const urls = [
    ["첫 화면", "https://onstori.com/"],
    ["자주 묻는 질문", "https://onstori.com/faq"],
    ["손님 홈페이지 예시", "https://onstori.com/sample-interior"],
  ];
  for (const [name, url] of urls) {
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const ok = res.status === 200;
      line(`  ${name.padEnd(12)} ${ok ? `${C.g}정상 (200)${C.r}` : `${C.red}이상 (${res.status})${C.r}`}`);
    } catch {
      line(`  ${name.padEnd(12)} ${C.dim}확인 못 함 (인터넷 연결)${C.r}`);
    }
  }
}

line("");
line(`${C.dim}자세한 것: docs/WAITING.md · docs/PROGRESS.md · docs/DECISIONS.md${C.r}`);
line(`${C.dim}코드 검사: npm run 검사${C.r}`);
line("");
