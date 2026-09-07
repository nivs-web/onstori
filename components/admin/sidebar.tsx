"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_GROUPS, ADMIN_DOCS, currentMenu, type AdminMenu } from "@/config/admin-menu";
import { AdminThemeToggle } from "./theme-toggle";

/**
 * 운영자 콘솔 왼쪽 고정 메뉴 + 폰 서랍.
 *
 * 왜 만들었나: `app/admin/` 에 layout.tsx 가 없어 화면마다 제각각이었고,
 * 8개 화면 중 **4곳은 뒤로가기 링크조차 없는 막다른 길**이었다(2026-09-07 실측).
 * 회원 목록에서 사이트 관리로 가려면 반드시 /admin 을 거쳐야 했다.
 *
 * ⚠ 색·간격·모서리는 v5 토큰만 쓴다. 새 값을 만들지 않는다(규칙 11).
 * ⚠ 사이드바는 position:fixed 다. 조상에 backdrop-filter·transform·filter·contain 을
 *   두면 화면이 아니라 그 상자에 갇힌다 — 첫 페이지 메뉴 시트가 55px 로 잘렸던 그 버그다.
 */

const W = 240; // 회장님 지정

function Item({ m, active }: { m: AdminMenu; active: boolean }) {
  const base: React.CSSProperties = {
    display: "block",
    padding: "8px 12px",
    borderRadius: "var(--r-md)",
    fontSize: 15,
    lineHeight: 1.4,
    borderLeft: "3px solid transparent",
    transition: "background var(--dur-2) var(--ease), color var(--dur-2) var(--ease)",
  };

  if (!m.ready) {
    return (
      <span
        style={{ ...base, color: "var(--text-soft)", cursor: "not-allowed", opacity: 0.65 }}
        title="아직 만들지 않은 화면입니다"
      >
        {m.label} <span style={{ fontSize: 12 }}>· 준비 중</span>
      </span>
    );
  }

  return (
    <Link
      href={m.href}
      aria-current={active ? "page" : undefined}
      style={{
        ...base,
        color: active ? "var(--text-strong)" : "var(--text)",
        fontWeight: active ? "var(--w-semi)" : "var(--w-normal)",
        background: active ? "var(--n-100)" : "transparent",
        borderLeftColor: active ? "var(--green-700)" : "transparent",
      }}
    >
      {m.label}
    </Link>
  );
}

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="운영자 메뉴" onClick={onNavigate} style={{ display: "grid", gap: "var(--s-5)" }}>
      {ADMIN_GROUPS.map((g) => (
        <div key={g.group}>
          <p
            style={{
              fontSize: 13, fontWeight: "var(--w-semi)", color: "var(--text-soft)",
              letterSpacing: "var(--tracking-kicker)", padding: "0 12px", marginBottom: "var(--s-2)",
            }}
          >
            {g.group}
          </p>
          <div style={{ display: "grid", gap: 2 }}>
            {g.items.map((m) => (
              <Item key={m.href} m={m} active={currentMenu(pathname)?.href === m.href} />
            ))}
          </div>
        </div>
      ))}

      {/* 기획실은 화면이 아니라 문서다 — 줄을 그어 갈라 둔다 */}
      <div style={{ borderTop: "1px solid var(--n-200)", paddingTop: "var(--s-4)" }}>
        <p
          style={{
            fontSize: 13, fontWeight: "var(--w-semi)", color: "var(--text-soft)",
            letterSpacing: "var(--tracking-kicker)", padding: "0 12px", marginBottom: "var(--s-2)",
          }}
        >
          기획실 (문서)
        </p>
        <div style={{ display: "grid", gap: 2 }}>
          {ADMIN_DOCS.map((m) => (
            <Item key={m.href} m={m} active={currentMenu(pathname)?.href === m.href} />
          ))}
        </div>
      </div>
    </nav>
  );
}

export function AdminSidebar() {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);
  const here = currentMenu(pathname);

  // Esc 로 서랍 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ⚠ 화면을 옮길 때 닫는 일은 **effect 로 하지 않는다.**
     `useEffect(() => setOpen(false), [pathname])` 는 렌더 중 setState 로 잡혀
     연쇄 렌더 경고가 난다. 서랍 안 메뉴를 누르는 순간 onNavigate 가 이미 닫는다. */

  return (
    <>
      {/* ── PC 고정 메뉴 ── */}
      <aside
        className="admin-side"
        style={{
          position: "fixed", insetBlock: 0, left: 0, width: W, zIndex: 30,
          background: "var(--n-50)", borderRight: "1px solid var(--n-200)",
          padding: "var(--s-5) var(--s-3)", overflowY: "auto",
        }}
      >
        {/* 다크모드 토글 — **메뉴바 맨 위** (2026-09-07 회장님: 대시보드가 아니라 여기로).
            사이드바에 두면 어드민 어느 화면에서나 같은 자리에 있다. */}
        <div style={{ padding: "0 12px", marginBottom: "var(--s-4)" }}>
          <AdminThemeToggle />
        </div>
        <Link
          href="/admin"
          style={{ display: "block", padding: "0 12px", marginBottom: "var(--s-6)", fontWeight: "var(--w-bold)", color: "var(--text-strong)" }}
        >
          <span style={{ fontSize: 12, letterSpacing: "var(--tracking-kicker)", color: "var(--green-700)", display: "block" }}>ONSTORI</span>
          운영자 콘솔
        </Link>
        <Nav pathname={pathname} />
      </aside>

      {/* ── 폰 상단 바 ── */}
      <div
        className="admin-topbar"
        style={{
          position: "sticky", top: 0, zIndex: 25, height: 56,
          display: "flex", alignItems: "center", gap: "var(--s-3)",
          padding: "0 var(--s-4)",
          background: "var(--n-0)", borderBottom: "1px solid var(--n-200)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          style={{
            width: 44, height: 44, marginLeft: -8, display: "grid", placeItems: "center",
            borderRadius: "var(--r-md)", color: "var(--text-strong)",
          }}
        >
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
        </button>
        {/* 현재 위치 — 서랍을 안 열어도 여기가 어디인지 보여야 한다 */}
        <span style={{ fontWeight: "var(--w-semi)", color: "var(--text-strong)" }}>
          {here?.label ?? "운영자 콘솔"}
        </span>
      </div>

      {/* ── 폰 서랍 ──
          ⚠ DOM 을 <header> 안에 넣지 않는다. backdrop-filter 가 걸린 조상이 생기면
            position:fixed 가 그 상자에 갇힌다(scripts/verify.mjs 의 "fixed 갇힘" 검사). */}
      {open && (
        <div className="admin-drawer" style={{ position: "fixed", inset: 0, zIndex: 40 }}>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            style={{ position: "absolute", inset: 0, background: "var(--scrim)", border: 0, width: "100%" }}
          />
          <div
            style={{
              position: "absolute", insetBlock: 0, left: 0, width: W,
              background: "var(--n-50)", borderRight: "1px solid var(--n-200)",
              padding: "var(--s-5) var(--s-3)", overflowY: "auto",
              animation: "admin-drawer-in 180ms var(--ease) both",
            }}
          >
            <p style={{ padding: "0 12px", marginBottom: "var(--s-6)", fontWeight: "var(--w-bold)", color: "var(--text-strong)" }}>
              <span style={{ fontSize: 12, letterSpacing: "var(--tracking-kicker)", color: "var(--green-700)", display: "block" }}>ONSTORI</span>
              운영자 콘솔
            </p>
            <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
