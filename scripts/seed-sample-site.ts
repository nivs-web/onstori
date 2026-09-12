/**
 * 손님용 샘플 사이트 생성·갱신 — 콜드콜 시연 링크 (2026-09-06 회장님 지시)
 * 실행: npx tsx --env-file=.env.local scripts/seed-sample-site.ts
 *
 * 왜 스크립트인가: 온보딩(/new)을 태우면 AI 가 문구를 새로 지어내 매번 달라지고,
 * "예시" 표시도 붙지 않는다. 시연용 화면은 내용이 고정돼야 해서 문서를 직접 박는다.
 *
 * 규칙 7(2026-09-06 개정) 적용:
 *   - 후기·시공 건수는 회원이 직접 입력한 값만 표시한다. AI 가 만들지 않는다.
 *   - 예외로 **샘플 사이트에 한해** 예시 후기·예시 시공 건수를 넣되 "예시" 표시를 단다.
 *   - 실고객 사례로 교체할 때 이 표시를 뗀다.
 *
 * 안전 설계:
 *   - status='active' → 만료 크론(app/api/cron/expire)의 두 쿼리가 모두 status='trial' 만
 *     보므로 이 사이트는 만료되지도, D-3·D-1 문자를 쏘지도 않는다.
 *   - owner_id·anon_id 를 **둘 다 null** 로 둔다 → lib/site-owner.ts 의 익명 폴백이
 *     `site.anon_id` 가 있을 때만 통과하므로, 운영자(ADMIN_KEY) 말고는 아무도 못 고친다.
 *   - 사진은 이미지뱅크에서 **검수 승인된 것(quality_ok=true)** 만 골랐다.
 *
 * 두 번 돌려도 안전하다(slug 기준 upsert).
 */
import { createClient } from "@supabase/supabase-js";
import { SiteDoc, type SiteDocT } from "../lib/schema";
import { BIZ } from "../config/company";

const SLUG = "sample-interior"; // "sample" 은 reserved_slugs 에 등록돼 있어 못 쓴다
/**
 * ★★ **손님에게 보이는 번호는 «가짜»여야 한다.** (2026-09-12 상무님 지적)
 *
 * ⚠ 전에는 여기에 **온스토리 본사 번호**가 박혀 있었다. 그런데 이 사이트는 첫 화면의
 *   대표 예시라 **제일 많이 보이는 번호**다 — 손님이 그 번호로 전화하면 우리 고객센터로 온다.
 *   가게에 거는 줄 알고 건 전화라 서로 헛걸음이고, 우리가 그 가게인 것처럼 보이기도 한다.
 * ★ 저장소의 다른 시연 자료(seeds/*.json)가 이미 010-0000-0000 을 쓴다. 같은 번호로 맞춘다 —
 *   한눈에 «예시»로 읽히고, 실제로 아무에게도 안 걸린다.
 */
const SHOWN_PHONE = "010-0000-0000";

/**
 * 문의가 들어왔을 때 **우리가 받을** 번호. 이건 본사 번호가 맞다 —
 * 이 사이트의 주인이 우리라서, 문의를 받을 사람도 우리다.
 * ⚠ 번호를 여기 다시 타이핑하지 않는다. config/company.ts 의 BIZ 가 단일 출처다.
 */
const NOTIFY_PHONE = BIZ.phone;

const B = "https://wpsrfjqfbhmeriscdacu.supabase.co/storage/v1/object/public/bank/interior";
const IMG = {
  hero: `${B}/warm/hero/14b20e8f-1f1c-4b8f-9cf3-c8f67106ff21.webp`,
  about: `${B}/warm/about/0381b7b5-77e2-4c5e-83d4-174c98075b6e.webp`,
  gallery: [
    `${B}/clean/gallery/907c1616-e082-4a25-b623-e2ab7082a80e.webp`,
    `${B}/clean/gallery/3d434d55-5616-43bc-bc25-79d7582de30d.webp`,
    `${B}/warm/gallery/296eb419-0264-4119-9d38-44ceef720c54.webp`,
    `${B}/warm/gallery/71d7db01-d737-4037-b0ff-9ccf98fc00a8.webp`,
  ],
  process: [
    `${B}/warm/process/248c28a5-e539-43e4-8613-747a8b1bbcc9.webp`,
    `${B}/warm/process/e4dacdb4-1315-43d1-a48e-2473462cf793.webp`,
    `${B}/warm/process/b407094e-84a6-4e7d-bb93-76a479264231.webp`,
  ],
};

const doc: SiteDocT = SiteDoc.parse({
  schemaVersion: 1,
  template: "quote",
  businessName: "온스토리 샘플 인테리어",
  theme: { palette: "warm", font: "pretendard" },
  sections: [
    // 맨 위 띠 — 첫 화면에서 가장 먼저 보이는 자리
    { type: "banner", text: "샘플 예시 사이트입니다 · 실제 업체가 아니며 후기와 시공 건수는 예시입니다" },
    {
      type: "hero",
      eyebrow: "샘플 예시 사이트",
      headline: "20년 된 아파트, 다시 살고 싶은 집으로",
      sub: "남양주에서 아파트 올수리만 합니다. 견적부터 마무리까지 사장이 직접 봅니다.",
      image: IMG.hero,
      cta: { label: "견적 문의하기", action: "quote" },
    },
    {
      type: "about",
      title: "소개",
      body:
        "온스토리 샘플 인테리어는 남양주에서 아파트 올수리를 하는 가상의 업체입니다.\n" +
        "이 화면은 온스토리로 홈페이지를 만들면 어떤 모습이 되는지 보여드리려고 만든 예시입니다.\n\n" +
        "사장님이 60초 동안 말씀하시면 이런 화면이 3분 만에 만들어집니다. " +
        "사진·문구·연락 버튼까지 전부 들어가 있고, 손님은 아래 문의 폼으로 바로 연락할 수 있습니다.",
      image: IMG.about,
      // 규칙 7 예외 — 샘플에 한해 허용되는 '예시 시공 건수' 1개
      stats: [{ label: "누적 시공 (예시)", value: "128건" }],
    },
    {
      type: "processSteps",
      title: "진행 과정",
      steps: [
        { name: "현장 방문", desc: "집 상태를 직접 보고 필요한 공사만 골라 드립니다.", image: IMG.process[0] },
        { name: "견적서", desc: "품목별로 나눠 드려서 뺄 것과 넣을 것을 정하실 수 있습니다.", image: IMG.process[1] },
        { name: "시공", desc: "공정별 사진을 보내 드립니다.", image: IMG.process[2] },
        { name: "마무리 점검", desc: "함께 한 바퀴 돌며 손볼 곳을 정리합니다." },
      ],
    },
    { type: "gallery", title: "시공 갤러리", photos: IMG.gallery },
    {
      // 규칙 7 예외 — 샘플에 한해 허용되는 '예시 후기'. source 에 "예시" 를 달아 화면에 표시된다.
      type: "reviews",
      title: "고객 이야기 (예시)",
      items: [
        {
          title: "다산동 34평 올수리",
          body: "견적서를 품목별로 주셔서 뭘 빼고 넣을지 저희가 정할 수 있었어요. 중간에 사진을 계속 보내주셔서 멀리 있어도 안심이 됐습니다.",
          source: "예시",
        },
        {
          title: "별내동 24평 부분수리",
          body: "욕실만 고치려다 주방까지 했는데, 필요 없는 공사는 먼저 빼자고 말씀해 주셨습니다. 마무리 점검 때 같이 돌면서 손볼 곳을 정리해 주신 게 좋았어요.",
          source: "예시",
        },
        {
          title: "진접읍 32평 올수리",
          body: "약속한 날짜에 정확히 끝났습니다. 공사 끝나고 두 달 뒤에 문틀이 살짝 틀어졌는데 바로 오셔서 봐주셨어요.",
          source: "예시",
        },
      ],
    },
    {
      type: "quoteForm",
      title: "견적 문의",
      sub: "사진을 함께 올려 주시면 더 정확하게 봐 드릴 수 있습니다. (샘플 사이트지만 문의는 실제로 접수됩니다)",
      phone: SHOWN_PHONE,
      allowPhotos: true,
    },
    {
      type: "map",
      title: "오시는 길",
      address: "경기도 남양주시",
      phone: SHOWN_PHONE,
      note: "샘플 예시 사이트라 실제 매장 주소는 아닙니다.",
    },
  ],
  widgets: [{ kind: "call", label: "전화" }],
});

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const now = new Date().toISOString();
  const row = {
    slug: SLUG,
    business_name: doc.businessName,
    industry: "interior",
    category: 5, // config/industries.ts — interior.categoryId
    template: "quote",
    cta_type: "quote",
    mood: "warm",
    status: "active", // 검색 허용 + 만료 크론 대상 아님
    // status 가 active 라 만료 판정에 쓰이지 않지만 컬럼이 NOT NULL 이라 값은 넣는다
    trial_ends_at: "2099-12-31T00:00:00.000Z",
    owner_id: null,
    anon_id: null, // 둘 다 null → 운영자만 편집 가능 (lib/site-owner.ts)
    theme: doc.theme,
    settings: {
      phone: SHOWN_PHONE,
      address: "경기도 남양주시",
      oneLiner: "남양주 아파트 올수리 · 온스토리 샘플 사이트",
      notify: { phone: NOTIFY_PHONE, email: "" }, // 문의 접수 시 이 번호로 문자
    },
    inferred: { method: "manual", industryId: "interior", confidence: 1, copyModel: "none(수기 작성)" },
    draft: doc,
    published: doc,
    published_at: now,
  };

  const { data, error } = await sb.from("sites").upsert(row, { onConflict: "slug" }).select("id, slug, status").single();
  if (error) throw new Error(`sites upsert 실패: ${error.message}`);
  console.log("사이트:", JSON.stringify(data));

  // 랜딩 "완성 예시" + 히어로 폰 목업 — featured 인 것이 heroSite 가 된다 (app/page.tsx)
  const { error: delErr } = await sb.from("showcase").delete().eq("slug", "interior2");
  if (delErr) throw new Error(`showcase(interior2) 삭제 실패: ${delErr.message}`);
  const { error: scErr } = await sb
    .from("showcase")
    .upsert({ slug: SLUG, tag: "인테리어", sort: 10, featured: true }, { onConflict: "slug" });
  if (scErr) throw new Error(`showcase upsert 실패: ${scErr.message}`);

  const { data: sc } = await sb.from("showcase").select("slug, tag, sort, featured");
  console.log("쇼케이스:", JSON.stringify(sc));
  console.log(`\n시연 링크: https://onstori.com/${SLUG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
