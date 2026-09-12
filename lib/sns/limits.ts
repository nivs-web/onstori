import type { SnsProvider } from "./types";

/**
 * SNS 글 상한 — 「몇 자까지, 해시태그 몇 개까지」의 **단일 출처**. (2026-09-12 회장님 지시 6)
 *
 * ★★ 왜 필요한가: 해시태그를 31개 쓰면 인스타가 **거절한다.** 그런데 지금은 그 이유가
 *   화면에 안 나온다. 사장님은 무엇을 고쳐야 하는지 모른 채 「실패했어요」만 본다.
 *   불변 규칙 12 — **판정하는 값·화면이 보여 주는 값·힌트가 데려가는 곳이 같아야 한다.**
 *
 * ★★ **여러 곳에 함께 올리면 «가장 짧은 곳»에 맞춰야 한다.** 인스타에 맞춰 쓴 글이
 *   X 에서 잘리면 사장님은 그것도 모른다. `strictest()` 가 그 계산을 한다.
 *
 * ⚠ 값의 출처는 각 플랫폼 공식 문서(김팀장 조사 2026-09-12). 바뀌면 **여기만** 고친다.
 *   화면·서버 어디에도 숫자를 다시 타이핑하지 마라.
 */

/**
 * ★ 영상 길이 상한(초). 상무님 규격서 v5 의 핵심 값이다.
 *
 * ★★ **페이스북 90초가 넷 중 가장 짧다.** 그래서 **60초가 «지켜야 하는 선»**이 됐다.
 *   영상 길이를 늘리는 결정은 **SNS 하나를 버리는 결정**이다 — 늘리자는 말이 나오면 이 표를 먼저 봐라.
 * ⚠ 모르는 것은 `null` 이다. **0 이 아니다** — 0 은 「못 올린다」가 돼 버린다.
 * ⚠ 틱톡은 계정마다 다르다. `creator_info` 가 주는 `max_video_post_duration_sec` 가 진짜 값이고,
 *   여기 값은 «물어보기 전»의 보수적인 짐작이 아니라 **모른다(null)** 로 둔다.
 */
export const MAX_DURATION_SEC: Record<SnsProvider, number | null> = {
  instagram: 900,
  facebook: 90,          // ← 넷 중 가장 짧다
  threads: null,         // ⚠ 확인 필요
  tiktok: null,          // 계정마다 다르다 — creator_info 로 받는다
  youtube: null,         // ⚠ 확인 필요
  x: null,               // ⚠ 확인 필요
};

export type TextLimit = {
  /** 글자 수 상한 */
  chars: number;
  /** 해시태그(#) 개수 상한. 제한이 없으면 null */
  hashtags: number | null;
  /** 멘션(@) 개수 상한. 제한이 없으면 null */
  mentions: number | null;
};

export const TEXT_LIMITS: Record<SnsProvider, TextLimit> = {
  instagram: { chars: 2200, hashtags: 30, mentions: 20 },
  threads:   { chars: 500,  hashtags: 1,  mentions: null },
  facebook:  { chars: 5000, hashtags: null, mentions: null },
  /* ⚠ 틱톡 제목 상한 2200자는 **첫 실제 게시로 대조해야 한다**(2026-09-12 추가).
     길이·용량은 계정마다 다를 수 있어 `creator_info` 가 주는 `max_video_post_duration_sec` 를 함께 본다. */
  tiktok:    { chars: 2200, hashtags: null, mentions: null },
  youtube:   { chars: 5000, hashtags: 15, mentions: null },
  /* X 는 무료 등급 기준 280자다. 링크는 서버가 지운다(lib/sns/no-url.ts) */
  x:         { chars: 280,  hashtags: null, mentions: null },
};

export type TextCount = { chars: number; hashtags: number; mentions: number };

/**
 * 글을 센다.
 *
 * ⚠ **글자 수는 코드포인트로 센다.** `"".length` 는 이모지 하나를 2로 세서
 *   사장님 화면의 숫자와 플랫폼의 판정이 어긋난다.
 * ⚠ 해시태그는 「#뒤에 글자가 붙은 것」만 센다 — `#` 하나만 있는 것은 태그가 아니다.
 *   한글 태그(`#입주청소`)가 실제로 가장 흔하므로 유니코드 글자를 포함해 센다.
 */
export function countText(s: string): TextCount {
  const text = s ?? "";
  return {
    chars: [...text].length,
    hashtags: (text.match(/(^|[\s(])#[\p{L}\p{N}_]+/gu) ?? []).length,
    mentions: (text.match(/(^|[\s(])@[A-Za-z0-9._]+/gu) ?? []).length,
  };
}

/** 고른 곳들 중 **가장 빡빡한** 상한. 하나도 안 골랐으면 null */
export function strictest(providers: SnsProvider[]): TextLimit | null {
  const picked = providers.map((p) => TEXT_LIMITS[p]).filter(Boolean);
  if (!picked.length) return null;
  const min = (xs: (number | null)[]) => {
    const nums = xs.filter((n): n is number => typeof n === "number");
    return nums.length ? Math.min(...nums) : null;
  };
  return {
    chars: Math.min(...picked.map((l) => l.chars)),
    hashtags: min(picked.map((l) => l.hashtags)),
    mentions: min(picked.map((l) => l.mentions)),
  };
}

/** 어느 곳이 그 상한을 만든 «범인»인가 — 사장님에게 「어디 때문인지」를 말해 주려고 */
export function tightestProvider(providers: SnsProvider[]): SnsProvider | null {
  if (!providers.length) return null;
  return providers.reduce((a, b) => (TEXT_LIMITS[b].chars < TEXT_LIMITS[a].chars ? b : a));
}

/**
 * 넘은 것을 **사람 말로** 돌려준다. 안 넘었으면 빈 배열.
 * ⚠ 「초과」·「유효하지 않음」 같은 말을 쓰지 않는다. 무엇을 몇 개 줄이면 되는지만 말한다.
 */
export function overs(count: TextCount, limit: TextLimit): string[] {
  const out: string[] = [];
  if (count.chars > limit.chars) out.push(`${count.chars - limit.chars}자 줄여 주세요 (${limit.chars}자까지)`);
  if (limit.hashtags !== null && count.hashtags > limit.hashtags) {
    out.push(`해시태그를 ${count.hashtags - limit.hashtags}개 줄여 주세요 (${limit.hashtags}개까지)`);
  }
  if (limit.mentions !== null && count.mentions > limit.mentions) {
    out.push(`@ 를 ${count.mentions - limit.mentions}개 줄여 주세요 (${limit.mentions}개까지)`);
  }
  return out;
}

/**
 * ⑨ 어댑터의 `getLimits()` 가 그대로 돌려주는 값. (상무님 규격서 v5)
 * ★ 어댑터마다 숫자를 다시 적지 않는다 — 위 두 표가 단일 출처다.
 */
export function limitsOf(p: SnsProvider): { maxDurationSec: number | null; maxCaptionChars: number; maxHashtags: number | null } {
  return {
    maxDurationSec: MAX_DURATION_SEC[p],
    maxCaptionChars: TEXT_LIMITS[p].chars,
    maxHashtags: TEXT_LIMITS[p].hashtags,
  };
}
