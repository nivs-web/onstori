"use client";

import { useEffect, useRef } from "react";

/**
 * 테마 카드 — 손님 사이트를 **미리 찍은 스크린샷**으로 보여준다.
 *
 * ⚠ 전에는 여기에 살아 있는 사이트를 iframe 으로 띄웠다. 스크롤바·오른쪽 흰 여백·느려짐이
 *   전부 거기서 나왔고, 카드 한 장이 손님 사이트 한 채(사진·글꼴·JS)를 통째로 불러왔다.
 *   지금은 20KB 짜리 webp 한 장이다.
 *
 * 움직임은 **CSS 만** 쓴다(globals.css `.tcard`). transform·opacity 뿐이라 GPU 가 처리한다.
 * 여기 JS 가 하는 일은 두 가지뿐이다:
 *   ① 사진이 실제로 얼마나 긴지 재서 "얼마나 밀지"(--tc-shift)를 정한다.
 *      사진마다 길이가 달라 고정값을 쓰면 짧은 사이트는 흰 바닥이, 긴 사이트는 아랫부분이 안 보인다.
 *   ② 손가락 화면에서 카드가 보이면 한 번만 재생시킨다(hover 가 없으니까).
 */

export type ThemeCardProps = {
  href: string;
  name: string;
  tag?: string;
  pc: string;
  phone: string;
};

export function ThemeCard({ href, name, tag, pc, phone }: ThemeCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  // ① 사진 길이에 맞춰 미는 거리를 정한다 (카드 밖으로 넘어가는 만큼만)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      for (const [sel, varName] of [[".tcard-shot", "--tc-shift"], [".tcard-phone > img", "--tc-shift-phone"]] as const) {
        const img = el.querySelector<HTMLImageElement>(sel);
        const box = sel.startsWith(".tcard-phone") ? img?.parentElement : el;
        if (!img || !box) continue;
        const over = img.getBoundingClientRect().height - box.getBoundingClientRect().height;
        el.style.setProperty(varName, `${Math.max(0, Math.round(over))}px`);
      }
    };
    const imgs = [...el.querySelectorAll("img")];
    let left = imgs.filter((i) => !i.complete).length;
    if (!left) measure();
    for (const i of imgs) {
      if (i.complete) continue;
      const done = () => { if (--left <= 0) measure(); };
      i.addEventListener("load", done, { once: true });
      i.addEventListener("error", done, { once: true });
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ② 손가락 화면에서는 hover 가 없다 — 화면에 들어오면 한 번만 재생
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add("tcard-play"); io.disconnect(); } },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noreferrer"
      className="tcard"
      aria-label={`${name} 홈페이지 새 창에서 보기`}
    >
      {/* ⚠ 브라우저 틀(상단 바 + 점 3개)을 **통째로 뺐다** (2026-09-07 회장님, 실제 화면을 보고).
          이유 셋: ①바 높이(36px)만큼 히어로 위쪽이 잘려 제목이 온전히 안 보였다
          ②마우스를 올려 사진이 내려가면 그 자리가 텅 빈 흰 공간으로 남았다
          ③점 3개가 아무 정보도 주지 않았다.
          주소창(.tcard-url)은 앞서 이미 뺐다. 부품 자체(.tcard-bar/.tcard-url)는 지우지 않았다 —
          `/my` 카드가 주소창까지 쓰는 완전한 틀로 계속 쓴다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tcard-shot" src={pc} alt={`${name} 홈페이지 화면`} loading="lazy" decoding="async" />
      <span className="tcard-phone" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={phone} alt="" loading="lazy" decoding="async" />
      </span>
      {tag && <span className="sr-only">{tag}</span>}
    </a>
  );
}
