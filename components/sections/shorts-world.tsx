"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShortT } from "@/lib/shorts";
import { SNS_LABEL, SNS_DOT, pillLinks } from "./sns-brand";
import { SWIPE_PX, HINT_MS } from "@/config/shorts";

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
   * ⚠ 나가는 길은 그대로 **넷**이다 — **✕(우상) · ESC · 폰 뒤로가기 · 바깥 클릭.**
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

        {/* 🔴 **소리 단추 하나** — 영상 왼쪽 위(유튜브 쇼츠와 같은 자리). 없어서 못 끄던 것을 고쳤다 */}
        {!calm && (
          <button type="button" className="world-sound" aria-label={loud ? "소리 끄기" : "소리 켜기"}
            onClick={() => setLoud((v) => !v)}>
            {loud ? "🔊" : "🔇"}
          </button>
        )}
        <div className="world-meta">
          {cur?.caption && <p className="world-cap">{cur.caption}</p>}
          {pillLinks(cur?.links ?? []).length ? (
            <div className="world-links">
              {pillLinks(cur.links).map((l) => (
                <a key={l.provider} href={l.url} target="_blank" rel="noopener noreferrer" className="world-pill">
                  <span className="world-dot" style={{ background: SNS_DOT[l.provider] }} />
                  {SNS_LABEL[l.provider]}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 🔴 2026-09-17 대표님 지시 [35]② — **나가기를 크게.**
          ⚠ 대표님은 「화면 «가운데»에 ［나가기 ✕］」를 원하셨는데, **권반장이 릴스·쇼츠의 실제 배치를
            조사 중**이라 **위치는 그대로 두고 크기만** 키웠습니다 — 두 번 옮기면 낭비입니다. */}
      <button ref={closeRef} type="button" className="world-x" onClick={close} aria-label="숏폼피드에서 나가기">
        <span aria-hidden>✕</span><span className="world-x-say">나가기</span>
      </button>
      <span className="world-count" aria-hidden>{at + 1} / {items.length}</span>

      {items.length > 1 && (
        <>
          {/* 🔴 **위아래**다(지시 [35]③). 릴스·쇼츠·틱톡 전부 위아래이고, 대표님 말씀도 그렇다.
              ⚠ ← → 키도 «함께» 산다 — 익숙한 사람의 손을 막을 이유는 없다. */}
          <button type="button" className="world-arrow up" aria-label="이전 영상"
            disabled={at === 0} onClick={() => onAt(Math.max(0, at - 1))}>⌃</button>
          <button type="button" className="world-arrow down" aria-label="다음 영상"
            disabled={at === items.length - 1} onClick={() => onAt(Math.min(items.length - 1, at + 1))}>⌄</button>
        </>
      )}

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
    </div>,
    document.body,
  );
}
