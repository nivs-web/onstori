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
