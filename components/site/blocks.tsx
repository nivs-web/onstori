import Link from "next/link";
import type { FaqItem } from "@/config/faq";
import { CHANNELS, CHANNEL_COUNT, LIVE_COUNT } from "@/config/channels";


/* 본사 페이지 공용 블록 — 색·간격·글자는 app/globals.css 토큰만 쓴다 (docs/DESIGN.md). */

/** 자주 묻는 질문 아코디언 — JS 없이 details/summary */
export function FaqList({ items, id }: { items: FaqItem[]; id?: string }) {
  return (
    <div id={id} className="card divide-y" style={{ borderColor: "var(--n-200)" }}>
      {items.map((it) => (
        <details key={it.q} className="faq" style={{ padding: "var(--s-4) var(--s-5)" }}>
          <summary
            className="t-body flex items-center justify-between font-semibold"
            style={{ gap: "var(--s-4)", minHeight: "var(--tap)", color: "var(--n-900)" }}
          >
            {it.q}
            <span className="plusminus" style={{ color: "var(--green-700)" }} aria-hidden />
          </summary>
          <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * 채널 띠 — **글자만.** 로고를 쓰지 않는다. (2026-09-11)
 *
 * ★★ 유튜브 브랜드 규칙: 로고를 쓰면 **반드시 유튜브로 가는 링크**여야 하고,
 *   **우리 앱 이름 옆에 나란히 두면 안 된다.** 전에는 로고가 `<span>` 안에 있어
 *   링크가 아니었고(규칙 위반), 우리 서비스 이름과 같은 띠에 놓여 있었다.
 * ★ 다른 SNS 도 같은 부류의 규칙이 있다(메타·틱톡 모두 «허가 없이 나란히 두어
 *   제휴처럼 보이게 하지 말 것»을 요구한다). **가장 안전한 것은 로고를 안 쓰는 것**이라
 *   여섯 곳 전부 글자로만 적는다. 로고를 되살리려면 각 사 브랜드 가이드를 먼저 확인해야 한다.
 */
/* ★ 띠에 나열된 여섯 개가 **똑같이 되는 것처럼** 보였다 (2026-09-13 박팀장 지적).
   제목에 «지금 몇 곳»을 적고, 아래 목록은 안 되는 곳을 흐리게 + (준비 중) 으로 구분한다. */
export function ChannelStrip({ title = `한 번 말하면 ${CHANNEL_COUNT}곳에 퍼지는 자동화 엔진 — 지금 ${LIVE_COUNT}곳` }: { title?: string }) {
  return (
    <section className="surface-50" style={{ borderBlock: "1px solid var(--n-200)" }}>
      <div
        className="wrap flex flex-wrap items-center justify-center"
        style={{ columnGap: "var(--s-6)", rowGap: "var(--s-3)", paddingBlock: "var(--s-5)" }}
      >
        <span className="t-caption font-bold" style={{ color: "var(--text-soft)", letterSpacing: "var(--tracking-kicker)" }}>{title}</span>
        {CHANNELS.map((c) => (
          <span
            key={c.id}
            className="t-small flex items-center font-bold"
            style={{ gap: "var(--s-2)", color: "var(--n-800)" }}
          >
            {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}

/** 60초 녹화 화면 목업 — 히어로 옆·데모 섹션·작동방식에서 재사용 (정적) */
export function RecMockup({ question = "이 일을 처음 시작하던 날, 무엇이 가장 두려웠나요?", state = "rec" }: { question?: string; state?: "rec" | "done" | "ask" }) {
  return (
    /* 폰 껍데기는 공용 부품(.phone-frame)을 쓴다 — 규격을 여기서 따로 정하지 않는다.
       전에는 여기만 border-radius: var(--r-lg) 라 히어로 폰보다 각져 장난감처럼 보였다. */
    <div className="phone-frame mx-auto" style={{ width: 280 }} aria-label="60초 녹화 화면 예시">
      <div className="phone-screen relative overflow-hidden" style={{ aspectRatio: "268 / 540", background: "var(--n-800)" }}>
        {/* 주소창 — 포트폴리오 카드에서 뺀 그 디자인을 여기서 쓴다(2026-09-07 회장님).
            여기서는 "브라우저에서 열린다"는 것이 바로 하려는 말이라 잘 어울린다.
            ⚠ 「크롬」 글자는 뺐다 — 아이폰 사용자는 크롬을 안 쓴다. */}
        <div className="absolute inset-x-0 top-0" style={{ padding: "var(--s-3) var(--s-3) 0" }}>
          <span className="tcard-url" style={{ height: 22 }}>onstori.com/rec</span>
        </div>
        {state === "ask" ? (
          <div className="absolute" style={{ insetInline: "var(--s-4)", top: "var(--s-7)" }}>
            <p className="t-caption font-bold" style={{ color: "var(--text-soft)", letterSpacing: "var(--tracking-kicker)" }}>오늘의 질문</p>
            {[question, "가장 힘들었던 작업은 무엇이었나요?", "이번 주 손님 한 분 이야기", "우리만 고집하는 게 있다면?"].map((t, i) => (
              <div
                key={i}
                className="t-caption"
                style={{
                  marginTop: "var(--s-2)", borderRadius: "var(--r-sm)", padding: "var(--s-2) var(--s-3)",
                  background: i === 0 ? "var(--n-0)" : "var(--n-700)",
                  color: i === 0 ? "var(--n-900)" : "var(--n-200)",
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >
                {t}
              </div>
            ))}
            <div
              className="t-caption text-center font-bold"
              style={{ marginTop: "var(--s-3)", borderRadius: "var(--r-full)", paddingBlock: "var(--s-2)", background: "var(--green-200)", color: "var(--n-900)" }}
            >
              ⇄ 랜덤 질문 바꾸기
            </div>
          </div>
        ) : (
          <>
            <div
              className="absolute t-caption font-semibold"
              style={{ insetInline: "var(--s-4)", top: "var(--s-6)", background: "var(--n-0)", borderRadius: "var(--r-sm)", padding: "var(--s-3)", color: "var(--n-900)" }}
            >
              <span className="t-caption block font-bold" style={{ marginBottom: "var(--s-1)", color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>오늘의 질문</span>
              {question}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-center" style={{ top: 190 }}>
              {state === "rec" ? (
                <>
                  <span
                    className="t-caption inline-flex items-center font-bold"
                    style={{ gap: "var(--s-2)", background: "var(--n-900)", borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-3)", color: "var(--n-0)" }}
                  >
                    <span className="inline-block" style={{ width: 10, height: 10, borderRadius: "var(--r-full)", background: "var(--danger)" }} /> REC 0:23 / 1:00
                  </span>
                  <p className="t-caption" style={{ marginTop: "var(--s-8)", color: "var(--text-soft)" }}>얼굴이 안 나와도 됩니다<br />목소리면 충분합니다</p>
                </>
              ) : (
                <>
                  <p className="t-display" style={{ color: "var(--n-0)" }}>✓</p>
                  <p className="t-small font-bold" style={{ marginTop: "var(--s-1)", color: "var(--n-0)" }}>보냈어요</p>
                  {/* ★ 2026-09-11 — 「자막 영상은 30분쯤 뒤 문자로」를 지웠다.
                      자막 워커도 그 문자도 **아직 없다.** 녹화 화면에서는 2026-09-10 에 이미 지웠는데
                      **손님이 실제로 보는 `/how-it-works` 목업에는 그대로 남아 있었다**(박팀장 발견).
                      오지 않는 것을 약속하면 사장님은 고장으로 여긴다. 지금 진짜 되는 것만 말한다.
                      ⚠ 자막·문자 발송이 실제로 도는 날 되살려라. 그전에는 안 된다.
                      ⚠ 목업이 좁아 줄바꿈을 직접 넣는다 — 폭 제한이 없어 길면 목업 밖으로 샌다. */}
                  <p className="t-caption" style={{ marginTop: "var(--s-1)", color: "var(--text-soft)" }}>영상이 저장됐어요<br />홈페이지 관리에서<br />홈페이지에 걸 수 있어요</p>
                </>
              )}
            </div>
            <div className="absolute inset-x-0 flex items-center justify-center" style={{ bottom: "var(--s-5)", gap: "var(--s-6)" }}>
              <span style={{ width: 36, height: 36, borderRadius: "var(--r-full)", border: "2px solid var(--n-400)" }} />
              <span className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: "var(--r-full)", border: "4px solid var(--n-0)" }}>
                <span
                  className="block"
                  style={{
                    width: state === "rec" ? 24 : 48, height: state === "rec" ? 24 : 48,
                    borderRadius: state === "rec" ? "var(--r-sm)" : "var(--r-full)",
                    background: "var(--danger)",
                  }}
                />
              </span>
              <span style={{ width: 36, height: 36, borderRadius: "var(--r-full)", border: "2px solid var(--n-400)" }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 말→글 3모드 샘플 (정적 3열) */
export function SpeechToStory() {
  const cols = [
    { t: "원문 그대로", d: "사장님 말 그대로. 원본은 항상 보관됩니다.", body: "어… 저는 원래 아버지가 도배를 하셨는데요, 그… 처음엔 안 하려고 했어요. 근데 군대 갔다 와서 딱히… 그래서 따라다니다 보니까 벌써 12년이네요." },
    { t: "1인칭 다듬기", d: "군더더기만 빼고 사장님 목소리로.", body: "원래 아버지가 도배를 하셨습니다. 처음엔 이 길을 갈 생각이 없었어요. 군대를 다녀와 아버지를 따라다니기 시작했는데, 그게 벌써 12년이 됐습니다." },
    { t: "3인칭 소개", d: "홈페이지 소개·블로그용.", body: "사장님은 도배를 하시던 아버지 곁에서 일을 배웠습니다. 처음엔 물려받을 생각이 없었지만, 아버지를 따라다닌 시간이 어느새 12년이 되었습니다." },
  ];
  return (
    <div className="grid md:grid-cols-3" style={{ gap: "var(--s-4)" }}>
      {cols.map((c, i) => (
        <div key={c.t} className="card" style={{ padding: "var(--s-5)" }}>
          <p className="t-caption font-bold" style={{ color: i === 0 ? "var(--text-soft)" : "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
            {String(i + 1).padStart(2, "0")} · {c.t}
          </p>
          <p className="t-caption" style={{ marginTop: "var(--s-1)", color: "var(--text-soft)" }}>{c.d}</p>
          <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--n-700)" }}>{c.body}</p>
        </div>
      ))}
    </div>
  );
}

/** 비교 콜아웃 — "아직 고민 중이신가요?" */
export function CompareCallout() {
  return (
    <section className="surface-0 section reveal">
      <div className="wrap">
        {/* ⚠ 가로세로가 답답했다(2026-09-07 회장님). 세로로 길게 편다 —
            안쪽 여백 32→48/64, 두 칸 사이 32→48, 항목 사이 6→16. 내용은 그대로다. */}
        <div
          className="surface-900 grid items-center md:grid-cols-[1.2fr_1fr]"
          style={{ gap: "var(--s-7)", borderRadius: "var(--r-lg)", padding: "var(--s-7) var(--s-6)" }}
        >
          <div>
            <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>아직 고민 중이신가요?</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-4)" }}>제작업체는 홈페이지를 줍니다.<br />온스토리는 손님을 부릅니다.</h2>
            <p className="t-body" style={{ marginTop: "var(--s-5)", color: "var(--n-300)" }}>
              비용·시간·글쓰기·영상·SNS·검색·소유권·해지 — 11가지 항목을 정직하게 비교했습니다.
            </p>
            <Link href="/our-story#compare" className="btn btn-secondary" style={{ marginTop: "var(--s-6)" }}>
              홈페이지 제작업체 vs 온스토리 →
            </Link>
          </div>
          <ul>
            {[["만드는 시간", "2~6주", "3분"], ["글쓰기", "사장님 몫", "없음"], ["영상", "편당 30만원~", "매주 포함"], ["SNS 발행", "없음", `지금 ${LIVE_COUNT}곳`], ["만든 뒤", "끝", "매주 쌓임"]].map(([k, a, b]) => (
              <li
                key={k}
                className="t-small grid grid-cols-3 items-center"
                style={{ gap: "var(--s-3)", marginBottom: "var(--s-3)", background: "var(--n-800)", borderRadius: "var(--r-md)", padding: "var(--s-4)" }}
              >
                <span style={{ color: "var(--text-soft)" }}>{k}</span>
                <span style={{ color: "var(--text-soft)", textDecoration: "line-through" }}>{a}</span>
                <span className="font-bold" style={{ color: "var(--green-200)" }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
