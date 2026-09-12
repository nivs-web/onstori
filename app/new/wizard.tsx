"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { INDUSTRY_GROUPS, findSubIndustry, type SubIndustry } from "@/config/industry-picker";
import { ACCENTS, TONE_PREVIEW, themeFor, type Tone } from "@/config/palettes";
import { QUESTIONS } from "@/config/questions";
import { TRIAL_DAYS, COPY } from "@/lib/trial";
import { isValidPhone } from "@/lib/phone";
import { sbBrowser } from "@/lib/supabase/browser";
import { Logo } from "@/components/site/logo";

/* ─────────────────────────── 공용 ─────────────────────────── */

const STEPS = ["상호명", "업종", "가게 정보", "분위기", "만들기"] as const;

async function readJson(r: Response): Promise<Record<string, unknown>> {
  if ((r.headers.get("content-type") ?? "").includes("application/json")) return (await r.json()) as Record<string, unknown>;
  const body = (await r.text()).slice(0, 200);
  console.error(JSON.stringify({ evt: "non_json_response", status: r.status, body }));
  throw new Error(r.status >= 500 ? "만드는 데 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해주세요." : `서버 응답을 읽지 못했어요 (${r.status})`);
}

function anonId(): string {
  try {
    const v = localStorage.getItem("onstori:anonId") ?? crypto.randomUUID();
    localStorage.setItem("onstori:anonId", v);
    return v;
  } catch { return ""; }
}

/**
 * 「배지」 로고에서 글자가 테두리를 넘지 않게 크기를 정한다. (2026-09-12)
 *
 * ★ 버그: 알약 테두리 안쪽 폭이 **360px** 인데 글자 크기를 min(fs, 52) 로 못 박아 뒀다.
 *   한글 6자면 52×6=312 로 아슬아슬하고, **8자면 416** 이라 테두리와 겹쳤다(박팀장 발견).
 *
 * ★ 한글은 한 글자가 대략 글자크기만큼(1em) 넓고, 영문·숫자는 그 절반쯤(0.55em)이다.
 *   그 비율로 **실제 폭을 어림잡아** 크기를 맞춘다.
 * ★ 그래도 너무 작아지면(28px 미만) **두 줄로 나눈다** — 읽을 수 없는 로고는 로고가 아니다.
 */
function fitBadge(name: string, maxW = 360, maxSize = 52): { size: number; lines: string[] } {
  const emWidth = (t: string) =>
    [...t].reduce((w, ch) => w + (/[ㄱ-힝一-鿿぀-ヿ]/.test(ch) ? 1 : 0.55), 0);

  const one = emWidth(name) || 1;
  const size = Math.min(maxSize, maxW / one);
  if (size >= 28) return { size: Math.floor(size), lines: [name] };

  /* 두 줄 — 띄어쓰기가 있으면 거기서, 없으면 가운데서 자른다 */
  const sp = name.lastIndexOf(" ", Math.ceil(name.length / 2));
  const cut = sp > 0 ? sp : Math.ceil(name.length / 2);
  const lines = [name.slice(0, cut).trim(), name.slice(sp > 0 ? cut + 1 : cut).trim()].filter(Boolean);
  const widest = Math.max(...lines.map(emWidth), 1);
  return { size: Math.floor(Math.min(maxSize, maxW / widest)), lines };
}

/** 자동 로고 4안 — 상호명 워드마크 SVG. 즉시·무료. (기획1 #onboarding: AI 그림 로고는 후순위) */
function wordmarks(name: string, accent: string): { id: string; label: string; svg: string }[] {
  const esc = name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const initial = esc.trim().charAt(0) || "온";
  const fs = name.length > 8 ? 44 : name.length > 5 ? 56 : 68;
  // 사장님 로고 그림(SVG 파일)에 박히는 글꼴 이름이다 — 우리 사이트 웹폰트와 무관하고,
  // 보는 사람 컴퓨터에 있는 글꼴로 그려진다. 그래서 시스템에 있을 만한 것만 적는다.
  const serif = `"Nanum Myeongjo","Batang",serif`;
  const sans = `"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  return [
    { id: "serif", label: "세리프", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><text x="256" y="276" text-anchor="middle" font-family='${serif}' font-weight="700" font-size="${fs}" fill="${accent}">${esc}</text><rect x="196" y="316" width="120" height="6" fill="${accent}"/></svg>` },
    { id: "sans", label: "굵은 고딕", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="${accent}"/><text x="256" y="278" text-anchor="middle" font-family='${sans}' font-weight="800" font-size="${fs}" fill="#FFFFFF" letter-spacing="-2">${esc}</text></svg>` },
    { id: "mono", label: "모노그램", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><circle cx="256" cy="216" r="120" fill="${accent}"/><text x="256" y="262" text-anchor="middle" font-family='${serif}' font-weight="700" font-size="120" fill="#FFFFFF">${initial}</text><text x="256" y="420" text-anchor="middle" font-family='${sans}' font-weight="700" font-size="40" fill="#1B2C2C">${esc}</text></svg>` },
    /* ★ 2026-09-12 — 글자 크기를 **테두리 안쪽 폭에 맞춰 계산한다.** 전에는 min(fs,52) 로 못 박혀
       8자 이상 상호에서 글자가 테두리를 뚫고 나갔다(박팀장 발견). 너무 작아지면 두 줄로 간다. */
    badge(esc, accent, sans),
  ];
}

/** 「배지」 한 장 — 글자 수에 따라 크기가 줄고, 필요하면 두 줄이 된다 */
function badge(esc: string, accent: string, sans: string): { id: string; label: string; svg: string } {
  const { size, lines } = fitBadge(esc);
  /* 한 줄이면 가운데(272), 두 줄이면 위아래로 나눈다 — 알약 세로 가운데가 256 이다 */
  const ys = lines.length === 1 ? [272] : [256 - size * 0.15, 256 + size * 1.0];
  const text = lines
    .map((ln, i) => `<text x="256" y="${Math.round(ys[i])}" text-anchor="middle" font-family='${sans}' font-weight="800" font-size="${size}" fill="${accent}">${ln}</text>`)
    .join("");
  return {
    id: "badge", label: "배지",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><rect x="56" y="176" width="400" height="160" rx="80" fill="none" stroke="${accent}" stroke-width="10"/>${text}<text x="256" y="400" text-anchor="middle" font-family='${sans}' font-size="24" fill="#5F6B69" letter-spacing="6">SINCE ${new Date().getFullYear()}</text></svg>`,
  };
}

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/* ─────────────────────────── 위저드 ─────────────────────────── */

type Place = { source: string; name: string; category: string; address: string; roadAddress: string; phone: string; subIndustry?: string };

export function Wizard() {
  const params = useSearchParams();
  const pickedQuestion = useMemo(() => QUESTIONS.find((q) => q.id === params.get("q")) ?? null, [params]);

  const [step, setStep] = useState(0);
  // 1
  const [name, setName] = useState("");
  const [placeOn, setPlaceOn] = useState<boolean | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  // 2
  const [group, setGroup] = useState(INDUSTRY_GROUPS[0].id);
  const [sub, setSub] = useState<SubIndustry | null>(null);
  const [filter, setFilter] = useState("");
  // 3
  const [oneLiner, setOneLiner] = useState("");
  const [phone, setPhone] = useState("");
  /** ★ 문의 알림이 가는 주소. 비면 문의가 와도 사장님이 모른다(2026-09-11 회장님 결정) */
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [why, setWhy] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoAuto, setLogoAuto] = useState<string | null>(null); // 선택한 자동 로고 id
  // 4
  const [tone, setTone] = useState<Tone>("light");
  const [accent, setAccent] = useState(ACCENTS[0].id);

  /* ★ 가입 동의 (2026-09-12 회장님 지시 2). 손님은 체크박스로 보호받는데 사장님은
     하나도 없었다. 필수 둘·선택 하나로 **반드시 나눠 둔다** — 선택을 필수처럼 묶으면 법 위반이다. */
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  // 5
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  /* 진행 단계. 92% 까지는 시간 추정이라 문구도 추정이고, 그 뒤는 실제로 끝난 일이다. */
  const [stage, setStage] = useState<"copy" | "photo" | "layout" | "logo" | "finish">("copy");
  const [errMsg, setErrMsg] = useState("");
  /* 이미 홈페이지를 가진 계정인가 — 이때는 "다시 만들기" 가 아니라 "내 홈페이지로" 를 보여 준다.
     한 계정에 하나뿐이라(config/limits.ts) 다시 눌러 봐야 똑같이 막힌다. */
  const [alreadyHasSite, setAlreadyHasSite] = useState(false);
  const [result, setResult] = useState<{ url: string; slug: string } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const accentHex = ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex;
  const marks = useMemo(() => wordmarks(name || "온스토리", accentHex), [name, accentHex]);

  /* 플레이스 검색 가능 여부 + 로그인 상태 */
  useEffect(() => {
    fetch("/api/place-search?q=").then(readJson).then((d) => setPlaceOn(!!d.available)).catch(() => setPlaceOn(false));
    Promise.resolve().then(() => sbBrowser().auth.getUser()).then(({ data }) => setSignedIn(!!data.user)).catch(() => setSignedIn(false));
  }, []);

  async function searchPlace() {
    setPlaceBusy(true);
    try {
      const d = await readJson(await fetch(`/api/place-search?q=${encodeURIComponent(name.trim())}`));
      setPlaces((d.items as Place[]) ?? []);
    } catch { setPlaces([]); }
    setPlaceBusy(false);
  }

  function applyPlace(p: Place) {
    setName(p.name);
    if (p.roadAddress || p.address) setAddress(p.roadAddress || p.address);
    if (p.phone) setPhone(p.phone);
    if (p.subIndustry) {
      const s = findSubIndustry(p.subIndustry);
      if (s) { setSub(s); setGroup(INDUSTRY_GROUPS.find((g) => g.items.includes(s))?.id ?? group); }
    }
    setPlaces(null);
  }

  function onLogoFile(f: File | null) {
    setLogoFile(f); setLogoAuto(null);
    if (!f) { setLogoPreview(""); return; }
    const url = URL.createObjectURL(f); setLogoPreview(url);
  }

  const can1 = name.trim().length >= 1;
  const can2 = !!sub;
  // 비어 있을 때는 조용히 둔다 — 아직 안 적은 것을 틀렸다고 하지 않는다. 적었는데 형식이 아닐 때만 말한다.
  const phoneErr = phone.trim() && !isValidPhone(phone) ? "전화번호를 정확히 입력해 주세요 — 숫자 9자리 이상" : "";
  /* ⚠ 지나치게 깐깐하게 잡지 않는다. 「@ 가 있고 점이 있는가」만 본다 —
     정규식으로 조이면 멀쩡한 회사 메일이 막히는 일이 더 잦다. */
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const emailErr = email.trim() && !emailOk ? "메일 주소를 정확히 입력해 주세요 — 예: example@gmail.com" : "";
  const can3 = oneLiner.trim().length >= 2 && isValidPhone(phone) && emailOk;

  /* 만들기 — 가짜 진행률(30초 곡선) + 실제 완료 시 100% */
  async function create() {
    setState("loading"); setErrMsg(""); setAlreadyHasSite(false); setProgress(1); setStage("copy");
    let elapsed = 0; // 초 — 400ms 마다 누적 (Date.now 대신 카운터: 렌더 순수성 규칙)
    const tick = setInterval(() => {
      elapsed += 0.4;
      const pct = Math.min(92, Math.round(100 * (1 - Math.exp(-elapsed / 18))));
      setProgress((p) => Math.max(p, pct));
      setStage(pct < 30 ? "copy" : pct < 60 ? "photo" : "layout");
    }, 400);
    try {
      const theme = themeFor(tone, accent);
      const aid = anonId();
      const body = {
        businessName: name.trim(), oneLiner: oneLiner.trim(), phone: phone.trim(), email: email.trim(),
        mood: theme.palette, accent: theme.accent,
        industryId: sub?.industryId, industryLabel: sub?.label,
        address: address.trim() || undefined, whyStarted: why.trim() || undefined, anonId: aid || undefined,
        /* ★ 동의는 서버가 다시 검사한다 — 화면 값을 믿지 않는다(불변 규칙 4의 정신) */
        consents: { terms: agreeTerms, privacy: agreePrivacy, marketing: agreeMarketing },
      };
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await readJson(r);
      if (r.status === 409 && d.goMy) { setAlreadyHasSite(true); throw new Error(String(d.error)); }
      if (!r.ok) throw new Error(String(d.error ?? "생성 실패"));
      // 로고 — 생성 뒤 소유권(anonId)으로 업로드. 실패해도 홈페이지는 이미 생겼으므로 조용히 넘어간다.
      try {
        const fd = new FormData();
        fd.set("slug", String(d.slug)); if (aid) fd.set("anonId", aid);
        if (logoFile) fd.set("file", logoFile);
        else if (logoAuto) fd.set("svg", marks.find((m) => m.id === logoAuto)?.svg ?? "");
        // 여기부터는 추정이 아니다 — 생성 응답을 이미 받았다
        if (logoFile || logoAuto) { setProgress(95); setStage("logo"); await fetch("/api/site/logo", { method: "POST", body: fd }); }
      } catch {}
      try { if (pickedQuestion) localStorage.setItem("onstori:firstQuestion", pickedQuestion.id); } catch {}
      clearInterval(tick); setProgress(100); setStage("finish");
      setResult({ url: String(d.url), slug: String(d.slug) });
      setTimeout(() => setState("done"), 600);
    } catch (e) {
      clearInterval(tick);
      setErrMsg(e instanceof Error ? e.message : "생성에 실패했어요");
      setState("error");
    }
  }

  /* ───────── 화면 ───────── */

  // 컴포넌트가 아니라 렌더 함수 — 매 렌더마다 새 컴포넌트 타입이 되면 입력창이 리마운트되어 포커스를 잃는다
  const shell = (children: React.ReactNode) => (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:pt-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="온스토리 홈" className="flex items-center" style={{ minHeight: "var(--tap)" }}><Logo height={20} /></Link>
          <span className="t-caption">{TRIAL_DAYS}일 전 기능 무료</span>
        </div>
        {/* 진행 바 2px. width 가 아니라 scaleX 를 움직인다 — width 애니메이션은 매 프레임
            레이아웃을 다시 계산해 끊긴다 (docs/MOTION.md). */}
        <div className="overflow-hidden" style={{ marginTop: "var(--s-4)", height: 2, borderRadius: "var(--r-full)", background: "var(--n-200)" }}>
          <div
            className="h-full origin-left"
            style={{
              transform: `scaleX(${(step + 1) / STEPS.length})`,
              background: "var(--green-700)",
              transition: "transform var(--dur-3) var(--ease)",
            }}
          />
        </div>
        <p className="t-caption font-bold" style={{ marginTop: "var(--s-2)", color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
          STEP {step + 1} / {STEPS.length} · {STEPS[step]}
        </p>
        {children}
      </div>
    </main>
  );

  const nav = ({ next, canNext, label = "다음 →" }: { next: () => void; canNext: boolean; label?: string }) => (
    <div
      className="fixed inset-x-0 bottom-0 z-20"
      style={{
        background: "color-mix(in srgb, var(--n-0) 95%, transparent)",
        borderTop: "1px solid var(--n-200)",
        paddingBottom: "env(safe-area-inset-bottom)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between" style={{ paddingInline: "var(--gutter)", paddingBlock: "var(--s-2)" }}>
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-text disabled:opacity-30">← 뒤로</button>
        <button type="button" onClick={next} disabled={!canNext} className="btn btn-primary disabled:opacity-40">{label}</button>
      </div>
    </div>
  );

  const STAGE_TEXT: Record<typeof stage, string> = {
    copy: "업종에 맞는 문구를 쓰고 있어요",
    photo: "사진을 고르고 있어요",
    layout: "섹션을 배치하고 있어요",
    logo: "로고를 올리고 있어요",
    finish: "마무리하고 있어요",
  };
  const stageText = STAGE_TEXT[stage];

  /* 5단계 — 만드는 중 / 완료 */
  if (step === 4) {
    return shell(
      <>
        {state === "done" && result ? (
          <section className="mt-8 text-center">
            <p className="t-display">🎉</p>
            <h1 className="t-h1" style={{ marginTop: "var(--s-3)" }}>홈페이지가 완성됐어요</h1>
            <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{result.url.replace("https://", "")}</p>
            <div className="card text-left" style={{ marginTop: "var(--s-6)", padding: "var(--s-5)" }}>
              <p className="t-body font-semibold" style={{ color: "var(--n-900)" }}>{COPY.policy}</p>
              <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>
                {signedIn ? "지금 바로 전 기능을 쓰실 수 있어요. 첫 질문은 문자로 보내드릴게요." : "정회원 이용은 회원가입(카카오 또는 이메일)이 필요해요. 가입하면 이 홈페이지가 사장님 계정에 연결되고, 첫 질문이 문자로 갑니다."}
              </p>
            </div>
            <a href={signedIn ? `/${result.slug}/edit` : `/login?next=${encodeURIComponent(`/${result.slug}/edit`)}`} className="btn btn-primary w-full" style={{ marginTop: "var(--s-5)" }}>
              정회원 이용하기 — {TRIAL_DAYS}일 무료
            </a>
            <a href={result.url} target="_blank" rel="noopener" className="btn btn-secondary w-full" style={{ marginTop: "var(--s-3)" }}>내 홈페이지 먼저 보기 ↗</a>
            <p className="t-caption" style={{ marginTop: "var(--s-5)" }}>정회원 {COPY.priceLine} · 매달 자동 결제 · 언제든 해지</p>
          </section>
        ) : state === "error" ? (
          alreadyHasSite ? (
            /* 한 계정에 홈페이지 하나 — 실패가 아니라 안내다.
               "다시 만들기" 를 보여 주면 안 된다. 눌러 봐야 똑같이 막힌다. */
            <section className="mt-10 text-center">
              <h1 className="t-h1">이미 홈페이지가 있어요</h1>
              <p className="t-body measure mx-auto" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>{errMsg}</p>
              <Link href="/my" className="btn btn-primary" style={{ marginTop: "var(--s-6)" }}>내 홈페이지로</Link>
            </section>
          ) : (
          <section className="mt-10 text-center">
            <h1 className="t-h1">잠깐 멈췄어요</h1>
            <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--danger)" }}>{errMsg}</p>
            <button type="button" onClick={create} className="btn btn-primary" style={{ marginTop: "var(--s-5)" }}>다시 만들기</button>
            <button type="button" onClick={() => setStep(3)} className="btn btn-text w-full" style={{ marginTop: "var(--s-3)" }}>이전 단계로</button>
          </section>
          )
        ) : (
          <section className="mt-10 text-center">
            <h1 className="t-h1">홈페이지를 만들고 있어요</h1>
            <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>문구를 쓰고, 사진을 고르고, 구조를 짜는 중입니다. 30초쯤 걸려요.</p>
            <div className="card mx-auto" style={{ marginTop: "var(--s-7)", maxWidth: "24rem", padding: "var(--s-6)" }}>
              <p className="t-display" style={{ color: "var(--n-900)", lineHeight: 1 }}>{progress}%</p>
              <div className="overflow-hidden" style={{ marginTop: "var(--s-4)", height: 2, borderRadius: "var(--r-full)", background: "var(--n-200)" }}>
                <div
                  className="h-full origin-left"
                  style={{ transform: `scaleX(${progress / 100})`, background: "var(--green-700)", transition: "transform var(--dur-4) var(--ease)" }}
                />
              </div>
              {/* ⚠ 92% 까지는 시간 기반 추정이다 — 서버가 진행 상황을 흘려보내지 않는다.
                  진짜 서버 진행률은 /api/generate 를 스트리밍(SSE)으로 바꿔야 나온다(별도 작업).
                  93% 부터는 추정이 아니라 실제로 일어난 일이다: 응답을 받았고 로고를 올리는 중. */}
              <p className="t-small" style={{ marginTop: "var(--s-4)", color: "var(--text)" }}>{stageText}</p>
            </div>
            <ul className="t-body mx-auto text-left" style={{ marginTop: "var(--s-6)", maxWidth: "24rem", color: "var(--text)" }}>
              <li>✎ 글쓰기 금지 — 사장님은 이제 말만 하시면 됩니다.</li>
              <li>🔗 문자 링크만 누르세요 — 매주 질문이 문자로 갑니다.</li>
              <li>⤓ 다운로드 없음 — 앱 설치 없이 브라우저에서 60초.</li>
            </ul>
          </section>
        )}
      </>
    );
  }

  return shell(
    <>
      {/* 1 상호명 */}
      {step === 0 && (
        <section className="mt-6">
          <h1 className="font-display t-h1 leading-snug">사장님 가게 이름부터<br />알려주세요</h1>
          <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>글 못 써도 됩니다. 말은 하시잖아요. 여기선 이름만 적어 주세요.</p>
          {pickedQuestion && (
            <p className="mt-4 rounded-xl px-4 py-3 t-small" style={{ background: "var(--lime)", color: "var(--forest)" }}>
              고르신 첫 질문: <b>{pickedQuestion.text}</b> — 홈페이지가 생기면 이 질문부터 문자로 보내드려요.
            </p>
          )}
          <input className="field mt-8" value={name} maxLength={40} autoFocus onChange={(e) => { setName(e.target.value); setPlaces(null); }} placeholder="예: 바른전기 · 카페 크로프트" />
          {placeOn && (
            <div className="mt-3 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="t-small"><b>네이버 플레이스에 등록된 가게</b>라면 이름·업종·주소·전화를 불러올 수 있어요.</p>
                <button type="button" disabled={!can1 || placeBusy} onClick={searchPlace} className="btn-forest !py-2 !t-small disabled:opacity-40">{placeBusy ? "찾는 중…" : "플레이스에서 불러오기"}</button>
              </div>
              <p className="mt-1 t-caption" style={{ color: "var(--muted)" }}>영업시간·사진·소개는 네이버가 열어 두지 않아 가져올 수 없어요. 뒤에서 직접 적어 주세요.</p>
              {places && (
                <ul className="mt-3 space-y-2">
                  {places.length === 0 && <li className="t-small" style={{ color: "var(--muted)" }}>찾지 못했어요. 이름을 조금 다르게 적어 보시거나, 그냥 다음으로 가셔도 됩니다.</li>}
                  {places.map((p, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => applyPlace(p)} className="w-full rounded-xl border p-3 text-left hover:bg-n-50" style={{ borderColor: "var(--line)" }}>
                        <p className="t-small font-bold">{p.name} <span className="t-caption font-medium" style={{ color: "var(--muted)" }}>{p.source === "naver" ? "네이버" : "카카오"}</span></p>
                        <p className="t-caption" style={{ color: "var(--muted)" }}>{p.category}{p.roadAddress || p.address ? ` · ${p.roadAddress || p.address}` : ""}{p.phone ? ` · ${p.phone}` : ""}</p>
                        <p className="mt-1 t-caption font-semibold" style={{ color: "var(--green)" }}>이 매장이 맞나요? → 불러오기</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {nav({ next: () => setStep(1), canNext: can1 })}
        </section>
      )}

      {/* 2 업종 */}
      {step === 1 && (
        <section className="mt-6">
          <h1 className="font-display t-h1 leading-snug">어떤 일을 하시나요?</h1>
          <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>가장 가까운 것 하나만 고르세요. 나중에 바꿀 수 있어요. (쇼핑몰은 지원하지 않아요)</p>
          <input className="field mt-6" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="업종 검색 — 예: 도배, 네일, 카페" />
          {!filter && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {INDUSTRY_GROUPS.map((g) => (
                <button key={g.id} type="button" onClick={() => setGroup(g.id)} className="shrink-0 rounded-full border px-3.5 py-2 t-small font-semibold"
                  style={{ borderColor: group === g.id ? "var(--n-800)" : "var(--n-200)", background: group === g.id ? "var(--n-800)" : "var(--n-0)", color: group === g.id ? "var(--n-0)" : "var(--n-800)", minHeight: "var(--tap)" }}>
                  {g.emoji} {g.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(filter
              ? INDUSTRY_GROUPS.flatMap((g) => g.items).filter((s) => s.label.replace(/\s/g, "").includes(filter.replace(/\s/g, "")))
              : INDUSTRY_GROUPS.find((g) => g.id === group)!.items
            ).map((s) => {
              const on = sub?.label === s.label;
              return (
                <button key={s.label} type="button" onClick={() => setSub(s)} className="rounded-xl border px-3.5 py-2.5 t-small font-medium"
                  style={{ borderColor: on ? "var(--green-700)" : "var(--n-200)", background: on ? "var(--green-50)" : "var(--n-0)", color: on ? "var(--green-700)" : "var(--n-900)", fontWeight: on ? 700 : 500, minHeight: "var(--tap)" }}>
                  {on ? "✓ " : ""}{s.label}
                </button>
              );
            })}
          </div>
          {sub && <p className="mt-4 t-small" style={{ color: "var(--muted)" }}>선택: <b style={{ color: "var(--forest)" }}>{sub.label}</b></p>}
          {nav({ next: () => setStep(2), canNext: can2 })}
        </section>
      )}

      {/* 3 가게 정보 */}
      {step === 2 && (
        <section className="mt-6 space-y-7">
          <div>
            <h1 className="font-display t-h1 leading-snug">가게를 한 줄로 소개해 주세요</h1>
            <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>사장님 말투 그대로. 문구는 온스토리가 다듬어요.</p>
          </div>
          <Field label="하는 일 한 줄">
            <input className="field" value={oneLiner} maxLength={120} onChange={(e) => setOneLiner(e.target.value)} placeholder={`예: ${sub?.label ?? "인테리어"}를 해요. 작은 현장도 갑니다.`} />
          </Field>
          <Field label="로고" hint="직접 올리거나(정사각 512×512 이상 · PNG/JPG/SVG · 2MB), 온스토리가 만든 4안 중 고르세요. 나중에 바꿀 수 있어요.">
            <div className="grid grid-cols-5 gap-2">
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white text-center t-caption" style={{ borderColor: logoFile ? "var(--green)" : "var(--line)" }}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="올린 로고" className="h-full w-full rounded-xl object-contain p-1" />
                ) : (<><span className="t-h2">＋</span>직접 올리기</>)}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} />
              </label>
              {marks.map((m) => (
                <button key={m.id} type="button" onClick={() => { setLogoAuto(m.id); onLogoFile(null); setLogoAuto(m.id); }} className="aspect-square overflow-hidden rounded-xl border bg-white" style={{ borderColor: logoAuto === m.id ? "var(--green)" : "var(--line)", boxShadow: logoAuto === m.id ? "0 0 0 2px var(--green)" : undefined }} title={m.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={svgUrl(m.svg)} alt={`자동 로고 ${m.label}`} className="h-full w-full" />
                </button>
              ))}
            </div>
            <p className="mt-1 t-caption" style={{ color: "var(--muted)" }}>{logoFile ? "올린 로고를 써요" : logoAuto ? `자동 로고 · ${marks.find((m) => m.id === logoAuto)?.label}` : "로고 없이 시작해도 돼요"}</p>
          </Field>
          {/* ★★ 2026-09-12 — 「홈페이지 주소」 칸을 **없앴다.** 가입 이탈 1위였다(회장님).
              한글 상호면 자동 초안이 빈칸이고, 한글을 치면 글자가 안 찍히는데 **이유를 안 알려줬다.**
              사장님은 「고장났나」 하고 나간다.
              ★ 이제 **서버가 상호·업종에서 짓고, 겹치면 뒤에 숫자를 붙인다**(lib/slug.ts).
              ⚠ 주소를 나중에 바꾸는 길은 편집화면에 남길 자리다 — 이미 발행된 주소가 깨지므로
                되돌리기(리다이렉트)까지 같이 만들어야 한다. 지금은 손대지 않는다. */}
          <Field label="전화번호 (필수)" hint={phoneErr} hintColor={phoneErr ? "text-danger" : undefined}>
            <input
              className="field"
              value={phone}
              maxLength={20}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              aria-invalid={!!phoneErr}
              aria-describedby="phone-why"
            />
            {/* 회색 힌트로 만들지 않는다 — 손님이 전화를 걸 번호라 눈에 걸려야 한다.
                ⚠ 2026-09-11 — 「문자가 옵니다」를 뺐다. 문의 알림은 **이메일로** 간다(회장님 결정). */}
            <p id="phone-why" className="t-small" style={{ marginTop: "var(--s-2)", borderRadius: "var(--r-md)", padding: "var(--s-2) var(--s-3)", background: "var(--green-50)", color: "var(--n-800)" }}>
              고객의 문의를 받을 수 있는 실제 사장님의 정확한 전화번호를 입력해주세요.
            </p>
          </Field>
          {/* ★ 2026-09-11 신설 — **문의 알림이 이 주소로 간다.** 비면 문의가 와도 사장님이 모른다.
              ⚠ 표를 새로 만들지 않았다. `sites.settings` 가 jsonb 라 `settings.notify.email` 에 넣는다 —
                `lib/notify.ts` 의 `resolveTargets()` 가 이미 그 자리를 읽는다. */}
          <Field label="이메일 (필수)" hint={emailErr} hintColor={emailErr ? "text-danger" : undefined}>
            <input
              className="field"
              value={email}
              maxLength={120}
              inputMode="email"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              aria-invalid={!!emailErr}
              aria-describedby="email-why"
            />
            <p id="email-why" className="t-small" style={{ marginTop: "var(--s-2)", borderRadius: "var(--r-md)", padding: "var(--s-2) var(--s-3)", background: "var(--green-50)", color: "var(--n-800)" }}>
              정확한 메일 주소를 입력해주세요. 고객 문의가 오면 이메일로 연락이 옵니다.<br />
              반드시 이메일의 알림 기능을 활성화 해주세요<br />
              (이메일 앱에서 알림을 켜면 메일 도착 즉시 핸드폰에 알림이 옵니다)
            </p>
          </Field>
          <Field label="주소 (선택)" hint="오시는 길 섹션에 들어가요">
            <input className="field" value={address} maxLength={120} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 광진구 …" />
          </Field>
          <Field label="이 일을 시작한 이유 (선택)" hint="첫 번째 이야기로 만들어 드려요. 비워 두면 첫 질문 때 말로 하셔도 됩니다.">
            <textarea className="field min-h-20" value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder="예: 아버지 밑에서 10년 배우고 독립했어요" />
          </Field>
          {nav({ next: () => setStep(3), canNext: can3 })}
        </section>
      )}

      {/* 4 분위기 */}
      {step === 3 && (
        <section className="mt-6">
          <h1 className="font-display t-h1 leading-snug">분위기를 골라 주세요</h1>
          <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>바탕은 다크/화이트, 포인트색은 8가지. 미리보기를 보고 고르세요.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {(["light", "dark"] as Tone[]).map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)} className="rounded-2xl border p-4 text-left" style={{ borderColor: tone === t ? "var(--green)" : "var(--line)", background: TONE_PREVIEW[t].bg, color: TONE_PREVIEW[t].ink, boxShadow: tone === t ? "0 0 0 2px var(--green)" : undefined }}>
                <p className="t-body font-bold">{t === "light" ? "화이트" : "다크"}</p>
                <p className="t-caption" style={{ color: TONE_PREVIEW[t].muted }}>{t === "light" ? "밝고 깔끔한 바탕" : "묵직하고 고급스러운 바탕"}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ACCENTS.map((a) => {
              const on = accent === a.id; const tp = TONE_PREVIEW[tone];
              return (
                <button key={a.id} type="button" onClick={() => setAccent(a.id)} className="overflow-hidden rounded-2xl border text-left" style={{ borderColor: on ? a.hex : "var(--line)", boxShadow: on ? `0 0 0 2px ${a.hex}` : undefined }}>
                  {/* 미니 미리보기 — 히어로·버튼·카드 */}
                  <div className="p-3" style={{ background: tp.bg, color: tp.ink }} aria-hidden>
                    <div className="h-10 rounded-md" style={{ background: `linear-gradient(150deg, ${a.hex} 0%, ${tp.ink} 100%)` }} />
                    <div className="mt-2 h-2 w-3/4 rounded" style={{ background: tp.ink, opacity: 0.85 }} />
                    <div className="mt-1 h-2 w-1/2 rounded" style={{ background: tp.muted, opacity: 0.6 }} />
                    <div className="mt-2 flex gap-1">
                      <span className="h-5 w-12 rounded-full" style={{ background: a.hex }} />
                      <span className="h-5 flex-1 rounded-md" style={{ background: tp.card }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-2">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: a.hex }} />
                    <span className="t-small font-bold">{a.name}</span>
                    <span className="t-caption" style={{ color: "var(--muted)" }}>{a.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {/* ★★ 가입 동의 — 만들기 «직전»이 마지막 문이다 (2026-09-12 회장님 지시 2).
              · 필수 둘은 안 누르면 [홈페이지 만들기] 가 눌리지 않는다
              · 알림 수신은 **선택**이다. 안 눌러도 가입은 그대로 된다
              · 문서는 **새 창**으로 연다 — 여기서 나가면 적어 둔 것이 다 날아간다 */}
          <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--n-0)" }}>
            <Consent
              checked={agreeTerms} onChange={setAgreeTerms} required
              label={<><Doc href="/terms">이용약관</Doc>에 동의합니다</>}
            />
            <Consent
              checked={agreePrivacy} onChange={setAgreePrivacy} required
              label={<><Doc href="/privacy">개인정보 수집·이용</Doc>에 동의합니다</>}
            />
            <Consent
              checked={agreeMarketing} onChange={setAgreeMarketing}
              label={<>촬영 알림·안내를 문자로 받겠습니다</>}
              hint="안 하셔도 가입돼요. 손님 문의 알림은 이것과 상관없이 갑니다."
            />
          </div>

          {nav({
            next: () => { setStep(4); void create(); },
            canNext: agreeTerms && agreePrivacy,
            label: "홈페이지 만들기 — 무료",
          })}
        </section>
      )}

      {/* 입력창은 공용 .field (app/globals.css) — 높이 48, focus 초록 2px + 바깥 4px 링 */}
    </>
  );
}

/** 동의 문서 링크 — **새 창**으로 연다. 여기서 나가면 적어 둔 것이 날아간다 */
function Doc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="underline underline-offset-2 font-bold"
      style={{ color: "var(--green-700)" }}
    >
      {children}
    </Link>
  );
}

/**
 * 동의 한 줄. 손님 견적 폼과 **같은 결**로 맞췄다 — 사장님만 홀대하지 않는다.
 * ⚠ 「필수」와 「선택」을 글자로 보이게 둔다. 표시가 없으면 선택도 필수처럼 읽힌다.
 */
function Consent({ checked, onChange, label, hint, required }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: React.ReactNode; hint?: string; required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3" style={{ paddingBlock: "var(--s-2)", minHeight: "var(--tap)" }}>
      <input
        type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0"
      />
      <span className="min-w-0">
        <span className="t-small block">
          <b style={{ color: required ? "var(--green-700)" : "var(--muted)" }}>{required ? "[필수]" : "[선택]"}</b>{" "}
          {label}
        </span>
        {hint && <span className="t-caption block" style={{ marginTop: "var(--s-1)", color: "var(--muted)" }}>{hint}</span>}
      </span>
    </label>
  );
}

function Field({ label, hint, hintColor, children }: { label: string; hint?: string; hintColor?: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="t-body block font-bold" style={{ marginBottom: "var(--s-2)" }}>{label}</span>
      {children}
      {hint && <span className={`t-small block ${hintColor ?? ""}`} style={hintColor ? { marginTop: "var(--s-1)" } : { marginTop: "var(--s-1)", color: "var(--text)" }}>{hint}</span>}
    </div>
  );
}
