"use client";

import { useEffect, useState } from "react";
import { OWNER_CHANNELS, isUsableChannelUrl } from "@/config/owner-channels";

/**
 * ★★★ **떠 있는 채널 위젯.** (2026-09-15 신설 · 2026-09-16 대표님 지시로 전면 개정)
 *
 * ★ 2026-09-16 대표님 말씀 — 이 파일이 지금 모습이 된 이유 셋:
 *   ① 「**왜 로고 안 넣어?** 네이버는 네이버 로고, 네이버 블로그는 Blog 라고 써 있는 로고로 개선해」
 *   ② 「**히어로 섹션에서는 이 플로팅 위젯이 아예 안 뜨면 좋겠어.** 벗어나면 나오는 게 좋겠다」
 *   ③ 「**PC 버전은 조금 조잡해 보인다.** PC 에서는 작은 + 모양 공이 우측 하단에 고정돼서,
 *      누르면 뜨게 하자」
 *
 * ⚠ **폐기된 옛 방침:** 「그림 파일을 안 쓰니 글자(N·IG·B)로 충분하다」(2026-09-15).
 *   글자만 넣은 원은 손님에게 «무슨 버튼인지» 안 읽혔다. 지금은 **인라인 SVG 로 직접 그린
 *   로고**를 쓴다 — 그림 파일을 안 쓴다는 원칙은 그대로다(외부 요청 0개, 캐시 걱정 0개).
 *
 * ★★ **하단 고정 바와 «절대» 겹치면 안 된다.**
 *   `site-chrome.tsx` 의 `Dock()` 주석에 못 박혀 있다 — 「이 바가 있으면 플로팅 버튼을 따로 두지
 *   않는다 — 겹친다」. 그래서 화면을 둘로 갈랐고, **폰 쪽 위치는 `calc(var(--dock-h) + …)` 를
 *   그대로 유지한다.** 하단 바 높이가 바뀌어도 따라가야 한다.
 *
 * ⚠ **채널이 하나도 없으면 아무것도 그리지 않는다.** 빈 동그라미는 고장으로 보인다.
 */

/* ───────────────────────── 크기 ─────────────────────────
   ★ **PC 공을 36px 로 정한 이유** (2026-09-16)
     대표님은 「모바일 48px 의 **1/3**」이라 하셨다. 문자 그대로면 16px 다. 그런데 16px 는
     ① 접근성 기준(WCAG 2.2 «최소 목표 크기» 24×24px)에 **미달**이고
     ② 마우스로도 자꾸 빗나간다 — 누르려다 못 누르면 없는 것만 못하다.
     그래서 **지름은 36px**(모바일의 3/4)로 두되, **차지하는 넓이는 48px 원의 56%** 다.
     눈에는 확실히 「작은 공」으로 보이면서 누르는 데는 지장이 없는 가장 작은 값이다.
   ⚠ 이 값을 24px 아래로 내리지 마라. 접근성 기준을 깬다. */
const PC_SIZE = 36;
const MOBILE_FAB = 48;
const MOBILE_BUBBLE = 44;

/* ───────────────────────── 로고 ─────────────────────────
 * ★★ **직접 그린 단순화 도형이다. 공식 로고를 베낀 것이 아니다.**
 *   상표 규정을 피하면서도 손님이 한눈에 알아보게 하는 선이다 — 색은 그 플랫폼 색을 쓰고,
 *   모양은 «그 플랫폼 하면 떠오르는 형태» 하나만 남겼다.
 * ★ 전부 `viewBox="0 0 24 24"` 한 규격이다. 바깥 <svg> 가 흰색 채움을 주므로,
 *   선으로 그리는 도형만 `fill="none" stroke="#fff"` 를 직접 적는다.
 * ⚠ 새 채널을 `config/owner-channels.ts` 에 더하면 **여기에도 한 줄 더해라.**
 *   없으면 그 채널의 `mark` 글자로 떨어진다(아래 Bubble 참고) — 고장은 아니지만 어색하다.
 */
const LOGO: Record<string, React.ReactNode> = {
  /* 네이버 — 초록 바탕에 각진 흰 N. 한국 손님은 이 한 글자로 바로 안다 */
  naverPlace: <path d="M7 6h3.6L14 12V6h3v12h-3.6L10 12v6H7z" />,

  /* 네이버 블로그 — 대표님 말씀대로 «Blog 라고 써 있는» 모양.
     ⚠ `textLength` 로 글자 폭을 못 박는다. 손님 사이트마다 글꼴이 다른데,
       폭을 안 박으면 어떤 사이트에서는 글자가 원 밖으로 삐져나온다. */
  naverBlog: (
    <text x="12" y="14.9" textAnchor="middle" textLength="17" lengthAdjust="spacingAndGlyphs"
          fontSize="11" fontWeight="800">blog</text>
  ),

  /* 인스타그램 — 둥근 네모 + 렌즈 + 점 하나. 바탕은 브랜드 그라데이션(owner-channels.ts) */
  instagram: (
    <>
      <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="4.6" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="16.7" cy="7.4" r="1.15" />
    </>
  ),

  /* 유튜브 — 빨간 바탕에 흰 재생 삼각형 */
  youtube: <path d="M9.2 7.4 17.6 12 9.2 16.6z" />,

  /* 네이버 예약 — 달력에 체크. 「예약이 잡혔다」가 한눈에 보이게 */
  naverBooking: (
    <>
      <rect x="4.2" y="6.2" width="15.6" height="13.6" rx="2.6" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M4.2 10.6h15.6M8.6 4.2v3.4M15.4 4.2v3.4"
            fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="m8.9 14.7 2.2 2.2 4.2-4.3"
            fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  /* 네이버 지도(길찾기) — 지도 핀. 같은 초록인 플레이스와 «모양»으로 구분된다 */
  naverMap: (
    <path fillRule="evenodd" d="M12 3a6.5 6.5 0 0 0-6.5 6.5c0 4.5 5.7 10.5 5.9 10.8a.8.8 0 0 0 1.2 0c.2-.3 5.9-6.3 5.9-10.8A6.5 6.5 0 0 0 12 3m0 4.1a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8" />
  ),

  /* 스마트스토어 — 장바구니 가방 */
  smartStore: (
    <>
      <path d="M4.6 8.6h14.8l-.85 10.5a1.5 1.5 0 0 1-1.5 1.4H7a1.5 1.5 0 0 1-1.5-1.4z" />
      <path d="M8.7 8.6V7a3.3 3.3 0 0 1 6.6 0v1.6"
            fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>
  ),

  /* 기존 홈페이지(서브) — 지구본. 특정 브랜드가 아니므로 중립 회색이다 */
  homepage: (
    <g fill="none" stroke="#fff" strokeWidth="1.9">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.5 2.3 3.8 4.9 3.8 8S14.5 17.7 12 20c-2.5-2.3-3.8-4.9-3.8-8S9.5 6.3 12 4z" />
    </g>
  ),
};

/* 떠 있어 보이게 — 그림자 둘을 겹친다(가까운 것 + 퍼지는 것) */
const LIFT = "0 1px 2px rgba(0,0,0,.18), 0 6px 16px rgba(0,0,0,.16)";

/**
 * 채널 원 하나.
 * 🔴 **이 둘(Bubble·Toggle)을 ChannelWidget «안»으로 옮기지 마라.**
 *   안에서 정의하면 다시 그릴 때마다 React 가 «다른 부품»으로 보고 버튼을 새로 만든다 →
 *   **키보드로 + 를 누른 손님의 초점이 날아간다.** 바깥에 두면 그 일이 없다.
 */
function Bubble({
  def, url, size, onPick,
}: { def: (typeof OWNER_CHANNELS)[number]; url: string; size: number; onPick: () => void }) {
  const g = Math.round(size * 0.58);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${def.label} 열기`}
      title={def.label}
      onClick={onPick}
      className="flex items-center justify-center transition-transform hover:scale-110"
      style={{
        width: size, height: size, borderRadius: "50%",
        /* ⚠ `def.color` 는 «색 하나»가 아니라 CSS background 값이다 — 인스타는 그라데이션이다 */
        background: def.color, color: "#fff",
        boxShadow: LIFT,
      }}
    >
      <svg viewBox="0 0 24 24" width={g} height={g} aria-hidden="true" fill="#fff">
        {/* 로고를 아직 안 그린 새 채널은 그 채널의 `mark` 글자로 떨어진다 */}
        {LOGO[def.id] ?? (
          <text x="12" y="16.2" textAnchor="middle" textLength={def.mark.length > 2 ? 19 : 14}
                lengthAdjust="spacingAndGlyphs" fontSize="13" fontWeight="800">{def.mark}</text>
        )}
      </svg>
    </a>
  );
}

/** 접었다 폈다 하는 + 공. PC·폰이 **같은 부품**을 크기만 달리 쓴다 */
function Toggle({
  size, open, count, onToggle,
}: { size: number; open: boolean; count: number; onToggle: () => void }) {
  const g = Math.round(size * 0.5);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "채널 목록 접기" : `채널 ${count}곳 보기`}
      className="flex items-center justify-center transition-transform hover:scale-110"
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "var(--s-accent)", color: "var(--s-on-accent)",
        boxShadow: LIFT,
        transform: open ? "rotate(45deg)" : "none",
      }}
    >
      {/* ＋ 를 글자로 쓰면 글꼴마다 굵기·위치가 달라진다. 선 두 개로 직접 그린다.
          펼치면 45도 돌아 × 가 된다 — 도형 하나로 두 뜻을 낸다 */}
      <svg viewBox="0 0 24 24" width={g} height={g} aria-hidden="true"
           fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

export function ChannelWidget({ channels }: { channels?: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  /**
   * ★ 히어로를 지났나. **처음에는 «아니다»(= 숨김)로 둔다.**
   *   반대로 두면 첫 화면에 위젯이 잠깐 번쩍였다 사라진다 — 히어로가 LCP(첫인상) 요소라
   *   거기서 뭔가 깜빡이는 것이 제일 나쁘다.
   */
  const [pastHero, setPastHero] = useState(false);

  const items = OWNER_CHANNELS
    .map((c) => ({ def: c, url: (channels ?? {})[c.id] }))
    .filter((x): x is { def: (typeof OWNER_CHANNELS)[number]; url: string } => isUsableChannelUrl(x.url));
  const count = items.length;

  /**
   * ★★ **히어로 섹션에서는 안 보인다.** (2026-09-16 대표님 지시)
   *
   * ⚠ **스크롤 이벤트를 듣지 않는다.** 스크롤은 손가락 한 번에 수십 번 불린다 —
   *   손님 폰에서 화면이 버벅인다. `IntersectionObserver` 는 브라우저가 «경계를 넘는 순간»에만
   *   불러 준다. 한 방문에 보통 **두세 번** 불린다. 사실상 공짜다.
   *
   * ★ 무엇을 보는가: 히어로가 달고 있는 `id="top"`(components/sections/index.tsx 의 HeroSec).
   * ⚠ **히어로가 없는 사이트도 있다.** 그때는 `#top` 이 없으므로 **항상 보이게** 한다.
   * ⚠ 히어로가 첫 섹션이 아닌 드문 사이트에서는 그 히어로가 화면에 들어올 때도 숨는다.
   *   일부러 그대로 뒀다 — 「히어로 위에는 안 띄운다」는 지시와 어긋나지 않고,
   *   첫 섹션인지 아닌지를 DOM 으로 되짚는 코드가 훨씬 깨지기 쉽다.
   */
  useEffect(() => {
    if (count === 0) return;
    const hero = document.getElementById("top");
    if (!hero || typeof IntersectionObserver === "undefined") {
      /* 히어로가 없는 사이트 — 관찰할 대상이 없으니 그냥 보여 준다.
         ⚠ 여기서 곧바로 setState 를 하면 렌더가 연달아 한 번 더 돈다(react-hooks 규칙).
           다음 그림 한 장 뒤로 미룬다 — 사람 눈에는 티가 안 나는 16밀리초다. */
      const t = requestAnimationFrame(() => setPastHero(true));
      return () => cancelAnimationFrame(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        const onHero = entries[0]?.isIntersecting ?? false;
        setPastHero(!onHero);
        // 히어로로 되돌아왔는데 펼친 채로 두면, 다시 내려왔을 때 갑자기 다 펼쳐져 있다
        if (onHero) setOpen(false);
      },
      { threshold: 0 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [count]);

  /** 펼친 동안에만 ESC 를 듣는다 — 접힌 상태에서는 아무것도 붙어 있지 않다 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (count === 0) return null;

  /* ⚠ 함수를 매번 새로 만들지만, Bubble·Toggle 이 memo 가 아니라 아무 비용이 없다.
     useCallback 을 붙이면 오히려 읽기만 어려워진다 */
  const close = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  /* 히어로 위에서는 **눌리지도, 탭으로 옮겨가지도** 않아야 한다 — 그래서 visibility 까지 끈다.
     ⚠ 끄는 쪽에만 `visibility 0s linear var(--dur-2)` 를 붙인다. 사라지는 동안은 보여야
       페이드가 보이고, 다 사라진 뒤에 초점 대상에서 빠진다. */
  const veil: React.CSSProperties = pastHero
    ? {
        opacity: 1,
        transform: "none",
        transition: "opacity var(--dur-2) var(--ease-ui), transform var(--dur-2) var(--ease-ui)",
      }
    : {
        opacity: 0,
        transform: "translateY(10px)",
        visibility: "hidden",
        pointerEvents: "none",
        transition:
          "opacity var(--dur-2) var(--ease-ui), transform var(--dur-2) var(--ease-ui), visibility 0s linear var(--dur-2)",
      };

  return (
    <>
      {/* ───────── PC — 우측 «하단»에 작은 공 하나. 누르면 위로 펼쳐진다 ─────────
          ⚠ 옛 모습(오른쪽 세로 띠에 아이콘 전부 펼침)은 2026-09-16 폐기됐다.
            대표님: 「PC 버전은 조금 조잡해 보인다」. 평소엔 공 하나만 조용히 떠 있는다.
          ★ 하단 고정 바는 `md:hidden` 이라 PC 에는 없다 — 그래서 여기서는 --dock-h 를 안 쓴다. */}
      <nav
        className="fixed z-30 hidden flex-col items-end md:flex"
        style={{ right: "var(--s-5)", bottom: "var(--s-5)", gap: "var(--s-3)", ...veil }}
        aria-label="채널 바로가기"
      >
        {open && items.map(({ def, url }) => (
          <Bubble key={def.id} def={def} url={url} size={PC_SIZE} onPick={close} />
        ))}
        <Toggle size={PC_SIZE} open={open} count={count} onToggle={toggle} />
      </nav>

      {/* ───────── 폰 — 하단 고정 바 «위»에 접힌 원 하나 ───────── */}
      <nav
        className="fixed right-4 z-30 flex flex-col items-end md:hidden"
        style={{
          /* ⚠ 하단 바 높이 + 안전영역 + 여백. 숫자를 박지 않는다 — 바가 바뀌면 따라가야 한다 */
          bottom: "calc(var(--dock-h) + env(safe-area-inset-bottom) + var(--s-3))",
          gap: "var(--s-2)",
          ...veil,
        }}
        aria-label="채널 바로가기"
      >
        {open && items.map(({ def, url }) => (
          <Bubble key={def.id} def={def} url={url} size={MOBILE_BUBBLE} onPick={close} />
        ))}
        <Toggle size={MOBILE_FAB} open={open} count={count} onToggle={toggle} />
      </nav>
    </>
  );
}
