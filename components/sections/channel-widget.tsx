"use client";

import { useState } from "react";
import { OWNER_CHANNELS, isUsableChannelUrl } from "@/config/owner-channels";

/**
 * ★★★ **떠 있는 채널 위젯.** (2026-09-15 대표님 지시)
 *
 * ★ 대표님 말씀: 「다양한 연결을 하면 홈페이지에 **플로팅으로 위젯처럼 공중에 뜨게** 만들 거야.
 *   클릭하면 연결되는 거야. 위에 버튼들 다 **최고급으로 디자인**해서 만들고」
 *
 * ★★ **하단 고정 바와 «절대» 겹치면 안 된다.**
 *   `site-chrome.tsx` 의 `Dock()` 주석에 못 박혀 있다 — 「이 바가 있으면 플로팅 버튼을 따로 두지
 *   않는다 — 겹친다」. 그래서 화면을 둘로 갈랐다:
 *   · **PC(md 이상)**  — 오른쪽 세로 띠. 하단 바가 `md:hidden` 이라 애초에 안 겹친다
 *   · **폰**          — 하단 바 **«위»**에 접힌 원 **하나**. 눌러야 펼쳐진다
 *     ⚠ 위치를 `bottom: calc(var(--dock-h) + …)` 로 잡는다. 하단 바 높이가 바뀌어도 따라간다
 *
 * ★ **그림 파일을 안 쓴다.** 로고를 받아 오면 ①외부 요청이 늘어 홈페이지가 느려지고
 *   ②플랫폼 로고에는 상표 규정이 있다. 글자 + 그 플랫폼 색이면 손님은 충분히 알아본다.
 *
 * ⚠ **채널이 하나도 없으면 아무것도 그리지 않는다.** 빈 동그라미는 고장으로 보인다.
 */
export function ChannelWidget({ channels }: { channels?: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);

  const items = OWNER_CHANNELS
    .map((c) => ({ def: c, url: (channels ?? {})[c.id] }))
    .filter((x): x is { def: (typeof OWNER_CHANNELS)[number]; url: string } => isUsableChannelUrl(x.url));

  if (items.length === 0) return null;

  const Bubble = ({ def, url, size }: { def: (typeof OWNER_CHANNELS)[number]; url: string; size: number }) => (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${def.label} 열기`}
      title={def.label}
      className="flex items-center justify-center font-bold transition-transform hover:scale-110"
      style={{
        width: size, height: size, borderRadius: "50%",
        background: def.color, color: "#fff",
        fontSize: def.mark.length > 2 ? size * 0.3 : size * 0.38,
        letterSpacing: "-0.02em",
        /* 떠 있어 보이게 — 그림자 둘을 겹친다(가까운 것 + 퍼지는 것) */
        boxShadow: "0 1px 2px rgba(0,0,0,.18), 0 6px 16px rgba(0,0,0,.16)",
      }}
    >
      {def.mark}
    </a>
  );

  return (
    <>
      {/* ───────── PC — 오른쪽 세로 띠 ───────── */}
      <div
        className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col md:flex"
        style={{ gap: "var(--s-3)" }}
        aria-label="채널 바로가기"
      >
        {items.map(({ def, url }) => <Bubble key={def.id} def={def} url={url} size={48} />)}
      </div>

      {/* ───────── 폰 — 하단 고정 바 «위»에 접힌 원 하나 ───────── */}
      <div
        className="fixed right-4 z-30 flex flex-col items-end md:hidden"
        style={{
          /* ⚠ 하단 바 높이 + 안전영역 + 여백. 숫자를 박지 않는다 — 바가 바뀌면 따라가야 한다 */
          bottom: "calc(var(--dock-h) + env(safe-area-inset-bottom) + var(--s-3))",
          gap: "var(--s-2)",
        }}
        aria-label="채널 바로가기"
      >
        {open && items.map(({ def, url }) => <Bubble key={def.id} def={def} url={url} size={44} />)}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "채널 목록 접기" : `채널 ${items.length}곳 보기`}
          className="flex items-center justify-center font-bold"
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--s-accent)", color: "var(--s-on-accent)",
            fontSize: 20, lineHeight: 1,
            boxShadow: "0 1px 2px rgba(0,0,0,.18), 0 6px 16px rgba(0,0,0,.16)",
            transition: "transform .15s",
            transform: open ? "rotate(45deg)" : "none",
          }}
        >
          ＋
        </button>
      </div>
    </>
  );
}
