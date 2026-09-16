"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/site/logo";
import { ADMIN_GROUPS, ADMIN_DOCS, currentMenu, type AdminMenu } from "@/config/admin-menu";
import { AdminThemeToggle } from "./theme-toggle";

/**
 * 운영자 콘솔 왼쪽 고정 메뉴 + 폰 서랍.
 *
 * 왜 만들었나: `app/admin/` 에 layout.tsx 가 없어 화면마다 제각각이었고,
 * 8개 화면 중 **4곳은 뒤로가기 링크조차 없는 막다른 길**이었다(2026-09-07 실측).
 * 회원 목록에서 사이트 관리로 가려면 반드시 /admin 을 거쳐야 했다.
 *
 * 2026-09-16 「빽빽하게」로 다시 짰다 — 메뉴가 21개로 늘어 스크롤을 오르내려야 했다.
 * 줄인 값은 ROW_PC · GROUP_TITLE · nav 의 gap 세 군데에 모여 있다. 아래 Nav 앞 주석에
 * «한 화면에 몇 개까지 들어가는지» 계산을 적어 뒀다.
 *
 * ⚠ 색·간격·모서리는 v5 토큰만 쓴다. 새 값을 만들지 않는다(규칙 11).
 * ⚠ 사이드바는 position:fixed 다. 조상에 backdrop-filter·transform·filter·contain 을
 *   두면 화면이 아니라 그 상자에 갇힌다 — 첫 페이지 메뉴 시트가 55px 로 잘렸던 그 버그다.
 */

const W = 240; // 회장님 지정

/* ── 메뉴 한 줄의 크기 ── 2026-09-16 대표님 지시:
     「버튼 사이 간격이 너무 넓다. 메뉴를 계속 추가할 거니까 위아래를 1/3 로 줄이고
       글씨도 한 단계 작게. 스크롤 내렸다 올렸다 하지 말고 한 방에 다 보이게.」

   🔴 여기 두 숫자만 px 로 못박는다. 이것은 «디자인 스케일»이 아니라
      «손가락·마우스가 빗나가지 않는 최소 크기»다. var(--s-*) 로 적으면 나중에 누가
      간격 토큰을 손볼 때 «누르는 크기»가 같이 줄어든다 — 그러면 안 되는 값이다.

   ★ PC 28px — 마우스 포인터 기준 하한. 가로 폭은 216px(240 − 좌우 여백)이라 옆으로는
     넉넉하고 세로만 28px 이다. 이 아래로 내리면 한 칸 옆 메뉴를 누르게 된다.
   ★ 폰 서랍 40px — 손가락은 포인터보다 굵다. 게다가 서랍은 «세로로 스크롤되는» 화면이라
     「한 화면에 다」가 애초에 목표가 아니다. 그래서 서랍만 예전 크기를 지킨다.
   (padding 은 minHeight 에서 글자 상자 높이를 뺀 나머지를 반씩 나눈 값이다)

   ⚠ 둘 다 디자인 시스템의 --tap(48px)보다 작다 — **알고 어긴 것이다.** 2026-09-16 대표님이
     「어차피 나 혼자 보는 메뉴다」라고 하신 운영자 전용 화면이라서다. 손님 화면·사장님
     편집화면에는 이 값을 «가져다 쓰지 않는다». 거기서는 --tap(48px)이 그대로 기준이다.
     (서랍은 이번에 37px → 40px 로 오히려 «커졌다». scripts/verify.mjs 의 48px 검사는
      폰에서만 돌고 서랍은 닫혀 있어 거기 걸리지도 않는다 — 전에도 37px 이었다) */
const ROW_PC = { minHeight: 28, padding: "5px 12px" } as const;
const ROW_PHONE = { minHeight: 40, padding: "11px 12px" } as const;
type Row = typeof ROW_PC | typeof ROW_PHONE;

function Item({ m, active, row }: { m: AdminMenu; active: boolean; row: Row }) {
  const base: React.CSSProperties = {
    display: "block",
    minHeight: row.minHeight,
    padding: row.padding,
    borderRadius: "var(--r-md)",
    // 15px → 13px. 한 단계 아래 토큰이다(새 값을 만들지 않았다)
    fontSize: "var(--t-caption)",
    // 1.4 → 1.3. 행간이 곧 줄 높이라 여기가 제일 크게 먹힌다
    lineHeight: 1.3,
    borderLeft: "3px solid transparent",
    transition: "background var(--dur-2) var(--ease), color var(--dur-2) var(--ease)",
  };

  if (!m.ready) {
    return (
      <span
        style={{ ...base, color: "var(--text-soft)", cursor: "not-allowed", opacity: 0.65 }}
        title="아직 만들지 않은 화면입니다"
      >
        {/* 본문이 13px 로 내려왔으니 곁다리도 한 단계 내려 «덧붙인 말»로 보이게 둔다 */}
        {m.label} <span style={{ fontSize: "var(--t-micro)" }}>· 준비 중</span>
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

/* 그룹 제목(「현황」「회원」…) — 항목과 «같은 비율로» 줄였다.
   ⚠ globals.css 의 --t-micro 는 「운영자 화면의 곁다리 표시에만」 쓰라고 못박힌 크기다.
     여기가 딱 그 경우다 — 손님 화면이 아니고, 누르는 글자도 아니고, 묶음 이름표다.
   ★ lineHeight 를 손으로 적은 이유: body 가 1.68 이라 그냥 두면 제목 한 줄이 22px 를
     먹는다. 1.2 로 내려 13px 로 만든다 — 줄인 간격이 여기서 도로 새어 나가지 않게. */
const GROUP_TITLE: React.CSSProperties = {
  fontSize: "var(--t-micro)",            // 13px → 11px
  fontWeight: "var(--w-semi)",
  color: "var(--text-soft)",
  letterSpacing: "var(--tracking-kicker)",
  lineHeight: 1.2,
  padding: "0 12px",
  marginBottom: "var(--s-1)",            // 6px → 4px
};

function Nav({ pathname, onNavigate, row }: { pathname: string; onNavigate?: () => void; row: Row }) {
  const here = currentMenu(pathname)?.href;
  return (
    // 묶음 사이 24px → 8px. 「1/3 로 줄여라」가 제일 크게 먹히는 자리가 여기다
    <nav aria-label="운영자 메뉴" onClick={onNavigate} style={{ display: "grid", gap: "var(--s-3)" }}>
      {ADMIN_GROUPS.map((g) => (
        <div key={g.group}>
          <p style={GROUP_TITLE}>{g.group}</p>
          <div style={{ display: "grid", gap: 2 }}>
            {g.items.map((m) => (
              <Item key={m.href} m={m} active={here === m.href} row={row} />
            ))}
          </div>
        </div>
      ))}

      {/* 기획실은 화면이 아니라 문서다 — 줄을 그어 갈라 둔다 (윗여백 16px → 8px) */}
      <div style={{ borderTop: "1px solid var(--n-200)", paddingTop: "var(--s-3)" }}>
        <p style={GROUP_TITLE}>기획실 (문서)</p>
        <div style={{ display: "grid", gap: 2 }}>
          {ADMIN_DOCS.map((m) => (
            <Item key={m.href} m={m} active={here === m.href} row={row} />
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
          // 위아래 여백 24px → 8px. 머리(토글·로고)가 메뉴를 아래로 밀어내던 만큼을 돌려받는다
          padding: "var(--s-3)", overflowY: "auto",
        }}
      >
        {/* 다크모드 토글 — **메뉴바 맨 위** (2026-09-07 회장님: 대시보드가 아니라 여기로).
            사이드바에 두면 어드민 어느 화면에서나 같은 자리에 있다.
            ★ 자리는 그대로다. 아래 여백만 16px → 8px 로 줄이고, 버튼에 `btn-xs` 를 더했다.
              기본 .btn 은 PC 에서 52px 인데, 28px 짜리 메뉴 위에 혼자 52px 로 앉아 있으면
              머리만 두꺼워 보이고 메뉴 두 줄을 잡아먹는다. btn-xs 는 32px — **이미 있는
              클래스**다(운영자 메모장이 쓴다). 새 크기를 만든 게 아니다. */}
        <div style={{ padding: "0 12px", marginBottom: "var(--s-3)" }}>
          <AdminThemeToggle className="btn btn-secondary btn-xs t-caption" />
        </div>
        {/* 로고 — 2026-09-09 대표님 지시로 글자에서 **그림 로고**로 바꿨다.
            어두운 화면에서는 **순백**이다(크림은 어두운 회녹색 위에서 누렇게 뜬다).
            ⚠ 두 장을 겹쳐 두고 CSS 로 하나만 보인다 — 자바스크립트로 갈아 끼우면
              화면이 처음 뜰 때 잘못된 색이 한 번 스쳐 간다. */}
        <Link
          href="/admin"
          aria-label="운영자 콘솔 첫 화면"
          // 로고 아래 여백 32px → 16px (메뉴를 한 화면에 넣으려고 머리부터 줄였다)
          style={{ display: "block", padding: "0 12px", marginBottom: "var(--s-4)", fontWeight: "var(--w-bold)", color: "var(--text-strong)" }}
        >
          {/* ★ 밝은/어두운 전환은 Logo 가 스스로 한다 */}
          <Logo height={22} priority={false} />
          <span style={{ fontSize: "var(--t-micro)", lineHeight: 1.2, color: "var(--text-soft)", display: "block", marginTop: "var(--s-1)" }}>운영자 콘솔</span>
        </Link>

        {/* ★★ 한 화면에 다 들어가나 — 2026-09-16 실측 계산 (PC, 브라우저 세로 ≈ 940px 기준)
              한 줄 28 + 줄 사이 2 = 메뉴 1개당 30px
              그룹 제목 11×1.2 ≈ 14 + 아래 4 = 18px · 그룹 사이 8px · 기획실 구분선 9px

              지금(메뉴 21개 · 그룹 6묶음)
                메뉴   21 × 28 = 588      줄 사이 15 × 2 =  30
                제목    6 × 18 = 108      그룹 사이 5 × 8 =  40      구분선 = 9
                → 메뉴 전체 775px
                머리 = 토글 32 + 8 + 로고 22 + 4 + 「운영자 콘솔」 14 + 16 = 96px
                위아래 여백 8 + 8 = 16px
                → 합 **887px**  (전에는 같은 계산이 1308px 이었다 — 스크롤이 날 수밖에)

              ⚠ 남은 여유는 약 50px — **메뉴 1~2개 더**까지가 한계다.
                그 다음에도 한 화면을 지키려면 손댈 곳은 셋 중 하나다:
                ① 다크모드 토글을 로고와 «같은 줄»로 옮긴다(약 40px)
                ② `ready:false` 인 준비 중 메뉴 5개를 목록에서 뺀다(약 150px)
                ③ 그룹을 합친다(제목 한 줄이 18 + 그룹 사이 8 = 26px)
              🔴 ROW_PC 의 28px 을 깎아서 버는 길은 «쓰지 않는다» — 누르기가 무너진다. */}
        <Nav pathname={pathname} row={ROW_PC} />
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
          <span aria-hidden style={{ fontSize: "var(--t-h3)", lineHeight: 1 }}>☰</span>
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
            <p style={{ padding: "0 12px", marginBottom: "var(--s-4)", fontWeight: "var(--w-bold)", color: "var(--text-strong)" }}>
              <span style={{ fontSize: "var(--t-caption)", letterSpacing: "var(--tracking-kicker)", color: "var(--green-700)", display: "block" }}>ONSTORI</span>
              운영자 콘솔
            </p>
            {/* ★ 서랍은 ROW_PHONE — 글자·그룹 간격은 PC 와 같이 줄었지만 «누르는 높이»만
                40px 로 남긴다. 손가락은 마우스 포인터보다 굵고, 서랍은 어차피 스크롤된다. */}
            <Nav pathname={pathname} onNavigate={() => setOpen(false)} row={ROW_PHONE} />
          </div>
        </div>
      )}
    </>
  );
}
