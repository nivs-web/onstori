import type { ShortT, ShortLink } from "@/lib/shorts";
import { SNS_SHORT, SNS_DOT } from "./sns-brand";

/**
 * 🔴 **「이 홈페이지가 영상을 퍼뜨리고 있는 곳」** — 무대 바로 아래 한 줄. (2026-09-17 지시 [31]⑤)
 *
 * > **대표님 원문:** 「이 홈페이지에 연결된 SNS가 전부 나열되어서, 클릭하면 각각의 SNS으로 이동…
 * >   **이 홈페이지는 이런 SNS에 이런식으로 영상을 한 방에 퍼뜨리고 있구나, 대단하다** 라는 걸 느낄 거 같아」
 *
 * ★★ **무엇을 «연결»로 볼 것인가 — 가장 정직한 값을 골랐다.**
 *   후보가 둘 있었다:
 *   ① `settings.channels` — 사장님이 **직접 적어 넣은** 주소(네이버 플레이스·블로그…).
 *      ⚠ **적어 넣기만 하고 실제로는 아무것도 안 나갔을 수** 있다. 그리고 그것은
 *        이미 **떠 있는 채널 위젯**(`channel-widget.tsx`)이 보여 준다 — 두 번 그릴 이유가 없다.
 *   ② 🔴 **실제로 «올라간» 글의 기록**(`sns_posts.status = 'published'`) ← **이것을 쓴다**
 *      대표님 말씀이 「퍼뜨리고 **있구나**」이므로, **진짜 나간 것**만 세는 것이 맞다.
 *
 * 🔴 **연결 안 된 것을 「준비 중」으로 늘어놓지 않는다**(권반장 지시). 없는 것을 있는 것처럼
 *   보이면 그건 거짓이다. **하나도 없으면 이 칸 자체를 안 그린다.**
 *
 * ⚠ 여기서는 **여섯 곳이 다 나온다.** 영상 위 알약만 둘로 줄였다(지시 ④) —
 *   「너저분하다」는 말은 **영상을 가리는 버튼**에 대한 것이지, 이 칸은 「전부 나열」이 목적이다.
 *
 * ⚠ **`"use client"` 가 없다.** 링크 몇 개라 JS 가 필요 없다 — 손님에게 한 바이트도 더 안 보낸다.
 */

/** 한 곳당 한 줄. 같은 곳에 여러 번 올라갔으면 **가장 위(최신) 것**을 쓴다 */
function collect(items: ShortT[]): ShortLink[] {
  const seen = new Map<ShortLink["provider"], string>();
  for (const it of items) {
    for (const l of it.links) if (!seen.has(l.provider)) seen.set(l.provider, l.url);
  }
  return [...seen].map(([provider, url]) => ({ provider, url }));
}

export default function ShortsSns({ items, title }: { items: ShortT[]; title: string }) {
  const links = collect(items);
  /* 🔴 하나도 없으면 아무것도 그리지 않는다 */
  if (!links.length) return null;

  return (
    <section className="sns-strip">
      <div className="sns-strip-in">
        <p className="sns-strip-head">{title}</p>
        <ul className="sns-strip-list">
          {links.map((l) => (
            <li key={l.provider}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="sns-strip-pill">
                <span className="sns-strip-dot" style={{ background: SNS_DOT[l.provider] }} />
                {SNS_SHORT[l.provider]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
