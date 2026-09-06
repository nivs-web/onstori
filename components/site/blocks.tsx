import Link from "next/link";
import type { FaqItem } from "@/config/faq";
import { CHANNELS } from "./chrome";

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
            <span className="chev shrink-0 t-h3 font-light" style={{ color: "var(--green-700)" }} aria-hidden>＋</span>
          </summary>
          <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--n-600)" }}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/** 채널 6개 로고 띠 */
export function ChannelStrip({ title = "한 번 말하면 6곳에 퍼지는 자동화 엔진" }: { title?: string }) {
  return (
    <section className="surface-50" style={{ borderBlock: "1px solid var(--n-200)" }}>
      <div
        className="wrap flex flex-wrap items-center justify-center"
        style={{ columnGap: "var(--s-6)", rowGap: "var(--s-3)", paddingBlock: "var(--s-5)" }}
      >
        <span className="t-caption font-bold" style={{ color: "var(--n-500)", letterSpacing: "var(--tracking-kicker)" }}>{title}</span>
        {CHANNELS.map((c) => (
          <span
            key={c.id}
            className="t-small flex items-center font-bold"
            style={{ gap: "var(--s-2)", color: "var(--n-800)" }}
          >
            <ChannelMark id={c.id} /> {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}

/* 채널 아이콘 — 각 사의 브랜드 색은 그 회사 자산이라 토큰으로 바꾸지 않는다.
   토큰은 온스토리 화면의 색을 정하는 것이지 남의 로고 색을 정하는 게 아니다. */
function ChannelMark({ id }: { id: string }) {
  const s = { width: 18, height: 18 } as const;
  switch (id) {
    case "youtube": return <svg {...s} viewBox="0 0 24 24" fill="#FF0000" aria-hidden><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8zM9.8 15.1V8.9L15.8 12l-6 3.1z" /></svg>;
    case "instagram": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#C13584" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#C13584" /></svg>;
    case "threads": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" aria-hidden><path d="M12 3c-5 0-8 3.5-8 9s3 9 8 9c4 0 6.5-2 6.5-5 0-2.5-2-4-5-4-2.5 0-4 1.2-4 3s1.5 2.7 3.2 2.7c2 0 3.3-1.3 3.5-4.2.2-3-1.5-5-4.5-5" /></svg>;
    case "x": return <svg {...s} viewBox="0 0 24 24" fill="#000000" aria-hidden><path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" /></svg>;
    case "naver": return <svg {...s} viewBox="0 0 24 24" fill="#03C75A" aria-hidden><path d="M3 3h6l6 9V3h6v18h-6l-6-9v9H3z" /></svg>;
    // eslint-disable-next-line @next/next/no-img-element
    default: return <img src="/brand/on-mark-64.png" alt="" width={18} height={18} className="inline-block" aria-hidden />;
  }
}

/** 60초 녹화 화면 목업 — 히어로 옆·데모 섹션·작동방식에서 재사용 (정적) */
export function RecMockup({ question = "이 일을 처음 시작하던 날, 무엇이 가장 두려웠나요?", state = "rec" }: { question?: string; state?: "rec" | "done" | "ask" }) {
  return (
    <div
      className="mx-auto"
      style={{
        width: 250, background: "var(--n-900)", borderRadius: "var(--r-lg)",
        border: "6px solid var(--n-900)", padding: "var(--s-2)", boxShadow: "var(--shadow-2)",
      }}
      aria-label="60초 녹화 화면 예시"
    >
      <div className="relative overflow-hidden" style={{ height: 500, borderRadius: "var(--r-md)", background: "var(--n-800)" }}>
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-between t-caption"
          style={{ padding: "var(--s-3) var(--s-4) 0", color: "var(--n-400)" }}
        >
          <span>onstori.com/rec</span><span>크롬</span>
        </div>
        {state === "ask" ? (
          <div className="absolute" style={{ insetInline: "var(--s-4)", top: "var(--s-7)" }}>
            <p className="t-caption font-bold" style={{ color: "var(--n-400)", letterSpacing: "var(--tracking-kicker)" }}>오늘의 질문</p>
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
                  <p className="t-caption" style={{ marginTop: "var(--s-8)", color: "var(--n-400)" }}>얼굴이 안 나와도 됩니다<br />목소리면 충분합니다</p>
                </>
              ) : (
                <>
                  <p className="t-display" style={{ color: "var(--n-0)" }}>✓</p>
                  <p className="t-small font-bold" style={{ marginTop: "var(--s-1)", color: "var(--n-0)" }}>보냈어요</p>
                  <p className="t-caption" style={{ marginTop: "var(--s-1)", color: "var(--n-400)" }}>자막 영상은 30분쯤 뒤<br />문자로 보내드릴게요</p>
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
          <p className="t-caption font-bold" style={{ color: i === 0 ? "var(--n-500)" : "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
            {String(i + 1).padStart(2, "0")} · {c.t}
          </p>
          <p className="t-caption" style={{ marginTop: "var(--s-1)", color: "var(--n-500)" }}>{c.d}</p>
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
        <div
          className="surface-900 grid items-center md:grid-cols-[1.2fr_1fr]"
          style={{ gap: "var(--s-6)", borderRadius: "var(--r-lg)", padding: "var(--s-6)" }}
        >
          <div>
            <p className="t-caption font-bold" style={{ color: "var(--green-200)", letterSpacing: "var(--tracking-kicker)" }}>아직 고민 중이신가요?</p>
            <h2 className="t-h2" style={{ marginTop: "var(--s-3)" }}>제작업체는 홈페이지를 줍니다.<br />온스토리는 손님을 부릅니다.</h2>
            <p className="t-body" style={{ marginTop: "var(--s-4)", color: "var(--n-300)" }}>
              비용·시간·글쓰기·영상·SNS·검색·소유권·해지 — 11가지 항목을 정직하게 비교했습니다.
            </p>
            <Link href="/our-story#compare" className="btn btn-secondary" style={{ marginTop: "var(--s-5)" }}>
              홈페이지 제작업체 vs 온스토리 →
            </Link>
          </div>
          <ul>
            {[["만드는 시간", "2~6주", "3분"], ["글쓰기", "사장님 몫", "없음"], ["영상", "편당 30만원~", "매주 포함"], ["SNS 발행", "없음", "6곳"], ["만든 뒤", "끝", "매주 쌓임"]].map(([k, a, b]) => (
              <li
                key={k}
                className="t-small grid grid-cols-3 items-center"
                style={{ gap: "var(--s-2)", marginBottom: "var(--s-2)", background: "var(--n-800)", borderRadius: "var(--r-md)", padding: "var(--s-2) var(--s-4)" }}
              >
                <span style={{ color: "var(--n-400)" }}>{k}</span>
                <span style={{ color: "var(--n-500)", textDecoration: "line-through" }}>{a}</span>
                <span className="font-bold" style={{ color: "var(--green-200)" }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
