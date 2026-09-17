/** 지시 [23] — 어드민 «화면»을 진짜 크롬으로 눌러 본다. (열쇠는 화면에 찍지 않는다) */
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const KEY = process.env.ADMIN_KEY ?? "";
const TARGET = "zz-gate-test-a";

async function main() {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], protocolTimeout: 180000 });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  p.on("console", (m) => { if (m.type() === "error") console.log("   [콘솔오류]", m.text().slice(0, 160)); });
  p.on("pageerror", (e) => console.log("   [페이지오류]", String(e).slice(0, 200)));
  await p.setCookie({ name: "onstori_admin", value: KEY, domain: "localhost", path: "/" });

  await p.goto("http://localhost:3000/admin/sites", { waitUntil: "networkidle2", timeout: 90000 });
  console.log("① 어드민이 열렸나 :", (await p.$("table")) ? "예" : "아니오(로그인 화면)");

  const gradeText = await p.evaluate((slug: string) => {
    const tds = [...document.querySelectorAll("td")];
    const cell = tds.find((t) => t.textContent?.includes(`/${slug}`));
    const tr = cell?.closest("tr");
    return [...(tr?.querySelectorAll("td") ?? [])].map((t) => t.textContent?.trim()).join(" | ");
  }, TARGET);
  console.log("② 그 줄이 지금 보여 주는 것 :", gradeText);

  // 체크박스 하나 고르기
  const picked = await p.evaluate((slug: string) => {
    const tds = [...document.querySelectorAll("td")];
    const cell = tds.find((t) => t.textContent?.includes(`/${slug}`));
    const cb = cell?.closest("tr")?.querySelector("input[type=checkbox]") as HTMLInputElement | undefined;
    if (!cb) return false;
    cb.click();
    return true;
  }, TARGET);
  console.log("③ 체크박스를 골랐나 :", picked);
  await new Promise((r) => setTimeout(r, 400));

  const bar = await p.evaluate(() => document.body.innerText.match(/선택 해제[\s\S]{0,10}|⬆[^\n]*|⬇[^\n]*/g)?.join(" / ") ?? "(없음)");
  console.log("④ 버튼 둘이 나왔나 :", bar);

  // ⬆ 정회원으로 올리기
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("정회원으로 올리기"));
    (btn as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 300));
  console.log("⑤ 안내문 :", await p.evaluate(() => document.body.innerText.match(/정회원으로 올립니다[\s\S]{0,140}/)?.[0]?.replace(/\s+/g, " ") ?? "(없음)"));

  // 이유를 비워 둔 채 눌러지나
  const disabled = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((x) => x.textContent?.trim() === "정회원으로 올리기");
    return (btns[btns.length - 1] as HTMLButtonElement).disabled;
  });
  console.log("⑥ 🔴 이유가 비면 버튼이 잠겨 있나 :", disabled);

  // 이유 적고 누르기
  console.log("   [진단] 이유 칸이 몇 개 보이나 :", await p.evaluate(() => document.querySelectorAll("input.field").length));
  /* ⚠ 한글이 든 CSS 선택자는 puppeteer 가 멈춘다(실측). ASCII 선택자만 쓴다 */
  /* ⚠ puppeteer 의 p.$/focus/waitForSelector 가 이 화면에서 멈춘다(실측).
       evaluate 로 포커스만 주고, 타자는 키보드 이벤트로 친다 */
  await p.evaluate(() => (document.querySelector("input.field") as HTMLInputElement).focus());
  await p.keyboard.type("우리 회사 시험용 사이트 (화면 확인)", { delay: 8 });
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((x) => x.textContent?.trim() === "정회원으로 올리기");
    (btns[btns.length - 1] as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  console.log("⑦ 🔴 누른 뒤 화면이 한 말 :", await p.evaluate(() => document.body.innerText.match(/등급을 바꿨습니다[^\n]*/)?.[0] ?? document.body.innerText.match(/[^\n]*(맞지|없어요|않습니다|먼저)[^\n]*/)?.[0] ?? "(아무 말 없음)"));

  await p.reload({ waitUntil: "networkidle2" });
  console.log("⑧ 표에 다시 나온 그 줄 :", await p.evaluate((slug: string) => {
    const tds = [...document.querySelectorAll("td")];
    const cell = tds.find((t) => t.textContent?.includes(`/${slug}`));
    return [...(cell?.closest("tr")?.querySelectorAll("td") ?? [])].map((t) => t.textContent?.trim()).join(" | ");
  }, TARGET));
  await p.screenshot({ path: "scripts/tmp/grade-after-up.png" });

  // 다시 내리기 — 원래대로
  await p.evaluate((slug: string) => {
    const tds = [...document.querySelectorAll("td")];
    const cb = tds.find((t) => t.textContent?.includes(`/${slug}`))?.closest("tr")?.querySelector("input[type=checkbox]") as HTMLInputElement;
    cb.click();
  }, TARGET);
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("무료회원으로 내리기"));
    (btn as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 300));
  console.log("⑨ 내릴 때 경고문 :", await p.evaluate(() => document.body.innerText.match(/정회원에서 내립니다[\s\S]{0,150}/)?.[0]?.replace(/\s+/g, " ") ?? "(없음)"));
  console.log("   어디로 내릴지 고르는 칸 :", await p.evaluate(() => [...document.querySelectorAll("select option")].map((o) => o.textContent).join(" / ")));
  await p.screenshot({ path: "scripts/tmp/grade-down-panel.png" });

  await p.evaluate(() => (document.querySelector("input.field") as HTMLInputElement).focus());
  await p.keyboard.type("화면 확인 끝나서 되돌림", { delay: 8 });
  await new Promise((r) => setTimeout(r, 300));
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((x) => x.textContent?.trim() === "내리기");
    (btns[btns.length - 1] as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  console.log("⑩ 내린 뒤 화면이 한 말 :", await p.evaluate(() => document.body.innerText.match(/등급을 바꿨습니다[^\n]*/)?.[0] ?? "(아무 말 없음)"));
  await b.close();
}
main();
