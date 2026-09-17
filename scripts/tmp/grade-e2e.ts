/** 지시 [23] 실측 — 어드민 «등급 올리기·내리기» 를 실제로 눌러 본다. 시험용 사이트에서만. */
import { sbAdmin } from "@/lib/db-admin";

const BASE = "http://localhost:3000/api/admin/site-bulk";
const KEY = process.env.ADMIN_KEY ?? "";
const TARGET = "zz-gate-test-a";          // 내가 만든 시험용 사이트. 손님 것이 아니다
const sb = sbAdmin();

async function call(body: unknown, withCookie = true) {
  const r = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json", ...(withCookie ? { cookie: `onstori_admin=${KEY}` } : {}) },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return { s: r.status, b: t.slice(0, 200) };
}
async function row() {
  const { data } = await sb.from("sites").select("status,paid_at,settings").eq("slug", TARGET).maybeSingle();
  const set = (data?.settings ?? {}) as Record<string, unknown>;
  return { status: data?.status, paid_at: data?.paid_at, manual_grant: set.manual_grant };
}
function show(n: string, r: { s: number; b: string }) { console.log(`${n}\n   → ${r.s} ${r.b}`); }

async function main() {
  const before = await row();
  console.log("시작 상태:", JSON.stringify(before), "\n");

  show("① 열쇠 없이 (로그인 안 한 사람)", await call({ mode: "grade", slugs: [TARGET], to: "active", reason: "시험" }, false));
  show("② 두 곳을 한 번에", await call({ mode: "grade", slugs: [TARGET, "peliz"], to: "active", reason: "시험" }));
  show("③ 이유를 안 적음", await call({ mode: "grade", slugs: [TARGET], to: "active", reason: "" }));
  show("④ 엉뚱한 등급", await call({ mode: "grade", slugs: [TARGET], to: "vip", reason: "시험입니다" }));
  show("⑤ 없는 홈페이지", await call({ mode: "grade", slugs: ["zz-no-such-site-xyz"], to: "active", reason: "시험입니다" }));
  show("⑥ 이미 그 등급", await call({ mode: "grade", slugs: [TARGET], to: String(before.status), reason: "시험입니다" }));
  console.log("   여기까지 DB 가 바뀌었나:", JSON.stringify(await row()), "\n");

  show("⑦ 🔴 진짜로 «정회원»으로 올리기", await call({ mode: "grade", slugs: [TARGET], to: "active", reason: "우리 회사 시험용 사이트" }));
  const up = await row();
  console.log("   DB:", JSON.stringify(up));
  console.log("   ✔ 정회원이 됐나:", up.status === "active");
  console.log("   ✔ 🔴 돈 받은 것으로 안 잡혔나(paid_at 비었나):", up.paid_at === null);
  console.log("   ✔ 왜 올렸는지 남았나:", JSON.stringify(up.manual_grant), "\n");

  // ⑧ 자동결제가 걸린 사람을 내리려 할 때 — 시험용 행을 잠깐 넣었다 바로 지운다
  const { data: site } = await sb.from("sites").select("id").eq("slug", TARGET).maybeSingle();
  let inserted = false;
  const ins = await sb.from("billing").insert({
    site_id: site!.id, customer_key: "zz-test-customer", billing_key: "zz-test-not-a-real-key",
    status: "failed",                                  // 🔴 크론이 긁는 것은 'active' 뿐이다
    next_charge_at: "2099-01-01T00:00:00Z",            // 🔴 그래도 한참 뒤로 둔다
  });
  if (ins.error) console.log("⑧ 시험용 결제행을 못 넣음:", ins.error.message);
  else {
    inserted = true;
    show("⑧ 🔴 자동결제가 살아 있는데 내리려 할 때", await call({ mode: "grade", slugs: [TARGET], to: "trial", reason: "시험입니다" }));
    console.log("   막힌 뒤 DB:", JSON.stringify(await row()));
  }
  if (inserted) {
    const del = await sb.from("billing").delete().eq("site_id", site!.id);
    const { data: left } = await sb.from("billing").select("site_id");
    console.log("   시험용 결제행 지웠나:", del.error ? "실패 " + del.error.message : "예", "| 남은 billing 행:", (left ?? []).length, "\n");
  }

  show("⑨ 🔴 다시 «무료회원»으로 내리기", await call({ mode: "grade", slugs: [TARGET], to: "trial", reason: "시험 끝나서 되돌림" }));
  const down = await row();
  console.log("   DB:", JSON.stringify(down));
  console.log("   ✔ 무료로 내려갔나:", down.status === "trial");
  console.log("   ✔ 올렸던 기록이 지워지지 않고 «언제 내렸는지»가 붙었나:",
    !!(down.manual_grant as Record<string, unknown> | undefined)?.revokedAt, "\n");

  show("⑩ 정지로 내리기", await call({ mode: "grade", slugs: [TARGET], to: "suspended", reason: "원래 상태로 되돌림" }));
  console.log("끝 상태:", JSON.stringify(await row()));
  console.log("시작과 같은가:", (await row()).status === before.status);
}
main();
