"use client";

import { useEffect, useState } from "react";
import type { SiteDocT } from "@/lib/schema";
import { contactOf, SECTION_ANCHORS } from "./index";
import { ICON, ARIA } from "./connect-widget";

/**
 * 손님 사이트 크롬 — 상단 바 + 햄버거 시트 + 하단 고정 바 (docs/specs/mobile-ux.md · docs/DESIGN.md).
 *
 * ⚠ 공개 셸(app/[slug]/page.tsx)과 미리보기 셸(app/[slug]/preview/preview-client.tsx)이
 *   **둘 다** 이 파일을 쓴다. 한쪽에만 넣으면 또 갈라진다 — 이미 로고 오버레이가 그렇게 갈라졌었다.
 *
 * 색은 사장님 팔레트(--s-*)만 쓴다. 흰색·검정을 하드코딩하면 premium 팔레트
 * (bg #12151B)에서 글자가 배경에 묻는다. 히어로 사진 위 구간만 예외로 흰 글자를 쓰는데,
 * 그 자리는 항상 어두운 그라데이션이 깔려 있어 팔레트와 무관하게 대비가 성립한다.
 */

export function SiteChrome({ doc, businessName, logo }: { doc: SiteDocT; businessName: string; logo?: string | null }) {
  const links = SECTION_ANCHORS(doc);
  const { tel, kakaoUrl } = contactOf(doc);
  const hasQuote = doc.sections.some((s) => s.type === "quoteForm");
  /* 투명하게 떠 있어도 되는 건 **첫 섹션이 사진 히어로일 때뿐**이다.
     그 자리엔 어두운 그라데이션이 깔려 흰 글자가 읽힌다.
     띠(banner)가 먼저 오는 사이트에서 투명을 쓰면 흰 배경 위 흰 글자가 되어 상호명이 사라진다. */
  const first = doc.sections[0];
  const canFloat = Boolean(first && first.type === "hero" && "image" in first && first.image);
  return (
    <>
      <TopBar links={links} businessName={businessName} logo={logo} tel={tel} kakaoUrl={kakaoUrl} canFloat={canFloat} quoteHref={hasQuote ? "#quote" : null} />
      <Dock tel={tel} kakaoUrl={kakaoUrl} hasQuote={hasQuote} />
    </>
  );
}

type Link = { href: string; label: string };

function TopBar({
  links, businessName, logo, tel, kakaoUrl, canFloat, quoteHref,
}: { links: Link[]; businessName: string; logo?: string | null; tel: string; kakaoUrl: string; canFloat: boolean; quoteHref: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // ⑥ 히어로 사진 위에서는 투명, 스크롤하면 사장님 배경색 95% + 헤어라인
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sheet-locked", open);
    return () => document.body.classList.remove("sheet-locked");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 사진 히어로 위에 떠 있을 때만 투명 + 흰 글자. 그 외에는 처음부터 불투명이다.
  const solid = !canFloat || scrolled;
  const fg = solid ? "var(--s-ink)" : "var(--n-0)";

  return (
    <>
    <header
      className="fixed inset-x-0 top-0 z-30"
      style={{
        height: "var(--bar-h)",
        background: solid ? "color-mix(in srgb, var(--s-bg) 95%, transparent)" : "transparent",
        borderBottom: `1px solid ${solid ? "var(--s-line)" : "transparent"}`,
        backdropFilter: solid ? "blur(8px)" : "none",
        transition: "background var(--dur-2) var(--ease), border-color var(--dur-2) var(--ease)",
      }}
    >
      {/* PC 에서는 본문(max-w-3xl)보다 넓게 잡는다 — 차례가 여러 개면 768px 안에서 두 줄로
          접히면서 상호명과 겹친다(2026-09-07 1440 캡처에서 실제로 그랬다). */}
      <div className="mx-auto flex h-full max-w-3xl items-center justify-between md:max-w-[var(--container)]" style={{ paddingInline: "var(--gutter)", gap: "var(--s-4)" }}>
        <a href="#top" className="flex min-w-0 items-center" style={{ gap: "var(--s-2)", minHeight: "var(--tap)", color: fg }}>
          {logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", objectFit: "contain" }} />
          )}
          <span className="t-small truncate font-bold" style={{ maxWidth: "16ch" }}>{businessName}</span>
        </a>

        {/* PC — 차례를 가로로 펼친다. 햄버거는 숨는다.
            손님이 마우스를 쓰는 화면에서 메뉴를 한 번 더 눌러 열게 만들 이유가 없다. */}
        <nav className="hidden min-w-0 items-center md:flex" style={{ gap: "var(--s-5)" }} aria-label="이 사이트의 차례">
          {/* 상단에 다 걸지 않는다 — 다섯 개까지만. 나머지는 스크롤하다 만난다.
              열 개를 걸면 줄이 접히고, 접히면 헤더 높이가 무너진다. */}
          {links.slice(0, 5).map((l) => (
            <a key={l.href} href={l.href} className="t-small whitespace-nowrap font-medium" style={{ color: fg }}>{l.label}</a>
          ))}
        </nav>
        <div className="hidden shrink-0 md:flex">
          {/* PC 우측 버튼은 하나뿐이다 — 견적이 있으면 견적, 없으면 전화 */}
          {quoteHref ? (
            <a
              href={quoteHref}
              className="t-small inline-flex items-center justify-center font-semibold"
              style={{ minHeight: "var(--tap)", paddingInline: "var(--btn-px)", borderRadius: "var(--r-md)", background: "var(--s-accent)", color: "var(--s-on-accent)" }}
            >
              견적 문의
            </a>
          ) : tel ? (
            <a
              href={`tel:${tel}`}
              className="t-small inline-flex items-center justify-center font-semibold"
              style={{ gap: "var(--s-2)", minHeight: "var(--tap)", paddingInline: "var(--btn-px)", borderRadius: "var(--r-md)", background: "var(--s-accent)", color: "var(--s-on-accent)" }}
            >
              {ICON.call} 전화
            </a>
          ) : null}
        </div>

        <button
          type="button"
          className="grid place-items-center md:hidden"
          style={{ width: "var(--tap)", height: "var(--tap)", color: fg }}
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls="shop-menu-sheet"
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M1 1h20M1 8h20M1 15h20" />
          </svg>
        </button>
      </div>

    </header>


      {/* ⚠ 시트는 <header> **밖**에 둔다. 헤더에 backdrop-filter 가 걸려 있으면
          그 헤더가 position:fixed 자식의 기준 상자가 돼 버려서, inset-0 이 화면이 아니라
          헤더의 56px 상자에 맞춰진다 — 시트 높이가 55px 로 잘렸다(2026-09-07 실측).
          형제로 빼면 기준이 다시 화면이 된다. */}
      {open && (
        <div
          id="shop-menu-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="메뉴"
          className="sheet-open fixed inset-0 z-40 flex flex-col md:hidden"
          style={{ background: "var(--s-bg)", color: "var(--s-ink)" }}
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between" style={{ height: "var(--bar-h)", paddingInline: "var(--gutter)" }}>
            <span className="t-small font-bold">{businessName}</span>
            <button
              type="button"
              className="grid place-items-center"
              style={{ width: "var(--tap)", height: "var(--tap)", color: "var(--s-ink)" }}
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M3 3l14 14M17 3L3 17" />
              </svg>
            </button>
          </div>

          <nav className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto" style={{ paddingInline: "var(--gutter)" }} aria-label="이 사이트의 차례">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="sheet-item t-h3 flex items-center"
                style={{ height: "var(--bar-h)", color: "var(--s-ink)", borderBottom: "1px solid var(--s-line)" }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* 시트 맨 아래 전화·카톡 — 메뉴를 열었다가 그대로 연락할 수 있어야 한다 */}
          <div
            className="mx-auto flex w-full max-w-3xl"
            style={{ gap: "var(--s-2)", paddingInline: "var(--gutter)", paddingTop: "var(--s-4)", paddingBottom: "calc(var(--s-5) + env(safe-area-inset-bottom))" }}
          >
            {tel && <ContactButton kind="call" href={`tel:${tel}`} label="전화" primary />}
            {kakaoUrl && <ContactButton kind="kakao" href={kakaoUrl} label="카카오톡" />}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 하단 고정 바 64px — [전화][카톡][견적 문의]. 견적만 주 버튼이다.
 * ⚠ 이 바가 있으면 플로팅 버튼을 따로 두지 않는다 — 겹친다 (지시서 2-4).
 */
function Dock({ tel, kakaoUrl, hasQuote }: { tel: string; kakaoUrl: string; hasQuote: boolean }) {
  const any = tel || kakaoUrl || hasQuote;
  if (!any) return null;
  return (
    <>
      {/* ⚠ 여기에 스페이서 <div> 를 두면 안 된다. SiteChrome 은 문서 **맨 앞**에 그려지므로
          그 빈 칸이 히어로를 64px 아래로 밀어 화면을 못 채운다(2026-09-07 실측: 히어로 top 64).
          고정 바가 푸터를 가리지 않게 하는 자리는 <main> 의 padding-bottom 으로 뺐다. */}
      <nav
        aria-label="연결 버튼"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center md:hidden"
        style={{
          gap: "var(--s-2)",
          height: "calc(var(--dock-h) + env(safe-area-inset-bottom))",
          paddingInline: "var(--s-3)",
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "color-mix(in srgb, var(--s-bg) 96%, transparent)",
          borderTop: "1px solid var(--s-line)",
          backdropFilter: "blur(8px)",
        }}
      >
        {tel && <ContactButton kind="call" href={`tel:${tel}`} label="전화" />}
        {kakaoUrl && <ContactButton kind="kakao" href={kakaoUrl} label="카톡" />}
        {hasQuote && (
          <a
            href="#quote"
            className="t-body flex flex-1 items-center justify-center font-semibold"
            style={{
              gap: "var(--s-2)", minHeight: "var(--tap)", borderRadius: "var(--r-md)",
              background: "var(--s-accent)", color: "var(--s-on-accent)",
            }}
          >
            견적 문의
          </a>
        )}
      </nav>
    </>
  );
}

function ContactButton({
  kind, href, label, primary = false,
}: { kind: "call" | "kakao"; href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      aria-label={ARIA[kind]}
      {...(kind === "kakao" ? { target: "_blank", rel: "noreferrer" } : {})}
      className="t-body flex flex-1 items-center justify-center font-semibold"
      style={{
        gap: "var(--s-2)", minHeight: "var(--tap)", borderRadius: "var(--r-md)",
        ...(primary
          ? { background: "var(--s-accent)", color: "var(--s-on-accent)" }
          : { background: "transparent", border: "1px solid var(--s-line)", color: "var(--s-ink)" }),
      }}
    >
      {ICON[kind]}
      {label}
    </a>
  );
}
