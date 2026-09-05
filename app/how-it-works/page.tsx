import Link from "next/link";
import type { Metadata } from "next";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";
import { RecMockup, SpeechToStory } from "@/components/site/blocks";
import { QuestionShuffle } from "@/components/site/question-shuffle";

export const metadata: Metadata = { title: "작동방식 — 온스토리", description: "문자 링크 하나로 매주 60초. 홈페이지·자막 영상·글·사진 카드가 되어 여섯 곳에 퍼집니다." };

/** 작동방식 — 레멘토 How it works 구조 (기획1 /mainplan #howitworks) */
export default function HowItWorks() {
  const steps = [
    ["홈페이지가 먼저 생깁니다", "오늘 · 3분", "상호명과 업종만 고르면 온스토리가 문구·사진·구조를 채워 onstori.com/사장님가게 를 만듭니다. 14일 동안 전 기능 무료."],
    ["매주 질문이 문자로 옵니다", "주 1회 (원하면 매일)", "\"이 일을 시작한 이유는요?\" 같은 질문 4개 중 하나. 마음에 안 들면 [랜덤 질문 바꾸기]."],
    ["링크를 누르고 60초 말합니다", "60초", "크롬이 열리고 3·2·1 뒤 녹화. 얼굴이 싫으면 '음성만'. 다시 찍기는 무제한."],
    ["온스토리가 영상·글·사진 카드를 만듭니다", "30분", "무음 컷 · 한글 자막 · 세로/가로 두 판 · 원문/1인칭/3인칭 글 · 캡션 6종 · 사진 카드."],
    ["여섯 곳에 퍼집니다", "하루 최대 3건", "유튜브 쇼츠 · 인스타 릴스 · 쓰레드 · X(유료) · 네이버 블로그(복사 30초) · 온스토리 홈페이지 블로그."],
    ["홈페이지에 쌓입니다", "계속", "이야기가 늘수록 검색에 잡히는 페이지가 늘고, \"작업 기록 47건\"이 말이 아니라 기록으로 증명됩니다."],
  ];
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader current="/how-it-works" />
      <PageHero kicker="작동방식" title={<>사장님이 말하면,<br />손님이 찾아옵니다.</>} sub="글쓰기·편집·앱 설치 없이, 문자 링크 하나로 매주 60초. 그 60초가 홈페이지·영상·글이 되어 여섯 곳에 퍼집니다.">
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/new" className="btn-lime">녹화를 시도해보세요 · 60초</Link>
          <Link href="#steps" className="btn-ghost">6단계 보기 ↓</Link>
        </div>
      </PageHero>

      <section id="steps" className="wrap pb-20">
        <ol className="relative space-y-6 border-l-2 pl-8" style={{ borderColor: "var(--line)" }}>
          {steps.map(([t, when, d], i) => (
            <li key={t} className="relative rounded-2xl border bg-white p-6" style={{ borderColor: "var(--line)" }}>
              <span className="absolute -left-[45px] top-6 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--forest)", color: "var(--lime)" }}>{i + 1}</span>
              <p className="text-[11.5px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>{when}</p>
              <h2 className="mt-1 text-[19px] font-extrabold" style={{ color: "var(--forest)" }}>{t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ background: "var(--cream-2)" }}>
        <div className="wrap py-20">
          <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>말→글 3모드</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">말하면 글이 됩니다</h2>
          <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted)" }}>입력에 없는 연차·건수·자격은 절대 만들지 않습니다. 사장님이 말한 숫자만 씁니다.</p>
          <div className="mt-8"><SpeechToStory /></div>
        </div>
      </section>

      <section style={{ background: "var(--forest)" }}>
        <div className="wrap py-20"><QuestionShuffle dark initialSeed={11} /></div>
      </section>

      <section className="wrap grid items-center gap-10 py-20 md:grid-cols-[1fr_auto_auto]">
        <div>
          <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>녹화 화면 미리보기</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">녹화를 시도해보세요.<br />60초 정도 걸립니다.</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
            로그인은 따로 없습니다. 문자·카카오톡으로 받은 링크를 크롬에서 여는 것이 곧 로그인입니다. 카카오톡 안에서 열렸다면 &ldquo;크롬으로 열기&rdquo;를 눌러 주세요 — 카톡 안에서는 카메라가 켜지지 않습니다.
          </p>
          <Link href="/new" className="btn-lime mt-8">지금 시작하기</Link>
        </div>
        <RecMockup state="ask" />
        <RecMockup state="done" />
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
