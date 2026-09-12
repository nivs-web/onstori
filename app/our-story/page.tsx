import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";
import { BIZ } from "@/config/company";
import { COPY } from "@/lib/trial";
import { CHANNELS_LINE_MARKED, LIVE_COUNT, KEEP_AFTER_CANCEL } from "@/config/channels";

export const metadata: Metadata = { title: "온스토리", description: "홈페이지는 있는데 손님이 없는 가게가 너무 많았습니다. 온스토리를 만든 이유." };

/** 온스토리 — 레멘토 Our story 구조: 창업자 편지 → 이정표 → 비교표 → 원칙 (기획1 /mainplan #ourstory).
 * 2026-09-06: /compare 메뉴를 내리고 그 11행 비교표를 #compare 로 옮겨 왔다. */
/** 11행 비교표 — 2026-09-06 /compare 페이지에서 옮겨 왔다. 타사 화면·문구 복제 없음, 기능 개념만 비교. */
const COMPARE_ROWS = [
  ["만드는 데 걸리는 시간", "2~6주, 미팅 3~5회", "3분 (상호명·업종·색만)"],
  ["비용", "제작 50~300만원 + 유지비", `30일 무료 → ${COPY.priceLine}`],
  ["만든 뒤", "끝. 수정은 건당 비용", "매주 질문 → 새 이야기가 쌓임"],
  ["사장님이 할 일", "원고·사진 준비, 검수, 수정 요청", "문자 링크 누르고 60초 말하기"],
  ["글쓰기", "사장님 또는 외주 작가", "없음 — 말하면 글이 됨"],
  ["영상", "별도 견적 (편당 30만원~)", "매주 자막 영상 포함"],
  /* ★ 비교표에서 「6곳」만 적으면 제작업체와의 차이를 부풀린 것이 된다 (2026-09-13) */
  ["SNS 발행", "없음", `${CHANNELS_LINE_MARKED} — 지금 ${LIVE_COUNT}곳`],
  ["검색 노출", "등록은 해 주지만 새 페이지가 안 생김", "이야기마다 새 페이지 — 검색 면적이 늘어남"],
  ["사진", "스톡 사진", "사장님 사진 우선 + 업종별 이미지뱅크"],
  ["소유권", "업체 서버·업체 계정인 경우 많음", "홈페이지·영상·기록 전부 사장님 것"],
  ["해지", "위약금·자료 반출 어려움", "언제든, 자료 전부 반출"],
];

/** 편지 마무리 — 빈 줄이 곧 호흡이라 문자열로 두고 white-space: pre-line 으로 살린다 */
const CLOSING = `홈페이지는 빈 집입니다.
이야기에는 사람이 있습니다.

진짜 사람들이 모여서
진짜 이야기를 나누는
그런 집을 만들고 싶습니다.

사장님의 이야기를 들려주세요.`;

export default function OurStory() {
  const milestones = [
    ["2000.04", "닙스닷컴(nivs.com)으로 사업 시작 — 웹 에이전시 스타트업 · 인터넷 사업 컨설팅 전문"],
    ["2003.02", "사업 확장 및 일본 도쿄 진출 — 도쿄에서 다수의 웹 컨설팅 및 웹사이트 개발 진행"],
    ["2004.07", "한중일 문화 교류 '새누리' 온라인 컨설팅 및 팀장 근무 (1986년 시작한 문화 교류 매거진 · saenulee.com)"],
    ["2009.05", "한국 웹 컨설팅 100건 이상 · 일본 기업 웹사이트 개발 100건 이상 진행"],
    ["2021.09", "onstori 초기 모델 구상 — jmake 사업 구상 및 자동화 템플릿 홈페이지 제작 시작"],
    ["2026.08", "브랜드 마케팅 AI 플랫폼 온스토리 오픈 (onstori.com)"],
  ];
  const principles = [
    ["사장님은 글을 쓰지 않는다.", "질문은 온스토리가, 대답은 말로."],
    ["없는 사실을 만들지 않는다.", "연차·건수·후기·별점을 지어내지 않는다."],
    ["사장님이 찍은 것이 우선이다.", "AI 사진은 빈자리를 채울 뿐이다."],
    ["전부 사장님 것이다.", KEEP_AFTER_CANCEL],
    ["가격은 처음부터 공개한다.", `30일 무료, 이후 ${COPY.priceLine}. 언제든 해지.`],
  ];
  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader current="/our-story" />
      <PageHero kicker="온스토리" title={<>손님은 상품이 아니라<br />사람을 믿습니다.</>} sub="온스토리를 만든 이유를 편지로 적었습니다." />

      {/* ── 창업자 편지 ──
          레이아웃은 레멘토의 창업자 편지 구조를 참고했다(규칙 11). 사진은 가로가 아니라 세로다.
          PC 는 2단(왼쪽 사진이 sticky 로 따라옴), 태블릿·폰은 사진이 위·글이 아래.
          ⚠ 명조를 쓰지 않는다 — Pretendard 를 크게·넓게 써서 같은 인상을 낸다(app/globals.css .letter). */}
      <section className="surface-50 section reveal">
        <div className="wrap letter-grid">
          <figure className="letter-photo" style={{ margin: 0 }}>
            <Image
              src="/brand/founder.webp"
              alt="온스토리 대표 권병철"
              width={1000}
              height={1250}
              sizes="(min-width: 1024px) 42vw, 336px"
              quality={78}
            />
          </figure>

          <article className="letter">
            <h2 className="letter-title">친형 같던 형님이 가게를 접던 날</h2>

            <p>그 형님이 그러셨습니다.</p>

            <p className="letter-quote">&ldquo;물건이 밀린 게 아니라, 내가 못 알린 거지.&rdquo;</p>

            <p>
              제 주변에는 장사하는 사람이 많았습니다.<br />
              친척도, 동네 형님도. 다들 물건 하나는 자신 있었습니다.<br />
              그런데 하나씩 밀려났습니다.
            </p>

            <p>
              홍보도 돈이 있어야 하는 것이었습니다.<br />
              대기업은 돈으로 광고를 샀고,<br />
              사장님들은 그 앞에서 조용했습니다.
            </p>

            <p>
              저는 26년째 홈페이지를 만들어 왔습니다.<br />
              사진은 예쁘고 문구도 그럴듯한데, 그 안에 사람이 없었습니다.<br />
              손님은 상품이 아니라 사람을 믿는데 말입니다.
            </p>

            <p>
              사장님들은 글을 쓰지 않으십니다. 시간이 없고,<br />
              뭘 써야 할지 모르시니까요.<br />
              그런데 말씀은 정말 잘하십니다.<br />
              손님 앞에서, 전화로, 현장에서 매일 하십니다.<br />
              그 말이 사라지지 않게만 하면 되는 일이었습니다.
            </p>

            <p>
              온스토리는 글을 쓰라고 하지 않습니다.<br />
              질문을 드리고, 60초만 말씀해 달라고 합니다.<br />
              그 60초가 영상이 되고 글이 되어,<br />
              홈페이지에 쌓이고 인스타와 유튜브로 퍼집니다.
            </p>

            <p className="letter-emph" style={{ marginTop: "1.6em" }}>
              대기업은 돈으로 광고를 삽니다.<br />
              사장님께는 돈으로 살 수 없는 이야기가 있습니다.
            </p>

            {/* 마무리 — 문단이 아니라 선언. 안쪽 빈 줄을 white-space: pre-line 으로 그대로 살린다 */}
            <p className="letter-close">{CLOSING}</p>

            {/* 서명 — 2026-09-07 회장님 지시.
                · 서명 이미지를 크게(높이 86px). 손으로 쓴 이름이 곧 이름이다.
                · 이름을 따로 적지 않는다 — 서명에 이미 들어 있다.
                · 가운데 정렬이 아니라 **왼쪽 글 흐름에 맞춘다**(편지니까). */}
            <div className="letter-sign">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/signature.png" alt={`${BIZ.ceo} 서명`} width={104} height={86} style={{ height: 86, width: "auto" }} />
              <p style={{ marginTop: "var(--s-4)", fontSize: 17, color: "var(--text)", lineHeight: 1.5 }}>
                {/* 상호는 config/company.ts 가 단일 출처다 — 법무 페이지·푸터와 같은 값을 쓴다 */}
                {BIZ.name}(온스토리 운영사) 대표이사
              </p>
            </div>
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
          <p className="t-body measure" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>
            홈페이지 제작이 아닙니다. 사업이 굴러가게 만듭니다. 일반 제작업체와 온스토리를 11가지로 정직하게 비교했습니다.
          </p>
          <div className="table-scroll card" style={{ marginTop: "var(--s-6)" }}>
            <table className="t-small w-full">
              <thead>
                <tr style={{ background: "var(--n-50)" }}>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--text-soft)" }}>항목</th>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--text-soft)" }}>일반 홈페이지 제작업체</th>
                  <th className="t-caption text-left font-bold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--green-700)" }}>온스토리</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([k, a, b]) => (
                  <tr key={k} style={{ borderTop: "1px solid var(--n-200)" }}>
                    <td className="font-semibold" style={{ padding: "var(--s-4) var(--s-5)", color: "var(--n-900)" }}>{k}</td>
                    <td style={{ padding: "var(--s-4) var(--s-5)", color: "var(--text)" }}>{a}</td>
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
                <p className="t-body" style={{ marginTop: "var(--s-1)", color: "var(--text)" }}>{d}</p>
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
