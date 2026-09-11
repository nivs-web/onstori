import Link from "next/link";
import { Portfolio, loadShowcase } from "@/components/portfolio";
import { PromoBar, SiteHeader, SiteFooter } from "@/components/site/chrome";
import { ChannelStrip, RecMockup, SpeechToStory, CompareCallout, FaqList } from "@/components/site/blocks";
import { QuestionShuffle } from "@/components/site/question-shuffle";
import { FAQ_FEATURED } from "@/config/faq";
import { sectionVisibility } from "@/lib/page-sections";
import { BIZ } from "@/config/company";
import { CHANNELS_LINE, CHANNELS_PITCH, CHANNEL_COUNT } from "@/config/channels";
import { COPY, BILLING_INTERVAL } from "@/lib/trial";
import { SectionGate } from "@/components/site/section-gate";
import { MarkStack, MarkSearch, MarkVoice } from "@/components/site/marks";

/**
 * ★ ISR — 요청마다 다시 그리지 않는다.
 *
 * 전에는 `dynamic = "force-dynamic"` 이었다. 그래서 손님이 올 때마다 서버가 화면을 새로
 * 조립하고 DB 를 두 번 읽었다 — 2026-09-07 실측 **TTFB 1.85~2.23초**.
 * 같은 조건에서 정적인 /how-it-works 는 **0.28초**였다. 8배 차이다.
 * 첫 페이지는 손님이 제일 먼저 보는 화면이라 여기가 제일 아프다.
 *
 * ⚠ "쇼케이스 즉시 반영"이 force-dynamic 의 이유였는데, 그건 어드민에서 바꿀 때
 *   revalidatePath("/") 로 하면 된다(app/api/admin/showcase). 손님 전원에게 2초를
 *   물리면서까지 지킬 이유가 아니다.
 */
export const revalidate = 60;

// 섹션 노출 스위치는 DB(page_sections)로 옮겼다 — /admin/pages 에서 켜고 끈다.
// DB 를 못 읽으면 안전 기본값(대부분 보임)으로 떨어진다 — lib/page-sections.ts

/**
 * 본사 첫 페이지 — 디자인 시스템 v1 (docs/DESIGN.md).
 *
 * 배경은 흰(.surface-0) / 연회색(.surface-50) / 어두운(.surface-900) 을 번갈아 쓴다 —
 * 같은 배경이 연달아 오면 경계가 사라져 한 덩어리로 보인다.
 * 세로 여백은 .section (모바일 64 / PC 128).
 * 주 버튼(초록)은 뷰포트당 1개 — 나머지는 보조·글자 버튼이다.
 * 히어로에는 .reveal 을 붙이지 않는다 (LCP).
 */
export default async function Home() {
  // ⚠ 두 번을 이어서 기다리지 않는다. 순서대로 하면 왕복이 두 번 쌓인다.
  const [show, items] = await Promise.all([sectionVisibility(), loadShowcase()]);
  const heroSite = items.find((i) => i.featured) ?? items[0];

  return (
    <main className="min-h-svh">
      <PromoBar />
      <SiteHeader />

      {/* ── 히어로 ── 주 버튼 1개 · 리드 1줄 · 스크롤 힌트 없음 */}
      <section className="surface-0">
        <div
          className="wrap grid items-center lg:grid-cols-[1.3fr_1fr]"
          style={{ gap: "var(--s-7)", paddingTop: "var(--s-7)", paddingBottom: "var(--s-8)" }}
        >
          <div className="measure">
            <h1 className="t-h1" style={{ textWrap: "balance" }}>
              홈페이지는 빈 집입니다.<br />
              스토리에는 <span style={{ color: "var(--green-700)" }}>진짜 사람</span>이 있습니다.
            </h1>
            <p className="t-lead" style={{ marginTop: "var(--s-4)" }}>
              사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다.
            </p>
            <ul className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }} aria-label="세 가지 약속">
              {[["✎", "글쓰기 금지"], ["🔗", "링크만 클릭"], ["⤓", "다운로드 없음"]].map(([i, t]) => (
                <li key={t} className="chip"><span aria-hidden>{i}</span>{t}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
              <Link href="/new" className="btn btn-primary">녹화를 시도해보세요 · 60초면 됩니다</Link>
              <Link href="/how-it-works" className="btn btn-text">작동방식 보기 →</Link>
            </div>
            <dl className="grid grid-cols-3 text-center" style={{ marginTop: "var(--s-6)", gap: "var(--s-3)", maxWidth: "28rem" }}>
              {[["3분", "제작 시간"], [`${CHANNEL_COUNT}곳`, "퍼지는 채널"], ["30일", "전 기능 무료"]].map(([v, k]) => (
                <div key={k} className="card" style={{ padding: "var(--s-3) var(--s-2)" }}>
                  <dd className="t-h3" style={{ color: "var(--green-700)" }}>{v}</dd>
                  <dt className="t-caption">{k}</dt>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto hidden items-end lg:flex" style={{ gap: "var(--s-4)" }}>
            {/* ⚠ 예전에는 여기에 살아 있는 사이트를 iframe 으로 띄웠다. 스크롤바·오른쪽 흰 여백·
                느려짐이 전부 거기서 나왔다. 지금은 미리 찍은 사진 한 장(13KB)이다. */}
            {heroSite?.phone && (
              <figure className="relative" style={{ margin: 0 }}>
                {/* ⚠ phone-frame 이 껍데기(테두리·모서리·그림자), phone-shot 은 폭·비율만.
                    둘 다 있어야 한다 — phone-frame 을 빼면 각진 사진 한 장으로 나온다. */}
                <span className="phone-frame phone-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroSite.phone} alt={`${heroSite.name} 홈페이지 화면`} width={236} height={480} />
                </span>
                <figcaption
                  className="absolute t-caption font-bold"
                  style={{
                    left: "calc(var(--s-5) * -1)", top: "var(--s-6)",
                    background: "var(--n-800)", color: "var(--n-0)",
                    borderRadius: "var(--r-full)", padding: "var(--s-2) var(--s-3)",
                    boxShadow: "var(--shadow-1)",
                  }}
                >
                  온스토리로 만든 홈페이지
                </figcaption>
              </figure>
            )}
            {/* ⚠ 1280 아래에서는 감춘다. 오른쪽 칸이 1fr(≈420px)인데 폰 두 대가 450px 을 먹어
                1024~1279 에서 화면 밖으로 튀어나갔다 — 폰이 커서가 아니라 **자리가 좁아서**였다.
                ⚠ 겹치는 정도도 주의. -s-8(-64px) 로 당겼더니 REC 폰이 왼쪽 폰을 통째로 덮었다. */}
            <div className="hidden origin-bottom-left scale-[.72] xl:block" style={{ marginLeft: "calc(var(--s-5) * -1)", marginBottom: "var(--s-5)" }}>
              <RecMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── 채널 띠 ── */}
      <SectionGate show={show} id="channels"><ChannelStrip /></SectionGate>

      {/* ── 약속 4개 ── */}
      <section className="surface-0 section reveal">
        <div className="wrap grid md:grid-cols-4" style={{ gap: "var(--s-4)" }}>
          {[
            ["60초만 말하세요.", "나머지는 온스토리가 합니다."],
            ["질문은 저희가 드립니다.", "사장님은 대답만."],
            ["얼굴이 안 나와도 됩니다.", "목소리면 충분합니다."],
            ["3년 뒤에도 검색되는 영상,", "오늘 60초만 말하세요."],
          ].map(([a, b]) => (
            <blockquote
              key={a}
              className="card"
              style={{ padding: "var(--s-5)", borderLeft: "4px solid var(--green-300)" }}
            >
              <p className="t-h3" style={{ color: "var(--n-900)" }}>{a}</p>
              <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{b}</p>
            </blockquote>
          ))}
        </div>
      </section>

      {/* ── 온스토리란 ── */}
      <section className="surface-50 section reveal">
        <div className="wrap grid items-start md:grid-cols-[1fr_1.4fr]" style={{ gap: "var(--s-7)" }}>
          <div>
            <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>온스토리란</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>사장님의 60초가<br />영상·글·블로그로 바뀌는<br />자동화 엔진</h2>
          </div>
          <div className="grid sm:grid-cols-3" style={{ gap: "var(--s-4)" }}>
            {[
              ["홈페이지", "상호명과 업종만 고르면 3분 만에 onstori.com/name 이 생깁니다. 이야기가 쌓일수록 페이지가 두꺼워집니다."],
              ["60초 영상", "매주(혹은 매일) 질문 하나에 60초. 아직도 타이핑하고 계신가요? 목소리가 있어야 고객이 신뢰합니다."],
              [`${CHANNEL_COUNT}곳 동시 발행`, CHANNELS_PITCH],
            ].map(([t, d]) => (
              <div key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <h3 className="t-h3">{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 작동방식 4단계 ── */}
      <section className="surface-900 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>이렇게 작동합니다</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>사장님이 할 일은 60초뿐입니다</h2>
          <ol className="grid md:grid-cols-4" style={{ marginTop: "var(--s-7)", gap: "var(--s-4)" }}>
            {[
              ["문자로 질문이 옵니다", "매주 질문 4개 중 하나. 마음에 안 들면 [랜덤 질문 바꾸기]."],
              ["링크 누르고 60초", "브라우저가 열리고 3·2·1. 앱 설치도, 글쓰기도 없습니다."],
              ["온스토리가 만듭니다", "30분 안에 자막 영상 · 다듬은 글 3종 · 사진 카드."],
              [`${CHANNEL_COUNT}곳에 퍼지고 쌓입니다`, `${CHANNELS_LINE}. 검색 면적이 늘어납니다.`],
            ].map(([t, d], i) => (
              <li key={t} style={{ background: "var(--n-800)", borderRadius: "var(--r-lg)", padding: "var(--s-5)" }}>
                <span className="t-h3" style={{ color: "var(--green-200)" }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ marginTop: "var(--s-2)" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-300)" }}>{d}</p>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: "var(--s-6)" }}>
            <Link href="/how-it-works" className="btn btn-secondary">작동방식 자세히 →</Link>
          </div>
        </div>
      </section>

      {/* ── 포트폴리오 — 쇼케이스가 등록돼 있을 때만 ── */}
      <SectionGate show={show} id="portfolio">
        {items.length > 0 && (
          <section className="surface-0 section reveal">
            <div className="wrap"><Portfolio items={items} /></div>
          </section>
        )}
      </SectionGate>

      {/* ── 스토리 페이지 들여다보기 ── */}
      <SectionGate show={show} id="inside">
        <section id="inside" className="surface-0 section reveal">
          <div className="wrap">
            <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>스토리 페이지 들여다보기</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>60초 하나가 네 가지 모양이 됩니다</h2>
            <div className="grid md:grid-cols-4" style={{ marginTop: "var(--s-7)", gap: "var(--s-4)" }}>
              {[
                ["스토리 페이지", "720px", "제목 · 날짜 · 영상 · 다듬은 글 · 사진 3장. 검색의 본진.", "3 / 4"],
                ["유튜브 쇼츠", "1080 × 1920", "유튜브 쇼츠 규격. 한글 어절 자막.", "9 / 16"],
                ["인스타 릴스", "1080 × 1920", "인스타 릴스 규격. 60초.", "9 / 16"],
                ["스토리 카드", "464 × 464", "인스타 · 쓰레드 사진. 질문 + 한 줄 답.", "1 / 1"],
              ].map(([t, size, d, ratio]) => (
                <div key={t} className="card" style={{ padding: "var(--s-4)" }}>
                  <div
                    className="w-full"
                    style={{ aspectRatio: ratio, borderRadius: "var(--r-md)", background: "var(--n-800)" }}
                    aria-hidden
                  >
                    <div className="flex h-full flex-col justify-end" style={{ padding: "var(--s-3)" }}>
                      <span
                        className="t-caption font-semibold"
                        style={{ background: "var(--n-0)", color: "var(--n-900)", borderRadius: "var(--r-sm)", padding: "var(--s-1) var(--s-2)" }}
                      >
                        &ldquo;처음엔 안 하려고 했어요&rdquo;
                      </span>
                    </div>
                  </div>
                  <p className="t-body font-bold" style={{ marginTop: "var(--s-3)", color: "var(--n-900)" }}>
                    {t} <span className="t-caption font-medium">{size}</span>
                  </p>
                  <p className="t-small" style={{ marginTop: "var(--s-1)", color: "var(--text)" }}>{d}</p>
                </div>
              ))}
            </div>
            <p className="t-small" style={{ marginTop: "var(--s-5)", color: "var(--text-soft)" }}>
              직접 찍은 사진으로 넣으시면 이야기에 신뢰가 쌓입니다. 사진이 없을 땐 업종별 이미지뱅크가 빈자리를 채웁니다.
            </p>
          </div>
        </section>
      </SectionGate>

      {/* ── 정회원 카드 + 사장님 것 ── */}
      <SectionGate show={show} id="pricing">
        <section id="pricing" className="surface-50 section reveal">
          <div className="wrap grid lg:grid-cols-[1.1fr_1fr]" style={{ gap: "var(--s-6)" }}>
            <div className="surface-900" style={{ borderRadius: "var(--r-lg)", padding: "var(--s-6)" }}>
              <p className="chip chip-accent">가장 많이 선택</p>
              <h2 className="t-h2" style={{ marginTop: "var(--s-4)" }}>
                정회원 <span style={{ color: "var(--accent)" }}>{COPY.priceOnly}</span>
                <span className="t-h3" style={{ fontWeight: "var(--w-semi)" }}> ({BILLING_INTERVAL} 구독 요금제)</span>
              </h2>
              <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-300)" }}>
                30일 동안 전 기능 무료로 써 보시고, 마음에 드시면 {COPY.priceLine}로 계속 쓰시면 됩니다. 언제든 해지하실 수 있습니다.
              </p>
              <ul className="grid sm:grid-cols-2" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }}>
                {["onstori.com/name 홈페이지", "매주 질문 문자 + 60초 녹화 링크", "자막 영상 (쇼츠·릴스 규격)", "다듬은 글 3종 + 사진 카드", CHANNELS_LINE, "견적·문의 알림 (문자·이메일)"].map((t) => (
                  <li key={t} className="t-small flex" style={{ gap: "var(--s-2)", color: "var(--n-200)" }}>
                    <span style={{ color: "var(--green-200)" }}>✓</span>{t}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
                <Link href="/new" className="btn btn-primary">30일 무료로 시작</Link>
                <span className="t-body" style={{ color: "var(--n-300)" }}>매달 자동 결제 · 언제든 해지</span>
              </div>
            </div>
            <div>
              <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>전부 사장님 것입니다</p>
              <div className="grid" style={{ marginTop: "var(--s-4)", gap: "var(--s-3)" }}>
                {[
                  ["홈페이지", "onstori.com/name. 검색 등록까지 온스토리가 준비합니다."],
                  ["영상", "자막 영상과 원본 전부 사장님 파일입니다. 해지해도 가져갑니다."],
                  ["이야기 기록", "3년 뒤에도 검색되는 사장님의 기록. 원문은 항상 보관됩니다."],
                ].map(([t, d]) => (
                  <div key={t} className="card" style={{ padding: "var(--s-5)" }}>
                    <h3 className="t-h3">{t}</h3>
                    <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </SectionGate>

      {/* ── 3단계 ── */}
      <section className="surface-0 section reveal">
        <div className="wrap">
          <h2 className="t-h2">사장님이 할 일은 60초뿐입니다</h2>
          <ol className="grid sm:grid-cols-3" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
            {[
              ["상호명·업종 고르기", "3분이면 홈페이지 뼈대가 완성됩니다. 사진 10장이 있으면 더 좋고, 없어도 됩니다."],
              ["문자 링크 누르고 60초", "매주 질문 하나. 브라우저에서 열고 말씀만 하세요."],
              ["이야기만 쌓기", `영상·글·사진 카드가 ${CHANNEL_COUNT}곳에 퍼지고 홈페이지에 쌓입니다. 그게 시공 사례가 되고 문의가 됩니다.`],
            ].map(([t, d], i) => (
              <li key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <span className="t-small font-bold" style={{ color: "var(--green-700)" }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ marginTop: "var(--s-2)" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 60초 녹화 데모 ── */}
      <section className="surface-900 section reveal">
        {/* ⚠ md(768) 가 아니라 lg(1024) 부터 3단이다. 폰 목업이 280px 이라 768 에서
            1fr + 280 + 280 이 화면을 821px 로 밀어냈다(2026-09-07 verify.js 가 잡았다). */}
        <div className="wrap grid items-center lg:grid-cols-[1fr_auto_auto]" style={{ gap: "var(--s-7)" }}>
          <div>
            <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>녹화 화면 미리보기</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>녹화를 시도해보세요.<br />60초 정도 걸립니다.</h2>
            <p className="t-body measure" style={{ marginTop: "var(--s-4)", color: "var(--n-300)" }}>
              문자로 온 링크를 브라우저에서 열면 이 화면이 뜹니다. 질문을 고르고, 3·2·1, 말씀하시고, 보내기. 카카오톡 안에서 열렸다면 &ldquo;기본 브라우저로 열기&rdquo; 한 번만 눌러 주세요.
            </p>
            <ul className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }}>
              {["✎ 글쓰기 금지", "🔗 로그인 = 링크 열기", "⤓ 앱 설치 없음"].map((t) => (
                <li
                  key={t}
                  className="t-caption font-semibold"
                  style={{ border: "1px solid var(--n-700)", borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-3)", color: "var(--n-300)" }}
                >
                  {t}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: "var(--s-6)" }}>
              <Link href="/new" className="btn btn-primary">지금 시작하기</Link>
            </div>
          </div>
          <RecMockup state="ask" />
          <RecMockup state="rec" />
        </div>
      </section>

      {/* ── 쌓인 기록이 영업한다 + 이런 사장님께 ──
          2026-09-07 회장님 확정. 전에는 제목만 셋 나열돼 있고 문구가 58~63자라
          "왜 있는 섹션인지 모르겠다"는 상태였다. 세 항목의 공통점을 타이틀 한 줄로 올리고
          설명을 절반 이하(27~30자)로 줄였다. 심볼은 components/site/marks.tsx. */}
      <section className="surface-0 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>온스토리가 하는 일</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>쌓인 기록이 사장님 대신 영업합니다</h2>
          {/* 폰 1열 · 태블릿 이상 3열 */}
          <div className="grid sm:grid-cols-3" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
            {[
              [<MarkStack key="s" />, "기록이 신뢰가 됩니다", "「작업 127건」은 말이 아니라 쌓인 기록으로 증명됩니다."],
              [<MarkSearch key="p" />, "이야기마다 새 페이지", "이야기 하나가 새 페이지 하나. 검색에 잡히는 면이 넓어집니다."],
              [<MarkVoice key="v" />, "사장님 목소리 그대로", "AI 목소리를 쓰지 않습니다. 자막과 컷 편집만 합니다."],
            ].map(([icon, t, d]) => (
              <div key={t as string} style={{ background: "var(--green-50)", borderRadius: "var(--r-lg)", padding: "var(--s-5)" }}>
                <span style={{ display: "block", color: "var(--green-700)" }}>{icon}</span>
                <h3 className="t-h3" style={{ marginTop: "var(--s-4)" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-700)" }}>{d}</p>
              </div>
            ))}
          </div>
          <p className="t-caption font-bold" style={{ marginTop: "var(--s-7)", color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
            이런 사장님께 (아직 후기가 아닙니다 — 첫 30일을 써 보신 사장님의 이야기를 기다립니다)
          </p>
          <div className="grid sm:grid-cols-3" style={{ marginTop: "var(--s-4)", gap: "var(--s-4)" }}>
            {[
              ["홈페이지는 있는데 손님이 없는 사장님", "만든 지 1년, 방문자 하루 3명. 새 페이지가 안 생기니 검색도 안 됩니다."],
              ["글은 못 쓰지만 말은 잘하는 사장님", "블로그 쓰라는 말은 많이 들었는데 한 번도 못 썼습니다. 말은 매일 합니다."],
              ["유튜브를 시작하고 싶은데 편집이 무서운 사장님", "60초 찍으면 자막과 컷 편집은 온스토리가 합니다."],
            ].map(([t, d]) => (
              <div key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <h3 className="t-h3" style={{ textWrap: "balance" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 말→글 ── */}
      <section className="surface-50 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>말하면 글이 됩니다</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>사장님이 말한 그대로, 그리고 다듬어서</h2>
          <p className="t-body measure" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>
            입력에 없는 연차·건수·자격은 절대 만들지 않습니다. 사장님이 말한 숫자만 씁니다.
          </p>
          <div style={{ marginTop: "var(--s-6)" }}><SpeechToStory /></div>
        </div>
      </section>

      {/* ── 질문 위젯 ── */}
      <section className="surface-900 section reveal">
        <div className="wrap"><QuestionShuffle dark /></div>
      </section>

      {/* ── 비교 콜아웃 ── */}
      <CompareCallout />

      {/* ── 스토리 예시 3 ── */}
      <section className="surface-50 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>이런 이야기가 됩니다 (예시)</p>
          <div className="grid md:grid-cols-3" style={{ marginTop: "var(--s-4)", gap: "var(--s-4)" }}>
            {[
              ["시작이야기", "처음엔 안 하려고 했어요", "아버지가 도배를 하셨습니다. 군대를 다녀와 따라다니기 시작했는데, 그게 벌써 12년이 됐습니다."],
              ["경험이야기", "새벽 2시에 끝난 누수 공사", "윗집 누수로 아랫집 천장이 젖고 있었습니다. 밤이었지만 다음 날 아침이면 늦는다고 판단했습니다."],
              ["최근손님이야기", "세 번째 오신 손님", "처음엔 소개로, 두 번째는 이사 가서, 이번엔 부모님 집. 사진을 찍어 가시더라고요."],
            ].map(([c, t, d]) => (
              <article key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <span className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>{c}</span>
                <h3 className="t-h3" style={{ marginTop: "var(--s-2)" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
                <p className="t-caption" style={{ marginTop: "var(--s-3)" }}>예시 문장 · 실제 사장님 이야기가 아닙니다</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대표 인사말 ──
          ★ 자리가 중요하다. «이런 이야기가 됩니다(예시)» 바로 다음이다(2026-09-07 회장님).
            예시를 보고 "이게 뭔데?" 싶은 순간에 만든 사람이 나와 이유를 말하는 순서다.
            앞(포트폴리오 뒤)에 있을 때는 아직 궁금하지 않아 그냥 지나쳤다.
          문구는 /our-story 편지의 첫 문단을 줄인 것이다 — 두 곳이 같은 이야기를 해야 한다. */}
      <section className="surface-0 section reveal">
        <div className="wrap">
          <div className="card mx-auto" style={{ maxWidth: "48rem", padding: "var(--s-6)" }}>
            <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>왜 온스토리를 만들었나</p>
            <p className="t-h3" style={{ marginTop: "var(--s-4)", lineHeight: 1.7 }}>
              &ldquo;물건이 밀린 게 아니라, 내가 못 알린 거지.&rdquo;
            </p>
            <p className="t-body" style={{ marginTop: "var(--s-4)", color: "var(--text)" }}>
              친형 같던 형님이 가게를 접던 날 하신 말씀입니다. 다들 물건 하나는 자신 있었는데, 하나씩 밀려났습니다. 26년째 홈페이지를 만들어 왔지만 그 안에 사람이 없었습니다.
            </p>
            <div className="flex flex-wrap items-center justify-between" style={{ marginTop: "var(--s-5)", gap: "var(--s-3)" }}>
              {/* 상호는 config/company.ts 가 단일 출처다 — 푸터·법무 페이지와 같은 값 */}
              <span className="t-small font-semibold">— {BIZ.name}(온스토리) 대표 {BIZ.ceo}</span>
              <Link href="/our-story" className="btn btn-text">온스토리 이야기 →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 무료 기간 흐름 + 가격 밴드 ── */}
      <section className="surface-900 section reveal">
        <div className="wrap text-center">
          <h2 className="t-h2" style={{ textWrap: "balance" }}>따로 견적 없이, 처음부터 공개합니다</h2>
          <ol className="mx-auto grid text-left sm:grid-cols-3" style={{ marginTop: "var(--s-6)", gap: "var(--s-3)", maxWidth: "48rem" }}>
            {[["오늘", "3분 만에 홈페이지. 30일 전 기능 무료."], ["30일 뒤", "미결제 시 홈페이지 정지(비공개). 자료는 그대로 보관."], ["언제든", "결제하시면 바로 다시 공개됩니다."]].map(([t, d]) => (
              <li key={t} style={{ background: "var(--n-800)", borderRadius: "var(--r-lg)", padding: "var(--s-5)" }}>
                <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>{t}</p>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-300)" }}>{d}</p>
              </li>
            ))}
          </ol>
          <p className="t-display" style={{ marginTop: "var(--s-6)" }}>
            정회원 <span style={{ color: "var(--accent)" }}>{COPY.priceOnly}</span>
            <span className="t-h2" style={{ fontWeight: "var(--w-semi)" }}> ({BILLING_INTERVAL} 구독 요금제)</span>
          </p>
          {/* ⚠ t-small(15px) 이라 안 읽혔다 — t-body(17px) 로 키우고 색도 --text 로 올린다(2026-09-07 회장님) */}
          <p className="t-body measure mx-auto" style={{ marginTop: "var(--s-4)", color: "var(--n-200)" }}>
            매달 자동 결제 · 언제든 해지 · 호스팅 · 네이버/구글 검색 등록 · 수정 무제한 · 이야기 무제한 · {CHANNEL_COUNT}채널 발행 포함
          </p>
          <div style={{ marginTop: "var(--s-7)" }}>
            <Link href="/new" className="btn btn-primary">무료로 만들어보기 →</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ 5 + 질문 20개 CTA ── */}
      <SectionGate show={show} id="faq">
        <section className="surface-0 section reveal">
          <div className="wrap grid lg:grid-cols-[1fr_1.4fr]" style={{ gap: "var(--s-7)" }}>
            <div>
              <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>자주 묻는 질문</p>
              <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>궁금한 것부터</h2>
              <Link href="/faq" className="btn btn-text" style={{ marginTop: "var(--s-3)" }}>전체 질문 보기 →</Link>
              <div style={{ marginTop: "var(--s-6)", background: "var(--green-50)", borderRadius: "var(--r-lg)", padding: "var(--s-5)" }}>
                <p className="t-h3">사장님이 답하기 좋은 질문 20개</p>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>
                  시작·경험·나만의·실적·최근손님 5가지 × 4. 홈페이지를 만들면 첫 질문과 함께 문자로 보내드립니다.
                </p>
                <Link href="/new" className="btn btn-secondary" style={{ marginTop: "var(--s-4)" }}>질문 20개 받기 (무료 시작)</Link>
              </div>
            </div>
            <FaqList items={FAQ_FEATURED} />
          </div>
        </section>
      </SectionGate>

      <SiteFooter />
    </main>
  );
}
