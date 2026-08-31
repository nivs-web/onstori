/**
 * DB 경로 검증용 시드 — dbtest 사이트 1개 + 스토리 2건을 실서버 DB에 upsert.
 * 실행: node --env-file=.env.local scripts/seed-db.mjs
 * (service_role 키 사용 — 로컬에서만 실행, 서버 코드에서는 사용하지 않음)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("env missing"); process.exit(1); }

const sb = createClient(url, service, { auth: { persistSession: false } });

const doc = {
  schemaVersion: 1,
  template: "quote",
  businessName: "디비테스트 설비",
  theme: { palette: "premium", font: "pretendard" },
  sections: [
    {
      type: "hero",
      eyebrow: "DB 연동 검증용 데모",
      headline: "이 페이지는\n데이터베이스에서 왔습니다",
      sub: "seeds 파일이 아니라 Supabase의 published JSON을 렌더링 중입니다.",
      cta: { label: "견적 문의", action: "quote" },
    },
    {
      type: "processSteps",
      title: "진행 과정",
      steps: [
        { name: "상담", desc: "상황을 듣습니다" },
        { name: "실측", desc: "현장을 봅니다" },
        { name: "시공", desc: "약속대로 합니다" },
      ],
    },
    { type: "storyFeed", title: "작업 일지", showCount: 5 },
    { type: "quoteForm", title: "견적 문의", phone: "010-0000-0000", allowPhotos: true },
    { type: "map", title: "서비스 지역", address: "서울 전지역", phone: "010-0000-0000" },
  ],
};

const { data: site, error: e1 } = await sb
  .from("sites")
  .upsert(
    {
      slug: "dbtest",
      business_name: doc.businessName,
      industry: "plumbing",
      category: 5,
      template: "quote",
      cta_type: "quote",
      mood: "premium",
      status: "trial",
      theme: doc.theme,
      published: doc,
      published_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();
if (e1) { console.error("site upsert failed:", e1.message); process.exit(1); }

await sb.from("story_entries").delete().eq("site_id", site.id);
const { error: e2 } = await sb.from("story_entries").insert([
  { site_id: site.id, entry_type: "work", title: "강서구 보일러 교체", body: "20년 된 보일러를 교체했습니다. DB에서 온 스토리입니다.", entry_date: "2026-08-28" },
  { site_id: site.id, entry_type: "milestone", title: "DB 연동 완료", body: "이 타임라인이 보인다면 sites → story_entries 조인이 동작하는 것.", entry_date: "2026-08-31" },
]);
if (e2) { console.error("stories insert failed:", e2.message); process.exit(1); }

console.log("OK — dbtest site id:", site.id);
