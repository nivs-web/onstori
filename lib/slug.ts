/**
 * 홈페이지 주소(slug) 자동 짓기. (2026-09-12)
 *
 * ★★ 왜 만들었나: 가입 3단계의 「홈페이지 주소」 칸이 **이탈 1위**였다(회장님).
 *   한글 상호면 자동 초안이 빈칸이고, 한글을 치면 글자가 안 찍히는데 **이유를 안 알려준다.**
 *   사장님은 «고장났나» 하고 나간다. 그래서 **칸을 없애고 서버가 짓는다.**
 *
 * ★ 짓는 순서
 *   ① 상호에서 영문·숫자만 뽑아 본다 (「Dasan Interior」 → `dasaninterior`)
 *   ② 한글이라 아무것도 안 남으면 **업종 영문 이름**으로 간다 (`interior`, `cafe` …)
 *   ③ 그것도 없으면 `store`
 *   ④ 겹치면 뒤에 숫자를 붙인다 (`interior-2`, `interior-3` …)
 *
 * ⚠ 사장님에게 보여 주는 주소라 **읽을 수 있어야** 한다. 무작위 문자열을 쓰지 않는다.
 */

/** 업종 id → 주소에 쓸 영문 조각. ⚠ 없는 업종은 그냥 store 로 떨어진다 */
const INDUSTRY_SLUG: Record<string, string> = {
  interior: "interior", remodel: "remodel", cafe: "cafe", restaurant: "restaurant",
  beauty: "beauty", hair: "hair", nail: "nail", pilates: "pilates", gym: "gym",
  academy: "academy", studio: "studio", clean: "clean", moving: "moving",
  repair: "repair", pet: "pet", flower: "flower", bakery: "bakery", photo: "photo",
};

const MIN = 3;
const MAX = 30;

/** 영문·숫자·하이픈만 남긴다. 앞뒤 하이픈은 떼고 길이를 맞춘다 */
function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX);
}

/** 후보 하나를 만든다(겹침 검사는 부르는 쪽이 한다) */
export function baseSlug(businessName: string, industryId?: string | null): string {
  const fromName = clean(businessName ?? "");
  if (fromName.length >= MIN) return fromName;

  const fromIndustry = clean(INDUSTRY_SLUG[String(industryId ?? "")] ?? "");
  if (fromIndustry.length >= MIN) return fromIndustry;

  return "store";
}

/**
 * 겹치지 않는 주소를 찾는다.
 * @param taken 이미 쓰고 있거나 예약된 주소인지 묻는 함수
 *
 * ⚠ 무한히 돌지 않는다. 넉넉히 돌고도 못 찾으면 **시각을 붙여** 반드시 끝낸다 —
 *   못 찾았다고 가입을 실패시키면 그게 더 나쁘다.
 */
export async function uniqueSlug(
  businessName: string,
  industryId: string | null | undefined,
  taken: (s: string) => Promise<boolean>,
): Promise<string> {
  const base = baseSlug(businessName, industryId);
  if (!(await taken(base))) return base;

  for (let i = 2; i <= 50; i++) {
    const cand = `${base.slice(0, MAX - String(i).length - 1)}-${i}`;
    if (!(await taken(cand))) return cand;
  }
  const tail = Date.now().toString(36).slice(-4);
  return `${base.slice(0, MAX - 5)}-${tail}`;
}
