"use client";

import { countText, overs, strictest, tightestProvider, TEXT_LIMITS } from "@/lib/sns/limits";
import { PROVIDER_NAME } from "@/lib/sns";
import type { SnsProvider } from "@/lib/sns/types";

/**
 * 글자 수·해시태그 세는 표시 (2026-09-12 회장님 지시 6)
 *
 * ★★ **넘었다고 막지 않는다.** 사장님이 쓴 글을 우리가 지우거나 못 쓰게 하지 않는다.
 *   대신 **무엇을 몇 개 줄이면 되는지** 그 자리에서 말한다. 지금은 올리기를 눌러야
 *   실패를 알고, 그마저 이유가 안 나온다.
 *
 * ★ 여러 곳에 함께 올릴 때는 **가장 짧은 곳** 기준으로 센다 — 인스타에 맞춰 쓴 글이
 *   X 에서 잘려도 사장님은 모른다.
 */
export function TextMeter({ text, providers, className = "" }: {
  text: string;
  /** 고른 SNS. 비어 있으면 인스타 기준으로 안내한다(지금 열려 있는 곳이 인스타뿐이라) */
  providers?: SnsProvider[];
  className?: string;
}) {
  const picked = providers?.length ? providers : (["instagram"] as SnsProvider[]);
  const limit = strictest(picked) ?? TEXT_LIMITS.instagram;
  const count = countText(text);
  const problems = overs(count, limit);
  const tight = tightestProvider(picked);
  const near = count.chars > limit.chars * 0.9;

  return (
    <p className={`t-caption leading-relaxed ${problems.length ? "font-semibold text-danger" : "text-[var(--text-soft)]"} ${className}`}>
      <span>
        {count.chars}/{limit.chars}자
        {limit.hashtags !== null && <> · 해시태그 {count.hashtags}/{limit.hashtags}</>}
        {limit.mentions !== null && count.mentions > 0 && <> · @ {count.mentions}/{limit.mentions}</>}
      </span>
      {/* ★ 왜 이 숫자인지 말해 준다 — 「어디 기준이냐」를 모르면 숫자가 남의 규칙으로 보인다 */}
      {tight && <span> · {PROVIDER_NAME[tight]} 기준</span>}
      {problems.length > 0 && <><br />{problems.join(" · ")}</>}
      {!problems.length && near && <><br />거의 다 찼어요.</>}
    </p>
  );
}
