import Link from "next/link";
import { Portfolio, loadShowcase } from "@/components/portfolio";
import { PhoneFrame } from "@/components/phone-frame";

export const dynamic = "force-dynamic"; // 쇼케이스 즉시 반영

/** 본사 랜딩 v2 — 페이퍼+잉크+딥틸 브랜드, 히어로에 라이브 폰 프레임 */
export default async function Home() {
  const items = await loadShowcase();
  const heroSite = items.find((i) => i.featured) ?? items[0];

  return (
    <main className="min-h-svh" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: "var(--line)", background: "rgba(251,250,247,0.9)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-[19px] font-extrabold tracking-tight">온스토리</span>
            <span className="hidden text-[11px] font-medium sm:inline" style={{ color: "var(--muted)" }}>onstori.com</span>
          </Link>
          <nav className="flex items-center gap-5 text-[13.5px] font-medium">
            <a href="#portfolio" className="hidden sm:inline" style={{ color: "var(--muted)" }}>완성 예시</a>
            <a href="#pricing" className="hidden sm:inline" style={{ color: "var(--muted)" }}>가격</a>
            <Link href="/new" className="rounded-full px-5 py-2 font-semibold text-white" style={{ background: "var(--accent)" }}>
              무료로 시작
            </Link>
          </nav>
        </div>
      </header>

      {/* ── 히어로 ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-20">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
             style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
            시공·출장 사장님 전용 홈페이지
          </p>
          <h1 className="mt-5 text-[38px] font-extrabold leading-[1.18] sm:text-[46px]" style={{ textWrap: "balance" }}>
            시공 사례가 쌓일수록,<br />
            <span style={{ color: "var(--accent)" }}>견적 문의</span>가 늘어납니다
          </h1>
          <p className="mt-5 text-[16.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            사진만 보내세요. 5분 만에 홈페이지가 완성되고,
            매주 사장님의 시공 이야기가 차곡차곡 쌓입니다.<br className="hidden sm:block" />
            이름 없는 업체가 아니라, <b style={{ color: "var(--ink)" }}>기록이 증명하는 업체</b>가 됩니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/new"
              className="rounded-full px-7 py-4 text-[16px] font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--accent)", boxShadow: "0 16px 32px -14px rgba(14,115,101,0.55)" }}>
              내 가게 홈페이지 미리 보기 — 무료
            </Link>
            <a href="#portfolio" className="text-[14px] font-semibold underline underline-offset-4" style={{ color: "var(--accent-strong)" }}>
              완성 예시 보기 ↓
            </a>
          </div>
          <p className="mt-5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            제작 49,000원 · 월 9,900원 · 오픈 기간 <b style={{ color: "var(--ink)" }}>1개월 무료 체험</b> · 언제든 해지
          </p>
        </div>

        {heroSite && (
          <figure className="relative mx-auto hidden lg:block">
            <PhoneFrame slug={heroSite.slug} scale={0.66} title={heroSite.name} />
            <figcaption className="absolute -left-7 top-9 rounded-full px-3.5 py-2 text-[12px] font-bold text-white shadow-lg"
              style={{ background: "var(--ink)" }}>
              실제 작동 중 · 스크롤해보세요 👆
            </figcaption>
          </figure>
        )}
      </section>

      {/* ── 포트폴리오 밴드 ── */}
      <div className="border-y bg-white" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Portfolio items={items} />
        </div>
      </div>

      {/* ── 3단계 ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-extrabold sm:text-3xl">사장님이 할 일은 사진뿐입니다</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["현장 사진 보내기", "폰에 있는 사진 10장이면 충분해요. 하는 일 한 줄만 곁들여 주세요."],
            ["5분 만에 완성", "문구·구성·검색 등록 준비까지 온스토리가 만들어 드려요."],
            ["이야기만 쌓기", "가끔 사진 한 장, 두 줄. 그게 시공 사례가 되고 견적 문의가 됩니다."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border bg-white p-6" style={{ borderColor: "var(--line)" }}>
              <span className="text-[13px] font-extrabold" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-[17px] font-bold">{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 차별점 ── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["기록이 영업합니다", "시공 전·후 사진과 이야기가 타임라인으로 쌓여, 견적 문의 전에 신뢰부터 만듭니다. “시공 사례 127건”은 말이 아니라 기록으로 증명됩니다."],
            ["검색에 잡히는 구조", "홈페이지를 만들면 네이버·구글 검색 등록까지 온스토리가 준비합니다. 별도 설정도, 추가 비용도 없습니다."],
            ["CF 같은 첫인상", "전문가가 사장님 가게만을 위해 기획·연출한 히어로 무비 옵션. 템플릿으로 찍어내지 않습니다."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl p-6" style={{ background: "var(--accent-soft)" }}>
              <h3 className="text-[16.5px] font-bold" style={{ color: "var(--accent-strong)" }}>{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 가격 (다크 밴드) ── */}
      <section id="pricing" className="text-white" style={{ background: "var(--band)" }}>
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ textWrap: "balance" }}>따로 견적 없이, 처음부터 공개합니다</h2>
          <p className="mt-6 text-[34px] font-extrabold sm:text-[40px]">
            제작 49,000<span className="text-[20px] font-bold">원</span>
            <span className="mx-3 text-[22px] font-medium text-white/40">+</span>
            월 9,900<span className="text-[20px] font-bold">원</span>
          </p>
          <p className="mt-3 text-[14.5px] text-white/60">호스팅 · 네이버/구글 검색 등록 · 수정 무제한 · 이야기 무제한 포함</p>
          <p className="mt-6 inline-block rounded-full px-4 py-2 text-[13px] font-bold" style={{ background: "var(--accent)", color: "#fff" }}>
            오픈 기간 — 1개월 무료 체험, 언제든 해지 · 위약금 없음
          </p>
          <div className="mt-9">
            <Link href="/new" className="inline-block rounded-full bg-white px-8 py-4 text-[16px] font-bold" style={{ color: "var(--band)" }}>
              무료로 만들어보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[16px] font-extrabold">온스토리</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>이야기가 쌓이는 가게 홈페이지</p>
          </div>
          <nav className="flex gap-5 text-[13px]" style={{ color: "var(--muted)" }}>
            <a href="#portfolio">완성 예시</a>
            <a href="#pricing">가격</a>
            <Link href="/new">시작하기</Link>
          </nav>
        </div>
        <p className="mt-8 border-t pt-5 text-[12px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          © {new Date().getFullYear()} 온스토리 · 문의: 카카오톡 채널 (준비 중)
        </p>
      </footer>
    </main>
  );
}
