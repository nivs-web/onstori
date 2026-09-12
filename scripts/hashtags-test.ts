/**
 * 해시태그 검사 — 실패하면 종료코드 1. (2026-09-12 지시 C2·C3)
 * ⚠ DB 도 네트워크도 안 쓴다. 표(상수)와 순수 함수뿐이라 몇 번이고 돌려도 안전하다.
 */
import { normalizeTag, normalizeTags, regionTags, autoTags, composeCaption, MAX_FIXED_TAGS } from "../lib/hashtags";

let bad = 0, done = 0;
const t = (name: string, got: unknown, want: unknown) => {
  done++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ❌ ${name}\n       기대 ${w}\n       실제 ${g}`); bad++; }
  else console.log(`  ✅ ${name}`);
};

console.log("── 태그 다듬기 ──");
t("# 없이 적어도 된다", normalizeTag("입주청소"), "#입주청소");
t("# 를 붙여 적어도 된다", normalizeTag("#입주청소"), "#입주청소");
t("## 도 하나로", normalizeTag("##입주청소"), "#입주청소");
/* ⚠ 공백을 지우는 이유: 플랫폼은 `#우리 동네` 를 `#우리` 까지만 태그로 읽는다 */
t("가운데 공백은 지운다", normalizeTag("우리 동네 청소"), "#우리동네청소");
t("기호·이모지는 버린다", normalizeTag("청소-전문 ★"), "#청소전문");
t("글자가 안 남으면 없는 것", normalizeTag("★ ☆ !!"), null);
t("숫자만이면 태그가 아니다", normalizeTag("2026"), null);
t("빈 값도 안전하다", normalizeTag("   "), null);

console.log("\n── 여러 개 ──");
t("중복은 버린다(대소문자 무시)", normalizeTags(["#Cafe", "cafe", "커피"]), ["#Cafe", "#커피"]);
t("상한을 지킨다", normalizeTags(["가", "나", "다", "라", "마", "바"], MAX_FIXED_TAGS).length, 5);
t("빈 것은 조용히 버리고 순서는 지킨다", normalizeTags(["가", "!!", "나"]), ["#가", "#나"]);

console.log("\n── 주소에서 지역 뽑기 (지어내지 않는다) ──");
t("구 + 동", regionTags("서울특별시 강남구 역삼동 12-3"), ["강남구", "역삼동"]);
t("시 + 구", regionTags("경기도 성남시 분당구 정자로 100"), ["성남시", "분당구"]);
/* ★ 광역은 뺀다 — 너무 넓어 그 태그로 오는 사람은 우리 가게를 찾는 사람이 아니다 */
t("서울특별시는 안 쓴다", regionTags("서울특별시 마포구").includes("서울특별시"), false);
t("경기도도 안 쓴다", regionTags("경기도 수원시").includes("경기도"), false);
t("주소가 비면 빈 배열", regionTags(""), []);
t("번지는 안 쓴다", regionTags("부산광역시 해운대구 우동 1408"), ["해운대구", "우동"]);

console.log("\n── 자동 태그 (지역 → 업종 → 상호) ──");
t("셋이 순서대로",
  autoTags({ businessName: "평화와평화", industryId: "cafe", address: "서울특별시 마포구 연남동 1" }),
  ["#마포구", "#연남동", "#카페"]);
/* ⚠ 최대 3개라 상호가 밀려난다 — 지역 둘이 더 값지다는 판단이 코드에 박혀 있다 */
t("주소가 없으면 업종·상호가 올라온다",
  autoTags({ businessName: "바른전기", industryId: "electric", address: "" }),
  ["#전기", "#바른전기"]);
t("아무것도 없으면 빈 배열", autoTags({}), []);
t("모르는 업종은 조용히 건너뛴다",
  autoTags({ businessName: "온규", industryId: "없는업종", address: "" }), ["#온규"]);

console.log("\n── 글 + 태그 합치기 ──");
t("본문 뒤 빈 줄 하나를 두고 붙인다",
  composeCaption("오늘 국이 잘 끓었어요.", ["#반찬", "#국"]),
  "오늘 국이 잘 끓었어요.\n\n#반찬 #국");
/* ★★ 이미 본문에 있는 태그를 또 붙이면 중복이 되고 플랫폼이 스팸으로 읽는다 */
t("본문에 이미 있는 태그는 다시 안 붙인다",
  composeCaption("오늘도 #반찬 만들었어요", ["#반찬", "#국"]),
  "오늘도 #반찬 만들었어요\n\n#국");
t("본문이 비면 태그만", composeCaption("", ["#반찬"]), "#반찬");
t("태그가 없으면 본문 그대로", composeCaption("오늘도 맑음", []), "오늘도 맑음");
/* ⚠ 넘치면 «뒤에서부터» 버린다 — 앞쪽(지역·고정)이 더 중요하다 */
t("상한을 넘으면 뒤를 버린다",
  composeCaption("글", ["#하나", "#둘", "#셋"], 2),
  "글\n\n#하나 #둘");
t("본문에 있는 태그도 상한에 센다",
  composeCaption("#이미 있음", ["#하나", "#둘"], 2),
  "#이미 있음\n\n#하나");

console.log(`\n검사 ${done}건 · 실패 ${bad}건`);
process.exitCode = bad ? 1 : 0;
