/* 대비 전수 검사.
   글자 뒤에 실제로 무엇이 깔려 있는지를 **화면 픽셀로** 잰다 — 사진·그라데이션 위 글자는
   CSS 배경색만 봐서는 알 수 없다. 글자를 잠시 투명하게 만든 뒤 그 자리를 캡처해
   평균색을 구하고, 글자색과의 대비를 계산한다. 화면 한 칸씩 내려가며 전 구간을 본다.
   기준: 본문 4.5:1 · 큰 제목(24px 이상 굵게) 3:1. */
import puppeteer from "puppeteer-core";
import sharp from "sharp";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const lum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const parse = (c) => {
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
};

const COLLECT = () => {
  document.getElementById("__hide")?.remove();
  document.querySelectorAll("[data-c]").forEach((e) => e.removeAttribute("data-c"));
  const out = [];
  let i = 0;
  for (const el of document.querySelectorAll("h1,h2,h3,p,span,a,li,dd,dt,td,th,button,figcaption,blockquote")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!(r.width > 2 && r.height > 2 && r.top > 0 && r.bottom < innerHeight)) continue;
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) continue;
    const txt = el.textContent.trim();
    if (txt.length < 2) continue;
    if ([...el.children].some((c) => c.textContent.trim().length > 1)) continue;
    el.setAttribute("data-c", String(out.length));
    out.push({
      sel: el.tagName + "." + String(el.className).slice(0, 22),
      txt: txt.slice(0, 20), color: cs.color,
      size: parseFloat(cs.fontSize), weight: +cs.fontWeight,
      x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      w: Math.round(r.width), h: Math.round(r.height),
    });
    if (++i > 300) break;
  }
  return out;
};

const HIDE = () => {
  const st = document.createElement("style");
  st.id = "__hide";
  st.textContent = "[data-c]{color:transparent !important;text-shadow:none !important}";
  document.head.appendChild(st);
};

async function scan(shotB64, items, bad, stats) {
  const { data, info } = await sharp(Buffer.from(shotB64, "base64")).raw().toBuffer({ resolveWithObject: true });
  for (const it of items) {
    let R = 0, G = 0, B = 0, n = 0;
    const hx = Math.min(40, it.w >> 1), hy = Math.min(8, it.h >> 1);
    for (let dx = -hx; dx <= hx; dx += 8) {
      for (let dy = -hy; dy <= hy; dy += 4) {
        const px = it.x + dx, py = it.y + dy;
        if (px < 0 || py < 0 || px >= info.width || py >= info.height) continue;
        const o = (py * info.width + px) * info.channels;
        R += data[o]; G += data[o + 1]; B += data[o + 2]; n++;
      }
    }
    if (!n) continue;
    const bg = { r: R / n, g: G / n, b: B / n };
    const fg = parse(it.color);
    if (!fg) continue;
    const cr = +ratio(fg, bg).toFixed(2);
    const large = it.size >= 24 && it.weight >= 600;
    if (large) stats.worstBig = Math.min(stats.worstBig, cr);
    else stats.worstBody = Math.min(stats.worstBody, cr);
    const need = large ? 3 : 4.5;
    if (cr < need) bad.push({ ...it, cr, need, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
  }
}

(async () => {
  const urls = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    // 첫 페이지는 섹션이 18개라 요소가 많다. 기본 30초로는 중간에 끊긴다
    // (2026-09-07: / 가 세 폭 모두 "Runtime.callFunctionOn timed out" 으로 검사 자체를 못 했다).
    protocolTimeout: 180000,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  let totalBad = 0;
  /* ★ 「건너뜀」과 「통과」를 구분한다 (2026-09-07 회장님 지시).
     검사가 조용히 건너뛰면 "미달 0건"이 나오는데, 그걸 통과로 읽으면 안 된다.
     실제로 첫 페이지가 세 폭 모두 건너뛰면서 0건으로 보고되고 있었다. */
  const lines = [];
  const say = (t) => lines.push(t);
  let 검사함 = 0;
  const 건너뜀 = [];

  for (const url of urls) {
    for (const W of [390, 768, 1440]) {
      const H = W === 390 ? 844 : W === 768 ? 1024 : 900;
      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        // ⚠ 등장 애니메이션을 꺼야 한다. 페이드 도중에 재면 반투명한 섹션 뒤 배경이
        //    섞여 들어와 실제와 다른 대비가 나온다(2026-09-07 오독 경험).
        await page.addStyleTag({ content: ".reveal,.reveal-stagger>*{animation:none !important;opacity:1 !important;transform:none !important}" });
        // 사진이 다 들어온 뒤에 잰다
        /* ⚠ 상한을 두지 않으면 **영영 안 끝난다.** loading="lazy" 사진은 화면에 들어오기 전까지
           complete 가 false 라서 onload 가 오지 않는다. 첫 페이지가 세 폭 모두
           "Runtime.callFunctionOn timed out" 으로 검사조차 못 되던 원인이다(2026-09-07). */
        await page.evaluate(() => Promise.race([
          Promise.all([...document.images].map((im) => im.complete || new Promise((r) => { im.onload = im.onerror = r; }))),
          new Promise((r) => setTimeout(r, 6000)),
        ]));
        await new Promise((r) => setTimeout(r, 1800));
        const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
        const steps = Math.min(16, Math.max(1, Math.ceil(pageH / (H * 0.9))));
        const bad = [];
        const stats = { worstBig: Infinity, worstBody: Infinity };
        let checked = 0;
        for (let s = 0; s < steps; s++) {
          /* ⚠ 지난 단계의 data-c 표시를 반드시 지운다.
             안 지우면 `querySelectorAll("[data-c]")` 가 **지난 화면의 요소까지** 긁어 오고,
             번호가 겹쳐 **엉뚱한 요소의 좌표**로 픽셀을 읽는다.
             2026-09-07 에 어두운 섹션의 «이정표» 를 흰 배경 위라고 1.39:1 로 잘못 신고했다. */
          await page.evaluate((y) => {
            document.getElementById("__hide")?.remove();
            document.querySelectorAll("[data-c]").forEach((e) => e.removeAttribute("data-c"));
            window.scrollTo(0, y);
          }, s * H * 0.9);
          await new Promise((r) => setTimeout(r, 600));
          const items = await page.evaluate(COLLECT);
          checked += items.length;
          if (!items.length) continue;
          await page.evaluate(HIDE);
          await new Promise((r) => setTimeout(r, 700));   /* 300→700ms: 어두운 섹션이 아직 안 칠해진 채로 읽혀 오탐이 났다(2026-09-07 «이정표» 1.39:1) */
          /* ⚠ 좌표를 여기서 다시 읽는다. 사진이 늦게 들어오면 그사이 레이아웃이 밀려
             처음 잡아둔 좌표가 엉뚱한 곳을 가리킨다 — 어두운 섹션 글자를 흰 배경 위라고
             잘못 읽는 사고가 났다(2026-09-07). */
          const fresh = await page.evaluate(() => {
            const m = {};
            document.querySelectorAll("[data-c]").forEach((e) => {
              const r = e.getBoundingClientRect();
              m[e.getAttribute("data-c")] = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), on: r.top > 0 && r.bottom < innerHeight };
            });
            return m;
          });
          const live = items.map((it, k) => ({ ...it, ...(fresh[k] || {}) })).filter((it) => it.on);
          await scan(await page.screenshot({ encoding: "base64" }), live, bad, stats);
        }
        // ⚠ 글자를 하나도 못 봤으면 "통과"가 아니라 "건너뜀"이다
        if (!checked) {
          건너뜀.push(`${url} @${W} — 잰 글자가 0개(빈 화면이거나 수집이 안 됐다)`);
          say(`\n── ${url.replace("http://localhost:3001", "")} @${W}  ⏭ 건너뜀 — 잰 글자 0개`);
          await page.close();
          continue;
        }
        검사함++;
        totalBad += bad.length;
        const fmt = (v) => (v === Infinity ? "-" : v.toFixed(2));
        say(`\n── ${url.replace("http://localhost:3001", "")} @${W}  검사 ${checked}개 · 최저 제목 ${fmt(stats.worstBig)}:1 · 최저 본문 ${fmt(stats.worstBody)}:1`);
        if (!bad.length) say("   ✅ 기준 미달 없음");
        const seen = new Set();
        for (const b of bad) {
          const k = b.sel + b.txt;
          if (seen.has(k)) continue;
          seen.add(k);
          if (seen.size > 12) break;
          say(`   ⚠ ${String(b.cr).padStart(5)}:1 (필요 ${b.need})  ${b.size}px/${b.weight}  ${b.sel.padEnd(28)} 글자${b.color} 배경${b.bg}  "${b.txt}"`);
        }
      } catch (e) {
        // ⚠ 실패를 조용히 넘기지 않는다 — 맨 위 경고로 올린다
        건너뜀.push(`${url} @${W} — ${e.message.slice(0, 70)}`);
        say(`
── ${url.replace("http://localhost:3001", "")} @${W}  ⏭ 건너뜀 — ${e.message.slice(0, 60)}`);
      }
      await page.close();
    }
  }
  const 총칸 = urls.length * 3;
  if (건너뜀.length) {
    console.log("\n" + "⚠".repeat(30));
    console.log(`⚠ 경고 — ${총칸}칸 중 ${건너뜀.length}칸을 **검사하지 못했다.** 아래 "미달 0건"은 그 칸을 뺀 결과다.`);
    for (const s of 건너뜀) console.log("   ⏭ " + s);
    console.log("⚠".repeat(30));
  }
  console.log(lines.join("\n"));
  console.log(`\n합계 미달 ${totalBad}건 · 검사함 ${검사함}칸 / 건너뜀 ${건너뜀.length}칸 (전체 ${총칸}칸 = 주소 ${urls.length} × 폭 3)`);
  if (건너뜀.length) { console.log("⚠ 건너뛴 칸이 있다. 전부 통과했다고 말하면 안 된다."); process.exitCode = 2; }
  await browser.close();
})().catch((e) => { console.error(e.stack); process.exit(1); });
