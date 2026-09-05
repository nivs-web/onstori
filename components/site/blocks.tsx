import Link from "next/link";
import type { FaqItem } from "@/config/faq";
import { CHANNELS } from "./chrome";

/** 자주 묻는 질문 아코디언 — JS 없이 details/summary */
export function FaqList({ items, id }: { items: FaqItem[]; id?: string }) {
  return (
    <div id={id} className="divide-y rounded-2xl border bg-white" style={{ borderColor: "var(--line)" }}>
      {items.map((it) => (
        <details key={it.q} className="faq px-5 py-4">
          <summary className="flex items-center justify-between gap-4 text-[15.5px] font-semibold">
            {it.q}
            <span className="chev shrink-0 text-[20px] font-light" style={{ color: "var(--teal)" }} aria-hidden>＋</span>
          </summary>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--muted)" }}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/** 채널 6개 로고 띠 — 레멘토 언론 로고 띠 대응 */
export function ChannelStrip({ title = "한 번 말하면 여섯 곳으로" }: { title?: string }) {
  return (
    <section className="border-y bg-white" style={{ borderColor: "var(--line)" }}>
      <div className="wrap flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6">
        <span className="text-[12.5px] font-bold tracking-[0.16em]" style={{ color: "var(--muted)" }}>{title}</span>
        {CHANNELS.map((c) => (
          <span key={c.id} className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight" style={{ color: "var(--forest)" }}>
            <ChannelMark id={c.id} /> {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function ChannelMark({ id }: { id: string }) {
  const s = { width: 20, height: 20 } as const;
  switch (id) {
    case "youtube": return <svg {...s} viewBox="0 0 24 24" fill="#FF0000" aria-hidden><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8zM9.8 15.1V8.9L15.8 12l-6 3.1z" /></svg>;
    case "instagram": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#C13584" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#C13584" /></svg>;
    case "threads": return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" aria-hidden><path d="M12 3c-5 0-8 3.5-8 9s3 9 8 9c4 0 6.5-2 6.5-5 0-2.5-2-4-5-4-2.5 0-4 1.2-4 3s1.5 2.7 3.2 2.7c2 0 3.3-1.3 3.5-4.2.2-3-1.5-5-4.5-5" /></svg>;
    case "x": return <svg {...s} viewBox="0 0 24 24" fill="#000" aria-hidden><path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" /></svg>;
    case "naver": return <svg {...s} viewBox="0 0 24 24" fill="#03C75A" aria-hidden><path d="M3 3h6l6 9V3h6v18h-6l-6-9v9H3z" /></svg>;
    default: return <span className="inline-block h-5 w-5 rounded-full" style={{ background: "var(--green)" }} aria-hidden />;
  }
}

/** 60초 녹화 화면 목업 — 히어로 옆·데모 섹션·작동방식에서 재사용 (정적) */
export function RecMockup({ question = "이 일을 처음 시작하던 날, 무엇이 가장 두려웠나요?", state = "rec" }: { question?: string; state?: "rec" | "done" | "ask" }) {
  return (
    <div className="mx-auto w-[250px] rounded-[34px] border-[6px] bg-black p-2 shadow-2xl" style={{ borderColor: "#111" }} aria-label="60초 녹화 화면 예시">
      <div className="relative h-[500px] overflow-hidden rounded-[26px]" style={{ background: "linear-gradient(180deg,#2C4A42 0%,#1E332D 60%,#15241F 100%)" }}>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3 text-[10px] text-white/70">
          <span>onstori.com/rec</span><span>크롬</span>
        </div>
        {state === "ask" ? (
          <div className="absolute inset-x-4 top-14 space-y-2">
            <p className="text-[11px] font-bold tracking-[0.14em] text-white/70">오늘의 질문</p>
            {[question, "가장 힘들었던 작업은 무엇이었나요?", "이번 주 손님 한 분 이야기", "우리만 고집하는 게 있다면?"].map((t, i) => (
              <div key={i} className={`rounded-xl px-3 py-2.5 text-[12px] leading-snug ${i === 0 ? "bg-white text-[#1E332D] font-semibold" : "bg-white/10 text-white/85"}`}>{t}</div>
            ))}
            <div className="mt-3 rounded-full py-2 text-center text-[12px] font-bold" style={{ background: "var(--lime)", color: "var(--forest)" }}>⇄ 랜덤 질문 바꾸기</div>
          </div>
        ) : (
          <>
            <div className="absolute inset-x-4 top-12 rounded-xl bg-white/95 p-3 text-[12.5px] font-semibold leading-snug" style={{ color: "var(--forest)" }}>
              <span className="mb-1 block text-[10px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>오늘의 질문</span>
              {question}
            </div>
            <div className="absolute left-1/2 top-[190px] -translate-x-1/2 text-center">
              {state === "rec" ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[12px] font-bold text-white">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "var(--terra)" }} /> REC 0:23 / 1:00
                  </span>
                  <p className="mt-16 text-[11.5px] text-white/60">얼굴이 안 나와도 됩니다<br />목소리면 충분합니다</p>
                </>
              ) : (
                <>
                  <p className="text-[40px]">✓</p>
                  <p className="mt-1 text-[14px] font-bold text-white">보냈어요</p>
                  <p className="mt-1 text-[11.5px] text-white/70">자막 영상은 30분쯤 뒤<br />문자로 보내드릴게요</p>
                </>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-6">
              <span className="h-9 w-9 rounded-full border-2 border-white/60" />
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white">
                <span className={`block ${state === "rec" ? "h-6 w-6 rounded-md" : "h-12 w-12 rounded-full"}`} style={{ background: "var(--terra)" }} />
              </span>
              <span className="h-9 w-9 rounded-full border-2 border-white/60" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 말→글 3모드 샘플 — 레멘토 Speech-to-Story 대응 (정적 3열) */
export function SpeechToStory() {
  const cols = [
    { t: "원문 그대로", d: "사장님 말 그대로. 원본은 항상 보관됩니다.", body: "어… 저는 원래 아버지가 도배를 하셨는데요, 그… 처음엔 안 하려고 했어요. 근데 군대 갔다 와서 딱히… 그래서 따라다니다 보니까 벌써 12년이네요." },
    { t: "1인칭 다듬기", d: "군더더기만 빼고 사장님 목소리로.", body: "원래 아버지가 도배를 하셨습니다. 처음엔 이 길을 갈 생각이 없었어요. 군대를 다녀와 아버지를 따라다니기 시작했는데, 그게 벌써 12년이 됐습니다." },
    { t: "3인칭 소개", d: "홈페이지 소개·블로그용.", body: "사장님은 도배를 하시던 아버지 곁에서 일을 배웠습니다. 처음엔 물려받을 생각이 없었지만, 아버지를 따라다닌 시간이 어느새 12년이 되었습니다." },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.map((c, i) => (
        <div key={c.t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
          <p className="text-[11px] font-bold tracking-[0.14em]" style={{ color: i === 0 ? "var(--muted)" : "var(--teal)" }}>{String(i + 1).padStart(2, "0")} · {c.t}</p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>{c.d}</p>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--forest)" }}>{c.body}</p>
        </div>
      ))}
    </div>
  );
}

/** 비교 콜아웃 — "아직 고민 중이신가요?" */
export function CompareCallout() {
  return (
    <section className="wrap py-16">
      <div className="grid items-center gap-8 rounded-3xl p-8 sm:p-12 md:grid-cols-[1.2fr_1fr]" style={{ background: "var(--forest)", color: "var(--cream)" }}>
        <div>
          <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">아직 고민 중이신가요?</p>
          <h2 className="font-display mt-3 text-[26px] leading-tight sm:text-[34px]">제작업체는 홈페이지를 줍니다.<br />온스토리는 손님을 부릅니다.</h2>
          <p className="mt-4 text-[15px] opacity-80">비용·시간·글쓰기·영상·SNS·검색·소유권·해지 — 11가지 항목을 정직하게 비교했습니다.</p>
          <Link href="/compare" className="btn-lime mt-6">홈페이지 제작업체 vs 온스토리 →</Link>
        </div>
        <ul className="space-y-2 text-[14.5px]">
          {[["만드는 시간", "2~6주", "3분"], ["글쓰기", "사장님 몫", "없음"], ["영상", "편당 30만원~", "매주 포함"], ["SNS 발행", "없음", "6곳"], ["만든 뒤", "끝", "매주 쌓임"]].map(([k, a, b]) => (
            <li key={k} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5">
              <span className="opacity-70">{k}</span><span className="opacity-60 line-through">{a}</span><span className="font-bold" style={{ color: "var(--lime)" }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
