/* 반응형·완료조건 자동 점검 — puppeteer-core 로 390/768/1440 을 한 번에 잰다. */
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const WIDTHS = [
  { w: 390, h: 844, name: "390" },
  { w: 768, h: 1024, name: "768" },
  { w: 1440, h: 900, name: "1440" },
];

const CHECK = () => {
  const isMobile = innerWidth < 768;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
  };
  const q = (sel) => [...document.querySelectorAll(sel)].filter(vis);

  /* 48×48 은 **손가락 화면에서만** 따진다(docs/DESIGN.md §9).
     마우스에는 필요 없고, 걸면 PC 가로 메뉴·푸터가 쓸데없이 길어진다.
     문서화된 예외: 푸터에 숨긴 에디터 진입로(손님에겐 그냥 글자로 보여야 한다). */
  const tap = !isMobile ? [] :
    q("a,button,summary,select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])")
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 48 || r.width < 48; })
      .filter((e) => !e.closest("footer"))
      /* 문장 한가운데 있는 링크는 제외 — 48px 로 키우면 줄 간격이 무너진다(예외 6).
         문단에서 떨어져 나온 링크·버튼은 그대로 검사한다. */
      .filter((e) => !(e.tagName === "A" && e.parentElement &&
        /^(P|LI|TD|SPAN|SMALL)$/.test(e.parentElement.tagName) &&
        e.parentElement.textContent.trim().length > e.textContent.trim().length + 8));
  /* "본문" = 문장으로 읽히는 글. 라벨·키커·법적 각주는 t-small(15)·t-caption(13) 이 정상이다. */
  const text = q("p,li,dd,blockquote,td").filter(
    (e) => e.children.length === 0 && e.textContent.trim().length > 25 &&
      parseFloat(getComputedStyle(e).fontSize) < 16 &&
      !e.className.includes("t-caption") && !e.className.includes("t-small") && !e.closest("footer"));
  const shadow = q(".card,img,figure,.photo").filter((e) => {
    const cs = getComputedStyle(e);
    return cs.boxShadow !== "none" && !e.matches(":hover");
  });
  const btns = q(".btn-primary,.btn-lime");
  const tops = btns.map((b) => b.getBoundingClientRect().top + scrollY).sort((a, b) => a - b);
  let primaryMax = 0;
  for (let i = 0; i < tops.length; i++) {
    let n = 1;
    for (let j = i + 1; j < tops.length; j++) if (tops[j] - tops[i] < innerHeight) n++;
    primaryMax = Math.max(primaryMax, n);
  }

  // 모바일 전용 요소가 PC 에 나오는지 / 그 반대
  const burger = q('button[aria-label="메뉴 열기"]').length;
  const dock = q('nav[aria-label="연결 버튼"]').length;
  const desktopNav = q('nav[aria-label="이 사이트의 차례"], nav[aria-label="주 메뉴"]').length;

  /* position:fixed 가 **화면**이 아니라 조상 상자에 갇혔는지.
     backdrop-filter · transform · filter · perspective · contain 이 걸린 조상은
     fixed 자식의 기준 상자가 된다 — 시트가 헤더 56px 안에 갇혔던 바로 그 버그다. */
  const trapped = [];
  for (const el of document.querySelectorAll("*")) {
    if (getComputedStyle(el).position !== "fixed") continue;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      const bad = (c.backdropFilter && c.backdropFilter !== "none") ||
        (c.filter && c.filter !== "none") ||
        (c.transform && c.transform !== "none") ||
        (c.perspective && c.perspective !== "none") ||
        (c.contain && /paint|layout|strict|content/.test(c.contain)) ||
        (c.willChange && /transform|filter|perspective/.test(c.willChange));
      if (bad) {
        trapped.push(el.tagName + "." + String(el.className).slice(0, 20) + " ← " + n.tagName + "(" +
          (c.backdropFilter !== "none" ? "backdrop-filter" : c.filter !== "none" ? "filter" : c.transform !== "none" ? "transform" : "contain") + ")");
        break;
      }
    }
  }

  const hero = document.querySelector("#top");
  return {
    w: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth : 0,
    tap: tap.length,
    tapSample: tap.slice(0, 4).map((e) => ((e.getAttribute("aria-label") || e.textContent.trim()) || e.tagName).slice(0, 16)),
    text: text.length,
    textSample: text.slice(0, 3).map((e) => e.textContent.trim().slice(0, 24) + " @" + getComputedStyle(e).fontSize),
    shadow: shadow.length,
    primaryMax,
    burger, dock, desktopNav, isMobile,
    heroH: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    heroTop: hero ? Math.round(hero.getBoundingClientRect().top + scrollY) : null,
    trapped,
  };
};

(async () => {
  const urls = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  for (const url of urls) {
    console.log("\n═══ " + url);
    for (const v of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 1500));
        const r = await page.evaluate(CHECK);
        const bad = [];
        if (r.overflow) bad.push("가로넘침 " + r.overflow);
        if (r.tap) bad.push("터치<48 " + r.tap + " " + JSON.stringify(r.tapSample));
        if (r.text) bad.push("본문<16 " + r.text + " " + JSON.stringify(r.textSample));
        if (r.shadow) bad.push("그림자 " + r.shadow);
        if (r.primaryMax > 1) bad.push("주버튼 " + r.primaryMax);
        if (!r.isMobile && r.burger) bad.push("PC에 햄버거 " + r.burger);
        if (!r.isMobile && r.dock) bad.push("PC에 하단바 " + r.dock);
        if (r.isMobile && r.desktopNav) bad.push("폰에 가로메뉴 " + r.desktopNav);
        if (r.trapped.length) bad.push("fixed 갇힘 " + r.trapped.length + " " + JSON.stringify(r.trapped.slice(0, 2)));
        console.log(
          "  " + v.name.padStart(4) + " | 히어로 " + String(r.heroH ?? "-").padStart(4) + "px(top " + String(r.heroTop ?? "-") + ")" +
          " | " + (bad.length ? "⚠ " + bad.join(" · ") : "✅ 통과"));
      } catch (e) {
        console.log("  " + v.name.padStart(4) + " | 실패 " + e.message.slice(0, 60));
      }
      await page.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
