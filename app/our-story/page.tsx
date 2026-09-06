import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "온스토리", description: "홈페이지는 있는데 손님이 없는 가게가 너무 많았습니다. 온스토리를 만든 이유." };

/** 온스토리 — 레멘토 Our story 구조: 창업자 편지 → 이정표 → 비교표 → 원칙 (기획1 /mainplan #ourstory).
 * 2026-09-06: /compare 메뉴를 내리고 그 11행 비교표를 #compare 로 옮겨 왔다. */
/** 11행 비교표 — 2026-09-06 /compare 페이지에서 옮겨 왔다. 타사 화면·문구 복제 없음, 기능 개념만 비교. */
const COMPARE_ROWS = [
  ["만드는 데 걸리는 시간", "2~6주, 미팅 3~5회", "3분 (상호명·업종·색만)"],
  ["비용", "제작 50~300만원 + 유지비", "30일 무료 → 매달 49,000원"],
  ["만든 뒤", "끝. 수정은 건당 비용", "매주 질문 → 새 이야기가 쌓임"],
  ["사장님이 할 일", "원고·사진 준비, 검수, 수정 요청", "문자 링크 누르고 60초 말하기"],
  ["글쓰기", "사장님 또는 외주 작가", "없음 — 말하면 글이 됨"],
  ["영상", "별도 견적 (편당 30만원~)", "매주 자막 영상 포함"],
  ["SNS 발행", "없음", "쇼츠·릴스·쓰레드·X(트위터)·네이버(복붙)·홈페이지 6곳"],
  ["검색 노출", "등록은 해 주지만 새 페이지가 안 생김", "이야기마다 새 페이지 — 검색 면적이 늘어남"],
  ["사진", "스톡 사진", "사장님 사진 우선 + 업종별 이미지뱅크"],
  ["소유권", "업체 서버·업체 계정인 경우 많음", "홈페이지·영상·기록 전부 사장님 것"],
  ["해지", "위약금·자료 반출 어려움", "언제든, 자료 전부 반출"],
];

export default function OurStory() {
  const milestones = [
    ["2000.04", "닙스닷컴(nivs.com)으로 사업 시작 — 웹 에이전시 스타트업 · 인터넷 사업 컨설팅 전문"],
    ["2003.02", "일본 진출 — 다수의 웹 컨설팅 사업 진행"],
    ["2004.07", "한중일 문화 교류 '새누리' 온라인 컨설팅 및 팀장 근무 (1986년 시작한 문화 교류 매거진 · saenulee.com)"],
    ["2009.05", "한국 웹 컨설팅 100건 이상 · 일본 기업 웹사이트 개발 100건 이상 진행"],
    ["2021.09", "onstori 초기 모델 구상 — jmake 사업 구상 및 자동화 템플릿 홈페이지 제작 시작"],
    ["2026.08", "브랜드 마케팅 AI 플랫폼 온스토리 오픈 (onstori.com)"],
  ];
  const principles = [
    ["사장님은 글을 쓰지 않는다.", "질문은 온스토리가, 대답은 말로."],
    ["없는 사실을 만들지 않는다.", "연차·건수·후기·별점을 지어내지 않는다."],
    ["사장님이 찍은 것이 우선이다.", "AI 사진은 빈자리를 채울 뿐이다."],
    ["전부 사장님 것이다.", "홈페이지·영상·기록은 해지해도 가져간다."],
    ["가격은 처음부터 공개한다.", "30일 무료, 이후 매달 49,000원. 언제든 해지."],
  ];
  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader current="/our-story" />
      <PageHero kicker="온스토리" title={<>손님은 상품이 아니라<br />사람을 믿습니다.</>} sub="온스토리를 만든 이유를 편지로 적었습니다." />

      {/* ── 창업자 편지 ── */}
      <section className="surface-0 reveal" style={{ paddingBottom: "var(--s-8)" }}>
        <div className="wrap">
          <article className="card mx-auto" style={{ maxWidth: "48rem", padding: "var(--s-6)" }}>
            <p className="t-h3">사장님께,</p>
            <div className="t-body" style={{ marginTop: "var(--s-4)", color: "var(--n-700)" }}>
              <p>홈페이지를 만들어 드리는 일을 하면서 한 가지가 계속 걸렸습니다. 홈페이지는 있는데 손님이 없는 가게가 너무 많다는 것입니다. 사진은 예쁘고 문구도 그럴듯한데, 그 안에 사람이 없었습니다. 손님은 상품이 아니라 사람을 믿는데 말입니다.</p>
              <p style={{ marginTop: "var(--s-4)" }}>사장님들은 글을 쓰기 싫어하십니다. 시간이 없고, 뭘 써야 할지 모르겠고, 써 봤자 아무도 안 읽을 것 같으니까요. 그런데 말은 잘하십니다. 손님 앞에서, 전화로, 현장에서 매일 이야기를 하십니다. 그 말을 그대로 기록으로 바꿔 드리면 어떨까 — 온스토리는 거기서 시작했습니다.</p>
              <p style={{ marginTop: "var(--s-4)" }}>온스토리는 사장님께 글을 쓰라고 하지 않습니다. 질문을 드리고, 60초만 말씀해 달라고 합니다. 그 60초를 자막 영상과 글과 사진으로 만들어 유튜브·인스타·네이버·그리고 사장님 홈페이지에 쌓습니다. 3년 뒤에도 검색되는 사장님의 기록이 됩니다.</p>
              <p className="t-h3" style={{ marginTop: "var(--s-5)" }}>홈페이지는 빈 집입니다. 스토리에는 진짜 사람이 있습니다. 사장님의 이야기부터 들려주세요.</p>
            </div>
            <p className="t-small font-semibold" style={{ marginTop: "var(--s-6)" }}>— 온스토리 대표 권병철</p>
          </article>
        </div>
      </section>

      {/* ── 이정표 ── */}
      <section className="surface-900 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>이정표</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>여기까지 왔습니다</h2>
          <ol className="grid md:grid-cols-3" style={{ marginTop: "var(--s-7)", gap: "var(--s-4)" }}>
            {milestones.map(([d, t]) => (
              <li key={d + t} style={{ background: "var(--n-800)", borderRadius: "var(--r-lg)", padding: "var(--s-5)" }}>
                <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>{d}</p>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--n-300)" }}>{t}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 11행 비교표 ── 폰에서는 표가 자기 안에서 스크롤하고 첫 열이 고정된다 */}
      <section id="compare" className="surface-0 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>비교</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>홈페이지 제작업체 vs 온스토리</h2>
          <p className="t-body measure" style={{ marginTop: "var(--s-3)", color: "var(--n-600)" }}>
            홈페이지 제작이 아닙니다. 사업이 굴러가게 만듭니다. 일반 제작업체와 온스토리를 11가지로 정직하게 비교했습니다.
          </p>
          <div className="table-scroll card" style={{ marginTop: "var(--s-6)" }}>
            <table className="t-small w-full">
              <thead>
                <tr style={{ background: "var(--n-50)" }}>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-500)" }}>항목</th>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-500)" }}>일반 홈페이지 제작업체</th>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--green-700)" }}>온스토리</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([k, a, b]) => (
                  <tr key={k} style={{ borderTop: "1px solid var(--n-200)" }}>
                    <td className="font-semibold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-900)" }}>{k}</td>
                    <td style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-600)" }}>{a}</td>
                    <td className="font-semibold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-900)" }}>
                      <span style={{ marginRight: "var(--s-1)", color: "var(--green-700)" }}>✓</span>{b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="surface-900 text-center" style={{ marginTop: "var(--s-6)", borderRadius: "var(--r-lg)", padding: "var(--s-6)" }}>
            <p className="t-h2">제작업체는 홈페이지를 줍니다.<br />온스토리는 손님을 부릅니다.</p>
            <div style={{ marginTop: "var(--s-5)" }}>
              <Link href="/new" className="btn btn-primary">30일 무료로 시작</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 원칙 다섯 ── */}
      <section className="surface-50 section reveal">
        <div className="wrap">
          <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>원칙 다섯</p>
          <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>지키는 것</h2>
          <ol className="grid md:grid-cols-5" style={{ marginTop: "var(--s-6)", gap: "var(--s-4)" }}>
            {principles.map(([t, d], i) => (
              <li key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <span className="t-h3" style={{ fontFamily: "var(--font-display)", color: "var(--green-700)" }}>{String(i + 1).padStart(2, "0")}</span>
                <p className="t-body font-bold" style={{ marginTop: "var(--s-2)", color: "var(--n-900)" }}>{t}</p>
                <p className="t-body" style={{ marginTop: "var(--s-1)", color: "var(--n-600)" }}>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
      <SiteFooter />
    </main>
  );
}
