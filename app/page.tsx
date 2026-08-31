import Link from "next/link";
import { Portfolio } from "@/components/portfolio";

export const dynamic = "force-dynamic"; // 쇼케이스 즉시 반영 (어드민 등록 → 바로 랜딩)

/** 본사 랜딩 v1 — 히어로 + 라이브 포트폴리오(폰 프레임) + 가치 제안 + 가격 */
export default function Home() {
  return (
    <main className="min-h-svh bg-white text-neutral-900"><div className="mx-auto max-w-5xl px-6 py-20">
      <div className="max-w-2xl"><p className="text-xs font-semibold tracking-[0.25em] text-blue-700">ONSTORI</p>
      <h1 className="mt-3 text-3xl font-bold leading-snug sm:text-4xl" style={{ textWrap: "balance" }}>
        시공 사례가 쌓일수록,<br />견적 문의가 늘어납니다
      </h1>
      <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-neutral-500">
        사진만 보내세요. 5분 만에 홈페이지가 완성되고, 매주 사장님의 시공 이야기가 차곡차곡 쌓입니다.
        이름 없는 업체가 아니라, 기록이 증명하는 업체가 됩니다.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/new" className="rounded-full bg-blue-700 px-7 py-3.5 font-semibold text-white shadow-lg">
          내 가게 홈페이지 미리 보기 — 무료
        </Link>
        <a href="#portfolio" className="text-sm font-medium text-blue-700 underline underline-offset-4">
          완성 예시 보기 ↓
        </a>
      </div></div>

      <Portfolio />

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          ["기록이 영업합니다", "시공 전·후 사진과 이야기가 타임라인으로 쌓여, 견적 문의 전에 신뢰부터 만듭니다."],
          ["사장님은 사진만", "한 장, 두 줄이면 끝. 문구·정리·검색 등록은 온스토리가 합니다."],
          ["CF 같은 첫인상", "전문가가 사장님 가게만을 위해 기획·연출한 히어로 무비 옵션. 템플릿으로 찍어내지 않습니다."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="font-bold">{t}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 rounded-2xl bg-neutral-50 p-6">
        <h2 className="font-bold">따로 견적 없이, 처음부터 공개합니다</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          제작 49,000원(1회) + 월 9,900원 — 호스팅·검색 등록·수정 무제한 포함.<br />
          지금은 오픈 기간이라 <b>1개월 무료 체험</b>으로 시작합니다. 언제든 해지, 위약금 없음.
        </p>
      </section>

      <footer className="mt-16 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} 온스토리 · 문의: 카카오톡 채널 (준비 중)
      </footer>
    </div></main>
  );
}
