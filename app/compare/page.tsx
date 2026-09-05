import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "홈페이지 제작업체 vs 온스토리", description: "비용·시간·글쓰기·영상·SNS·검색·소유권·해지 — 11가지 정직한 비교." };

/** 비교 — 레멘토 vs Storyworth 11행 표 (기획1 /mainplan #compare). 타사 화면·문구 복제 없음, 기능 개념만 비교 */
const ROWS = [
  ["만드는 데 걸리는 시간", "2~6주, 미팅 3~5회", "3분 (상호명·업종·색만)"],
  ["비용", "제작 50~300만원 + 유지비", "14일 무료 → 49,000원"],
  ["만든 뒤", "끝. 수정은 건당 비용", "매주 질문 → 새 이야기가 쌓임"],
  ["사장님이 할 일", "원고·사진 준비, 검수, 수정 요청", "문자 링크 누르고 60초 말하기"],
  ["글쓰기", "사장님 또는 외주 작가", "없음 — 말하면 글이 됨"],
  ["영상", "별도 견적 (편당 30만원~)", "매주 자막 영상 포함"],
  ["SNS 발행", "없음", "쇼츠·릴스·쓰레드·X·네이버(복붙)·홈페이지 6곳"],
  ["검색 노출", "등록은 해 주지만 새 페이지가 안 생김", "이야기마다 새 페이지 — 검색 면적이 늘어남"],
  ["사진", "스톡 사진", "사장님 사진 우선 + 업종별 이미지뱅크"],
  ["소유권", "업체 서버·업체 계정인 경우 많음", "홈페이지·영상·기록 전부 사장님 것"],
  ["해지", "위약금·자료 반출 어려움", "언제든, 자료 전부 반출"],
];

export default function ComparePage() {
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader />
      <PageHero kicker="비교" title={<>홈페이지는 있는데,<br />왜 손님이 없을까요?</>} sub="홈페이지 제작이 아닙니다. 사업이 굴러가게 만듭니다. 일반 제작업체와 온스토리를 11가지로 정직하게 비교했습니다." />
      <section className="wrap pb-16">
        <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--line)" }}>
          <table className="w-full min-w-[640px] text-[14.5px]">
            <thead>
              <tr style={{ background: "var(--cream-2)" }}>
                <th className="px-5 py-4 text-left text-[12.5px] font-bold tracking-[0.1em]" style={{ color: "var(--muted)" }}>항목</th>
                <th className="px-5 py-4 text-left text-[13px] font-bold" style={{ color: "var(--muted)" }}>일반 홈페이지 제작업체</th>
                <th className="px-5 py-4 text-left text-[13px] font-extrabold" style={{ color: "var(--forest)" }}>온스토리</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b]) => (
                <tr key={k} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-5 py-4 font-semibold" style={{ color: "var(--forest)" }}>{k}</td>
                  <td className="px-5 py-4" style={{ color: "var(--muted)" }}>{a}</td>
                  <td className="px-5 py-4 font-semibold" style={{ color: "var(--forest)" }}><span className="mr-1.5" style={{ color: "var(--green)" }}>✓</span>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 rounded-3xl p-8 text-center" style={{ background: "var(--forest)", color: "var(--cream)" }}>
          <p className="font-display text-[26px] sm:text-[32px]">제작업체는 홈페이지를 줍니다.<br />온스토리는 손님을 부릅니다.</p>
          <Link href="/new" className="btn-lime mt-6">14일 무료로 시작</Link>
        </div>
      </section>
      <CtaBand />
      <SiteFooter />
    </main>
  );
}
