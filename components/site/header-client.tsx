"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";

/**
 * 본사 상단 바 — 56px · 왼쪽 로고 · 오른쪽 햄버거(48×48).
 * 히어로 위에서는 투명, 스크롤하면 흰 배경 95% + 헤어라인 (MOTION ⑥, 200ms).
 * 햄버거를 누르면 오른쪽에서 전체 화면 시트 (MOTION ④⑤).
 *
 * 세션 조회는 서버에서만 가능하므로 chrome.tsx 의 서버 컴포넌트가 signedIn 을 내려준다.
 */

export type NavItem = { href: string; label: string };

export function SiteHeaderClient({
  nav,
  current,
  signedIn,
}: {
  nav: readonly NavItem[];
  current?: string;
  signedIn: boolean;
}) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  // ⑥ 상단 바 투명 → 불투명. passive 로 붙여 스크롤을 막지 않는다.
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 시트가 열린 동안 뒤 배경이 따라 움직이지 않게 (globals.css 의 .sheet-locked)
  useEffect(() => {
    document.body.classList.toggle("sheet-locked", open);
    return () => document.body.classList.remove("sheet-locked");
  }, [open]);

  // 열린 시트는 Esc 로 닫힌다 — 키보드 사용자에게 탈출구가 있어야 한다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const myHref = signedIn ? "/my" : "/login?next=%2Fmy";
  const myLabel = signedIn ? "마이페이지" : "로그인";

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        height: "var(--bar-h)",
        background: solid ? "color-mix(in srgb, var(--n-0) 95%, transparent)" : "transparent",
        borderBottom: `1px solid ${solid ? "var(--n-200)" : "transparent"}`,
        backdropFilter: solid ? "blur(8px)" : "none",
        transition: "background var(--dur-2) var(--ease), border-color var(--dur-2) var(--ease)",
      }}
    >
      <div className="wrap flex h-full items-center justify-between gap-4">
        <Link href="/" aria-label="온스토리 홈" className="flex items-center" style={{ minHeight: "var(--tap)" }}>
          <Logo height={20} />
        </Link>

        {/* PC — 메뉴를 펼쳐 둔다 */}
        <nav className="hidden items-center md:flex" style={{ gap: "var(--s-6)" }} aria-label="주 메뉴">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="t-small"
              style={{
                color: current === n.href ? "var(--n-900)" : "var(--n-600)",
                fontWeight: current === n.href ? 700 : 500,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center" style={{ gap: "var(--s-3)" }}>
          <Link href={myHref} className="hidden t-small md:flex md:items-center" style={{ color: "var(--n-600)", minHeight: "var(--tap)" }}>
            {myLabel}
          </Link>
          {/* ⚠ 주 버튼은 뷰포트당 1개 — 첫 화면에서 히어로 CTA 와 나란히 보이므로
              상단 바 쪽은 **보조 버튼**이다. 초록을 둘 두면 어디를 눌러야 할지 모른다. */}
          <Link href="/new" className="btn btn-secondary hidden md:inline-flex">무료로 시작</Link>

          {/* 모바일 햄버거 — 보이는 아이콘은 작아도 눌리는 영역은 48×48 */}
          <button
            type="button"
            className="grid place-items-center md:hidden"
            style={{ width: "var(--tap)", height: "var(--tap)", color: "var(--n-900)" }}
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls="site-menu-sheet"
            onClick={() => setOpen(true)}
          >
            <BurgerIcon />
          </button>
        </div>
      </div>

      {open && (
        <MenuSheet
          id="site-menu-sheet"
          nav={nav}
          myHref={myHref}
          myLabel={myLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </header>
  );
}

/** 오른쪽에서 들어오는 전체 화면 시트 (MOTION ④ 320ms spring · ⑤ 24ms 순차) */
function MenuSheet({
  id, nav, myHref, myLabel, onClose,
}: {
  id: string; nav: readonly NavItem[]; myHref: string; myLabel: string; onClose: () => void;
}) {
  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      className="sheet-open fixed inset-0 z-50 flex flex-col md:hidden"
      style={{ background: "var(--n-0)" }}
    >
      <div className="wrap flex items-center justify-between" style={{ height: "var(--bar-h)" }}>
        <Logo height={20} />
        <button
          type="button"
          className="grid place-items-center"
          style={{ width: "var(--tap)", height: "var(--tap)", color: "var(--n-900)" }}
          aria-label="메뉴 닫기"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="wrap flex-1 overflow-y-auto" aria-label="주 메뉴">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClose}
            className="sheet-item t-h3 flex items-center"
            style={{ height: "var(--bar-h)", color: "var(--n-900)", borderBottom: "1px solid var(--n-100)" }}
          >
            {n.label}
          </Link>
        ))}
        <Link
          href={myHref}
          onClick={onClose}
          className="sheet-item t-h3 flex items-center"
          style={{ height: "var(--bar-h)", color: "var(--n-600)" }}
        >
          {myLabel}
        </Link>
      </nav>

      <div
        className="wrap"
        style={{ paddingBottom: "calc(var(--s-5) + env(safe-area-inset-bottom))", paddingTop: "var(--s-4)" }}
      >
        <Link href="/new" onClick={onClose} className="btn btn-primary w-full">무료로 시작 · 60초</Link>
      </div>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M1 1h20M1 8h20M1 15h20" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 3l14 14M17 3L3 17" />
    </svg>
  );
}
