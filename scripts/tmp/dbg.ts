import puppeteer from "puppeteer-core";
const KEY = process.env.ADMIN_KEY ?? "";
async function main() {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], protocolTimeout: 20000 });
  const p = await b.newPage();
  await p.setCookie({ name: "onstori_admin", value: KEY, domain: "localhost", path: "/" });
  await p.goto("http://localhost:3000/admin/sites", { waitUntil: "networkidle2", timeout: 90000 });
  const ev = async (n: string, fn: () => unknown) => {
    try { console.log(n, "→", JSON.stringify(await p.evaluate(fn))); }
    catch (e) { console.log(n, "→ ❌", String(e).slice(0, 90)); }
  };
  await ev("A 살아있나", () => 1 + 1);
  await ev("B 체크박스 클릭", () => { const tds=[...document.querySelectorAll("td")]; const cb=tds.find(t=>t.textContent?.includes("/zz-gate-test-a"))?.closest("tr")?.querySelector("input[type=checkbox]") as HTMLInputElement; cb.click(); return "clicked"; });
  await new Promise(r=>setTimeout(r,500));
  await ev("C 살아있나", () => 2 + 2);
  await ev("D 올리기 버튼 클릭", () => { const x=[...document.querySelectorAll("button")].find(y=>y.textContent?.includes("정회원으로 올리기")) as HTMLButtonElement; x.click(); return "clicked"; });
  await new Promise(r=>setTimeout(r,500));
  await ev("E 살아있나", () => 3 + 3);
  await ev("F input 개수", () => document.querySelectorAll("input.field").length);
  await ev("G input 있나", () => !!document.querySelector("input.field"));
  await ev("H focus", () => { (document.querySelector("input.field") as HTMLInputElement).focus(); return "focused"; });
  await ev("I 살아있나", () => 4 + 4);
  await b.close();
}
main();
