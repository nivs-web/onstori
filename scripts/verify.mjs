/* 반응형·완료조건 자동 점검 — puppeteer-core 로 390/768/1440 을 한 번에 잰다.
   + 저장소에 lib/trial.ts 밖의 하드코딩 금액이 있는지도 같이 본다(아래 checkPrices). */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

/**
 * ★ 금액이 코드·문서에 직접 적혀 있는지 훑는다 (CLAUDE.md 규칙 9).
 *
 * 왜: 2026-09-06 에 요금 진술 182곳 중 **175곳**이 확정안과 어긋나 있었다. 이유는 하나 —
 * 숫자와 문장을 파일마다 복사해 적었기 때문이다. 한쪽만 고쳐지면 화면이 손님에게 거짓말을 한다.
 * 2026-09-07 에 49,000 → 49,900 으로 바꾸면서 30개 파일 114곳을 다시 손봐야 했다.
 *
 * 값의 유일한 출처는 `lib/trial.ts` 다. 다른 곳에서는 `COPY` 를 import 해서 쓴다.
 * ⚠ 날짜가 박힌 역사 기록은 뺀다 — 그때 값을 그대로 두는 것이 맞다.
 */
function checkPrices() {
  const SKIP_DIR = new Set(["node_modules", ".next", ".git", "backups", "public"]);
  const EXT = new Set([".ts", ".tsx", ".md", ".js", ".mjs", ".sql", ".json", ".html"]);
  /* "49,900원" 처럼 **원**이 붙은 것만 본다.
     ⚠ `20_000`(메모 글자 수 상한) 같은 것까지 잡으면 오탐이라 밑줄 형태는 빼 두었다. */
  const RE = /\b\d{2},\d{3}\s*원/g;
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(dir, e.name)); continue; }
      if (!EXT.has(path.extname(e.name))) continue;
      const p = path.join(dir, e.name).replace(/\\/g, "/").replace(/^\.\//, "");
      if (p === "lib/trial.ts") continue;                        // 유일한 출처
      /* ⚠ 도구가 남긴 임시 파일은 저장소 코드가 아니다. 2026-09-12 에 Vercel CLI 가
         `deployments.json`(679KB, 배포 목록 덤프)을 남겨 이 검사가 옛 요금 숫자를 잡고 실패했다.
         파일을 지우지 않고 검사에서 뺀다 — 회장님이 쓰시려고 뽑아 두신 것일 수 있다. */
      if (p === "deployments.json" || p === ".vercel") continue;
      if (/20\d\d-\d\d-\d\d/.test(e.name)) continue;             // 날짜 박힌 역사 기록
      /* ⚠ 기록 문서는 «옛 값이 무엇이었는지»를 적는 것이 일이다 (2026-09-13 추가).
         거기서 옛 금액을 지우면 기록이 기록이 아니게 된다 — 이 검사의 목적과 반대다. */
      if (p === "docs/DECISIONS.md" || p.startsWith("docs/design/")) continue;
      if (p === "docs/PROGRESS.md" || p.startsWith("docs/AI/")) continue;
      let s; try { s = fs.readFileSync(p, "utf8"); } catch { continue; }
      if (s.includes("작성 당시 값")) continue;                   // 역사 표시가 붙은 문서
      /* 예외 표시 — 우리 요금이 아니거나(손님 사이트 예시 가격),
         운영자만 보는 기획실 화면처럼 숫자를 그대로 보여줘야 하는 문서. */
      if (s.includes("금액 출처: lib/trial.ts")) continue;
      const m = s.match(RE);
      if (m) found.push({ p, n: m.length, 예: [...new Set(m)].slice(0, 3).join(", ") });
    }
  };
  walk(".");
  return found;
}
/**
 * ★★ **기간 검사** (2026-09-13 추가).
 *
 * ⚠ 왜 필요했나: 규칙 9 는 「기간·금액 둘 다 lib/trial.ts 가 단일 출처」라고 못 박았는데
 *   이 파일은 **금액만** 보고 있었다. 그 사이 「30일」이 손님 화면 열 곳 넘게 글자로 박혔고,
 *   검사는 그때도 «0건 통과»를 찍었다. **검사가 조용하면 사람은 지켜지고 있다고 믿는다.**
 *
 * ⚠ 오탐이 많은 검사다 — 「인스타 60일 토큰」·「최근 30일 매출」처럼 요금과 무관한 30·60 이
 *   많다. 그래서 그런 파일은 아래에서 건너뛴다. 건너뛰는 목록을 늘릴 때는
 *   **왜 요금과 무관한지**를 한 줄로 적어라.
 */
function checkPeriods() {
  const SKIP_DIR = new Set(["node_modules", ".next", ".git", "backups", "public", "docs"]);
  const EXT = new Set([".ts", ".tsx"]);
  /* 요금 정책에 쓰이는 숫자만 — 14(옛 값) · 30(무료) · 60(삭제 유예) · 90(총 수명) */
  const RE = /(?:^|[^0-9])(14|30|60|90)\s*일/g;
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(dir, e.name)); continue; }
      if (!EXT.has(path.extname(e.name))) continue;
      const p = path.join(dir, e.name).replace(/\\/g, "/").replace(/^\.\//, "");
      if (p === "lib/trial.ts") continue;                        // 유일한 출처
      /* 요금과 무관한 30·60 이 나오는 곳 — 토큰 수명 · 스팸 차단 · 매출 집계 · 저장소 수명 */
      if (/^lib\/sns\/|^lib\/storage\.ts$|^app\/api\/cron\/weekly\/|^app\/api\/inquiry\/|^app\/admin\/page\.tsx$|^scripts\//.test(p)) continue;
      let s; try { s = fs.readFileSync(p, "utf8"); } catch { continue; }
      if (s.includes("기간 출처: lib/trial.ts")) continue;        // 일부러 적은 자리
      const m = s.match(RE);
      if (m) found.push({ p, n: m.length, 예: [...new Set(m.map((x) => x.trim()))].slice(0, 3).join(", ") });
    }
  };
  walk(".");
  return found;
}

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
    /* ★ 실제로 몇 개를 봤는지. 0 이면 "통과"가 아니라 "아무것도 안 봤다"는 뜻이다.
       2026-09-07 에 첫 페이지가 검사를 통째로 건너뛰면서도 조용했다. */
    looked: {
      누름: q("a,button,summary,select,textarea,input").length,
      글: q("p,li,dd,blockquote,td").length,
      전체요소: document.querySelectorAll("*").length,
    },
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
  /* ★ 「건너뜀」과 「통과」를 구분해서 모은다 (2026-09-07 회장님 지시).
     검사가 조용히 건너뛰면 0건이 나오는데, 그걸 통과로 읽으면 안 된다.
     결과는 **맨 위에 경고를 먼저** 띄우려고 줄을 모아 뒀다가 마지막에 찍는다. */
  const lines = [];
  const say = (s) => lines.push(s);
  let 검사함 = 0;
  const 건너뜀 = [];

  for (const url of urls) {
    say("\n═══ " + url);
    for (const v of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 1500));
        const r = await page.evaluate(CHECK);
        if (!r.looked.전체요소 || r.looked.전체요소 < 20) {
          건너뜀.push(`${url} @${v.name} — 화면에 요소가 ${r.looked.전체요소}개뿐(빈 화면이거나 안 열렸다)`);
          say("  " + v.name.padStart(4) + " | ⏭ 건너뜀 — 요소 " + r.looked.전체요소 + "개뿐");
          await page.close();
          continue;
        }
        검사함++;
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
        say(
          "  " + v.name.padStart(4) + " | 봄 누를것 " + String(r.looked.누름).padStart(3) + "·글 " + String(r.looked.글).padStart(3) +
          " | 히어로 " + String(r.heroH ?? "-").padStart(4) + "px" +
          " | " + (bad.length ? "⚠ " + bad.join(" · ") : "✅ 통과"));
      } catch (e) {
        // ⚠ 실패를 조용히 넘기지 않는다. 건너뛴 것으로 세어 맨 위 경고에 올린다.
        건너뜀.push(`${url} @${v.name} — ${e.message.slice(0, 70)}`);
        say("  " + v.name.padStart(4) + " | ⏭ 건너뜀 — " + e.message.slice(0, 60));
      }
      await page.close();
    }
  }
  await browser.close();

  // ── 하드코딩 금액 검사 (화면 검사와 별개로 항상 돈다) ──
  const 금액 = checkPrices();
  if (금액.length) {
    console.log("\n" + "⚠".repeat(30));
    console.log(`⚠ 하드코딩 금액 — ${금액.length}개 파일에 요금 숫자가 직접 적혀 있다.`);
    console.log("   값의 유일한 출처는 lib/trial.ts 다. 다른 곳에서는 COPY 를 import 해서 써라(CLAUDE.md 규칙 9).");
    console.log("   역사 기록이라면 문서 맨 위에 「작성 당시 값」 한 줄을 붙이면 이 검사에서 빠진다.");
    for (const f of 금액) console.log(`   💰 ${f.p} — ${f.n}곳 (${f.예})`);
    console.log("⚠".repeat(30));
    process.exitCode = 2;
  } else {
    console.log("\n💰 하드코딩 금액 0건 — 요금 숫자는 lib/trial.ts 에만 있다 ✅");
  }

  // ── 하드코딩 «기간» 검사 (2026-09-13 추가 — 전에는 금액만 봤다) ──
  const 기간 = checkPeriods();
  if (기간.length) {
    console.log("\n" + "⚠".repeat(30));
    console.log(`⚠ 하드코딩 기간 — ${기간.length}개 파일에 무료·삭제 기간 숫자가 직접 적혀 있다.`);
    console.log("   TRIAL_DAYS·DELETE_AFTER_SUSPEND_DAYS 를 import 해서 써라(CLAUDE.md 규칙 9).");
    console.log("   요금과 무관한 숫자라면 파일 안에 「기간 출처: lib/trial.ts」 한 줄을 붙이면 빠진다.");
    for (const f of 기간) console.log(`   📅 ${f.p} — ${f.n}곳 (${f.예})`);
    console.log("⚠".repeat(30));
    process.exitCode = 2;
  } else {
    console.log("📅 하드코딩 기간 0건 — 무료·삭제 기간은 lib/trial.ts 에만 있다 ✅");
  }

  const 총칸 = urls.length * WIDTHS.length;
  if (건너뜀.length) {
    console.log("\n" + "⚠".repeat(30));
    console.log(`⚠ 경고 — ${총칸}칸 중 ${건너뜀.length}칸을 **검사하지 못했다.** 아래 "통과"는 그 칸을 뺀 결과다.`);
    for (const s of 건너뜀) console.log("   ⏭ " + s);
    console.log("⚠".repeat(30));
  }
  console.log(lines.join("\n"));
  console.log(`\n── 검사함 ${검사함}칸 / 건너뜀 ${건너뜀.length}칸 (전체 ${총칸}칸 = 주소 ${urls.length} × 폭 ${WIDTHS.length})`);
  if (건너뜀.length) { console.log("⚠ 건너뛴 칸이 있다. 전부 통과했다고 말하면 안 된다."); process.exitCode = 2; }
})().catch((e) => { console.error(e.message); process.exit(1); });
