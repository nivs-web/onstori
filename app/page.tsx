import Link from "next/link";
import { Portfolio, loadShowcase } from "@/components/portfolio";
import { PhoneFrame } from "@/components/phone-frame";
import { PromoBar, SiteHeader, SiteFooter } from "@/components/site/chrome";
import { ChannelStrip, RecMockup, SpeechToStory, CompareCallout, FaqList } from "@/components/site/blocks";
import { QuestionShuffle } from "@/components/site/question-shuffle";
import { FAQ_FEATURED } from "@/config/faq";

export const dynamic = "force-dynamic"; // 쇼케이스 즉시 반영

/**
 * 본사 첫 페이지 v3 — 레멘토(remento.co) 홈 구조 1:1, 내용은 온스토리 (기획1 /mainplan #sections · 2026-09-05)
 * 기존 섹션(포트폴리오·3단계·차별점·가격 밴드)은 버리지 않고 자리만 잡았다 — 지울지는 회장님 결정.
 */
export default async function Home() {
  const items = await loadShowcase();
  const heroSite = items.find((i) => i.featured) ?? items[0];

  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader />

      {/* ── 2. 히어로 (확정 카피) ── */}
      <section className="wrap grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1.3fr_1fr] lg:gap-8 lg:pt-20">
        <div className="max-w-[660px]">
          <h1 className="font-display text-[34px] leading-[1.18] sm:text-[44px] lg:text-[48px]" style={{ textWrap: "balance" }}>
            홈페이지는 텅 빈 상가입니다.<br />스토리에는 <span style={{ color: "var(--green)" }}>진짜 사람</span>이 있습니다.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed sm:text-[19px]" style={{ color: "var(--muted)" }}>
            사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다. 온스토리.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-[13.5px] font-semibold" aria-label="세 가지 약속">
            {[["✎", "글쓰기 금지"], ["🔗", "문자 링크만 누르세요 (카톡 로그인)"], ["⤓", "다운로드 없음"]].map(([i, t]) => (
              <li key={t} className="flex items-center gap-2 rounded-full border bg-white px-3.5 py-2" style={{ borderColor: "var(--line)" }}>
                <span aria-hidden>{i}</span>{t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/new" className="btn-lime !px-8 !py-4 !text-[16px]">녹화를 시도해보세요 · 60초면 됩니다</Link>
            <Link href="/how-it-works" className="text-[14.5px] font-semibold underline underline-offset-4" style={{ color: "var(--forest)" }}>작동방식 보기 →</Link>
          </div>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
            {[["100개", "질문 은행"], ["6곳", "퍼지는 채널"], ["14일", "전 기능 무료"]].map(([v, k]) => (
              <div key={k} className="rounded-2xl border bg-white px-2 py-3" style={{ borderColor: "var(--line)" }}>
                <dd className="font-display text-[22px]" style={{ color: "var(--forest)" }}>{v}</dd>
                <dt className="text-[12px]" style={{ color: "var(--muted)" }}>{k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative mx-auto hidden items-end gap-4 lg:flex">
          {heroSite && (
            <figure className="relative">
              <PhoneFrame slug={heroSite.slug} scale={0.6} title={heroSite.name} />
              <figcaption className="absolute -left-6 top-8 rounded-full px-3.5 py-2 text-[12px] font-bold shadow-lg" style={{ background: "var(--forest)", color: "var(--cream)" }}>
                실제 작동 중 · 스크롤해보세요 👆
              </figcaption>
            </figure>
          )}
          <div className="-ml-16 mb-10 scale-[.78] origin-bottom-left"><RecMockup /></div>
        </div>
      </section>

      {/* ── 3. 채널 띠 ── */}
      <ChannelStrip />

      {/* ── 4. 약속 4개 (레멘토 유명인 인용 자리) ── */}
      <section className="wrap py-16">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["60초만 말하세요.", "나머지는 온스토리가 합니다."],
            ["질문은 저희가 드립니다.", "사장님은 대답만."],
            ["얼굴이 안 나와도 됩니다.", "목소리면 충분합니다."],
            ["3년 뒤에도 검색되는 영상,", "오늘 60초."],
          ].map(([a, b]) => (
            <blockquote key={a} className="rounded-2xl border-l-4 bg-white p-5" style={{ borderColor: "var(--lime)" }}>
              <p className="font-display text-[19px] leading-snug" style={{ color: "var(--forest)" }}>{a}</p>
              <p className="mt-1 text-[14.5px]" style={{ color: "var(--muted)" }}>{b}</p>
            </blockquote>
          ))}
        </div>
      </section>

      {/* ── 5. 온스토리란 ── */}
      <section className="wrap pb-16">
        <div className="grid items-start gap-10 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>온스토리란</p>
            <h2 className="font-display mt-3 text-[30px] leading-tight sm:text-[38px]">사장님의 60초를<br />홈페이지·영상·글로 바꾸는<br />이야기 엔진입니다.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["홈페이지", "상호명과 업종만 고르면 3분 만에 onstori.com/사장님가게 가 생깁니다. 이야기가 쌓일수록 페이지가 두꺼워집니다."],
              ["60초 영상", "매주 질문 하나에 60초. 무음 컷·한글 자막·세로/가로 두 판. 얼굴이 싫으면 목소리만."],
              ["6곳 발행", "유튜브 쇼츠·인스타 릴스·쓰레드·X·네이버 블로그(복사 30초)·온스토리 블로그. 하루 최대 3건."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-5" style={{ boxShadow: "0 1px 0 var(--line)" }}>
                <h3 className="text-[17px] font-extrabold" style={{ color: "var(--forest)" }}>{t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. 작동방식 4단계 ── */}
      <section style={{ background: "var(--forest)", color: "var(--cream)" }}>
        <div className="wrap py-20">
          <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">이렇게 작동합니다</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">사장님이 할 일은 60초뿐입니다</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              ["문자로 질문이 옵니다", "매주 질문 4개 중 하나. 마음에 안 들면 [랜덤 질문 바꾸기]."],
              ["링크 누르고 60초", "크롬이 열리고 3·2·1. 앱 설치도, 글쓰기도 없습니다."],
              ["온스토리가 만듭니다", "30분 안에 자막 영상 · 다듬은 글 3종 · 사진 카드."],
              ["6곳에 퍼지고 쌓입니다", "쇼츠·릴스·쓰레드·X·네이버·홈페이지. 검색 면적이 늘어납니다."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <span className="font-display text-[26px]" style={{ color: "var(--lime)" }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-[17px] font-bold">{t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed opacity-80">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8"><Link href="/how-it-works" className="btn-lime">작동방식 자세히 →</Link></div>
        </div>
      </section>

      {/* ── 7. (기존) 포트폴리오 밴드 — 쇼케이스가 등록돼 있을 때만 ── */}
      {items.length > 0 && (
        <div className="border-y bg-white" style={{ borderColor: "var(--line)" }}>
          <div className="wrap py-20">
            <Portfolio items={items} />
          </div>
        </div>
      )}

      {/* ── 8. 창업자 편지 ── */}
      <section className="wrap py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 sm:p-12" style={{ borderColor: "var(--line)" }}>
          <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>왜 온스토리를 만들었나</p>
          <p className="font-display mt-4 text-[22px] leading-relaxed sm:text-[25px]" style={{ color: "var(--forest)" }}>
            홈페이지는 있는데 손님이 없는 가게가 너무 많았습니다. 사진은 예쁘고 문구도 그럴듯한데, 그 안에 사람이 없었습니다. 손님은 상품이 아니라 사람을 믿는데 말입니다.
          </p>
          <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            사장님들은 글을 쓰기 싫어하십니다. 그런데 말은 잘하십니다. 손님 앞에서, 전화로, 현장에서 매일 이야기를 하십니다. 그 말을 그대로 기록으로 바꿔 드리면 어떨까 — 온스토리는 거기서 시작했습니다.
          </p>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[14px] font-semibold">— 온스토리 대표 권병철</span>
            <Link href="/our-story" className="text-[14px] font-semibold underline underline-offset-4" style={{ color: "var(--forest)" }}>사업이야기 전문 →</Link>
          </div>
        </div>
      </section>

      {/* ── 9. 스토리 페이지 들여다보기 (Inside our books) ── */}
      <section id="inside" style={{ background: "var(--cream-2)" }}>
        <div className="wrap py-20">
          <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>스토리 페이지 들여다보기</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">60초 하나가 네 가지 모양이 됩니다</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              ["스토리 페이지", "720px", "제목 · 날짜 · 영상 · 다듬은 글 · 사진 3장. 검색의 본진.", "aspect-[3/4]"],
              ["가로 영상", "1440 × 810", "홈페이지 · 유튜브. 한글 어절 자막.", "aspect-video"],
              ["세로 영상", "1080 × 1920", "쇼츠 · 릴스. 60초 규격.", "aspect-[9/16]"],
              ["스토리 카드", "464 × 464", "인스타 · 쓰레드 사진. 질문 + 한 줄 답.", "aspect-square"],
            ].map(([t, size, d, ratio]) => (
              <div key={t} className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
                <div className={`${ratio} w-full rounded-xl`} style={{ background: "linear-gradient(160deg,#2C4A42,#1E332D)" }} aria-hidden>
                  <div className="flex h-full flex-col justify-end p-3 text-[11px] text-white/80">
                    <span className="rounded bg-white/90 px-2 py-1 font-semibold" style={{ color: "var(--forest)" }}>&ldquo;처음엔 안 하려고 했어요&rdquo;</span>
                  </div>
                </div>
                <p className="mt-3 text-[15px] font-extrabold" style={{ color: "var(--forest)" }}>{t} <span className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{size}</span></p>
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px]" style={{ color: "var(--muted)" }}>직접 찍은 사진으로 넣으시면 이야기에 신뢰가 쌓입니다. 사진이 없을 땐 업종별 이미지뱅크가 빈자리를 채웁니다.</p>
        </div>
      </section>

      {/* ── 10. 정회원 카드 (Best-seller) + 11. 사장님 것 ── */}
      <section id="pricing" className="wrap py-20">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl p-8 sm:p-10" style={{ background: "var(--forest)", color: "var(--cream)" }}>
            <p className="inline-block rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "var(--lime)", color: "var(--forest)" }}>가장 많이 선택</p>
            <h2 className="font-display mt-4 text-[30px] sm:text-[36px]">정회원 49,000<span className="text-[20px]">원</span></h2>
            <p className="mt-2 text-[14.5px] opacity-80">14일 동안 전 기능 무료로 써 보시고, 14일 안에 결제하시면 홈페이지가 계속 유지됩니다.</p>
            <ul className="mt-6 grid gap-2 text-[14.5px] sm:grid-cols-2">
              {["onstori.com/사장님가게 홈페이지", "매주 질문 문자 + 60초 녹화 링크", "자막 영상 세로·가로 두 판", "다듬은 글 3종 + 사진 카드", "쇼츠·릴스·쓰레드·네이버·홈페이지 발행", "견적·문의 알림 (문자·이메일)"].map((t) => (
                <li key={t} className="flex gap-2"><span style={{ color: "var(--lime)" }}>✓</span>{t}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/new" className="btn-lime">14일 무료로 시작</Link>
              <span className="text-[13px] opacity-70">14일 이후 자동 삭제 · 결제 뒤 언제든 해지</span>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>전부 사장님 것입니다</p>
            <div className="mt-4 grid gap-3">
              {[
                ["홈페이지", "onstori.com/사장님가게. 검색 등록까지 온스토리가 준비합니다."],
                ["영상", "자막 영상 원본·가로·세로 전부 사장님 파일입니다. 해지해도 가져갑니다."],
                ["이야기 기록", "3년 뒤에도 검색되는 사장님의 기록. 원문은 항상 보관됩니다."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
                  <h3 className="text-[16px] font-extrabold" style={{ color: "var(--forest)" }}>{t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 12. (기존) 3단계 — 문구만 60초로 ── */}
      <section className="wrap pb-20">
        <h2 className="font-display text-[28px] sm:text-[34px]">사장님이 할 일은 60초뿐입니다</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["상호명·업종 고르기", "3분이면 홈페이지 뼈대가 완성됩니다. 사진 10장이 있으면 더 좋고, 없어도 됩니다."],
            ["문자 링크 누르고 60초", "매주 질문 하나. 크롬에서 열고 말씀만 하세요."],
            ["이야기만 쌓기", "영상·글·사진 카드가 6곳에 퍼지고 홈페이지에 쌓입니다. 그게 시공 사례가 되고 문의가 됩니다."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border bg-white p-6" style={{ borderColor: "var(--line)" }}>
              <span className="text-[13px] font-extrabold" style={{ color: "var(--green)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-[17px] font-bold">{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 13. 60초 녹화 데모 (Shark Tank 자리) ── */}
      <section style={{ background: "var(--forest)", color: "var(--cream)" }}>
        <div className="wrap grid items-center gap-10 py-20 md:grid-cols-[1fr_auto_auto]">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">녹화 화면 미리보기</p>
            <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">녹화를 시도해보세요.<br />60초 정도 걸립니다.</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed opacity-80">
              문자로 온 링크를 크롬에서 열면 이 화면이 뜹니다. 질문을 고르고, 3·2·1, 말씀하시고, 보내기. 카카오톡 안에서 열렸다면 &ldquo;크롬으로 열기&rdquo; 한 번만 눌러 주세요.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-[13px] font-semibold">
              {["✎ 글쓰기 금지", "🔗 로그인 = 링크 열기", "⤓ 앱 설치 없음"].map((t) => <li key={t} className="rounded-full border border-white/25 px-3 py-1.5">{t}</li>)}
            </ul>
            <Link href="/new" className="btn-lime mt-8">지금 시작하기</Link>
          </div>
          <RecMockup state="ask" />
          <RecMockup state="rec" />
        </div>
      </section>

      {/* ── 14. (기존) 차별점 + 이런 사장님께 ── */}
      <section className="wrap py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["기록이 영업합니다", "작업 사진과 이야기가 타임라인으로 쌓여, 문의 전에 신뢰부터 만듭니다. “작업 기록 127건”은 말이 아니라 기록으로 증명됩니다."],
            ["검색에 잡히는 구조", "이야기마다 새 페이지가 생기고, 네이버·구글 검색 등록까지 온스토리가 준비합니다. 별도 설정도, 추가 비용도 없습니다."],
            ["사장님 목소리 그대로", "AI 아바타·AI 목소리는 쓰지 않습니다. 사장님이 찍고 말한 영상에 자막과 컷 편집만 합니다. 그래야 손님도, 유튜브도 믿습니다."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl p-6" style={{ background: "var(--accent-soft)" }}>
              <h3 className="text-[16.5px] font-bold" style={{ color: "var(--forest)" }}>{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>이런 사장님께 (아직 후기가 아닙니다 — 첫 14일을 써 보신 사장님의 이야기를 기다립니다)</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["홈페이지는 있는데 손님이 없는 사장님", "만든 지 1년, 방문자 하루 3명. 새 페이지가 안 생기니 검색도 안 됩니다."],
            ["글은 못 쓰지만 말은 잘하는 사장님", "블로그 쓰라는 말은 많이 들었는데 한 번도 못 썼습니다. 말은 매일 합니다."],
            ["유튜브를 시작하고 싶은데 편집이 무서운 사장님", "60초 찍으면 자막과 컷 편집은 온스토리가 합니다."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-[15.5px] font-bold" style={{ color: "var(--forest)" }}>{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 15. 말→글 ── */}
      <section style={{ background: "var(--cream-2)" }}>
        <div className="wrap py-20">
          <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>말하면 글이 됩니다</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[38px]">사장님이 말한 그대로, 그리고 다듬어서</h2>
          <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "var(--muted)" }}>입력에 없는 연차·건수·자격은 절대 만들지 않습니다. 사장님이 말한 숫자만 씁니다.</p>
          <div className="mt-8"><SpeechToStory /></div>
        </div>
      </section>

      {/* ── 16. 질문 위젯 ── */}
      <section style={{ background: "var(--forest)" }}>
        <div className="wrap py-20"><QuestionShuffle dark /></div>
      </section>

      {/* ── 17. 비교 콜아웃 ── */}
      <CompareCallout />

      {/* ── 18. 스토리 예시 3 ── */}
      <section className="wrap pb-20">
        <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>이런 이야기가 됩니다 (예시)</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ["시작이야기", "처음엔 안 하려고 했어요", "아버지가 도배를 하셨습니다. 군대를 다녀와 따라다니기 시작했는데, 그게 벌써 12년이 됐습니다."],
            ["경험이야기", "새벽 2시에 끝난 누수 공사", "윗집 누수로 아랫집 천장이 젖고 있었습니다. 밤이었지만 다음 날 아침이면 늦는다고 판단했습니다."],
            ["최근손님이야기", "세 번째 오신 손님", "처음엔 소개로, 두 번째는 이사 가서, 이번엔 부모님 집. 사진을 찍어 가시더라고요."],
          ].map(([c, t, d]) => (
            <article key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
              <span className="text-[11px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>{c}</span>
              <h3 className="font-display mt-2 text-[19px]" style={{ color: "var(--forest)" }}>{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
              <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>예시 문장 · 실제 사장님 이야기가 아닙니다</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── 19. 14일 흐름 + (기존) 가격 다크 밴드 ── */}
      <section style={{ background: "var(--band)" }} className="text-white">
        <div className="wrap py-20 text-center">
          <h2 className="font-display text-[28px] sm:text-[36px]" style={{ textWrap: "balance" }}>따로 견적 없이, 처음부터 공개합니다</h2>
          <ol className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {[["오늘", "3분 만에 홈페이지. 14일 전 기능 무료."], ["14일 안에", "정회원 49,000원 결제 → 홈페이지 계속 유지."], ["14일 이후", "결제하지 않으면 자동 삭제. 삭제 전 문자 두 번."]].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="text-[12px] font-bold tracking-[0.14em]" style={{ color: "var(--lime)" }}>{t}</p>
                <p className="mt-1.5 text-[14.5px] text-white/85">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[34px] font-extrabold sm:text-[40px]">정회원 49,000<span className="text-[20px] font-bold">원</span></p>
          <p className="mt-3 text-[14.5px] text-white/60">호스팅 · 네이버/구글 검색 등록 · 수정 무제한 · 이야기 무제한 · 6채널 발행 포함</p>
          <div className="mt-9">
            <Link href="/new" className="inline-block rounded-full bg-white px-8 py-4 text-[16px] font-bold" style={{ color: "var(--band)" }}>무료로 만들어보기 →</Link>
          </div>
        </div>
      </section>

      {/* ── 20. FAQ 5 + 질문 20개 CTA ── */}
      <section className="wrap py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>자주 묻는 질문</p>
            <h2 className="font-display mt-3 text-[30px]">궁금한 것부터</h2>
            <Link href="/faq" className="mt-4 inline-block text-[14px] font-semibold underline underline-offset-4" style={{ color: "var(--forest)" }}>전체 질문 보기 →</Link>
            <div className="mt-8 rounded-2xl p-6" style={{ background: "var(--lime)", color: "var(--forest)" }}>
              <p className="font-display text-[20px]">사장님이 답하기 좋은 질문 20개</p>
              <p className="mt-1 text-[13.5px] opacity-80">시작·경험·나만의·실적·최근손님 5가지 × 4. 홈페이지를 만들면 첫 질문과 함께 문자로 보내드립니다.</p>
              <Link href="/new" className="btn-forest mt-4 !py-2.5 !text-[14px]">질문 20개 받기 (무료 시작)</Link>
            </div>
          </div>
          <FaqList items={FAQ_FEATURED} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
