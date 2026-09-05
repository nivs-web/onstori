import type { Metadata } from "next";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "사업이야기 — 온스토리", description: "홈페이지는 있는데 손님이 없는 가게가 너무 많았습니다. 온스토리를 만든 이유." };

/** 사업이야기 — 레멘토 Our story 구조: 창업자 편지 → 이정표 → 원칙 (기획1 /mainplan #ourstory) */
export default function OurStory() {
  const milestones = [
    ["2026.08", "onstori.com 도메인 · 저장소 · 설계서 v1"],
    ["2026.08.31", "첫 고객 사이트가 DB에서 렌더링됨"],
    ["2026.09.01", "AI 생성 파이프라인 · 이미지뱅크 638장 · 에디터 · 카카오/이메일 로그인"],
    ["2026.09.04", "견적 문의 접수·알림 프로덕션 검증 · R2 저장소 전환"],
    ["2026.09.05", "'이야기 엔진'으로 전환 — 60초 녹화 · 6채널 · 레멘토 구조"],
    ["다음", "첫 사장님 10명 무료 14일 · 첫 60초 영상 · 첫 결제"],
  ];
  const principles = [
    ["사장님은 글을 쓰지 않는다.", "질문은 온스토리가, 대답은 말로."],
    ["없는 사실을 만들지 않는다.", "연차·건수·후기·별점을 지어내지 않는다."],
    ["사장님이 찍은 것이 우선이다.", "AI 사진은 빈자리를 채울 뿐이다."],
    ["전부 사장님 것이다.", "홈페이지·영상·기록은 해지해도 가져간다."],
    ["가격은 처음부터 공개한다.", "14일 무료, 이후 49,000원."],
  ];
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader current="/our-story" />
      <PageHero kicker="사업이야기" title={<>손님은 상품이 아니라<br />사람을 믿습니다.</>} sub="온스토리를 만든 이유를 편지로 적었습니다." />

      <section className="wrap pb-20">
        <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 sm:p-12" style={{ borderColor: "var(--line)" }}>
          <p className="font-display text-[20px]" style={{ color: "var(--forest)" }}>사장님께,</p>
          <div className="mt-5 space-y-5 text-[16px] leading-[1.9]" style={{ color: "var(--ink)" }}>
            <p>홈페이지를 만들어 드리는 일을 하면서 한 가지가 계속 걸렸습니다. 홈페이지는 있는데 손님이 없는 가게가 너무 많다는 것입니다. 사진은 예쁘고 문구도 그럴듯한데, 그 안에 사람이 없었습니다. 손님은 상품이 아니라 사람을 믿는데 말입니다.</p>
            <p>사장님들은 글을 쓰기 싫어하십니다. 시간이 없고, 뭘 써야 할지 모르겠고, 써 봤자 아무도 안 읽을 것 같으니까요. 그런데 말은 잘하십니다. 손님 앞에서, 전화로, 현장에서 매일 이야기를 하십니다. 그 말을 그대로 기록으로 바꿔 드리면 어떨까 — 온스토리는 거기서 시작했습니다.</p>
            <p>온스토리는 사장님께 글을 쓰라고 하지 않습니다. 질문을 드리고, 60초만 말씀해 달라고 합니다. 그 60초를 자막 영상과 글과 사진으로 만들어 유튜브·인스타·네이버·그리고 사장님 홈페이지에 쌓습니다. 3년 뒤에도 검색되는 사장님의 기록이 됩니다.</p>
            <p className="font-display text-[19px]" style={{ color: "var(--forest)" }}>홈페이지는 텅 빈 상가입니다. 스토리에는 진짜 사람이 있습니다. 사장님의 이야기부터 들려주세요.</p>
          </div>
          <p className="mt-8 text-[15px] font-semibold">— 온스토리 대표 권병철</p>
        </article>
      </section>

      <section style={{ background: "var(--forest)", color: "var(--cream)" }}>
        <div className="wrap py-20">
          <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">이정표</p>
          <h2 className="font-display mt-3 text-[30px] sm:text-[36px]">여기까지 왔습니다</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {milestones.map(([d, t]) => (
              <li key={d + t} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="text-[12px] font-bold tracking-[0.14em]" style={{ color: "var(--lime)" }}>{d}</p>
                <p className="mt-2 text-[15px] leading-relaxed">{t}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap py-20">
        <p className="text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>원칙 다섯</p>
        <h2 className="font-display mt-3 text-[30px] sm:text-[36px]">지키는 것</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {principles.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
              <span className="font-display text-[24px]" style={{ color: "var(--green)" }}>{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 text-[15.5px] font-extrabold" style={{ color: "var(--forest)" }}>{t}</p>
              <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--muted)" }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
