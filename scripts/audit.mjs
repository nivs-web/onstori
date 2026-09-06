/**
 * 눈으로 볼 목록 줄이기 — verify.js·contrast.js 가 **못 잡는** 것을 훑는다.
 * 실행: node scripts/audit.js http://localhost:3001/ [주소 ...]
 *
 * 찾는 것 (회장님 [K] 지시):
 *  ① 글자가 잘리는 곳 (넘쳐서 ... 되거나 상자 밖으로 나감)
 *  ② 어색하게 두 줄로 접히는 제목 (마지막 줄에 한 어절만 남음)
 *  ③ 버튼·아이콘 간격이 들쭉날쭉한 곳
 *  ④ 빈 화면인데 안내 문구가 없는 곳
 *  ⑤ 폰에서 누르기 애매한 곳 (44px 미만)
 * 고치지 않는다. 목록만 만든다.
 */
import puppeteer from "puppeteer-core";

const URLS = process.argv.slice(2);
const WIDTHS = [[390, 844, "폰"], [1440, 900, "PC"]];

const COLLECT = (label) => {
  const out = [];
  const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05 && r.width > 0 && r.height > 0; };
  const name = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0,2).join(".") : "");
  const txt = (e) => (e.textContent || "").replace(/\s+/g," ").trim().slice(0,34);

  // ① 글자 잘림 — 내용이 상자보다 넓은데 넘침을 감춘 곳
  // ⚠ .sr-only 는 화면낭독기 전용이라 **일부러** 1px 로 감춰 둔 것이다. 잘림이 아니다.
  const srOnly = (e) => e.closest(".sr-only") || getComputedStyle(e).clipPath !== "none";
  document.querySelectorAll("h1,h2,h3,p,span,a,button,li,td,th,dt,dd").forEach((e) => {
    if (!vis(e) || e.children.length || srOnly(e)) return;
    const s = getComputedStyle(e);
    const clipped = (s.overflow !== "visible" || s.textOverflow === "ellipsis");
    if (clipped && e.scrollWidth > e.clientWidth + 2) out.push({ 종류:"글자잘림", 요소:name(e), 글:txt(e), 값:`${e.scrollWidth}>${e.clientWidth}px` });
    if (e.scrollHeight > e.clientHeight + 3 && s.overflowY !== "visible" && s.overflowY !== "auto" && s.overflowY !== "scroll")
      out.push({ 종류:"세로잘림", 요소:name(e), 글:txt(e), 값:`${e.scrollHeight}>${e.clientHeight}px` });
  });

  // ② 마지막 줄에 한 어절만 남은 제목 (고아 어절)
  document.querySelectorAll("h1,h2,h3").forEach((e) => {
    /* ⚠ 자식 요소가 있으면 건드리지 않는다.
       제목 안에 번호 배지(<span>3</span>)가 들어 있으면 Range 가 배지와 글자를 따로 잡아
       **2줄로 오해**한다. /faq 의 «3녹화» 를 10줄이라고 신고했다(2026-09-07).
       상자가 글자보다 훨씬 높은 경우(세로로 늘어난 사이드바 제목)도 같이 걸러진다. */
    if (!vis(e) || e.children.length) return;
    const t = (e.textContent||"").trim(); if (!t || t.includes("\n")) return;
    const r = e.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(e).lineHeight) || r.height;
    const lines = Math.round(r.height / lh);
    if (lines < 2 || lines > 4) return;   // 5줄 넘게 잡히면 글자가 아니라 상자가 늘어난 것이다
    const rng = document.createRange(); rng.selectNodeContents(e);
    const rects = [...rng.getClientRects()];
    if (rects.length < 2) return;
    const last = rects[rects.length-1];
    if (last.width < r.width * 0.22) out.push({ 종류:"고아어절", 요소:name(e), 글:txt(e), 값:`${lines}줄·끝줄 ${Math.round(last.width)}px(${Math.round(last.width/r.width*100)}%)` });
  });

  // ③ 같은 부모 안 버튼들의 간격이 제각각
  document.querySelectorAll("div,ul,nav,section,form").forEach((p) => {
    const kids = [...p.children].filter((c) => vis(c) && /^(a|button)$/i.test(c.tagName));
    if (kids.length < 3) return;
    const gaps = [];
    for (let i=1;i<kids.length;i++){ const a=kids[i-1].getBoundingClientRect(), b=kids[i].getBoundingClientRect();
      if (Math.abs(a.top-b.top) < 4) gaps.push(Math.round(b.left-a.right)); }
    if (gaps.length < 2) return;
    const mn=Math.min(...gaps), mx=Math.max(...gaps);
    if (mx-mn > 8) out.push({ 종류:"간격들쭉", 요소:name(p), 글:txt(p), 값:`${mn}~${mx}px` });
  });

  // ⑤ 누르기 애매한 것 (44px 미만) — 폰에서만 의미 있다
  if (label === "폰") {
    const small = [...document.querySelectorAll("a,button,input[type=checkbox],select")].filter((e)=>{
      if (!vis(e)) return false; const r=e.getBoundingClientRect(); return r.height < 44 && r.width > 8; });
    if (small.length) out.push({ 종류:"작은터치", 요소:`${small.length}개`, 글:small.slice(0,3).map(txt).join(" / "), 값:"44px 미만" });
  }
  return out;
};

const b = await puppeteer.launch({ executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe", headless:true, args:["--no-sandbox","--hide-scrollbars"] });
let total = 0;
for (const url of URLS) {
  const rows = [];
  for (const [W,H,label] of WIDTHS) {
    const p = await b.newPage();
    await p.setViewport({ width:W, height:H, deviceScaleFactor:1 });
    try {
      await p.goto(url, { waitUntil:"networkidle2", timeout:60000 });
      await p.addStyleTag({ content:".reveal,.reveal-stagger>*{animation:none!important;opacity:1!important;transform:none!important}" });
      await p.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=innerHeight*0.8){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));} scrollTo(0,0); });
      await new Promise(r=>setTimeout(r,800));
      // ④ 빈 화면인데 안내가 없는가
      const body = await p.evaluate(()=>document.body.innerText.replace(/\s+/g," ").trim());
      if (body.length < 90) rows.push({ 어디:label, 종류:"내용없음", 요소:"body", 글:body.slice(0,40), 값:`글자 ${body.length}자` });
      for (const r of await p.evaluate(COLLECT, label)) rows.push({ 어디:label, ...r });
    } catch(e) { rows.push({ 어디:label, 종류:"열지못함", 요소:"-", 글:e.message.slice(0,50), 값:"-" }); }
    await p.close();
  }
  const path = url.replace(/^https?:\/\/[^/]+/,"") || "/";
  if (!rows.length) { console.log(`\n═══ ${path}  ✅ 걸리는 것 없음`); continue; }
  console.log(`\n═══ ${path}  ${rows.length}건`);
  for (const r of rows) console.log(`  ${r.어디.padEnd(3)} ${r.종류.padEnd(6)} ${String(r.요소).padEnd(26)} ${String(r.값).padEnd(20)} "${r.글}"`);
  total += rows.length;
}
console.log(`\n합계 ${total}건`);
await b.close();
