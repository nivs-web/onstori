"use client";

import { useEffect, useRef, useState } from "react";

/** 생성 위저드 MVP — 카테고리를 묻지 않는다 (설계서 4장). 타이핑 4번 + 탭 1번. */

const MOODS = [
  { id: "clean", name: "깔끔한", desc: "믿음직한 화이트·블루" },
  { id: "warm", name: "따뜻한", desc: "포근한 베이지·브라운" },
  { id: "premium", name: "프리미엄", desc: "고급스러운 다크·골드" },
  { id: "lively", name: "활기찬", desc: "생기있는 코랄 포인트" },
] as const;

/**
 * 응답이 JSON일 때만 파싱한다.
 * 서버가 죽거나 함수 타임아웃이 나면 Vercel이 "An error occurred with this application." 같은
 * 평문 에러 페이지를 돌려주는데, 바로 res.json()을 부르면 그 파싱 오류
 * ("Unexpected token 'A', \"An error o\"...")가 사장님 화면에 그대로 노출된다.
 */
async function readJson(r: Response): Promise<Record<string, unknown>> {
  if ((r.headers.get("content-type") ?? "").includes("application/json")) {
    return (await r.json()) as Record<string, unknown>;
  }
  const body = (await r.text()).slice(0, 200);
  console.error(JSON.stringify({ evt: "non_json_response", status: r.status, body }));
  throw new Error(
    r.status === 504 || r.status === 502 || r.status === 500
      ? "만드는 데 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해주세요."
      : `서버 응답을 읽지 못했어요 (${r.status})`,
  );
}

export default function NewSitePage() {
  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [why, setWhy] = useState("");
  const [mood, setMood] = useState<(typeof MOODS)[number]["id"]>("clean");
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!slug) { setSlugMsg(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/slug-check?slug=${encodeURIComponent(slug)}`);
        const d = await readJson(r);
        setSlugMsg(d.available ? { ok: true, msg: "사용 가능한 주소예요" } : { ok: false, msg: String(d.reason ?? "") });
      } catch { setSlugMsg(null); }
    }, 400);
  }, [slug]);

  const canSubmit = name && oneLiner.length >= 2 && phone.length >= 9 && slug && slugMsg?.ok && state !== "loading";

  async function submit() {
    setState("loading");
    setErrMsg("");
    try {
      let anonId = "";
      try {
        anonId = localStorage.getItem("onstori:anonId") ?? crypto.randomUUID();
        localStorage.setItem("onstori:anonId", anonId);
      } catch {}
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, oneLiner, phone, slug, mood, address: address || undefined, whyStarted: why || undefined, anonId: anonId || undefined }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error ?? "생성 실패"));
      setResult(d as { url: string });
      setState("done");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "생성에 실패했어요");
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-4 text-2xl font-bold">홈페이지가 완성됐어요</h1>
        <p className="mt-2 text-neutral-500">이제 이야기를 쌓아갈 차례입니다.</p>
        <a href={result.url} className="mt-8 rounded-full bg-teal-700 px-8 py-4 text-lg font-semibold text-white shadow-lg">
          {result.url.replace("https://", "")} 열기 →
        </a>
        <p className="mt-6 text-sm text-neutral-400">1개월 무료 체험 중 · 언제든 해지 가능</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="text-xs font-semibold tracking-[0.2em] text-teal-700">ONSTORI</p>
      <h1 className="mt-2 text-2xl font-bold leading-snug">
        사진만 보내면 되는 홈페이지,<br />먼저 뼈대부터 만들어 드릴게요
      </h1>
      <p className="mt-2 text-[15px] text-neutral-500">업종이나 카테고리는 묻지 않아요. 하는 일을 사장님 말로 적어주시면 저희가 알아서 준비합니다.</p>

      <div className="mt-10 space-y-7">
        <Field label="상호명">
          <input className="inp" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 니브인테리어" />
        </Field>
        <Field label="하는 일 한 줄">
          <input className="inp" value={oneLiner} maxLength={120} onChange={(e) => setOneLiner(e.target.value)} placeholder="예: 주거 인테리어 리모델링을 해요" />
        </Field>
        <Field label="전화번호" hint="홈페이지의 문의 버튼에 연결돼요">
          <input className="inp" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
        </Field>
        <Field label="홈페이지 주소" hint={slugMsg ? slugMsg.msg : "영문 소문자·숫자·하이픈"}
               hintColor={slugMsg ? (slugMsg.ok ? "text-green-600" : "text-red-500") : undefined}>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-neutral-400">onstori.com/</span>
            <input className="inp flex-1" value={slug} maxLength={30}
                   onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                   placeholder="mystore" />
          </div>
        </Field>
        <Field label="분위기">
          <div className="grid grid-cols-2 gap-2">
            {MOODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMood(m.id)}
                className={`rounded-xl border p-3 text-left text-sm transition ${mood === m.id ? "border-teal-700 bg-teal-50" : "border-neutral-200"}`}>
                <span className="font-semibold">{m.name}</span>
                <span className="block text-xs text-neutral-400">{m.desc}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="주소 (선택)" hint="오시는 길 섹션에 들어가요">
          <input className="inp" value={address} maxLength={120} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 광진구 …" />
        </Field>
        <Field label="이 일을 시작한 이유 (선택)" hint="첫 번째 이야기로 만들어 드려요">
          <textarea className="inp min-h-20" value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder="예: 아버지 밑에서 10년 배우고 독립했어요" />
        </Field>

        {state === "error" && <p className="text-sm text-red-500">{errMsg}</p>}

        <button disabled={!canSubmit} onClick={submit}
          className="w-full rounded-full bg-teal-700 py-4 text-lg font-semibold text-white shadow-lg disabled:opacity-40">
          {state === "loading" ? "홈페이지를 만들고 있어요… (30초 정도)" : "홈페이지 만들기 — 무료"}
        </button>
        <p className="text-center text-xs text-neutral-400">1개월 무료 체험 · 이후 월 9,900원 · 언제든 해지</p>
      </div>

      <style>{`.inp{width:100%;border:1px solid #e5e5e5;border-radius:12px;padding:12px 14px;font-size:15px;outline:none}.inp:focus{border-color:#0e7365}`}</style>
    </main>
  );
}

function Field({ label, hint, hintColor, children }: { label: string; hint?: string; hintColor?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className={`mt-1 block text-xs ${hintColor ?? "text-neutral-400"}`}>{hint}</span>}
    </label>
  );
}
