/** 지시 [23] — 어드민 «화면»을 진짜 크롬으로 끝까지 눌러 본다. (열쇠는 화면에 찍지 않는다) */
import puppeteer from "puppeteer-core";
const KEY = process.env.ADMIN_KEY ?? "";
const T = "/zz-gate-test-a";

async function main() {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--window-size=1280,1000"], protocolTimeout: 30000 });
  const p = await b.newPage();
  const asked: string[] = [];
  p.on("dialog", async (d) => { asked.push(d.message().split(String.fromCharCode(10)).filter(Boolean).join(" / ")); await d.accept(); });
  await p.setCookie({ name: "onstori_admin", value: KEY, domain: "localhost", path: "/" });
  await p.goto("http://localhost:3000/admin/sites", { waitUntil: "networkidle2", timeout: 90000 });
  const ev = async (fn: () => unknown) => { try { return await p.evaluate(fn); } catch (e) { return "❌ " + String(e).slice(0, 80); } };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const rowText = () => ev(() => { const tds=[...document.querySelectorAll("td")]; const c=tds.find(t=>t.textContent?.includes("/zz-gate-test-a")); return [...(c?.closest("tr")?.querySelectorAll("td")??[])].map(t=>t.textContent?.trim()).filter(Boolean).slice(0,3).join(" | "); });

  console.log("① 그 줄이 지금 :", await rowText());
  await ev(() => { const tds=[...document.querySelectorAll("td")]; (tds.find(t=>t.textContent?.includes("/zz-gate-test-a"))!.closest("tr")!.querySelector("input[type=checkbox]") as HTMLInputElement).click(); });
  await wait(400);
  console.log("② 하나 고르니 나온 버튼 :", await ev(() => [...document.querySelectorAll("button")].map(x=>x.textContent?.trim()).filter(t=>t?.startsWith("⬆")||t?.startsWith("⬇")).join(" / ")));

  await ev(() => { ([...document.querySelectorAll("button")].find(x=>x.textContent?.includes("정회원으로 올리기")) as HTMLButtonElement).click(); });
  await wait(400);
  console.log("③ 올릴 때 안내 :", await ev(() => document.body.innerText.match(/정회원으로 올립니다\s*\n([^\n]+)/)?.[1] ?? "(없음)"));
  console.log("④ 🔴 이유가 비면 잠겨 있나 :", await ev(() => { const bs=[...document.querySelectorAll("button")].filter(x=>x.textContent?.trim()==="정회원으로 올리기"); return (bs[bs.length-1] as HTMLButtonElement).disabled; }));

  await ev(() => { (document.querySelector("input.field") as HTMLInputElement).focus(); });
  await p.keyboard.type("우리 회사 시험용 사이트 (화면 확인)", { delay: 6 });
  await wait(300);
  console.log("⑤ 이유를 적으니 잠금이 풀렸나 :", await ev(() => { const bs=[...document.querySelectorAll("button")].filter(x=>x.textContent?.trim()==="정회원으로 올리기"); return !(bs[bs.length-1] as HTMLButtonElement).disabled; }));
  await p.screenshot({ path: "scripts/tmp/ui-1-up-panel.png" });

  await ev(() => { const bs=[...document.querySelectorAll("button")].filter(x=>x.textContent?.trim()==="정회원으로 올리기"); (bs[bs.length-1] as HTMLButtonElement).click(); });
  await wait(3000);
  console.log("   ↳ 확인창이 물어본 말 :", asked[asked.length-1] ?? "(안 떴음)");
  console.log("⑥ 🔴 누른 뒤 화면이 한 말 :", await ev(() => document.body.innerText.match(/등급을 바꿨습니다[^\n]*/)?.[0] ?? document.body.innerText.match(/[^\n]*(먼저 해지|한 곳만|적어 주세요|찾지 못|이미 그)[^\n]*/)?.[0] ?? "(아무 말 없음)"));
  await p.screenshot({ path: "scripts/tmp/ui-2-up-done.png" });

  await p.reload({ waitUntil: "networkidle2" });
  console.log("⑦ 🔴 표에 다시 나온 그 줄 :", await rowText());

  await ev(() => { const tds=[...document.querySelectorAll("td")]; (tds.find(t=>t.textContent?.includes("/zz-gate-test-a"))!.closest("tr")!.querySelector("input[type=checkbox]") as HTMLInputElement).click(); });
  await wait(400);
  await ev(() => { ([...document.querySelectorAll("button")].find(x=>x.textContent?.includes("무료회원으로 내리기")) as HTMLButtonElement).click(); });
  await wait(400);
  console.log("⑧ 내릴 때 경고 :", await ev(() => document.body.innerText.match(/정회원에서 내립니다\s*\n([^\n]+)/)?.[1] ?? "(없음)"));
  console.log("⑨ 어디로 내릴지 :", await ev(() => [...document.querySelectorAll("select option")].map(o=>o.textContent).join(" / ")));
  await p.screenshot({ path: "scripts/tmp/ui-3-down-panel.png" });

  await ev(() => { (document.querySelector("input.field") as HTMLInputElement).focus(); });
  await p.keyboard.type("화면 확인 끝나서 되돌림", { delay: 6 });
  await wait(300);
  await ev(() => { const bs=[...document.querySelectorAll("button")].filter(x=>x.textContent?.trim()==="내리기"); (bs[bs.length-1] as HTMLButtonElement).click(); });
  await wait(3000);
  console.log("   ↳ 확인창이 물어본 말 :", asked[asked.length-1] ?? "(안 떴음)");
  console.log("⑩ 내린 뒤 화면이 한 말 :", await ev(() => document.body.innerText.match(/등급을 바꿨습니다[^\n]*/)?.[0] ?? "(아무 말 없음)"));
  await p.reload({ waitUntil: "networkidle2" });
  console.log("⑪ 되돌아온 줄 :", await rowText());
  await b.close();
}
main();
