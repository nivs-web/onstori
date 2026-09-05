import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { Logo } from "./logo";

/**
 * 본사 페이지 공용 크롬 — 헤더·프로모 띠·푸터 (기획1 /mainplan #menu · 2026-09-05).
 * 레멘토 구조: 상단 띠 → 로고 · 메뉴 5 · 로그인 · [무료로 시작](라임) / 푸터 3열 + 채널.
 * 첫 페이지·작동방식·사업이야기·FAQ·리뷰·블로그·비교 페이지가 전부 이 파일을 쓴다.
 */

export const NAV = [
  { href: "/how-it-works", label: "작동방식" },
  { href: "/our-story", label: "사업이야기" },
  { href: "/faq", label: "자주묻는질문" },
  { href: "/reviews", label: "리뷰" },
  { href: "/blog", label: "블로그" },
] as const;

export const CHANNELS = [
  { id: "youtube", name: "유튜브 쇼츠", short: "Shorts" },
  { id: "instagram", name: "인스타 릴스", short: "Reels" },
  { id: "threads", name: "쓰레드", short: "Threads" },
  { id: "x", name: "X", short: "X" },
  { id: "naver", name: "네이버 블로그", short: "Naver" },
  { id: "onstori", name: "온스토리 홈페이지", short: "onstori" },
] as const;

export { Logo };

export function PromoBar() {
  return (
    <Link href="/new" className="block text-center text-[13px] font-semibold" style={{ background: "var(--forest)", color: "#fff" }}>
      <span className="inline-block px-4 py-2">오픈 기념 — 14일 동안 전 기능 무료 · 이후 정회원 49,000원 · 사장님 이야기부터 들려주세요 →</span>
    </Link>
  );
}

/** 헤더 — 서버 컴포넌트. 로그인 상태에 따라 로그인/마이페이지가 바뀐다. */
export async function SiteHeader({ current }: { current?: string }) {
  const user = await getSessionUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.92)" }}>
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="온스토리 홈">
          <Logo height={24} />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] font-medium md:flex" aria-label="주 메뉴">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:underline underline-offset-4"
              style={{ color: current === n.href ? "var(--forest)" : "var(--muted)", fontWeight: current === n.href ? 700 : 500 }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/my" className="text-[13.5px] font-semibold" style={{ color: "var(--forest)" }}>마이페이지</Link>
          ) : (
            <Link href="/login?next=%2Fmy" className="hidden text-[13.5px] font-medium sm:inline" style={{ color: "var(--muted)" }}>로그인</Link>
          )}
          <Link href="/new" className="btn-lime !px-4 !py-2.5 !text-[13.5px] sm:!px-5 sm:!text-[14px]">무료로 시작</Link>
          {/* 모바일 메뉴 — JS 없이 details 로 */}
          <details className="relative md:hidden">
            <summary className="list-none cursor-pointer rounded-full border px-3 py-2 text-[13px]" style={{ borderColor: "var(--line)" }} aria-label="메뉴 열기">☰</summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: "var(--line)" }}>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-xl px-4 py-2.5 text-[14px] font-medium hover:bg-neutral-50">{n.label}</Link>
              ))}
              <Link href="/compare" className="block rounded-xl px-4 py-2.5 text-[14px] font-medium hover:bg-neutral-50">제작업체 vs 온스토리</Link>
              <Link href={user ? "/my" : "/login?next=%2Fmy"} className="block rounded-xl px-4 py-2.5 text-[14px] font-semibold hover:bg-neutral-50" style={{ color: "var(--forest)" }}>{user ? "마이페이지" : "로그인"}</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--forest)", color: "var(--cream)" }}>
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo variant="cream" height={22} />
          <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed opacity-80">
            홈페이지는 텅 빈 상가입니다. 스토리에는 진짜 사람이 있습니다.<br />사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다.
          </p>
          <p className="mt-4 flex flex-wrap gap-2 text-[11.5px] opacity-70">
            {CHANNELS.map((c) => <span key={c.id} className="rounded-full border border-white/25 px-2.5 py-1">{c.name}</span>)}
          </p>
        </div>
        <FooterCol title="둘러보기" links={[["/how-it-works", "작동방식"], ["/#portfolio", "완성 예시"], ["/#pricing", "가격"], ["/faq", "자주묻는질문"], ["/reviews", "리뷰"], ["/blog", "블로그"]]} />
        <FooterCol title="회사" links={[["/our-story", "사업이야기"], ["/faq#privacy", "개인정보 · 보안"], ["/login", "로그인"], ["/my", "마이페이지"], ["/admin", "운영자"]]} />
        <FooterCol title="비교" links={[["/compare", "홈페이지 제작업체 vs 온스토리"], ["/how-it-works", "60초로 무엇이 되나"], ["/new", "14일 무료로 시작"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-5 text-[12px] opacity-70">
          <span>© {new Date().getFullYear()} 온스토리 onstori.com · 문의: 카카오톡 채널 (준비 중)</span>
          <span>사업자 정보는 등록 후 표기됩니다</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">{title}</p>
      <ul className="mt-3 space-y-2 text-[14px]">
        {links.map(([href, label]) => (
          <li key={href + label}><Link href={href} className="opacity-90 hover:underline underline-offset-4">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

/** 페이지 상단 공통 히어로 (메뉴 페이지용) */
export function PageHero({ kicker, title, sub, children }: { kicker: string; title: React.ReactNode; sub?: string; children?: React.ReactNode }) {
  return (
    <section className="wrap pb-10 pt-14 sm:pt-20">
      <p className="text-[12px] font-bold tracking-[0.2em]" style={{ color: "var(--teal)" }}>{kicker}</p>
      <h1 className="font-display mt-3 max-w-3xl text-[32px] leading-[1.22] sm:text-[44px]" style={{ textWrap: "balance" }}>{title}</h1>
      {sub && <p className="mt-4 max-w-2xl text-[16.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{sub}</p>}
      {children}
    </section>
  );
}

/** 페이지 하단 공통 CTA 밴드 */
export function CtaBand({ title = "사장님 이야기부터 들려주세요", sub = "14일 동안 전 기능 무료 · 이후 정회원 49,000원 · 언제든 해지" }: { title?: string; sub?: string }) {
  return (
    <section style={{ background: "var(--cream-2)" }}>
      <div className="wrap py-16 text-center">
        <h2 className="font-display text-[28px] sm:text-[36px]" style={{ textWrap: "balance" }}>{title}</h2>
        <p className="mt-3 text-[14.5px]" style={{ color: "var(--muted)" }}>{sub}</p>
        <div className="mt-7"><Link href="/new" className="btn-lime">녹화를 시도해보세요 · 60초</Link></div>
      </div>
    </section>
  );
}
