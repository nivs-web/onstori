import { INDUSTRIES } from "@/config/industries";

/**
 * 해시태그 — **고정 · 자동 · 직접** 세 갈래. (2026-09-12 회장님 지시 C2·C3)
 *
 * ★★ 셋을 나눈 이유:
 *   · **고정** — 사장님이 «가게 설정»으로 한 번 정해 두는 것. 매번 다시 치지 않는다
 *   · **자동** — 우리가 **가게 정보에서 그대로 뽑아** 제안하는 것
 *   · **직접** — 이번 영상에만 붙이는 것
 *
 * ★★★ **자동 태그는 «지어내지» 않는다.** 상호·업종·주소에 **이미 있는 글자**만 쓴다.
 *   CLAUDE.md 불변 규칙(사실 날조 금지)이 여기에도 그대로 걸린다 — 없는 지역명이나
 *   없는 업종을 붙이면 그것은 손님을 속이는 것이고, 플랫폼이 「검색 조작」으로 본다.
 *   그래서 LLM 을 쓰지 않는다. **글자를 옮길 뿐**이라 결과가 항상 같고, 검사할 수 있다.
 *
 * ⚠ 자동 태그를 **몰래 붙이지 않는다.** 화면이 「이렇게 붙습니다」로 먼저 보여 주고,
 *   사장님이 지울 수 있는 «글자»로 들어간다(상무님 설계서 §1-6 · 틱톡 심사 요건).
 */

/** 고정 해시태그 상한 — 회장님 지시 「최대 5개」 (2026-09-12) */
export const MAX_FIXED_TAGS = 5;

/** 자동 제안 개수 — 상무님 설계서 「2~3개」 */
export const MAX_AUTO_TAGS = 3;

/**
 * 글자를 해시태그로 쓸 수 있게 다듬는다.
 *
 * ⚠ 공백·점·하이픈을 **지운다**(`#우리 동네` 는 `#우리` 까지만 태그가 된다).
 * ⚠ 앞의 `#` 는 있어도 되고 없어도 된다 — 사장님이 「# 없이 적으셔도 돼요」를 읽고 친다.
 * ⚠ 글자가 하나도 안 남으면 `null` — 빈 `#` 를 만들지 않는다.
 */
export function normalizeTag(raw: string): string | null {
  const body = (raw ?? "").trim().replace(/^#+/, "");
  /* 한글·영문·숫자·밑줄만 남긴다. 이모지와 기호는 태그를 깨뜨린다 */
  const kept = [...body].filter((ch) => /[\p{L}\p{N}_]/u.test(ch)).join("");
  if (!kept) return null;
  /* 숫자만으로 된 태그는 플랫폼이 태그로 안 읽는다 */
  if (/^\p{N}+$/u.test(kept)) return null;
  return `#${kept.slice(0, 40)}`;
}

/** 여러 개를 한 번에. 빈 것·중복은 조용히 버린다(순서는 지킨다) */
export function normalizeTags(raws: string[], max = MAX_FIXED_TAGS): string[] {
  const out: string[] = [];
  for (const r of raws ?? []) {
    const t = normalizeTag(r);
    if (!t) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 주소에서 **지역 이름**을 뽑는다. 지어내지 않는다 — 주소에 적힌 글자만 쓴다.
 *
 * 예) 「서울특별시 강남구 역삼동 12-3」 → ["강남구", "역삼동"]
 *     「경기도 성남시 분당구 …」        → ["성남시", "분당구"]
 *
 * ⚠ 「서울특별시」 같은 광역은 **뺀다.** 너무 넓어 검색에 도움이 안 되고,
 *   그 태그로 들어오는 사람은 우리 사장님 가게를 찾는 사람이 아니다.
 * ⚠ 번지·동호수는 안 쓴다. 그것은 개인정보에 가깝고 태그로서 뜻이 없다.
 */
export function regionTags(address: string): string[] {
  const words = (address ?? "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    /* 시·군·구·동·읍·면·리 로 끝나는 낱말만. 광역(특별시·광역시·도)은 건너뛴다 */
    if (/(특별시|광역시|특별자치시|특별자치도)$/.test(w)) continue;
    if (/^[가-힣]{1,2}도$/.test(w)) continue;                    // 경기도·강원도…
    if (!/[가-힣]$/.test(w)) continue;
    if (!/(시|군|구|동|읍|면|리)$/.test(w)) continue;
    if (w.length < 2) continue;
    out.push(w);
    if (out.length >= 2) break;                                  // 「구 + 동」이면 충분하다
  }
  return out;
}

export type SiteFacts = {
  businessName?: string | null;
  industryId?: string | null;
  address?: string | null;
};

/**
 * 가게 정보에서 **그대로 뽑은** 자동 태그. 최대 3개.
 *
 * 순서에 뜻이 있다: **지역 → 업종 → 상호**.
 *   · 지역이 먼저인 이유 — 동네 손님이 가장 많이 치는 말이다
 *   · 상호가 마지막인 이유 — 아직 아무도 모르는 이름이라 검색으로 들어오지 않는다.
 *     그래도 넣는 이유는 «이미 아는 손님»이 그 태그로 모이기 때문이다
 */
export function autoTags(facts: SiteFacts, max = MAX_AUTO_TAGS): string[] {
  const raw: string[] = [];
  raw.push(...regionTags(facts.address ?? ""));
  const ind = INDUSTRIES.find((i) => i.id === facts.industryId);
  if (ind) raw.push(ind.name);
  if (facts.businessName) raw.push(facts.businessName);
  return normalizeTags(raw, max);
}

/**
 * 글 + 태그를 **한 덩어리**로 만든다. 이것이 실제로 SNS 로 나가는 글이다.
 *
 * ⚠ 글 안에 이미 있는 태그는 **다시 붙이지 않는다.** 사장님이 본문에 `#입주청소` 를
 *   썼는데 우리가 또 붙이면 중복 태그가 되고, 플랫폼이 스팸으로 읽는다.
 * ⚠ 태그는 **본문 뒤 빈 줄 하나**를 두고 붙인다. 붙여 쓰면 마지막 문장이 태그에 먹힌다.
 * ⚠ `limit` 를 넘는 만큼은 **뒤에서부터 버린다** — 앞쪽(지역·고정)이 더 중요하기 때문이다.
 */
export function composeCaption(body: string, tags: string[], limit: number | null = null): string {
  const text = (body ?? "").trim();
  const already = new Set(
    (text.match(/(^|[\s(])#[\p{L}\p{N}_]+/gu) ?? []).map((m) => m.trim().toLowerCase()),
  );
  let use = normalizeTags(tags, 60).filter((t) => !already.has(t.toLowerCase()));
  if (limit !== null) {
    const room = Math.max(0, limit - already.size);
    use = use.slice(0, room);
  }
  if (!use.length) return text;
  return text ? `${text}\n\n${use.join(" ")}` : use.join(" ");
}
