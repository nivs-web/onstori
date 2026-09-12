/** 세부 업종 전부에 조사를 맞춰 본다 — 눈으로 확인용 (2026-09-13 박팀장 지적) */
import { josa } from "../lib/sns/status-say";
import { INDUSTRY_GROUPS } from "../config/industry-picker";

const labels = INDUSTRY_GROUPS.flatMap((g) => g.items.map((i) => i.label));
let withF = 0, without = 0;
for (const t of labels) (josa(t, "을/를") === "을" ? withF++ : without++);
console.log(`세부 업종 ${labels.length}개 — 받침 있음 ${withF} · 없음 ${without}`);
console.log("보기:");
for (const t of labels.slice(0, 10)) console.log(`  예: ${t}${josa(t, "을/를")} 해요. 작은 현장도 갑니다.`);
