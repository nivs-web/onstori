import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { BIZ_LINE } from "@/config/company";
import { COPY } from "@/lib/trial";
import { Logo } from "./logo";
import { SiteHeaderClient } from "./header-client";

/**
 * 본사 페이지 공용 크롬 — 헤더·프로모 띠·푸터.
 * 첫 페이지·작동방식·온스토리·FAQ·리뷰·블로그·비교 페이지가 전부 이 파일을 쓴다.
 *
 * 색·간격·글자는 app/globals.css 의 토큰만 쓴다 (CLAUDE.md 규칙 11 · docs/DESIGN.md).
 */

export const NAV = [
  { href: "/how-it-works", label: "작동방식" },
  { href: "/our-story", label: "온스토리" },
  { href: "/faq", label: "자주묻는질문" },
  { href: "/reviews", label: "리뷰" },
  { href: "/blog", label: "블로그" },
] as const;

export const CHANNELS = [
  { id: "youtube", name: "유튜브 쇼츠", short: "Shorts" },
  { id: "instagram", name: "인스타 릴스", short: "Reels" },
  { id: "threads", name: "쓰레드", short: "Threads" },
  { id: "x", name: "X(트위터)", short: "X" },
  { id: "naver", name: "네이버 블로그", short: "Naver" },
  { id: "onstori", name: "온스토리 사이트", short: "onstori" },
] as const;

export { Logo };

/** 상단 프로모 띠 — 높이를 고정한다. 조건부로 나타나면 아래가 통째로 밀린다(CLS). */
export function PromoBar() {
  return (
    <Link
      href="/new"
      className="flex items-center justify-center text-center t-caption font-semibold"
      style={{ height: "var(--s-7)", background: "var(--n-800)", color: "var(--n-0)", paddingInline: "var(--s-4)" }}
    >
      {/* 높이 한 줄에 맞춰 폰에서는 뒷문장을 접는다 — 잘린 문장을 보여주는 것보다 낫다 */}
      <span className="truncate">
        오픈 기념 — {COPY.trialShort} · 이후 {COPY.priceLine}
        <span className="hidden sm:inline"> · 사장님 이야기부터 들려주세요</span> →
      </span>
    </Link>
  );
}

/** 헤더 — 서버 컴포넌트에서 세션만 읽고, 실제 화면은 클라이언트 쪽이 그린다(스크롤·시트). */
export async function SiteHeader({ current }: { current?: string }) {
  const user = await getSessionUser().catch(() => null);
  return <SiteHeaderClient nav={NAV} current={current} signedIn={Boolean(user)} />;
}

export function SiteFooter() {
  return (
    <footer className="surface-900">
      <div
        className="wrap grid md:grid-cols-[1.4fr_1fr_1fr]"
        style={{ gap: "var(--s-7)", paddingBlock: "var(--s-8)" }}
      >
        <div>
          <Logo variant="cream" height={22} />
          <p className="t-small measure" style={{ marginTop: "var(--s-3)", color: "var(--n-300)" }}>
            홈페이지는 빈 집입니다. 스토리에는 진짜 사람이 있습니다.<br />
            사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다.
          </p>
          <p className="flex flex-wrap" style={{ marginTop: "var(--s-4)", gap: "var(--s-2)" }}>
            {CHANNELS.map((c) => (
              <span
                key={c.id}
                className="t-caption"
                style={{
                  border: "1px solid var(--n-700)", color: "var(--text-soft)",
                  borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-3)",
                }}
              >
                {c.name}
              </span>
            ))}
          </p>
        </div>
        <FooterCol title="둘러보기" links={[["/how-it-works", "작동방식"], ["/#portfolio", "완성 예시"], ["/#pricing", "가격"], ["/faq", "자주묻는질문"], ["/reviews", "리뷰"], ["/blog", "블로그"]]} />
        <FooterCol title="회사" links={[["/our-story", "온스토리"], ["/privacy", "개인정보처리방침"], ["/terms", "이용약관"], ["/login", "로그인"], ["/my", "마이페이지"], ["/admin", "운영자"]]} />
      </div>
      <div style={{ borderTop: "1px solid var(--n-800)" }}>
        <div
          className="wrap flex flex-wrap items-center justify-between t-caption"
          style={{ gap: "var(--s-3)", paddingBlock: "var(--s-5)", color: "var(--text-soft)" }}
        >
          <span>© {new Date().getFullYear()} 온스토리 onstori.com · 문의: 카카오톡 채널 (준비 중)</span>
          {/* 전자상거래법 제10조 표시 의무 — 값의 단일 출처는 config/company.ts */}
          <span>{BIZ_LINE}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="t-caption font-bold" style={{ color: "var(--text-soft)", letterSpacing: "var(--tracking-kicker)" }}>{title}</p>
      <ul style={{ marginTop: "var(--s-3)" }}>
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="t-small tap-row" style={{ color: "var(--n-300)" }}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 페이지 상단 공통 히어로 (메뉴 페이지용) — .reveal 을 붙이지 않는다(LCP) */
export function PageHero({ kicker, title, sub, children }: { kicker: string; title: React.ReactNode; sub?: string; children?: React.ReactNode }) {
  return (
    <section className="wrap" style={{ paddingTop: "var(--s-7)", paddingBottom: "var(--s-6)" }}>
      <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>{kicker}</p>
      <h1 className="t-h1" style={{ marginTop: "var(--s-3)", maxWidth: "18ch", textWrap: "balance" }}>{title}</h1>
      {sub && <p className="t-lead measure" style={{ marginTop: "var(--s-4)" }}>{sub}</p>}
      {children}
    </section>
  );
}

/** 페이지 하단 공통 CTA 밴드 */
export function CtaBand({
  title = "사장님 이야기부터 들려주세요",
  sub = `${COPY.trialShort} · 이후 ${COPY.priceLine} 자동 결제 · 언제든 해지`,
}: { title?: string; sub?: string }) {
  return (
    <section className="surface-50 section reveal">
      <div className="wrap text-center">
        <h2 className="t-h2" style={{ textWrap: "balance" }}>{title}</h2>
        <p className="t-small" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>{sub}</p>
        <div style={{ marginTop: "var(--s-6)" }}>
          <Link href="/new" className="btn btn-primary">녹화를 시도해보세요 · 60초</Link>
        </div>
      </div>
    </section>
  );
}
