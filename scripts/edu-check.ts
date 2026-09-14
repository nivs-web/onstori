/**
 * **교육·레슨 샘플 셋이 제대로 분류되는지** 눈으로 본다. (2026-09-13 지시 14)
 * ⚠ DB 도 AI 도 안 쓴다 — 분류표만 읽는다.
 */
import { CATEGORIES, INDUSTRIES } from "../config/industries";
import { findSubIndustry } from "../config/industry-picker";
import { josa } from "../lib/sns/status-say";

for (const label of ["일본어", "배드민턴", "코딩", "카페"]) {
  const sub = findSubIndustry(label);
  const ind = INDUSTRIES.find((i) => i.id === sub?.industryId);
  const cat = CATEGORIES.find((c) => c.id === ind?.categoryId);
  console.log(
    `${label.padEnd(6)} → 업종 ${(ind?.name ?? "❌ 못 찾음").padEnd(10)}· 카테고리 ${(cat?.name ?? "-").padEnd(8)}` +
    `· 템플릿 ${(cat?.template ?? "-").padEnd(8)}· 켜짐 ${cat?.active ? "✅" : "❌"} · 사진태그 ${ind?.bankTags.join(",") ?? "-"}`,
  );
  console.log(`         문구: 「${label}${josa(label, "을/를")} 해요」`);
}

/* ════════ 부르는 말이 템플릿에 맞는지 (2026-09-13 상무님 지적 18·19·21) ════════ */
import { TEMPLATE_WORDS } from "../config/industries";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`  ❌ ${name}\n       기대 ${JSON.stringify(want)}\n       실제 ${JSON.stringify(got)}`); bad++;
  } else console.log(`  ✅ ${name}`);
};

console.log("\n── 학원에 「견적」·「매장」·「메뉴」를 쓰지 않는다 ──");
t("★ 문의 단추(전 업종 「문의하기」로 통일, 대표 결정 R-0001)", TEMPLATE_WORDS.consult.cta, "문의하기");
t("★ 사진 제목", TEMPLATE_WORDS.consult.gallery, "수업 사진");
t("★ 가격표 제목", TEMPLATE_WORDS.consult.priceTitle, "수업료");
t("시공도 문의 단추는 「문의하기」(대표 결정 R-0001)", TEMPLATE_WORDS.quote.cta, "문의하기");
t("카페는 그대로 「매장 사진」", TEMPLATE_WORDS.visit.gallery, "매장 사진");
t(
  "★ 템플릿 5종의 문의 단추가 전부 같은 값이다(누가 한 업종만 되돌려도 여기서 잡힌다)",
  Object.values(TEMPLATE_WORDS).map((w) => w.cta),
  Object.values(TEMPLATE_WORDS).map(() => "문의하기"),
);

console.log("\n── 모든 템플릿에 말이 빠짐없이 있다 ──");
for (const [k, w] of Object.entries(TEMPLATE_WORDS)) {
  t(`${k} — 네 가지가 다 있다`, [w.cta, w.formTitle, w.gallery, w.priceTitle].every((x) => !!x && x.length <= 8), true);
}

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
