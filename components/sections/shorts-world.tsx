"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShortT, ShortLink } from "@/lib/shorts";
import { SNS_LABEL, pillLinks } from "./sns-brand";
import { SWIPE_PX, HINT_MS } from "@/config/shorts";
import { IconSoundOn, IconSoundOff, IconChevronUp, IconChevronDown } from "./shorts-icons";

/**
 * 🔴 **공식 로고 파일 — 대표님이 주신 것을 그대로 쓴다.** (2026-09-18 B-19)
 * ⚠ 직접 그리거나 색을 바꾸지 마라(상표 규칙). 흰 단색만 쓴다.
 * ⚠ **일부러 «빠진 채널이 있는» 표다**(`Partial`). 로고 파일이 없는 채널이 들어오면
 *   그 단추는 **안 그린다** — 깨진 그림 자리가 영상 위에 남는 것보다 낫다.
 */
const LOGO_SRC: Partial<Record<ShortLink["provider"], string>> = {
  instagram: "/brand/instagram-white.svg",
  youtube: "/brand/youtube-white.png",
};

/**
 * 🔴🔴 **몰입모드(「숏폼시네마」)만 사는 파일.** (2026-09-17 지시 [42] §1)
 *
 * ⚠⚠ **왜 떼어냈나:** 전에는 `shorts-stage.tsx`(무대) **안에만** 있었다.
 *   그래서 **카드형태(`shorts-feed.tsx`)에는 몰입모드가 없었다.**
 *   [42] 에서 **두 모양이 같은 몰입모드를 공유**하므로 여기로 옮긴다.
 *
 * ★ **이 단계에서는 화면이 한 픽셀도 바뀌지 않는다**(권반장 지시 §1 「화면 변화 0」).
 *   옮기기만 한 것이다 — 그래야 다음 단계에서 뭔가 깨졌을 때
 *   **«떼어내기»가 잘못됐는지 «새로 짠 것»이 잘못됐는지**를 가를 수 있다.
 *
 * ⚠ 부르는 쪽이 아는 것은 **「열림 여부」 하나**다. props 다섯(`items`·`at`·`onAt`·`onClose`·`calm`)
 *   말고는 바깥과 나눠 쓰는 것이 없다 — 그래서 이 파일이 자급자족한다.
 *
 * ⚠ **`"use client"` 가 여기에도 필요하다.** 부르는 쪽이 클라이언트라도 이 파일이
 *   스스로 그것을 선언해야 «어디서 불러도» 안전하다.
 */

/**
 * 🔴🔴 **숏폼피드 세상** — 「통으로 하나의 세상」. (2026-09-17 대표님 지시 [33])
 *
 * ★ **우리 숏폼의 공식 이름은 「숏폼피드」다**(2026-09-17 대표님 확정).
 *   「**숏폼피드가 있는 홈페이지**」를 광고 카피로 쓰신다. **코드·주석·화면 어디서든 이 이름으로 부른다.**
 *
 * ⚠ **`createPortal` 로 `body` 에 직접 붙인다.** 무대 안에 두면 `overflow:hidden` 인 상자에 갇혀
 *   전체화면이 안 된다. 「전체화면」은 **아무 상자에도 안 들어가야** 참이 된다.
 *
 * 🔴 **나가는 길을 셋 둔다 — ESC · [✕] · 바깥 클릭**(지시 2번).
 *   하나뿐이면 갇힌 느낌이 난다. 그리고 **닫으면 원래 보던 자리로** 돌아간다(지시 3번).
 * 🔴 **키보드로만 쓰는 손님**(지시 5번) — 열리면 **[✕] 에 초점이 가고**, `Tab` 으로 단추들을 돈다.
 */
export default function ShortsWorld({ items, at, onAt, onClose, calm }: {
  items: ShortT[]; at: number; onAt: (i: number) => void; onClose: () => void; calm: boolean;
}) {
  const vid = useRef<HTMLVideoElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [help, setHelp] = useState(!calm);
  /**
   * 🔴🔴 **소리 끄는 단추 — 없었습니다.** (2026-09-17 권반장 조사 · [36]①)
   *
   * > 「대표님이 지적하신 「스피커 2개」는 코드상 이미 1개로 고쳐져 있었고,
   * >   **진짜 문제는 전체화면에 소리 «끄는» 단추가 «0개»인데 소리가 켜진 채 열린다**는 점입니다」
   *
   * ⚠ **제가 [33] 에서 만든 것의 실수입니다.** 「클릭했으니 소리를 켜 준다」까지는 맞았는데,
   *   **끄는 길을 안 만들었습니다.** 조용한 사무실에서 연 손님은 **허둥대다 그냥 나갑니다.**
   * ★ 자리는 **영상 왼쪽 위**(유튜브 쇼츠와 같은 자리) — 조사 결과 그대로.
   * 🔴 **화면에 스피커 그림은 언제나 «1개»를 넘지 않는다**(릴스·쇼츠 둘 다 그렇다).
   *   무대의 스피커는 이 검은 화면 «아래»에 깔려 안 보인다.
   */
  const [loud, setLoud] = useState(true);
  const touchY = useRef<number | null>(null);
  const cur = items[at];

  /* 열리면 닫기 단추에 초점을 준다 — 키보드만 쓰는 손님이 곧바로 나갈 수 있어야 한다 */
  useEffect(() => { closeRef.current?.focus(); }, []);

  /**
   * 🔴 **폰 「뒤로가기」로 닫힌다.** (권반장 조사 · [36]②)
   *
   * ⚠ 지금은 뒤로가기를 누르면 **홈페이지를 통째로 떠납니다.**
   *   **한국 안드로이드 손님이 제일 먼저 누르는 단추**입니다.
   * ★ 열릴 때 기록을 하나 밀어 넣고, 뒤로가기가 그 기록을 먹으면 닫습니다.
   * ⚠ ✕·ESC·바깥클릭으로 닫을 때는 **밀어 넣은 기록을 되돌립니다** —
   *   안 그러면 손님의 뒤로가기 한 번이 «아무 일도 안 하는» 데 낭비됩니다.
   */
  const pushed = useRef(false);
  useEffect(() => {
    /* ⚠⚠ **React 는 개발 중에 이 효과를 «두 번» 돌린다**(StrictMode).
         처음에 정리(cleanup)에서 `history.back()` 을 불렀더니 **열자마자 닫혔다**(실측).
         ⇒ 기록은 **딱 한 번만** 밀어 넣고, 되돌리는 것은 **닫는 자리**에서 한다. */
    if (!pushed.current) { window.history.pushState({ onstoriWorld: true }, ""); pushed.current = true; }
    const onPop = () => { pushed.current = false; onClose(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  /**
   * 닫는 «단 하나의» 길. ✕·ESC·바깥클릭·쓸어내리기가 전부 여기로 온다.
   * ⚠ 내가 밀어 넣은 기록을 **내가 치운다** — 안 그러면 손님의 뒤로가기 한 번이 낭비된다.
   */
  const close = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back(); }
    onClose();
  }, [onClose]);

  /* ↑ ↓ (그리고 ← →) 로 넘기고, ESC 로 나간다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); onAt(Math.min(items.length - 1, at + 1)); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onAt(Math.max(0, at - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, items.length, onAt, close]);

  /**
   * 🔴 **마우스 휠로 위아래.** (2026-09-17 대표님 지시 [35]③)
   * ⚠ 휠은 **한 번에 여러 번** 들어온다(관성). 그대로 두면 한 번 굴려 대여섯 편이 지나간다.
   *   그래서 **한 번 넘기면 잠깐 잠근다.**
   */
  useEffect(() => {
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now < lock || Math.abs(e.deltaY) < 8) return;
      lock = now + 420;
      onAt(Math.min(items.length - 1, Math.max(0, at + (e.deltaY > 0 ? 1 : -1))));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [at, items.length, onAt]);

  /* 도움말은 2.8초. 「움직임 줄이기」에서는 아예 안 띄운다 */
  useEffect(() => {
    if (!help) return;
    const t = window.setTimeout(() => setHelp(false), HINT_MS);
    return () => window.clearTimeout(t);
  }, [help]);

  /**
   * ★ **소리를 켠 채로 시작한다.** 손님이 **클릭해서** 들어왔으니 브라우저가 허락한다.
   * ⚠ 그래도 `play()` 는 거절될 수 있다(전원 절약 등). 잡아서 조용히 넘긴다 —
   *   콘솔에 빨간 줄이 남아도 손님 잘못이 아니다.
   */
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    v.muted = !loud;
    void v.play().catch(() => {});
  }, [at, loud]);

  /**
   * 🔴🔴 **위아래로 쓸면 «영상 넘기기»다. 쓸어서 나가지지 않는다.** (2026-09-17 대표님 확정)
   *
   * > 대표님: 「나가는길, X 버튼 우측상단, 좌측 하단, ESC, 폰 뒤로가기,
   * >   **아래로 쓸어내리는건 못나가게해, 위아래 스크롤은 영상 넘기기야**」
   *
   * ⚠⚠ **[36]⑤ 에서 넣었던 「아래로 크게 쓸면 닫힘」을 걷어냈다.**
   *   인스타·틱톡·유튜브에 있는 몸짓이라 넣었는데, **우리 화면에서는 사고가 된다** —
   *   **다음 편을 보려고 손가락을 움직이다 «크게» 쓸면 그대로 나가진다.**
   *   나가는 길이 이미 넷이라 그 몸짓이 벌어 주는 것도 없다.
   * 🔴 **그냥 «막기»만 하면 안 된다.** 아래로 쓸면 **이전 편**으로 가야 한다 —
   *   아무 일도 안 일어나면 손님은 「멈췄나?」 한다.
   *
   * ⚠ 나가는 길은 그대로 **넷**이다 — **[숏폼 나가기](하단 중앙) · ESC · 폰 뒤로가기 · 바깥 클릭.**
   *   (2026-09-18 B-9 로 «우상 ✕» 가 사라지고 그 자리가 소리 단추가 되었다)
   * ⚠ `preventDefault` 를 **하지 않는다.** 막으면 평범한 스크롤이 죽는다.
   */
  const onTouchStart = (e: React.TouchEvent) => { touchY.current = e.touches[0]?.clientY ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touchY.current;
    touchY.current = null;
    if (from === null || calm) return;
    const dy = (e.changedTouches[0]?.clientY ?? from) - from;
    if (dy < -SWIPE_PX) { onAt(Math.min(items.length - 1, at + 1)); return; }   // 위로 → 다음 편
    if (dy > SWIPE_PX) { onAt(Math.max(0, at - 1)); }                           // 아래로 → 이전 편
  };

  return createPortal(
    <div className={`world${calm ? " calm" : ""}`} role="dialog" aria-modal="true" aria-label="숏폼피드"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="world-frame" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <video ref={vid} className="world-video" src={cur?.src} poster={cur?.poster}
          autoPlay loop playsInline controls={calm} />

        {/**
          * 🔴🔴 **소리 단추 하나 — 영상 «오른쪽» 위.** (2026-09-18 대표님 지시 B-9)
          *
          * > 대표님: 「몰입모드 우측 상단의 **X 동그라미를 없애고 그 자리에 «스피커 음소거» 버튼**.
          * >   나가기는 **하단 중앙 하나만**」
          *
          * ⚠⚠ **2026-09-17 의 「좌상 🔊 · 우상 ✕ 완벽 대칭」은 «대표님 지시로» 끝났다.**
          *   ✕ 가 사라졌으니 대칭을 맞출 짝이 없다. 되돌리지 마라 — 그때도 대표님 지시였고
          *   이번에도 대표님 지시다. **나중 것이 이긴다.**
          * ⚠ 자리는 릴스·쇼츠와 같아졌다(둘 다 소리 단추가 오른쪽 위다).
          * 🔴 화면에 스피커 그림은 **언제나 하나**다. 무대의 것은 이 검은 화면 아래에 깔린다.
          */}
        {!calm && (
          <button type="button" className="world-sound" aria-label={loud ? "소리 끄기" : "소리 켜기"}
            onClick={() => setLoud((v) => !v)}>
            {loud ? <IconSoundOn /> : <IconSoundOff />}
          </button>
        )}
        {/**
          * 🔴 **좌하 묶음 — 위에서 아래로: 영상 제목 → [인스타에서 보기] → [쇼츠에서 보기]**
          *   (2026-09-17 지시 [42] §2 · 대표님 원문)
          *
          * > 대표님: 「좌측 아래는 [인스타에서 보기] [유튜브에서 보기] …
          * >   **그 위에 지금처럼 영상 제목이 나온다**」
          *
          * ⚠ **「지금처럼」이라 하셨다 — 제목의 «생김새»를 바꾸지 않는다.** 자리만 이 묶음이다.
          * ⚠ **연결된 채널만, 그리고 둘뿐이다** — `pillLinks()` 가 이미 인스타·유튜브만 남긴다
          *   ([31]④ 대표님: 「버튼이 6개 이상 뜨면 너무 너저분」). 여기서 또 거르지 않는다.
          * 🔴 **♡·💬 는 아직 «자리만»이다.** 숫자를 가져오는 일은 §6 이고, 그 전에는
          *   **0 이라 아예 안 그린다** — 「♡ 0」은 「아무도 안 좋아했다」로 읽힌다(권반장 지시).
          */}
        <div className="world-meta">
          {/* 🔴 좌하에는 **제목만** 남는다. [인스타에서 보기] 알약은 2026-09-18 [49]③ 으로
               «우측 세로줄의 로고 단추»가 되었다(아래 `.world-side`). */}
          {cur?.caption && <p className="world-cap">{cur.caption}</p>}
        </div>

        {/**
          * 🔴🔴 **우측 세로줄 — «로고 단추»뿐이다. 숫자는 없다.** (2026-09-18 [49]③ · B-12 · B-19)
          *
          * > 대표님(B-19): 「로고는 `fable51plandept\etc\insta logo` · `youtube logo` 에 넣어 뒀다.
          * >   **SVG · 흰색 · 컬러 없는 심플한 것만.** 숫자 0이면 **로고만** 표시」
          * > 대표님(B-12): 「**좋아요·댓글 수는 지금 안 한다(확정).**」
          *
          * ⚠⚠ **전에는 「인스타에서 보기」 «글자 알약»이 좌하에 있었다.** 알약 하나가 120px 이라
          *   폰에서 **영상을 가렸다** — 대표님이 「디자인이 별로」라 하신 것의 한 자락이다.
          * ⇒ 글자를 **공식 로고 그림**으로 바꾸고 **오른쪽 세로줄**로 옮겼다(릴스·쇼츠와 같은 자리).
          *
          * 🔴 **로고는 «공식 파일»이다. 직접 그리지 않았다**(상표) —
          *   `public/brand/instagram-white.svg`(Meta 공식 White Glyph) ·
          *   `public/brand/youtube-white.png`(Google 공식 White icon · 96px 로 줄인 것).
          *   ⚠ 유튜브는 **공식 SVG 가 없다**(.ai/.eps/.png 뿐) — 그래서 PNG 다. 늘리지 마라.
          * ⚠ **연결된 채널만 그린다**(`pillLinks`) ⇒ 0~2개다. 없으면 줄 자체를 안 만든다.
          * ⚠ 글자를 못 읽는 손님을 위해 `aria-label` 에 이름을 남긴다(눈에는 안 보인다).
          */}
        {pillLinks(cur?.links ?? []).length ? (
          <div className="world-side">
            {pillLinks(cur.links).map((l) => {
              const src = LOGO_SRC[l.provider];
              if (!src) return null;   /* 로고 파일이 없는 채널은 그리지 않는다(위 주석) */
              return (
                <a key={l.provider} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="world-logo" aria-label={SNS_LABEL[l.provider]} title={SNS_LABEL[l.provider]}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 크기 로고 두 장뿐이라 next/image 의 최적화가 값을 못 한다 */}
                  <img src={src} alt="" width={22} height={22} />
                </a>
              );
            })}
          </div>
        ) : null}

        {/**
          * 🔴🔴 **아래 것들은 «화면 구석»이 아니라 «영상 프레임» 안에 붙는다.** (2026-09-17 [42] §2)
          *
          * ⚠⚠ **실측으로 잡았다.** 처음엔 ✕·1/N·막대·나가기를 프레임 «밖»(화면 기준)에 뒀다.
          *   폰에서는 프레임이 화면과 같은 폭이라 **멀쩡해 보였는데**, PC(1280×800)에서 재 보니 —
          *   ```
          *   프레임 폭 450  ·  🔊 는 영상 왼쪽 431  ·  ✕ 는 화면 오른쪽 1264
          *   ⇒ 둘이 «415px» 떨어져 있었다. 대칭이 아니라 남남이었다
          *   ```
          *   대표님이 **두 번** 강조하신 「스피커와 완벽 대칭」이 **PC 에서만 깨져** 있었다.
          * ⇒ 전부 프레임 안으로. 폰에서는 프레임=화면이라 **보이는 것이 그대로**다.
          * ⚠ 바깥(검은 띠)을 클릭하면 닫히는 길은 그대로다 — 그건 `.world` 가 받는다.
          */}

        {/**
          * 🔴🔴 **여기 있던 «우상 ✕» 는 2026-09-18 대표님 지시(B-9)로 없앴다.**
          *
          * > 「몰입모드 우측 상단의 **X 동그라미를 없애고 그 자리에 «스피커 음소거» 버튼**.
          * >   나가기는 **하단 중앙 하나만**이고 **X 모양은 쓰지 마라**」
          *
          * ⚠ **다시 만들지 마라.** 나가는 길은 여전히 **넷**이다 —
          *   하단 중앙 [숏폼 나가기] · ESC · 폰 뒤로가기 · 바깥(검은 띠) 클릭.
          * ⚠ 옛 코드는 git 에 남아 있다(`.world-x`).
          */}

        {/**
          * 상단 정중앙 「1 / N」. (지시 [42] §2)
          * ⚠⚠ **N 은 «손님이 실제로 닿을 수 있는 수»다** — 우리가 가져온 편수(`items.length`).
          *   지시서에 「가져온 수가 아니라 있는 수」라고 적혀 있었으나 **그대로 하지 않았다:**
          *   DB 에 300편이 있어도 한 번에 싣는 것은 `SHORTS_MAX`(200)까지다. 「1 / 300」이라고 쓰면
          *   **손님이 끝까지 내려도 200에서 멈춘다** — 화면이 거짓말을 한다(불변 규칙 12).
          *   🔴 진짜로 300을 보여 주려면 **300편을 실을 수 있게 만드는 것이 먼저**다.
          *   권반장님께 이 판단을 보고했다.
          */}
        <span className="world-count" aria-hidden>{at + 1} / {items.length}</span>

        {/**
          * 🔴🔴 **우측 정중앙 — 「점 3 + 긴 막대 1 + 점 3」.** (2026-09-17 지시 [42] §2)
          *
          * ⚠⚠ **⌃⌄ 두 단추를 지운 «그 자리»다.** 대표님 설계에서 그 자리가 이것이라
          *   자리다툼이 없다(클코 조사 ④).
          *
          * ★★ **왜 «일곱 칸 고정»인가 — 2000편에서도 안 깨지게.**
          *   무대의 `.stage-dots` 는 **편수만큼** 점을 그린다. 그 방식으로 2000편을 그리면
          *   점이 2000개가 되어 **화면 밖으로 흘러넘치고 그리는 비용도 든다.**
          *   ⇒ 여기서는 **지금 편을 가운데 두고 앞뒤 세 칸씩만** 그린다.
          *     막대는 **언제나 한가운데**에 있고, 끝에 가까워지면 **바깥 점이 비어 간다** —
          *     그래서 「어디쯤인지」가 편수와 상관없이 읽힌다.
          *
          * ⚠ **누르는 단추가 아니다**(`aria-hidden`). ⌃⌄ 를 없앤 자리에 또 단추를 두면
          *   없앤 뜻이 사라진다. 넘기는 길은 **↑↓ · 휠 · 쓸기** 셋이다.
          */}
        {items.length > 1 && (
          <div className="world-rail" aria-hidden>
            {[-3, -2, -1, 0, 1, 2, 3].map((off) => {
              const i = at + off;
              const there = i >= 0 && i < items.length;
              return <span key={off} className={`${off === 0 ? "on" : ""}${there ? "" : " gone"}`} />;
            })}
          </div>
        )}


      {/**
          * 🔴🔴 **나가기는 «하단 중앙 하나»다. ✕ 모양을 쓰지 않는다.** (2026-09-18 대표님 B-8·B-9·B-10)
          *
          * > 「나가기는 **하단 중앙 하나만** (X 모양 쓰지 말 것)」
          * > 「**화면 최하단에서 10px 위 고정** — 폰·PC·몰입모드 어디서나 같은 자리.
          * >   지금 폰에서 **공중에 떠 있어** 보기 안 좋다」
          * > 「「숏폼에서 나가기」·「건너뛰기」 전부 → **「숏폼 나가기」** 하나로」
          *
          * ⚠ **2026-09-17 의 「우하 ✕ + 작은 글씨」는 대표님 지시로 끝났다.** 되돌리지 마라.
          * ⚠ 글자가 그림을 대신하므로 **알약 배경을 준다** — 영상 위 흰 글자만으로는
          *   밝은 영상에서 읽히지 않는다(무대의 `.stage-skip` 과 같은 결이다).
          * 🔴 **초점은 이 단추가 받는다**(64행) — 키보드만 쓰는 손님이 열자마자 나갈 수 있어야 한다.
          */}
        <button ref={closeRef} type="button" className="world-exit" onClick={close}>
          숏폼 나가기
        </button>

        {/**
          * 🔴 **대표님 확정 문구다 — 마음대로 바꾸지 마라.** (2026-09-17 밤 · 권반장 전달)
          *
          * > 대표님: 「"↑ ↓ 또는 마우스 휠로 넘길 수 잇어요" 으로 **확정**하고 **esc 쓰지마**,
          * >   어차피 X 버튼 우측상단, X 몰입모드나가기 버튼 좌측 하단에 넣을거잖아?」
          *
          * ⚠ **나가는 법을 이 문장에 쓰지 않는다** — ✕ 단추가 눈에 두 개나 보이기 때문이다.
          * ⚠⚠ **「아래로 쓸어내리면 나가요」를 «절대» 넣지 마라.** 대표님이 그 동작 자체를
          *   **없애라고** 하셨다 — 「위아래 스크롤은 **영상 넘기기**」다. 다음 편을 보려고
          *   쓸어내리다 **실수로 나가지는** 것이 이유다. (동작을 걷어내는 일은 [42] 에서 한다)
          * ⚠ 2026-09-17 에 내가 「폰에는 휠이 없으니 손가락 말로 바꾸자」고 기기별로 갈랐다가
          *   **대표님 확정과 어긋나** 되돌렸다. 이 화면은 [42] 「숏폼시네마」에서 통째로 다시 짠다.
          */}
        {help && <p className="world-help">↑ ↓ 또는 마우스 휠로 넘길 수 있어요</p>}
      </div>

      {/**
        * 🔴🔴 **⌃⌄ 는 «영상 바깥»에 둔다 — 프레임 «밖»이라 여기 있다.** (2026-09-17 지시 [49]②)
        *
        * ## 무엇이 문제였나 — 5px 겹침
        *
        * `.world-rail`(점 표시기)과 `.world-arrow` 가 **둘 다 `right:24px` · `top:50%`** 였다.
        * 막대는 폭이 5px 라 **단추 안에 통째로 들어가** 있었다. 그것이 그 「5px 겹침」이다.
        *
        * ## 어떻게 풀었나 — «없애지» 않고 «자리»로 가른다
        *
        * 🔴 **점 표시기를 없애지 않았다.** 대표님이 기획서에 **두 번** 명시하셨다(권반장 재확인).
        * ⇒ 대표님 캡처④(인스타 PC)대로 **⌃⌄ 는 화면 가장자리 · 점 표시기는 영상 안**으로 나눴다.
        *
        * ## ⚠ 그래서 이 단추가 «프레임 밖»에 있다 — 옮기지 마라
        *
        * `.world-frame` 에는 **`overflow: hidden`** 이 걸려 있다.
        * 🔴 **프레임 «안»에 두고 바깥으로 밀면 «잘려서 안 보인다».** 그래서 `.world` 의 직계 자식이다.
        * ⚠ `position:absolute` 라 **grid 흐름에서 빠진다** — `.world` 의 가운데 정렬(`place-items:center`)이
        *   이 단추 때문에 흔들리지 않는다.
        * ⚠ 바깥을 눌러 닫는 길(`e.target === e.currentTarget`)도 **안 막힌다** — 단추를 누르면
        *   `target` 이 단추라 닫기가 안 걸린다.
        *
        * ## ⚠ 폰에서는 «안 보인다». 대표님이 살리라 하신 것을 왜 숨기나
        *
        * **다음 창이 반드시 물을 것이라 여기 적어 둔다**(권반장 지시):
        * ① **인스타도 폰에는 ⌃⌄ 가 없다** — 손가락으로 쓸면 되기 때문이다(우리도 쓸기가 된다)
        * ② 폰은 **영상이 화면을 꽉 채운다.** 「영상 바깥」이라는 자리 자체가 없다
        * ③ 억지로 안에 넣으면 **점 표시기와 다시 겹친다** — 방금 푼 문제로 되돌아간다
        * 🔴 **PC 에서는 그대로 보인다.** 대표님 지시(「다시 살리는 게 좋겠다」)는 지켜진다.
        */}
      {items.length > 1 && (
        <>
          <button type="button" className="world-arrow up" aria-label="이전 영상"
            disabled={at === 0} onClick={() => onAt(Math.max(0, at - 1))}><IconChevronUp /></button>
          <button type="button" className="world-arrow down" aria-label="다음 영상"
            disabled={at === items.length - 1} onClick={() => onAt(Math.min(items.length - 1, at + 1))}><IconChevronDown /></button>
        </>
      )}
    </div>,
    document.body,
  );
}

/* 🔴 **여기 있던 `Reactions`(♡·💬 숫자)는 2026-09-18 대표님 B-12 로 «폐기»했다.**
   > 「좋아요·댓글 수는 **지금은 안 한다(확정)**. 속도 위험 + 숫자 불일치 우려.
   >   **아이디어뱅크에 기획서로** 넣어 둔다. 유튜브 연결 뒤 꺼내서 속도 시험」
   ⚠ 되살릴 때는 git 에서 꺼내라(2026-09-18 이전 판). 지금 «자리»는 `.world-side` 가 쓴다. */
