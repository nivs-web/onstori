"use client";

import { useEffect, useRef, useState } from "react";
import { QuestionShuffle } from "@/components/site/question-shuffle";
import type { Question } from "@/config/questions";

/**
 * 60초 녹화 화면 — 레멘토 web.remento.co 14화면을 9화면으로 (기획1 /mainplan #rec).
 * greet → ask → mode → permission/setup → countdown → rec → review → sending → done
 * 브라우저 MediaRecorder 만 쓴다(앱 없음). 60초에 자동 정지. 업로드는 R2 서명 URL 로 직접(폴백: 서버 경유).
 */

const MAX_SEC = 60;
type Screen = "greet" | "ask" | "mode" | "setup" | "count" | "rec" | "review" | "sending" | "done" | "error";

function isInApp(): boolean {
  const ua = navigator.userAgent;
  return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

function pickMime(): string {
  const c = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const m of c) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

export function RecClient({ slug, k, businessName }: { slug: string; k: string; businessName: string }) {
  const [screen, setScreen] = useState<Screen>("greet");
  const [q, setQ] = useState<Question | null>(null);
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [inApp] = useState(() => (typeof navigator !== "undefined" ? isInApp() : false));
  const [count, setCount] = useState(3);
  const [sec, setSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const liveRef = useRef<HTMLVideoElement | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { stopStream(); }, []);
  useEffect(() => { if (liveRef.current && streamRef.current) liveRef.current.srcObject = streamRef.current; }, [screen]);

  const questionText = q?.text ?? custom.trim();

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function setup() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mode === "video" ? { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true } : { audio: true });
      streamRef.current = stream;
      setScreen("setup");
    } catch {
      setErr(inApp ? "카카오톡·인스타 안에서는 카메라를 열 수 없어요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'(크롬)를 눌러 주세요." : "카메라·마이크 권한이 필요해요. 브라우저 주소창의 자물쇠 아이콘에서 허용해 주세요.");
      setScreen("error");
    }
  }

  function startCountdown() {
    setScreen("count"); setCount(3);
    let c = 3;
    const t = setInterval(() => { c -= 1; setCount(c); if (c <= 0) { clearInterval(t); startRec(); } }, 1000);
  }

  function startRec() {
    const stream = streamRef.current;
    if (!stream) return;
    chunks.current = [];
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunks.current, { type: rec.mimeType || "video/webm" });
      setBlob(b); setBlobUrl(URL.createObjectURL(b));
      if (tickRef.current) clearInterval(tickRef.current);
      setScreen("review");
    };
    rec.start(1000);
    setSec(0); setPaused(false); setScreen("rec");
    tickRef.current = setInterval(() => {
      setSec((s) => {
        if (recRef.current?.state === "paused") return s;
        if (s + 1 >= MAX_SEC) { recRef.current?.stop(); return MAX_SEC; }
        return s + 1;
      });
    }, 1000);
  }

  function togglePause() {
    const r = recRef.current; if (!r) return;
    if (r.state === "recording") { r.pause(); setPaused(true); } else if (r.state === "paused") { r.resume(); setPaused(false); }
  }

  function stopRec() { recRef.current?.stop(); }

  function reRecord() {
    setBlob(null); setBlobUrl(""); setSec(0);
    setScreen("setup");
  }

  async function send() {
    if (!blob) return;
    setScreen("sending"); setProgress(0); setErr("");
    try {
      const ct = blob.type || "video/webm";
      const r = await fetch("/api/story/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, k, contentType: ct }) });
      const d = (await r.json()) as { mode?: string; url?: string; key?: string; contentType?: string; error?: string };
      if (!r.ok || !d.key) throw new Error(d.error ?? "업로드 준비 실패");
      if (d.mode === "r2" && d.url) {
        await new Promise<void>((resolve, reject) => {
          const x = new XMLHttpRequest();
          x.open("PUT", d.url!);
          x.setRequestHeader("Content-Type", d.contentType ?? ct);
          x.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
          x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${x.status})`)));
          x.onerror = () => reject(new Error("네트워크 오류 — 다시 시도해 주세요"));
          x.send(blob);
        });
      } else {
        const fd = new FormData(); fd.set("slug", slug); fd.set("k", k); fd.set("key", d.key); fd.set("file", blob, "story.webm");
        const u = await fetch("/api/story/upload", { method: "POST", body: fd });
        if (!u.ok) throw new Error(((await u.json().catch(() => ({}))) as { error?: string }).error ?? "업로드 실패");
        setProgress(100);
      }
      const s = await fetch("/api/story/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, k, key: d.key, question: questionText, questionId: q?.id, mode, durationSec: sec || undefined }) });
      if (!s.ok) throw new Error(((await s.json().catch(() => ({}))) as { error?: string }).error ?? "저장 실패");
      stopStream();
      setScreen("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "보내지 못했어요");
      setScreen("review");
    }
  }

  const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-svh" style={{ background: "var(--forest)", color: "var(--cream)" }}>
      <div className="mx-auto flex min-h-svh max-w-md flex-col px-5 pb-10 pt-6">
        <div className="flex items-center justify-between text-[11.5px] opacity-70">
          <span>onstori.com/rec · {businessName}</span>
          <span>{screen === "rec" ? `REC ${mm(sec)} / ${mm(MAX_SEC)}` : "60초 녹화"}</span>
        </div>

        {/* 1 인사 */}
        {screen === "greet" && (
          <section className="flex flex-1 flex-col justify-center text-center">
            <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">온스토리</p>
            <h1 className="font-display mt-3 text-[30px] leading-tight">안녕하세요,<br />{businessName} 사장님</h1>
            <p className="mt-4 text-[15px] leading-relaxed opacity-80">오늘 질문 하나에 60초만 말씀해 주세요. 자막 영상과 글은 온스토리가 만듭니다.</p>
            <ul className="mx-auto mt-6 flex flex-wrap justify-center gap-2 text-[12.5px] font-semibold">
              {["✎ 글쓰기 금지", "🔗 이 링크가 로그인", "⤓ 앱 설치 없음"].map((t) => <li key={t} className="rounded-full border border-white/25 px-3 py-1.5">{t}</li>)}
            </ul>
            {inApp && (
              <p className="mt-6 rounded-xl bg-white/10 p-3 text-[13px] leading-relaxed">
                카카오톡·인스타 안에서 열렸어요. 카메라를 쓰려면 오른쪽 위 <b>⋮ 메뉴 → 다른 브라우저로 열기(크롬)</b>를 눌러 주세요.
              </p>
            )}
            <button type="button" onClick={() => setScreen("ask")} className="btn-lime mt-8 w-full !py-4 !text-[16px]">시작하기</button>
          </section>
        )}

        {/* 2 질문 */}
        {screen === "ask" && (
          <section className="flex-1 py-6">
            <QuestionShuffle dark onPick={(picked) => { setQ(picked); setCustom(""); setScreen("mode"); }} initialSeed={Date.now() % 1000} />
            <div className="mt-8 rounded-2xl bg-white/10 p-4">
              <p className="text-[12.5px] font-bold opacity-80">직접 주제를 적어도 돼요</p>
              <div className="mt-2 flex gap-2">
                <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} placeholder="예: 이번 주 바빴던 이유" className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-[14px] text-white placeholder:text-white/40" />
                <button type="button" disabled={custom.trim().length < 2} onClick={() => { setQ(null); setScreen("mode"); }} className="rounded-xl px-4 text-[13.5px] font-bold disabled:opacity-40" style={{ background: "var(--lime)", color: "var(--forest)" }}>이걸로</button>
              </div>
            </div>
          </section>
        )}

        {/* 3 영상/음성 */}
        {screen === "mode" && (
          <section className="flex flex-1 flex-col justify-center">
            <p className="text-[12px] font-bold tracking-[0.18em] opacity-60">오늘의 질문</p>
            <p className="font-display mt-2 text-[24px] leading-snug">{questionText}</p>
            <button type="button" onClick={() => setScreen("ask")} className="mt-2 self-start text-[13px] underline opacity-70">질문 바꾸기</button>
            <div className="mt-8 grid gap-3">
              {([["video", "영상으로", "얼굴이 나옵니다. 가장 반응이 좋아요."], ["audio", "음성만", "얼굴 없이 목소리만. 사진과 자막으로 영상을 만듭니다."]] as const).map(([m, t, d]) => (
                <button key={m} type="button" onClick={() => setMode(m)} className="rounded-2xl border p-4 text-left" style={{ borderColor: mode === m ? "var(--lime)" : "rgba(255,255,255,.25)", background: mode === m ? "rgba(183,220,198,.14)" : "transparent" }}>
                  <p className="text-[16px] font-bold">{mode === m ? "● " : "○ "}{t}</p>
                  <p className="mt-1 text-[13px] opacity-75">{d}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={setup} className="btn-lime mt-8 w-full !py-4 !text-[16px]">카메라·마이크 켜기</button>
            <p className="mt-3 text-center text-[12px] opacity-60">브라우저가 권한을 물으면 &lsquo;허용&rsquo;을 눌러 주세요</p>
          </section>
        )}

        {/* 4·5 카메라 확인 */}
        {screen === "setup" && (
          <section className="flex flex-1 flex-col">
            <p className="mt-4 text-[12px] font-bold tracking-[0.18em] opacity-60">카메라 확인</p>
            <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {mode === "video" ? (
                <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center"><span className="text-[48px]">🎙</span><p className="mt-2 text-[14px] opacity-80">음성만 녹음합니다</p></div>
              )}
              <div className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-[13.5px] font-semibold leading-snug" style={{ color: "var(--forest)" }}>{questionText}</div>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed opacity-80">준비되셨으면 시작을 누르세요. 3·2·1 뒤 녹화가 시작되고 60초에 자동으로 멈춥니다. 다시 찍기는 무제한이에요.</p>
            <button type="button" onClick={startCountdown} className="btn-lime mt-6 w-full !py-4 !text-[16px]">준비됐어요 · 시작</button>
          </section>
        )}

        {/* 6 카운트다운 · 7 녹화 */}
        {(screen === "count" || screen === "rec") && (
          <section className="flex flex-1 flex-col">
            <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {mode === "video" ? (
                <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
              ) : (
                <div className="flex h-full items-center justify-center"><span className="text-[64px]">🎙</span></div>
              )}
              <div className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 text-[13.5px] font-semibold leading-snug" style={{ color: "var(--forest)" }}>{questionText}</div>
              {screen === "count" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="font-display text-[96px] text-white">{count > 0 ? count : "●"}</span>
                  <button type="button" onClick={startRec} className="absolute bottom-5 text-[13px] text-white/70 underline">건너뛰기</button>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[13px] font-bold text-white">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${paused ? "" : "animate-pulse"}`} style={{ background: paused ? "#bbb" : "var(--terra)" }} /> {paused ? "일시정지" : "REC"} {mm(sec)} / {mm(MAX_SEC)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-all" style={{ width: `${(sec / MAX_SEC) * 100}%`, background: "var(--terra)" }} /></div>
            {screen === "rec" && (
              <div className="mt-6 flex items-center justify-center gap-8">
                <button type="button" onClick={togglePause} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/60 text-[13px] font-bold">{paused ? "재개" : "잠깐"}</button>
                <button type="button" onClick={stopRec} aria-label="정지" className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white"><span className="block h-8 w-8 rounded-md" style={{ background: "var(--terra)" }} /></button>
                <span className="h-14 w-14" />
              </div>
            )}
            <p className="mt-4 text-center text-[12.5px] opacity-60">얼굴이 안 나와도 됩니다. 목소리면 충분합니다.</p>
          </section>
        )}

        {/* 8 확인 */}
        {screen === "review" && (
          <section className="flex flex-1 flex-col">
            <p className="mt-4 text-[12px] font-bold tracking-[0.18em] opacity-60">확인 · {mm(sec)}</p>
            <div className="mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {mode === "video" ? <video src={blobUrl} controls playsInline className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center gap-4"><span className="text-[48px]">🎙</span><audio src={blobUrl} controls /></div>}
            </div>
            {err && <p className="mt-3 text-[13px]" style={{ color: "#F5B7A6" }}>{err}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={reRecord} className="rounded-full border border-white/40 py-4 text-[15px] font-bold">다시 찍기</button>
              <button type="button" onClick={send} className="btn-lime !py-4 !text-[15px]">보내기</button>
            </div>
            <p className="mt-3 text-center text-[12px] opacity-60">보내면 온스토리가 무음을 자르고 자막을 넣어 영상·글로 만듭니다</p>
          </section>
        )}

        {/* 보내는 중 */}
        {screen === "sending" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display text-[56px]">{progress}%</p>
            <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--lime)" }} /></div>
            <p className="mt-4 text-[14px] opacity-80">보내는 중이에요. 화면을 닫지 마세요.</p>
          </section>
        )}

        {/* 9 완료 */}
        {screen === "done" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-[52px]">✓</p>
            <h2 className="font-display mt-2 text-[28px]">보냈어요</h2>
            <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed opacity-80">자막 영상과 다듬은 글은 30분쯤 뒤 문자로 보내드릴게요. 홈페이지 블로그와 6개 채널에 올릴 준비가 되면 알려 드립니다.</p>
            <a href={`/${slug}/edit`} className="btn-lime mt-8">홈페이지 관리로</a>
            <button type="button" onClick={() => { setBlob(null); setBlobUrl(""); setSec(0); setQ(null); setCustom(""); setScreen("ask"); }} className="mt-4 text-[13px] underline opacity-70">하나 더 녹화하기</button>
          </section>
        )}

        {screen === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="font-display text-[24px]">카메라를 열지 못했어요</h2>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed opacity-80">{err}</p>
            <button type="button" onClick={() => setScreen("mode")} className="btn-lime mt-8">다시 시도</button>
            {inApp && <a href={`intent://onstori.com/rec/${slug}?k=${encodeURIComponent(k)}#Intent;scheme=https;package=com.android.chrome;end`} className="mt-4 text-[13px] underline opacity-80">안드로이드: 크롬으로 열기</a>}
          </section>
        )}
      </div>
    </main>
  );
}
