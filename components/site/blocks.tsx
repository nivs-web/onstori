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

/* ════════ 채널 로고 (2026-09-16 복구) ════════ */

/**
 * 🔴 **로고를 끄는 스위치 — 여기 한 줄이 전부다.**
 *
 * ⚠ 2026-09-11 커밋 `f7d99ae`(「유튜브 로고 제거」)에서 사고가 났다. 유튜브 심사 때문에
 *   **유튜브 하나만** 빼려던 것이었는데, 아이콘을 그리는 함수(`ChannelMark`)를 통째로 지워
 *   **인스타·쓰레드·X 로고까지 같이 사라졌다.** 대표님이 「왜 로고가 없냐」고 물으신 것이 이것이다.
 *
 * ★ 그래서 되살리기 전에 «끄는 방법»부터 만들어 둔다. 심사에서 지적이 오면
 *   아래 배열에 `"youtube"` 한 낱말만 넣어라 — 유튜브 로고만 조용히 사라지고 글자는 남는다.
 *   **다시는 함수를 지우지 마라.** 지우면 남의 로고까지 같이 죽는다.
 *
 * ⚠ 되살릴 때 알고 있어야 할 위험(2026-09-11 에 적혀 있던 그대로 남긴다):
 *   유튜브 브랜드 규칙은 로고를 쓰면 **유튜브로 가는 링크**일 것을 요구하고,
 *   메타·틱톡도 «허가 없이 나란히 두어 제휴처럼 보이게 하지 말 것»을 요구한다.
 *   여기 로고들은 링크가 아니라 «어디로 나가는지 알려주는 표시»다 — 심사에서 걸리면
 *   그 채널 id 를 아래에 넣는 것으로 끝낸다.
 *
 * ★ 이 스위치의 «제자리»는 `config/channels.ts` 의 각 항목(`icon: false`)이다.
 *   이번 작업은 그 파일을 고칠 권한이 없어 여기에 뒀다 — 옮길 때 이 주석도 같이 옮겨라.
 */
export const CHANNEL_ICONS_OFF: readonly string[] = [];

/**
 * 채널 아이콘 — `config/channels.ts` 의 id 로 고른다.
 *
 * ⚠ 각 사의 브랜드 색은 **그 회사 자산**이라 토큰으로 바꾸지 않는다.
 *   토큰은 온스토리 화면의 색을 정하는 것이지 남의 로고 색을 정하는 게 아니다.
 * ⚠ 검은 로고(X·쓰레드·틱톡)는 **어두운 바탕(푸터)에서 안 보인다.** `onDark` 로 흰색으로 뒤집는다.
 * ★ `live: false`(준비 중)면 흐리게 그린다 — 「되는 곳/안 되는 곳」이 눈에 보여야 한다(2026-09-13 원칙).
 */
export function ChannelIcon({ id, live = true, onDark = false, size = 18 }: { id: string; live?: boolean; onDark?: boolean; size?: number }) {
  if (CHANNEL_ICONS_OFF.includes(id)) return null;
  const s = { width: size, height: size, style: { opacity: live ? 1 : 0.45, flex: "none" }, "aria-hidden": true } as const;
  /* 단색 로고(X·쓰레드·틱톡)의 색 — 어두운 바탕에서는 뒤집는다.
     ★ 검정은 «그 회사가 정한 로고 색»이라 그대로 두고, 뒤집은 흰색은 «우리가 정한 것»이라 토큰을 쓴다. */
  const ink = onDark ? "var(--n-0)" : "#000000";
  switch (id) {
    case "youtube": return <svg {...s} viewBox="0 0 24 24" fill="#FF0000"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8zM9.8 15.1V8.9L15.8 12l-6 3.1z" /></svg>;
    case "instagram": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#C13584" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#C13584" /></svg>;
    case "threads": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2"><path d="M12 3c-5 0-8 3.5-8 9s3 9 8 9c4 0 6.5-2 6.5-5 0-2.5-2-4-5-4-2.5 0-4 1.2-4 3s1.5 2.7 3.2 2.7c2 0 3.3-1.3 3.5-4.2.2-3-1.5-5-4.5-5" /></svg>;
    case "x": return <svg {...s} viewBox="0 0 24 24" fill={ink}><path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" /></svg>;
    /* ★ 틱톡·페이스북은 2026-09-11 에 지워진 그 함수에 **원래 없었다**(그때 목록에 네이버가 있었다).
       되찾을 원본이 없어 같은 규격(24×24 · 단색 · 인라인)으로 새로 그렸다. */
    case "tiktok": return <svg {...s} viewBox="0 0 24 24" fill={ink}><path d="M16.5 3c.3 2.1 1.5 3.4 3.5 3.6v2.6c-1.3.1-2.5-.3-3.6-1v5.9c0 3.9-3.3 6.5-6.7 5.7-2.6-.6-4.2-2.9-4.2-5.5 0-3 2.4-5.4 5.4-5.4.3 0 .5 0 .8.1v2.8c-.3-.1-.5-.1-.8-.1-1.5 0-2.7 1.3-2.6 2.8.1 1.3 1.2 2.4 2.5 2.5 1.6.1 2.9-1.1 2.9-2.7V3h2.8z" /></svg>;
    case "facebook": return <svg {...s} viewBox="0 0 24 24" fill="#1877F2"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" /></svg>;
    /* ⚠ 모르는 id 면 **아무것도 그리지 않는다.** 엉뚱한 표시를 그리면 손님이 그 채널로 착각한다. */
    default: return null;
  }
}

/**
 * 채널 이름 + «(준비 중)» — 표기는 `config/channels.ts` 의 `CHANNELS_LINE_MARKED` 와 **같은 형식**이다.
 * ⚠ 아이콘만 흐리게 하면 «디자인이 흐린 것»으로 보인다. 글자로도 말해야 사실 표시가 된다.
 */
export function channelLabel(c: { name: string; live: boolean }) {
  return c.live ? c.name : `${c.name}(준비 중)`;
}

/**
 * 채널 띠 — 로고 + 이름. (2026-09-16 로고 복구 — 위 `CHANNEL_ICONS_OFF` 주석을 먼저 읽어라)
 *
 * ★ 띠에 나열된 여섯 개가 **똑같이 되는 것처럼** 보였다 (2026-09-13 박팀장 지적).
 *   제목에 «지금 몇 곳»을 적고, 아래 목록은 안 되는 곳을 **흐리게 + (준비 중)** 으로 구분한다.
 */
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
            style={{ gap: "var(--s-2)", color: c.live ? "var(--n-800)" : "var(--text-soft)" }}
          >
            <ChannelIcon id={c.id} live={c.live} />
            {channelLabel(c)}
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
