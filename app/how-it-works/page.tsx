import Link from "next/link";
import type { Metadata } from "next";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";
import { RecMockup, SpeechToStory } from "@/components/site/blocks";
import { QuestionShuffle } from "@/components/site/question-shuffle";

export const metadata: Metadata = { title: "작동방식 — 온스토리", description: "문자 링크 하나로 매주 60초. 홈페이지·자막 영상·글·사진 카드가 되어 여섯 곳에 퍼집니다." };

/** 작동방식 — 색·간격·글자는 app/globals.css 토큰만 쓴다 (docs/DESIGN.md) */
export default function HowItWorks() {
  const steps = [
    ["홈페이지가 먼저 생깁니다", "오늘 · 3분", "상호명과 업종만 고르면 온스토리가 문구·사진·구조를 채워 onstori.com/name 을 만듭니다. 30일 동안 전 기능 무료."],
    ["매주 질문이 문자로 옵니다", "주 1회 (원하면 매일)", "\"이 일을 시작한 이유는요?\" 같은 질문 4개 중 하나. 마음에 안 들면 [랜덤 질문 바꾸기]."],
    ["링크를 누르고 60초 말합니다", "60초", "크롬이 열리고 3·2·1 뒤 녹화. 얼굴이 싫으면 '음성만'. 다시 찍기는 무제한."],
    ["온스토리가 영상·글·사진 카드를 만듭니다", "30분", "무음 컷 · 한글 자막 · 쇼츠·릴스 규격 · 원문/1인칭/3인칭 글 · 캡션 6종 · 사진 카드."],
    ["여섯 곳에 퍼집니다", "하루 최대 3건", "유튜브 쇼츠 · 인스타 릴스 · 쓰레드 · X(유료) · 네이버 블로그(복사 30초) · 온스토리 사이트."],
    ["홈페이지에 쌓입니다", "계속", "이야기가 늘수록 검색에 잡히는 페이지가 늘고, \"작업 기록 47건\"이 말이 아니라 기록으로 증명됩니다."],
  ];
  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader current="/how-it-works" />
      <PageHero
        kicker="작동방식"
        title={<>사장님이 말하면,<br />손님이 찾아옵니다.</>}
        sub="글쓰기·편집·앱 설치 없이, 문자 링크 하나로 매주 60초. 그 60초가 홈페이지·영상·글이 되어 여섯 곳에 퍼집니다."
      >
        <div className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-3)" }}>
          <Link href="/new" className="btn btn-primary">녹화를 시도해보세요 · 60초</Link>
          <Link href="#steps" className="btn btn-secondary">6단계 보기 ↓</Link>
        </div>
      </PageHero>

      <section id="steps" className="surface-0 reveal" style={{ paddingBottom: "var(--s-8)" }}>
        <div className="wrap">
          <ol className="relative" style={{ borderLeft: "2px solid var(--n-200)", paddingLeft: "var(--s-6)" }}>
            {steps.map(([t, when, d], i) => (
              <li key={t} className="card relative" style={{ padding: "var(--s-5)", marginBottom: "var(--s-5)" }}>
                <span
                  className="absolute t-caption flex items-center justify-center font-bold"
                  style={{
                    left: "calc((var(--s-6) + var(--s-5) + 15px) * -1)", top: "var(--s-5)",
                    width: 28, height: 28, borderRadius: "var(--r-full)",
                    background: "var(--n-800)", color: "var(--green-200)",
                  }}
                >
                  {i + 1}
                </span>
                <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>{when}</p>
                <h2 className="t-h3" style={{ marginTop: "var(--s-1)" }}>{t}</h2>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-600)" }}>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="surface-50 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>말→글 3모드</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>말하면 글이 됩니다</h2>
          <p className="t-body measure" style={{ marginTop: "var(--s-3)", color: "var(--n-600)" }}>
            입력에 없는 연차·건수·자격은 절대 만들지 않습니다. 사장님이 말한 숫자만 씁니다.
          </p>
          <div style={{ marginTop: "var(--s-6)" }}><SpeechToStory /></div>
        </div>
      </section>

      <section className="surface-900 section reveal">
        <div className="wrap"><QuestionShuffle dark initialSeed={11} /></div>
      </section>

      <section className="surface-0 section reveal">
        <div className="wrap grid items-center md:grid-cols-[1fr_auto_auto]" style={{ gap: "var(--s-7)" }}>
          <div>
            <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>녹화 화면 미리보기</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>녹화를 시도해보세요.<br />60초 정도 걸립니다.</h2>
            <p className="t-body measure" style={{ marginTop: "var(--s-4)", color: "var(--n-600)" }}>
              로그인은 따로 없습니다. 문자·카카오톡으로 받은 링크를 크롬에서 여는 것이 곧 로그인입니다. 카카오톡 안에서 열렸다면 &ldquo;크롬으로 열기&rdquo;를 눌러 주세요 — 카톡 안에서는 카메라가 켜지지 않습니다.
            </p>
            <div style={{ marginTop: "var(--s-6)" }}>
              <Link href="/new" className="btn btn-primary">지금 시작하기</Link>
            </div>
          </div>
          <RecMockup state="ask" />
          <RecMockup state="done" />
        </div>
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
