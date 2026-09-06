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
  | { ok: true; pc: string; phone: string; at: string }
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

/** 폭별 촬영 규격. 세로는 폭의 6배까지만 — 아주 긴 사이트에서 파일이 감당 안 되게 커진다. */
const SHOTS = [
  { key: "pc", width: 1440, maxRatio: 6, out: 900, cropTop: 0.78 },
  { key: "phone", width: 390, maxRatio: 6, out: 360, cropTop: 0.78 },
] as const;

/**
 * ⚠ 맨 위를 잘라낸다(cropTop).
 * 손님 사이트는 100svh 짜리 **사진 히어로**로 시작한다. 그래서 스크린샷 맨 위는
 * 글자 없는 사진뿐이고, 카드가 "웹사이트"가 아니라 "사진"으로 보인다(2026-09-07 실측).
 * 히어로는 화면 높이 전체(100svh)다. 0.55 로 잘랐더니 여전히 히어로 안이었다 —
 * 0.78 이면 히어로의 **아래쪽(제목·버튼이 있는 자리)**부터 시작해 그 아래 내용이 이어진다.
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

    for (const s of SHOTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: s.width, height: Math.round(s.width * 0.66), deviceScaleFactor: 2 });
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
      await page.addStyleTag({
        content: ".reveal,.reveal-stagger>*{animation:none!important;opacity:1!important;transform:none!important}" +
          "header[class*=fixed],nav[aria-label='연결 버튼']{display:none!important}",
      });
      await page.evaluate(() => Promise.race([
        Promise.all([...document.images].map((im) => im.complete || new Promise((r) => { im.onload = im.onerror = r; }))),
        new Promise((r) => setTimeout(r, 6000)),
      ]));

      const full = Math.min(
        await page.evaluate(() => document.documentElement.scrollHeight),
        s.width * s.maxRatio,
      );
      await page.setViewport({ width: s.width, height: full, deviceScaleFactor: 2 });
      await new Promise((r) => setTimeout(r, 600));
      const png = (await page.screenshot({ type: "png" })) as Buffer;
      await page.close();

      // 히어로 사진만 나오는 맨 위를 잘라낸다
      const meta = await sharp(png).metadata();
      const cut = Math.min(
        Math.round((meta.height ?? 0) * 0.4),                       // 안전장치: 40% 넘게 자르지 않는다
        Math.round(s.width * 0.66 * 2 * s.cropTop),                 // 화면 높이 × 비율 (dpr 2)
      );
      const cropped = cut > 0 && (meta.height ?? 0) > cut + 400
        ? await sharp(png).extract({ left: 0, top: cut, width: meta.width ?? 0, height: (meta.height ?? 0) - cut }).toBuffer()
        : png;

      // 80KB 이하가 목표 — 품질을 낮춰가며 맞춘다. 안 되면 마지막 값으로 둔다.
      let webp = Buffer.alloc(0);
      for (const q of [72, 60, 50, 42, 35]) {
        webp = await sharp(cropped).resize({ width: s.out, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
        if (webp.length <= 80 * 1024) break;
      }
      const { key } = await storage.put("media", `shots/${slug}/${s.key}-${stamp}.webp`, webp, "image/webp");
      urls[s.key] = storage.publicUrl(key);
    }

    return { ok: true, pc: urls.pc, phone: urls.phone, at: new Date().toISOString() };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 160) };
  } finally {
    await browser?.close().catch(() => {});
  }
}
