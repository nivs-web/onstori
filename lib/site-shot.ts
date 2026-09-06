import puppeteer, { type Browser } from "puppeteer-core";
import sharp from "sharp";
import * as storage from "./storage";

/**
 * 손님 사이트 **미리 찍은 스크린샷** — 첫 페이지 테마 카드가 이걸 쓴다.
 *
 * 왜 필요한가: 전에는 첫 페이지가 살아 있는 사이트를 iframe 으로 띄웠다.
 * 그 탓에 스크롤바·오른쪽 흰 여백·느려짐이 전부 생겼고, 카드 한 장이
 * 손님 사이트 한 채를 통째로 불러왔다(사진·글꼴·JS 전부).
 * 미리 찍은 사진 한 장이면 그 전부가 사라진다.
 *
 * ⚠ **브라우저가 있는 곳에서만 돈다.** Vercel 서버리스에는 크롬이 없다 —
 *   `findBrowser()` 가 못 찾으면 던지지 않고 `{ ok:false, reason:"no-browser" }` 로 돌려준다.
 *   호출부(발행·어드민)는 그걸 보고 조용히 넘어간다. 발행을 막지 않는다.
 *   서버에서도 돌리려면 @sparticuz/chromium 같은 걸 얹어야 한다(회장님 결정 대기).
 */

export type ShotResult =
  | { ok: true; pc: string; phone: string; at: string; kb?: Record<string, number> }
  | { ok: false; reason: string };

/** 이 기계에서 쓸 수 있는 크롬을 찾는다. 환경변수 > 흔한 설치 경로 순. */
function findBrowser(): string | null {
  const fromEnv = process.env.CHROME_PATH?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  // 서버리스에는 파일이 없다 — require 로 확인하면 번들이 커지므로 fs 로 가볍게 본다
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) ?? null;
}

/**
 * 폭별 촬영 규격.
 *
 * ⚠ `out`(내보내는 폭)은 **카드에 보이는 크기의 최소 1.5배**여야 한다.
 *   PC 카드는 넓어야 360px(768 2열) 인데 폰 화면은 dpr 2~3 이라 실제로는 720~1080px 이 필요하다.
 *   전에 900→80KB 로 눌렀더니 10~28KB 짜리가 나와 심하게 뭉갰다(2026-09-07 회장님 지적).
 *   **용량보다 선명함이 우선이다.** 품질은 82 로 고정하고 낮추지 않는다.
 *
 * `maxTall`: 잘라낸 뒤 남길 세로 길이를 **내보내는 폭의 배수**로 묶는다.
 *   카드는 16:10 이고 마우스를 올리면 사진이 위로 밀린다. 2.4배면 카드 한 장 높이의
 *   약 3.8배라 밀 거리가 넉넉하면서 파일이 감당된다. 6배로 두면 파일이 1MB 를 넘는다.
 */
const SHOTS = [
  { key: "pc", width: 1440, vh: 950, out: 1080, quality: 82, maxTall: 2.4 },
  { key: "phone", width: 390, vh: 844, out: 640, quality: 82, maxTall: 2.4 },
] as const;

/**
 * ⚠ 맨 위를 잘라낸다 — 어디서 자르는지가 핵심이다.
 *
 * 손님 사이트는 100svh 짜리 **사진 히어로**로 시작한다. 그래서 스크린샷 맨 위는
 * 글자 없는 사진뿐이고, 카드가 "웹사이트"가 아니라 "사진"으로 보인다.
 *
 * ★ 비율(40%·78%)로 자르면 안 된다. 사이트마다 제목이 있는 높이가 다르기 때문이다.
 *   2026-09-07 에 78% 로 잘랐더니 히어로 사진 한가운데 **벽만** 나왔다.
 *   그래서 지금은 **h1 을 실제로 찾아 그 위 72px 에서 자른다.** 제목과 그 아래 버튼이
 *   항상 카드 안에 온전히 들어온다. 숫자가 아니라 화면 요소를 기준으로 삼는다.
 *
 * ⚠ 크롭만으로 "웹사이트"가 되지는 않는다 — 그건 **주소창**이 만든다(.tcard-url).
 *   둘 다 있어야 한다.
 */

/**
 * 한 사이트를 두 폭으로 찍어 R2 에 올린다.
 * 파일명에 갱신 시각을 넣어 캐시가 옛 사진을 붙들지 않게 한다(R2 는 immutable 캐시다).
 */
export async function captureSite(slug: string, origin: string): Promise<ShotResult> {
  const exe = findBrowser();
  if (!exe) return { ok: false, reason: "no-browser" };

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: exe,
      headless: true,
      protocolTimeout: 120000,
      args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
    });

    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const urls: Record<string, string> = {};
    const sizes: Record<string, number> = {};   // KB — 촬영 로그로 선명함/용량을 눈으로 본다

    for (const s of SHOTS) {
      const page = await browser.newPage();
      // ⚠ 진짜 기기 크기로 둔다. 폰을 390×257 로 두면 100svh 히어로가 257px 이 돼
      //   실제 폰에서 보이는 화면과 전혀 다른 것이 찍힌다.
      await page.setViewport({ width: s.width, height: s.vh, deviceScaleFactor: 2 });
      await page.goto(`${origin}/${slug}`, { waitUntil: "networkidle2", timeout: 45000 });

      // ⚠ 끝까지 스크롤해야 lazy 사진이 뜬다. 안 하면 아래가 비어 찍힌다.
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 220));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 400));
      });
      // 등장 애니메이션이 끝난 상태로 찍는다 — 반투명한 섹션이 찍히면 안 된다
      /* ⚠ 손님 사이트의 헤더를 숨기지 마라.
         전에는 `header[class*=fixed]{display:none}` 을 넣었는데, 그게 히어로 레이아웃을
         무너뜨려 **제목이 사라진 채** 사진만 찍혔다(2026-09-07 실측: 제목 y가 201→61 로 튀고
         화면에는 안 그려졌다). 사이트 자기 헤더는 오히려 "웹사이트"로 읽히게 도와준다.
         떠 있는 연결 버튼(플로팅 독)만 지운다 — 그건 카드 위에서 정체불명의 덩어리로 보인다. */
      await page.addStyleTag({
        content: ".reveal,.reveal-stagger>*{animation:none!important;opacity:1!important;transform:none!important}" +
          "nav[aria-label='연결 버튼']{display:none!important}",
      });
      await page.evaluate(() => Promise.race([
        Promise.all([...document.images].map((im) => im.complete || new Promise((r) => { im.onload = im.onerror = r; }))),
        new Promise((r) => setTimeout(r, 6000)),
      ]));

      // ★ 자를 위치를 **h1 을 찾아서** 정한다 (위 주석). 못 찾으면 화면 높이의 45%.
      // ⚠ 0 아래로 내려가면 sharp 가 던진다. 제목이 이미 위쪽에 있으면 자를 필요가 없다.
      const probe = await page.evaluate(() => {
        /* ⚠ `document.querySelector("h1")` 만 쓰면 안 된다.
           손님 사이트에는 화면에 안 그려지는 h1(숨김·접근성용)이 앞에 있을 수 있고,
           그걸 잡으면 엉뚱한 y 가 나온다 — 2026-09-07 에 실제로 y=61 이 나와
           히어로 사진 한복판에서 잘렸다.
           그래서 **실제로 그려졌고(높이>10) 충분히 큰(24px 이상)** 제목만 후보로 본다. */
        const cands = [...document.querySelectorAll("h1,h2")]
          .map((e) => {
            const r = e.getBoundingClientRect();
            return {
              y: Math.round(r.top + window.scrollY),
              h: Math.round(r.height),
              fs: Math.round(parseFloat(getComputedStyle(e).fontSize)),
              t: (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 20),
            };
          })
          .filter((c) => c.h > 10 && c.fs >= 24)
          .sort((a, b) => a.y - b.y);
        return { first: cands[0] ?? null, innerH: window.innerHeight };
      });
      // 제목 위 90px 에서 시작한다 — 제목과 그 아래 버튼이 카드 안에 온전히 들어온다
      const cutCss = Math.max(0, probe.first ? probe.first.y - 90 : Math.round(probe.innerH * 0.45));
      console.log(`     ${s.key}: 제목 y=${probe.first?.y ?? "?"} (${probe.first?.fs ?? "?"}px "${probe.first?.t ?? ""}") → ${cutCss}px 잘라냄`);

      const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
      // 내보낸 사진의 세로가 out × maxTall 이 되려면 CSS 로 width × maxTall 만큼 남기면 된다
      // (촬영폭 width → 내보내는 폭 out 으로 줄여도 가로세로 비는 그대로다).
      const clipH = Math.max(400, Math.min(pageH - cutCss, Math.round(s.width * s.maxTall)));

      /* ★★ 뷰포트를 늘려서 찍으면 안 된다.
         손님 사이트 히어로는 `min-height: 100svh` 다. 뷰포트 높이를 페이지 전체 길이로
         늘리는 순간 **히어로가 그만큼 같이 커져서** 사진 한 장만 찍힌다.
         2026-09-07 까지 카드가 계속 "사진"으로 보인 진짜 원인이 이거였다 —
         크롭 위치(40%·78%)를 아무리 바꿔도 소용없었던 이유다. 히어로가 사진 전부였으니까.
         그래서 뷰포트는 폰·PC 실제 크기 그대로 두고 `clip` + `captureBeyondViewport` 로
         화면 밖까지 찍는다. svh 가 950(폰 844)에 고정된다. */
      const png = (await page.screenshot({
        type: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: cutCss, width: s.width, height: clipH },
      })) as Buffer;
      await page.close();

      const meta = await sharp(png).metadata();
      const srcW = meta.width ?? 0, srcH = meta.height ?? 0;
      const cut = 0, keep = srcH;   // clip 이 이미 잘라 왔다

      // ⚠ 품질을 낮춰 용량을 맞추지 않는다. 82 고정 — 선명함이 우선이다(회장님 2026-09-07).
      const webp = await sharp(png)
        .resize({ width: s.out, withoutEnlargement: true })
        .webp({ quality: s.quality })
        .toBuffer();
      const outMeta = await sharp(webp).metadata();
      console.log(`     ${s.key}: 원본 ${srcW}x${srcH} → 자름 ${cut} 남김 ${keep} → 내보냄 ${outMeta.width}x${outMeta.height} ${Math.round(webp.length / 1024)}KB`);
      const { key } = await storage.put("media", `shots/${slug}/${s.key}-${stamp}.webp`, webp, "image/webp");
      urls[s.key] = storage.publicUrl(key);
      sizes[s.key] = Math.round(webp.length / 1024);
    }

    return { ok: true, pc: urls.pc, phone: urls.phone, at: new Date().toISOString(), kb: sizes };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 160) };
  } finally {
    await browser?.close().catch(() => {});
  }
}
