import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "블로그 — 온스토리", description: "사장님 이야기 · 질문 은행 · 업종별 가이드 · 검색·유튜브 노하우 · 온스토리 소식." };

/**
 * 블로그 — 레멘토 Blog 구조(6분류 · 카드 · 리드 매그닛). 기획1 /mainplan #blog.
 * 글 본문은 다음 세션에서 md → 페이지로. 지금은 목록·분류·첫 12편 제목이 실려 있고 각 카드는 '준비 중'.
 */
const CATS = ["전체", "사장님 이야기", "질문 은행", "업종별 가이드", "검색·유튜브 노하우", "온스토리 소식", "사장님 인터뷰"];
const POSTS = [
  ["사장님 이야기", "홈페이지는 있는데 손님이 없는 이유", "텅 빈 상가론. 사람이 없는 페이지는 검색도 신뢰도 안 쌓인다."],
  ["질문 은행", "사장님이 답하기 좋은 질문 20개", "시작·경험·나만의·실적·최근손님 5분류 × 4."],
  ["검색·유튜브 노하우", "60초 영상이 3년 뒤에도 검색되는 이유", "쇼츠·릴스의 롱테일과 홈페이지 스토리 페이지의 관계."],
  ["검색·유튜브 노하우", "얼굴 없이 영상 만드는 법", "음성만 모드 + 사진 + 자막."],
  ["검색·유튜브 노하우", "네이버 블로그 30초 복붙 가이드", "복사 버튼, 붙여넣기, 저품질 피하는 3가지."],
  ["검색·유튜브 노하우", "유튜브 '비진정성 콘텐츠' 정책과 사장님 영상", "왜 AI 아바타를 쓰지 않는가."],
  ["업종별 가이드", "도배·장판 사장님 홈페이지에 꼭 있어야 할 5가지", "업종 가이드 1."],
  ["업종별 가이드", "카페 사장님, 메뉴판보다 먼저 올릴 것", "업종 가이드 2."],
  ["사장님 이야기", "이번 주 손님 이야기가 다음 주 손님을 부른다", "최근손님이야기 카테고리 사용법."],
  ["온스토리 소식", "홈페이지 제작업체 vs 온스토리, 정직한 비교", "비교 페이지 확장판."],
  ["온스토리 소식", "14일 무료로 무엇까지 할 수 있나", "온보딩부터 첫 영상까지 체크리스트."],
  ["사장님 인터뷰", "온스토리를 만든 이유", "사업이야기 확장판."],
];

export default function BlogPage() {
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader current="/blog" />
      <PageHero kicker="블로그" title="이야기가 쌓이면 검색이 따라옵니다" sub="온스토리 블로그는 두 층입니다. 여기(본사)와, 사장님 각자의 홈페이지 블로그. 사장님 60초는 사장님 페이지에 쌓입니다.">
        <div className="mt-6 flex flex-wrap gap-2" aria-label="분류">
          {CATS.map((t, i) => <span key={t} className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold" style={{ borderColor: "var(--line)", background: i === 0 ? "var(--forest)" : "#fff", color: i === 0 ? "var(--cream)" : "var(--forest)" }}>{t}</span>)}
        </div>
      </PageHero>
      <section className="wrap pb-20">
        <ul className="grid gap-4 md:grid-cols-3">
          {POSTS.map(([c, t, d]) => (
            <li key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
              <div className="aspect-[16/9] rounded-xl" style={{ background: "linear-gradient(160deg,#33514F,#273D3D)" }} aria-hidden />
              <p className="mt-4 text-[11.5px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>{c}</p>
              <h2 className="font-display mt-1.5 text-[19px] leading-snug" style={{ color: "var(--forest)" }}>{t}</h2>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
              <p className="mt-3 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>준비 중 · 곧 올립니다</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-3xl p-8 md:flex md:items-center md:justify-between" style={{ background: "var(--lime)", color: "var(--forest)" }}>
          <div>
            <p className="font-display text-[24px]">사장님이 답하기 좋은 질문 20개</p>
            <p className="mt-1 text-[14px] opacity-80">홈페이지를 만들면 첫 질문과 함께 문자로 보내드립니다.</p>
          </div>
          <Link href="/new" className="btn-forest mt-4 md:mt-0">질문 20개 받기</Link>
        </div>
      </section>
      <CtaBand />
      <SiteFooter />
    </main>
  );
}
