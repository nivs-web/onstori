import { sbAdmin } from "@/lib/db-admin";
async function main() {
  const sb = sbAdmin();
  const { data, error } = await sb.from("sites").select("slug,business_name,status,paid_at,owner_id,anon_id,created_at").order("created_at",{ascending:false}).limit(60);
  if (error) { console.log("ERR", error.message); return; }
  for (const s of data ?? []) {
    console.log([s.status, s.paid_at ? "PAID" : "-", s.owner_id ? "owner" : (s.anon_id ? "anon" : "NOONE"), s.slug, String(s.business_name ?? "").slice(0,14)].join(" | "));
  }
  console.log("총", (data??[]).length);
  const { data: b, error: be } = await sb.from("billing").select("site_id,status").limit(20);
  console.log("billing:", be ? "ERR " + be.message : JSON.stringify(b));
}
main();
