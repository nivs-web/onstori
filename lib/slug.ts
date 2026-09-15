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

/* ───────── 한글 상호 → 영문 주소 (2026-09-15 대표님 지시로 신설) ───────── */

/**
 * ★★ **한글 상호를 영문으로 옮긴다.** 국어의 로마자 표기법(가까운 쪽) 근사.
 *
 * ★ 왜 필요한가: 주소 칸을 되살리면서 **추천 단추 3개**를 같이 드리기로 했다.
 *   그런데 상호가 한글이면 뽑아 낼 영문이 **한 글자도 없었다.** 그래서 전에는
 *   자동 초안이 «빈칸»이었고, 그게 가입 이탈 1위의 진짜 원인이었다(2026-09-12).
 *   여기서 옮겨 주면 「다산 리모델링」이 `dasan` 이 된다 — 사장님이 **읽을 수 있는** 주소다.
 *
 * ⚠ **완벽한 표기법이 아니다.** 사람 이름·고유명사는 관용 표기가 따로 있다(「이」=Lee 등).
 *   그래서 이것은 **추천일 뿐**이고, 옆 칸에서 사장님이 직접 고칠 수 있어야 한다. 그게 핵심이다.
 * ⚠ 한글이 아닌 글자는 **그대로 둔다** — 이미 영문 상호면 손대지 않는다.
 */
const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","k","n","n","n","t","l","k","m","p","t","t","p","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

export function romanize(s: string): string {
  let out = "";
  for (const ch of s ?? "") {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) { out += ch; continue; } // 한글 음절이 아니면 그대로
    out += CHO[Math.floor(code / 588)] + JUNG[Math.floor((code % 588) / 28)] + JONG[code % 28];
  }
  return out;
}

/**
 * ★ **주소 후보를 «좋은 순서»로 만든다.** 겹침 검사는 부르는 쪽이 한다(`/api/slug-check`).
 *
 * 순서에 뜻이 있다 — 사장님이 **첫 번째를 고를 확률이 가장 높다**:
 *   ① 상호 첫 낱말      「다산 리모델링」 → `dasan`          ← 가장 짧고 기억하기 쉽다
 *   ② 상호 첫 낱말＋업종 「다산 리모델링」 → `dasan-interior` ← ①이 찼을 때의 자연스러운 다음
 *   ③ 상호 전체         「다산 리모델링」 → `dasanrimodelring`
 *   ④ 업종만            `interior`                          ← 상호에서 아무것도 못 뽑았을 때
 *
 * ⚠ 3글자 미만은 버린다 — 주소 규칙이 3~30자다(`/api/slug-check`).
 * ⚠ **중복을 뺀 순서 그대로** 돌려준다. 부르는 쪽이 위에서부터 비어 있는 것을 고른다.
 */
export function slugCandidates(businessName: string, industryId?: string | null): string[] {
  const words = romanize(businessName ?? "").split(/[\s·,./_-]+/).map(clean).filter(Boolean);
  const first = words[0] ?? "";
  const joined = clean(words.join(""));
  const ind = clean(INDUSTRY_SLUG[String(industryId ?? "")] ?? "");

  const raw = [
    first,
    first && ind && first !== ind ? `${first}-${ind}`.slice(0, MAX) : "",
    joined !== first ? joined : "",
    ind,
  ];
  const seen = new Set<string>();
  return raw.filter((c) => c.length >= MIN && !seen.has(c) && seen.add(c));
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
