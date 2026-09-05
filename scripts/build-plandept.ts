/**
 * 사업 설계도 대시보드 생성 — content/onstoriplandept/index.html 한 파일.
 * (운영자 전용 — 2026-09-04 회장님 결정. public/ 에 두면 누구나 볼 수 있어 content/ 로 옮겼고
 *  app/onstoriplandept/[[...path]]/route.ts 가 ADMIN_KEY 쿠키 확인 뒤에만 내보낸다.)
 * 실행: npx tsx scripts/build-plandept.ts   (npm run build 의 prebuild 로 자동 실행)
 *
 * 왜 생성하는가: md 파일을 손으로 박아넣으면 다음 커밋에 바로 낡는다. 빌드마다 저장소의
 * 최신 문서를 읽어 다시 쓰므로 배포된 페이지는 항상 그 배포 시점의 저장소와 일치한다.
 *
 * 왜 한 파일인가: 사장님이 밖에서·자기 전에·아침에 주소 하나로 열어보는 용도다.
 * 마크다운 문서는 빌드 때 HTML로 렌더하고, 자체 CSS를 가진 기획 원본(설계서·선판매킷·벤치)은
 * <script type="text/plain"> 에 원문 그대로 담았다가 클릭 시 iframe(srcdoc)에 부어 격리한다.
 * 이스케이프 부풀림도 없고 바깥 CSS와 섞이지도 않는다.
 *
 * 공개 범위: noindex + robots.txt 차단. 로그인 게이트는 없다(2026-09-02 사용자 결정 —
 * 트래픽이 늘면 그때 붙인다). 주소를 아는 사람만 들어온다는 전제.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "content", "onstoriplandept");
const OUT = join(OUT_DIR, "index.html");

/* ────────────────── 문서 목록 ────────────────── */

type Doc = {
  id: string;
  label: string;
  note: string;
  file: string;
  kind: "md" | "html";
};

type Group = { title: string; docs: Doc[] };

const GROUPS: Group[] = [
  {
    title: "기획 원본",
    docs: [
      { id: "design", label: "온스토리 구축 설계서", note: "최초 설계 · 전체 구조", file: "docs/design/design-doc.html", kind: "html" },
      { id: "presale", label: "선판매 킷", note: "당근 초안 · 응대 템플릿", file: "docs/design/presale-kit.html", kind: "html" },
      { id: "bench", label: "이미지뱅크 모델 벤치", note: "히어로=Pro 결정 근거", file: "docs/design/bank-bench.html", kind: "html" },
    ],
  },
  {
    title: "규칙 · 현황",
    docs: [
      { id: "claude", label: "CLAUDE.md", note: "불변 규칙 8개 · 작업 방식", file: "CLAUDE.md", kind: "md" },
      { id: "plan", label: "PLAN", note: "Phase 로드맵 · 현재 위치", file: "docs/PLAN.md", kind: "md" },
      { id: "progress", label: "PROGRESS", note: "작업 인수인계 · 최다 정보", file: "docs/PROGRESS.md", kind: "md" },
      { id: "decisions", label: "DECISIONS", note: "뒤집으면 안 되는 결정", file: "docs/DECISIONS.md", kind: "md" },
    ],
  },
  {
    title: "기술 문서",
    docs: [
      { id: "schema", label: "SCHEMA", note: "섹션 JSON 약속", file: "docs/SCHEMA.md", kind: "md" },
      { id: "vertex", label: "vertex-setup", note: "Vertex AI 콘솔 체크리스트", file: "docs/vertex-setup.md", kind: "md" },
      { id: "auth", label: "auth-setup", note: "Supabase Auth 체크리스트", file: "docs/auth-setup.md", kind: "md" },
      { id: "admin", label: "admin", note: "운영자 콘솔 기획", file: "docs/admin.md", kind: "md" },
      { id: "prompts", label: "prompt-pack", note: "AI 프롬프트 모음", file: "docs/prompt-pack.md", kind: "md" },
      { id: "presalemd", label: "presale", note: "선판매 트래커", file: "docs/presale.md", kind: "md" },
    ],
  },
];

/* ────────────────── 마크다운 → HTML ──────────────────
   외부 의존성 없이 이 저장소의 md 가 실제로 쓰는 문법만 다룬다:
   제목·표·코드펜스·인용·목록(중첩/체크박스)·수평선·인라인(굵게/코드/링크/취소선). */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string): string {
  let t = esc(s);
  // 코드 먼저 — 안쪽은 다른 규칙을 적용하지 않는다
  const codes: string[] = [];
  t = t.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return "" + (codes.length - 1) + "";
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/(\d+)/g, (_m, i) => "<code>" + esc(codes[Number(i)]) + "</code>");
  return t;
}

/** "- [ ] " / "- [x] " 를 체크박스로 */
function listItemBody(raw: string): string {
  const m = raw.match(/^\[([ xX~])\]\s+(.*)$/);
  if (!m) return inline(raw);
  const done = m[1].toLowerCase() === "x";
  return '<span class="cb ' + (done ? "on" : "off") + '">' + (done ? "✓" : "") + "</span>" + inline(m[2]);
}

function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const closeLists = (stack: { tag: string; indent: number }[]) => {
    while (stack.length) out.push("</" + stack.pop()!.tag + ">");
  };
  const listStack: { tag: string; indent: number }[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // 코드 펜스
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeLists(listStack);
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre class="code"' + (lang ? ' data-lang="' + esc(lang) + '"' : "") + "><code>" + esc(buf.join("\n")) + "</code></pre>");
      continue;
    }

    // 표: 헤더줄 + 구분줄
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      closeLists(listStack);
      const cells = (r: string) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push('<div class="tw"><table><thead><tr>' + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }

    // 제목
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeLists(listStack);
      const lv = h[1].length;
      out.push("<h" + lv + ' id="' + slug(h[2]) + '">' + inline(h[2]) + "</h" + lv + ">");
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { closeLists(listStack); out.push("<hr>"); i++; continue; }

    // 인용
    if (/^>\s?/.test(line)) {
      closeLists(listStack);
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push("<blockquote>" + buf.map((b) => inline(b)).join("<br>") + "</blockquote>");
      continue;
    }

    // 목록 (중첩은 들여쓰기 기준)
    const li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (li) {
      const indent = li[1].length;
      const tag = /^\d/.test(li[2]) ? "ol" : "ul";
      while (listStack.length && listStack[listStack.length - 1].indent > indent) out.push("</" + listStack.pop()!.tag + ">");
      if (!listStack.length || listStack[listStack.length - 1].indent < indent) {
        out.push("<" + tag + ">");
        listStack.push({ tag, indent });
      } else if (listStack[listStack.length - 1].tag !== tag) {
        out.push("</" + listStack.pop()!.tag + ">");
        out.push("<" + tag + ">");
        listStack.push({ tag, indent });
      }
      out.push("<li>" + listItemBody(li[3]) + "</li>");
      i++;
      continue;
    }

    // 빈 줄
    if (!line.trim()) { closeLists(listStack); i++; continue; }

    // 문단
    closeLists(listStack);
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+\.\s|\s*\|)/.test(lines[i]) && !/^(-{3,})\s*$/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    if (buf.length) out.push("<p>" + buf.map((b) => inline(b)).join("<br>") + "</p>");
    else { out.push("<p>" + inline(lines[i]) + "</p>"); i++; }
  }
  closeLists(listStack);
  return out.join("\n");
}

function slug(s: string): string {
  return "h-" + s.replace(/<[^>]*>/g, "").replace(/[^\wㄱ-힣]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
}

/** md 의 ## / ### 를 뽑아 문서 안 목차로 */
function outline(md: string): { lv: number; text: string; id: string }[] {
  const res: { lv: number; text: string; id: string }[] = [];
  let fenced = false;
  for (const l of md.replace(/\r\n/g, "\n").split("\n")) {
    if (/^```/.test(l)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = l.match(/^(#{2,3})\s+(.*)$/);
    if (m) res.push({ lv: m[1].length, text: m[2].replace(/[*`~]/g, ""), id: slug(m[2]) });
  }
  return res;
}

/* ────────────────── 상태 요약 (PLAN 의 체크박스에서) ────────────────── */

function phaseSummary(plan: string) {
  const rows: { mark: string; text: string }[] = [];
  for (const l of plan.split(/\r?\n/)) {
    const m = l.match(/^- \[([ x~])\]\s+(.*)$/);
    if (!m) continue;
    const t = m[2];
    if (!/^\*\*?P\d|^P\d/.test(t.replace(/^\*\*/, "").replace(/^~~/, ""))) continue;
    rows.push({ mark: m[1], text: t.replace(/\*\*/g, "").split("—")[0].split(":")[0].trim() });
  }
  return rows;
}

/* ────────────────── 생성 ────────────────── */

function readOr(p: string): string | null {
  const full = join(ROOT, p);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function gitInfo() {
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    const date = execSync("git log -1 --format=%cI", { cwd: ROOT }).toString().trim();
    return { sha, date };
  } catch {
    return { sha: "(git 정보 없음)", date: "" };
  }
}

function main() {
  const git = gitInfo();
  const builtAt = new Date().toLocaleString("sv");

  const payloads: string[] = [];
  const navGroups: string[] = [];
  let missing = 0;
  let firstId = "";

  for (const g of GROUPS) {
    const items: string[] = [];
    for (const d of g.docs) {
      const raw = readOr(d.file);
      if (raw === null) { console.warn("  ⚠ 없음: " + d.file); missing++; continue; }
      if (!firstId) firstId = d.id;
      const body = d.kind === "md" ? mdToHtml(raw) : raw;
      const ol = d.kind === "md" ? outline(raw) : [];
      payloads.push(
        '<script type="text/plain" id="p-' + d.id + '" data-kind="' + d.kind + '" data-file="' + esc(d.file) +
        '" data-outline="' + esc(JSON.stringify(ol)).replace(/"/g, "&quot;") + '">\n' + body + "\n<\/script>"
      );
      const kb = Math.round(raw.length / 1024);
      items.push(
        '<li><a href="#' + d.id + '" data-id="' + d.id + '"><span class="lbl">' + esc(d.label) +
        '</span><span class="note">' + esc(d.note) + '</span><span class="sz">' + kb + "KB</span></a></li>"
      );
    }
    if (items.length) navGroups.push('<div class="grp"><div class="grp-t">' + esc(g.title) + "</div><ul>" + items.join("") + "</ul></div>");
  }

  const plan = readOr("docs/PLAN.md") ?? "";
  const phases = phaseSummary(plan);
  const doneN = phases.filter((p) => p.mark === "x").length;
  const wipN = phases.filter((p) => p.mark === "~").length;
  const todoN = phases.filter((p) => p.mark === " ").length;

  const homeCards = phases.map((p) => {
    const cls = p.mark === "x" ? "ok" : p.mark === "~" ? "wip" : "todo";
    const badge = p.mark === "x" ? "완료" : p.mark === "~" ? "진행" : "미착수";
    return '<div class="pcard ' + cls + '"><span class="pb">' + badge + "</span>" + esc(p.text) + "</div>";
  }).join("");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, page({ navGroups, payloads, homeCards, doneN, wipN, todoN, git, builtAt, firstId }), "utf8");

  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log("✅ " + OUT.replace(ROOT, ".") + " — " + kb + "KB · 문서 " + payloads.length + "개" + (missing ? " · 누락 " + missing : ""));
}

function page(v: {
  navGroups: string[]; payloads: string[]; homeCards: string;
  doneN: number; wipN: number; todoN: number;
  git: { sha: string; date: string }; builtAt: string; firstId: string;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<title>온스토리 설계도 — 사업 전체 구조</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --paper:#FBFAF7; --surface:#FFFFFF; --sunk:#F4F2EC;
  --ink:#17191D; --muted:#6B7280; --faint:#8D93A0;
  --line:#E8E6E0; --line2:#D8D5CC;
  --accent:#0E7365; --accent-soft:#E9F3F1;
  --ok:#15803D; --ok-bg:#EAF6EE; --wip:#92600A; --wip-bg:#FDF4DC; --todo:#6B7280; --todo-bg:#F1F2F4;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#14161A; --surface:#1B1E23; --sunk:#101216;
  --ink:#ECE9E2; --muted:#9AA1AD; --faint:#767D89;
  --line:#2A2E35; --line2:#3A3F48;
  --accent:#5FBCAC; --accent-soft:#132A27;
  --ok:#63CE8A; --ok-bg:#12291B; --wip:#E5B458; --wip-bg:#2C2410; --todo:#9AA1AD; --todo-bg:#20242B;
}}
:root[data-theme="dark"]{
  --paper:#14161A; --surface:#1B1E23; --sunk:#101216;
  --ink:#ECE9E2; --muted:#9AA1AD; --faint:#767D89;
  --line:#2A2E35; --line2:#3A3F48;
  --accent:#5FBCAC; --accent-soft:#132A27;
  --ok:#63CE8A; --ok-bg:#12291B; --wip:#E5B458; --wip-bg:#2C2410; --todo:#9AA1AD; --todo-bg:#20242B;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans KR","Apple SD Gothic Neo",system-ui,sans-serif;line-height:1.7;letter-spacing:-.01em;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
.app{display:flex;min-height:100%}

/* 사이드바 */
.side{width:290px;flex:0 0 290px;background:var(--surface);border-right:1px solid var(--line);height:100vh;position:sticky;top:0;overflow-y:auto;padding:20px 0 40px}
.rooms{display:flex;gap:6px;padding:0 16px 12px}
.rooms a{flex:1;text-align:center;padding:6px;border-radius:999px;border:1px solid var(--line2);color:var(--ink);font-size:12.5px;text-decoration:none}
.rooms a[aria-current="true"]{background:#E1EB6E;color:#1B2C2C;border-color:#E1EB6E;font-weight:700}
.brand{padding:0 20px 16px;border-bottom:1px solid var(--line);margin-bottom:14px}
.brand b{display:block;font-size:16px;letter-spacing:-.02em}
.brand span{display:block;font-size:11.5px;color:var(--faint);font-family:"IBM Plex Mono",monospace;margin-top:3px}
.q{margin:0 16px 12px;position:relative}
.q input{width:100%;padding:8px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--paper);color:var(--ink);font:inherit;font-size:13px}
.q input::placeholder{color:var(--faint)}
.grp{margin-bottom:16px}
.grp-t{padding:0 20px 6px;font-size:11px;font-weight:600;color:var(--faint);letter-spacing:.08em;text-transform:uppercase}
.side ul{list-style:none;margin:0;padding:0}
.side li a{display:block;padding:8px 20px;text-decoration:none;color:var(--ink);border-left:3px solid transparent}
.side li a:hover{background:var(--sunk)}
.side li a.on{background:var(--accent-soft);border-left-color:var(--accent)}
.side .lbl{display:block;font-size:14px;font-weight:500}
.side .note{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}
.side .sz{display:none}
.side li a.hide{display:none}

/* 본문 */
.main{flex:1;min-width:0;padding:34px 40px 90px;max-width:1000px}
.bar{display:flex;align-items:center;gap:10px;margin-bottom:22px;flex-wrap:wrap}
.bar h1{font-size:22px;margin:0;letter-spacing:-.03em}
.bar .src{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--faint);background:var(--sunk);padding:2px 8px;border-radius:6px}
.menu{display:none}
.toc-in{background:var(--sunk);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:0 0 24px}
.toc-in b{font-size:11.5px;color:var(--faint);letter-spacing:.06em}
.toc-in ul{list-style:none;margin:6px 0 0;padding:0;columns:2;column-gap:26px}
.toc-in li{font-size:13px;break-inside:avoid;margin:2px 0}
.toc-in li.l3{padding-left:12px;color:var(--muted)}
.toc-in a{text-decoration:none}
.toc-in a:hover{text-decoration:underline}

/* 홈 */
.hero{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:24px;margin-bottom:22px}
.hero h2{margin:0 0 6px;font-size:19px;letter-spacing:-.03em}
.hero p{margin:0;color:var(--muted);font-size:14.5px}
.stats{display:flex;gap:10px;margin:16px 0 0;flex-wrap:wrap}
.stat{background:var(--sunk);border-radius:10px;padding:9px 14px;font-size:13px}
.stat b{font-size:18px;display:block;line-height:1.2}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-top:16px}
.pcard{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13.5px;background:var(--surface)}
.pcard .pb{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:20px;margin-right:7px}
.pcard.ok .pb{background:var(--ok-bg);color:var(--ok)}
.pcard.wip .pb{background:var(--wip-bg);color:var(--wip)}
.pcard.todo .pb{background:var(--todo-bg);color:var(--todo)}

/* 렌더된 마크다운 */
.doc h1,.doc h2,.doc h3,.doc h4{letter-spacing:-.025em;line-height:1.35;margin:1.9em 0 .6em}
.doc h1{font-size:24px} .doc h2{font-size:19px;padding-bottom:6px;border-bottom:1px solid var(--line)} .doc h3{font-size:16px} .doc h4{font-size:14.5px}
.doc h1:first-child,.doc h2:first-child{margin-top:0}
.doc p{margin:.75em 0;font-size:15px}
.doc ul,.doc ol{margin:.6em 0;padding-left:1.35em}
.doc li{margin:.28em 0;font-size:15px}
.doc code{font-family:"IBM Plex Mono",monospace;font-size:.87em;background:var(--sunk);padding:1.5px 5px;border-radius:5px;word-break:break-word}
.doc pre.code{background:var(--sunk);border:1px solid var(--line);border-radius:11px;padding:13px 15px;overflow-x:auto;margin:1em 0}
.doc pre.code code{background:none;padding:0;font-size:12.8px;line-height:1.62}
.doc blockquote{margin:1em 0;padding:10px 16px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 10px 10px 0;font-size:14.5px}
.doc hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.doc .tw{overflow-x:auto;margin:1em 0;border:1px solid var(--line);border-radius:11px}
.doc table{border-collapse:collapse;width:100%;font-size:13.5px}
.doc th,.doc td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.doc th{background:var(--sunk);font-weight:600;white-space:nowrap}
.doc tr:last-child td{border-bottom:0}
.doc del{color:var(--faint)}
.doc .cb{display:inline-block;width:15px;height:15px;border:1.5px solid var(--line2);border-radius:4px;margin-right:7px;vertical-align:-2px;text-align:center;font-size:11px;line-height:12px;color:var(--ok)}
.doc .cb.on{background:var(--ok-bg);border-color:var(--ok)}

/* 기획 원본 iframe */
.frame{width:100%;border:1px solid var(--line);border-radius:14px;background:var(--surface);min-height:70vh}
.fnote{font-size:12.5px;color:var(--muted);margin:0 0 10px}

footer{margin-top:60px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--faint);font-family:"IBM Plex Mono",monospace}

@media (max-width:900px){
  .app{display:block}
  .side{position:fixed;left:0;top:0;bottom:0;z-index:40;transform:translateX(-100%);transition:transform .22s;width:84vw;max-width:320px;flex:none;box-shadow:0 0 0 100vmax rgba(0,0,0,0);}
  .side.open{transform:none;box-shadow:0 0 0 100vmax rgba(0,0,0,.35)}
  .main{padding:16px 16px 70px;max-width:none}
  .menu{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line2);border-radius:9px;padding:6px 11px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
  .bar h1{font-size:18px}
  .toc-in ul{columns:1}
}
</style>
</head>
<body>
<div class="app">
  <aside class="side" id="side">
    <div class="rooms" aria-label="기획실 이동"><a href="/mainplan">기획1</a><a href="/plandept">기획2</a><a href="/onstoriplandept" aria-current="true">기획3</a></div>
    <div class="brand"><b>온스토리 설계도</b><span>onstori.com/onstoriplandept · 기획3</span></div>
    <div class="q"><input id="q" type="search" placeholder="문서 검색 (제목·본문)" autocomplete="off"></div>
    <div class="grp"><div class="grp-t">개요</div><ul><li><a href="#home" data-id="home"><span class="lbl">대시보드</span><span class="note">Phase 현황 한눈에</span></a></li></ul></div>
    ${v.navGroups.join("\n    ")}
  </aside>

  <main class="main">
    <div class="bar">
      <button class="menu" id="menu" aria-label="목록 열기">☰ 목록</button>
      <h1 id="title">대시보드</h1>
      <span class="src" id="src"></span>
    </div>
    <div id="toc"></div>
    <div id="content"></div>
    <footer>
      생성 ${v.builtAt} · 커밋 ${v.git.sha} · 저장소 문서에서 빌드 시 자동 생성 (scripts/build-plandept.ts)<br>
      noindex · 검색엔진 차단됨. 로그인 게이트 없음 — 주소를 아는 사람만 접근.
    </footer>
  </main>
</div>

<div id="home-tpl" hidden>
  <div class="hero">
    <h2>사업 전체 구조 한 장</h2>
    <p>왼쪽 목록에서 문서를 고르면 저장소의 <b>최신 내용</b>이 그대로 나옵니다. 이 페이지는 배포할 때마다 다시 생성됩니다.</p>
    <div class="stats">
      <div class="stat"><b>${v.doneN}</b>완료 Phase</div>
      <div class="stat"><b>${v.wipN}</b>진행 중</div>
      <div class="stat"><b>${v.todoN}</b>미착수</div>
    </div>
    <div class="pgrid">${v.homeCards}</div>
  </div>
  <p class="fnote">진척·잔여 항목의 단일 출처는 <b>PROGRESS</b>, 뒤집힌 결정은 <b>DECISIONS</b>가 최신입니다. 설계서는 <b>원안</b>이라 둘과 어긋날 수 있습니다.</p>
</div>

${v.payloads.join("\n")}

<script>
(function(){
  var content=document.getElementById("content"), title=document.getElementById("title"),
      srcEl=document.getElementById("src"), tocEl=document.getElementById("toc"),
      side=document.getElementById("side"), menu=document.getElementById("menu"), q=document.getElementById("q");
  var links=[].slice.call(document.querySelectorAll(".side a[data-id]"));

  function show(id){
    var link=links.filter(function(a){return a.dataset.id===id;})[0];
    if(!link){ id="home"; link=links[0]; }
    links.forEach(function(a){ a.classList.toggle("on", a===link); });
    title.textContent=link.querySelector(".lbl").textContent;
    tocEl.innerHTML=""; srcEl.textContent="";
    if(id==="home"){
      content.className=""; content.innerHTML=document.getElementById("home-tpl").innerHTML;
    } else {
      var p=document.getElementById("p-"+id);
      srcEl.textContent=p.dataset.file;
      if(p.dataset.kind==="md"){
        content.className="doc"; content.innerHTML=p.textContent;
        var ol=[]; try{ ol=JSON.parse(p.dataset.outline||"[]"); }catch(e){}
        if(ol.length>3){
          tocEl.innerHTML='<div class="toc-in"><b>이 문서 안</b><ul>'+ol.map(function(o){
            return '<li class="'+(o.lv===3?"l3":"")+'"><a href="#'+o.id+'">'+o.text+"</a></li>";
          }).join("")+"</ul></div>";
        }
      } else {
        content.className="";
        content.innerHTML='<p class="fnote">기획 원본 문서 — 자체 서식을 그대로 보존하기 위해 격리해 표시합니다.</p><iframe class="frame" id="fr"></iframe>';
        var fr=document.getElementById("fr");
        fr.srcdoc='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+p.textContent;
        fr.onload=function(){
          try{
            var d=fr.contentDocument;
            var fit=function(){ fr.style.height=Math.max(600,d.documentElement.scrollHeight+24)+"px"; };
            fit(); setTimeout(fit,300); setTimeout(fit,1200);
            if(window.ResizeObserver) new ResizeObserver(fit).observe(d.body);
          }catch(e){ fr.style.height="85vh"; }
        };
      }
    }
    window.scrollTo(0,0);
    side.classList.remove("open");
  }

  window.addEventListener("hashchange",function(){ show((location.hash||"#home").slice(1)); });
  menu && menu.addEventListener("click",function(){ side.classList.toggle("open"); });

  // 검색 — 제목·설명 + 본문 텍스트
  q.addEventListener("input",function(){
    var v=q.value.trim().toLowerCase();
    links.forEach(function(a){
      if(!v){ a.classList.remove("hide"); return; }
      var hay=a.textContent.toLowerCase();
      var p=document.getElementById("p-"+a.dataset.id);
      if(p && p.textContent.toLowerCase().indexOf(v)>-1) hay+=" hit";
      a.classList.toggle("hide", hay.indexOf(v)===-1 && hay.indexOf("hit")===-1);
    });
  });

  show((location.hash||"#home").slice(1));
})();
</script>
</body>
</html>
`;
}

main();
