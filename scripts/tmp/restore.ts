import { sbAdmin } from "@/lib/db-admin";
async function main() {
  const r = await fetch("http://localhost:3000/api/admin/site-bulk", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `onstori_admin=${process.env.ADMIN_KEY}` },
    body: JSON.stringify({ mode: "grade", slugs: ["zz-gate-test-a"], to: "suspended", reason: "시험 끝 — 원래 상태로 되돌림" }),
  });
  console.log("되돌리기:", r.status, (await r.text()).slice(0, 120));
  const sb = sbAdmin();
  const { data } = await sb.from("sites").select("slug,status,paid_at").in("slug", ["zz-gate-test-a","zz-gate-test-b","sample-interior","sample-toss"]);
  console.log(JSON.stringify(data));
  const { data: b } = await sb.from("billing").select("site_id");
  console.log("billing 행 수:", (b ?? []).length);
}
main();
