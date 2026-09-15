/**
 * **만들어진 로고를 «눈으로» 보는 한 장.** (2026-09-16 지시 [5])
 * ⚠ 검사가 아니라 «구경»용이다. 화면에 실제로 어떻게 나오는지 대표님께 보여 드리려고 만든다.
 * ★ 우리 웹폰트를 불러 쓰므로 위저드 미리보기와 «같은» 그림이 나온다.
 * 쓰는 법:  npx tsx scripts/logo-sheet.ts   → logo-sheet.html
 */
import { writeFileSync } from "node:fs";
import { FONTS, SHAPES, makeLogoSvg } from "../lib/logo-maker";

const ACC = "#005B2A";
const cases = [
  ...SHAPES.map((s) => ({ t: `모양 · ${s.label}`, svg: makeLogoSvg({ name: "온스토리", shape: s.id, font: "pretendard", accent: ACC, symbol: "home", initials: "OS" }) })),
  ...FONTS.map((f) => ({ t: `글꼴 · ${f.label}`, svg: makeLogoSvg({ name: "온스토리", shape: "ultra", font: f.id, accent: ACC }) })),
  { t: "긴 이름 (두 줄로)", svg: makeLogoSvg({ name: "우리동네 반찬가게 본점", shape: "ultra", font: "pretendard", accent: ACC }) },
  { t: "짧은 이름", svg: makeLogoSvg({ name: "온", shape: "ultra", font: "pretendard", accent: ACC }) },
  { t: "영문", svg: makeLogoSvg({ name: "Onseutori", shape: "ultra", font: "pretendard", accent: ACC }) },
  { t: "심볼 · 컵", svg: makeLogoSvg({ name: "평화와평화", shape: "symbol", font: "pretendard", accent: ACC, symbol: "cup" }) },
];

writeFileSync("logo-sheet.html", `<!doctype html><meta charset="utf-8"><title>로고 미리보기</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<style>
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");
body{font-family:Pretendard,system-ui;background:#f4f5f6;padding:24px;margin:0}
h1{font-size:18px;margin:0 0 16px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
figure{margin:0;background:#fff;border-radius:14px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
figcaption{font-size:12px;color:#667;margin-top:8px}svg{width:100%;height:auto;display:block}
</style>
<h1>온스토리 글자 로고 — 모양 5 · 글꼴 5 · 그 밖</h1>
<div class="g">${cases.map((c) => `<figure>${c.svg}<figcaption>${c.t}</figcaption></figure>`).join("")}</div>`);
console.log(`로고 ${cases.length}장 → logo-sheet.html`);
