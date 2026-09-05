"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { INDUSTRY_GROUPS, findSubIndustry, type SubIndustry } from "@/config/industry-picker";
import { ACCENTS, TONE_PREVIEW, themeFor, type Tone } from "@/config/palettes";
import { QUESTIONS } from "@/config/questions";
import { TRIAL_DAYS, TRIAL_NOTICE } from "@/lib/trial";
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

/** 상호명 → 영문 슬러그 초안 (한글은 못 옮기므로 비워두고 사장님이 짓는다) */
function slugSuggest(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  return s.length >= 3 ? s : "";
}

/** 자동 로고 4안 — 상호명 워드마크 SVG. 즉시·무료. (기획1 #onboarding: AI 그림 로고는 후순위) */
function wordmarks(name: string, accent: string): { id: string; label: string; svg: string }[] {
  const esc = name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const initial = esc.trim().charAt(0) || "온";
  const fs = name.length > 8 ? 44 : name.length > 5 ? 56 : 68;
  const serif = `"Noto Serif KR","Nanum Myeongjo",serif`;
  const sans = `"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  return [
    { id: "serif", label: "세리프", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><text x="256" y="276" text-anchor="middle" font-family='${serif}' font-weight="700" font-size="${fs}" fill="${accent}">${esc}</text><rect x="196" y="316" width="120" height="6" fill="${accent}"/></svg>` },
    { id: "sans", label: "굵은 고딕", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="${accent}"/><text x="256" y="278" text-anchor="middle" font-family='${sans}' font-weight="800" font-size="${fs}" fill="#FFFFFF" letter-spacing="-2">${esc}</text></svg>` },
    { id: "mono", label: "모노그램", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><circle cx="256" cy="216" r="120" fill="${accent}"/><text x="256" y="262" text-anchor="middle" font-family='${serif}' font-weight="700" font-size="120" fill="#FFFFFF">${initial}</text><text x="256" y="420" text-anchor="middle" font-family='${sans}' font-weight="700" font-size="40" fill="#1B2C2C">${esc}</text></svg>` },
    { id: "badge", label: "배지", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFFFFF"/><rect x="56" y="176" width="400" height="160" rx="80" fill="none" stroke="${accent}" stroke-width="10"/><text x="256" y="272" text-anchor="middle" font-family='${sans}' font-weight="800" font-size="${Math.min(fs, 52)}" fill="${accent}">${esc}</text><text x="256" y="400" text-anchor="middle" font-family='${sans}' font-size="24" fill="#5F6B69" letter-spacing="6">SINCE ${new Date().getFullYear()}</text></svg>` },
  ];
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
  const [address, setAddress] = useState("");
  const [slug, setSlug] = useState("");
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [why, setWhy] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoAuto, setLogoAuto] = useState<string | null>(null); // 선택한 자동 로고 id
  // 4
  const [tone, setTone] = useState<Tone>("light");
  const [accent, setAccent] = useState(ACCENTS[0].id);
  // 5
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const [result, setResult] = useState<{ url: string; slug: string } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentHex = ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex;
  const marks = useMemo(() => wordmarks(name || "온스토리", accentHex), [name, accentHex]);

  /* 플레이스 검색 가능 여부 + 로그인 상태 */
  useEffect(() => {
    fetch("/api/place-search?q=").then(readJson).then((d) => setPlaceOn(!!d.available)).catch(() => setPlaceOn(false));
    Promise.resolve().then(() => sbBrowser().auth.getUser()).then(({ data }) => setSignedIn(!!data.user)).catch(() => setSignedIn(false));
  }, []);

  /* 슬러그 실시간 검사 */
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!slug) { setSlugMsg(null); return; }
      try {
        const d = await readJson(await fetch(`/api/slug-check?slug=${encodeURIComponent(slug)}`));
        setSlugMsg(d.available ? { ok: true, msg: "사용 가능한 주소예요" } : { ok: false, msg: String(d.reason ?? "") });
      } catch { setSlugMsg(null); }
    }, 400);
  }, [slug]);

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
  const can3 = oneLiner.trim().length >= 2 && isValidPhone(phone) && !!slug && !!slugMsg?.ok;

  /* 만들기 — 가짜 진행률(30초 곡선) + 실제 완료 시 100% */
  async function create() {
    setState("loading"); setErrMsg(""); setProgress(1);
    let elapsed = 0; // 초 — 400ms 마다 누적 (Date.now 대신 카운터: 렌더 순수성 규칙)
    const tick = setInterval(() => {
      elapsed += 0.4;
      setProgress((p) => Math.max(p, Math.min(92, Math.round(100 * (1 - Math.exp(-elapsed / 18))))));
    }, 400);
    try {
      const theme = themeFor(tone, accent);
      const aid = anonId();
      const body = {
        businessName: name.trim(), oneLiner: oneLiner.trim(), phone: phone.trim(), slug,
        mood: theme.palette, accent: theme.accent,
        industryId: sub?.industryId, industryLabel: sub?.label,
        address: address.trim() || undefined, whyStarted: why.trim() || undefined, anonId: aid || undefined,
      };
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await readJson(r);
      if (!r.ok) throw new Error(String(d.error ?? "생성 실패"));
      // 로고 — 생성 뒤 소유권(anonId)으로 업로드. 실패해도 홈페이지는 이미 생겼으므로 조용히 넘어간다.
      try {
        const fd = new FormData();
        fd.set("slug", String(d.slug)); if (aid) fd.set("anonId", aid);
        if (logoFile) fd.set("file", logoFile);
        else if (logoAuto) fd.set("svg", marks.find((m) => m.id === logoAuto)?.svg ?? "");
        if (logoFile || logoAuto) await fetch("/api/site/logo", { method: "POST", body: fd });
      } catch {}
      try { if (pickedQuestion) localStorage.setItem("onstori:firstQuestion", pickedQuestion.id); } catch {}
      clearInterval(tick); setProgress(100);
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
          <Link href="/" aria-label="온스토리 홈"><Logo height={20} /></Link>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>{TRIAL_DAYS}일 전 기능 무료</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--lime-2)" }} />
        </div>
        <p className="mt-2 text-[11.5px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>
          STEP {step + 1} / {STEPS.length} · {STEPS[step]}
        </p>
        {children}
      </div>
    </main>
  );

  const nav = ({ next, canNext, label = "다음 →" }: { next: () => void; canNext: boolean; label?: string }) => (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t" style={{ background: "rgba(255,255,255,0.95)", borderColor: "var(--line)" }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="text-[14px] font-semibold disabled:opacity-30" style={{ color: "var(--forest)" }}>← 뒤로</button>
        <button type="button" onClick={next} disabled={!canNext} className="btn-lime disabled:opacity-40 disabled:shadow-none">{label}</button>
      </div>
    </div>
  );

  /* 5단계 — 만드는 중 / 완료 */
  if (step === 4) {
    return shell(
      <>
        {state === "done" && result ? (
          <section className="mt-8 text-center">
            <p className="text-[44px]">🎉</p>
            <h1 className="font-display mt-3 text-[28px] sm:text-[34px]">홈페이지가 완성됐어요</h1>
            <p className="mt-2 text-[15px]" style={{ color: "var(--muted)" }}>{result.url.replace("https://", "")}</p>
            <div className="mt-8 rounded-2xl border bg-white p-5 text-left" style={{ borderColor: "var(--line)" }}>
              <p className="text-[14.5px] font-semibold" style={{ color: "var(--forest)" }}>{TRIAL_NOTICE}</p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {signedIn ? "지금 바로 전 기능을 쓰실 수 있어요. 첫 질문은 문자로 보내드릴게요." : "정회원 이용은 회원가입(카카오 또는 이메일)이 필요해요. 가입하면 이 홈페이지가 사장님 계정에 연결되고, 첫 질문이 문자로 갑니다."}
              </p>
            </div>
            <a href={signedIn ? `/${result.slug}/edit` : `/login?next=${encodeURIComponent(`/${result.slug}/edit`)}`} className="btn-lime mt-6 w-full !py-4 !text-[16px]">
              정회원 이용하기 — {TRIAL_DAYS}일 무료
            </a>
            <a href={result.url} target="_blank" rel="noopener" className="btn-ghost mt-3 w-full">내 홈페이지 먼저 보기 ↗</a>
            <p className="mt-6 text-[12px]" style={{ color: "var(--muted)" }}>{TRIAL_DAYS}일 이내 정회원(49,000원) 전환 시 계속 유지 · 이후 자동 삭제 · 언제든 해지</p>
          </section>
        ) : state === "error" ? (
          <section className="mt-10 text-center">
            <h1 className="font-display text-[26px]">잠깐 멈췄어요</h1>
            <p className="mt-3 text-[14.5px] text-red-600">{errMsg}</p>
            <button type="button" onClick={create} className="btn-lime mt-6">다시 만들기</button>
            <button type="button" onClick={() => setStep(3)} className="mt-3 block w-full text-[14px] underline" style={{ color: "var(--muted)" }}>이전 단계로</button>
          </section>
        ) : (
          <section className="mt-10 text-center">
            <h1 className="font-display text-[26px] sm:text-[30px]">홈페이지를 만들고 있어요</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>문구를 쓰고, 사진을 고르고, 구조를 짜는 중입니다. 30초쯤 걸려요.</p>
            <div className="mx-auto mt-10 max-w-sm rounded-3xl border bg-white p-8" style={{ borderColor: "var(--line)" }}>
              <p className="font-display text-[56px] leading-none" style={{ color: "var(--forest)" }}>{progress}%</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "var(--green)" }} />
              </div>
              <p className="mt-4 text-[13px]" style={{ color: "var(--muted)" }}>
                {progress < 30 ? "업종에 맞는 문구를 쓰고 있어요" : progress < 60 ? "사진을 고르고 있어요" : progress < 92 ? "섹션을 배치하고 있어요" : "마무리하고 있어요"}
              </p>
            </div>
            <ul className="mx-auto mt-8 max-w-sm space-y-2 text-left text-[13.5px]" style={{ color: "var(--muted)" }}>
              <li>✎ 글쓰기 금지 — 사장님은 이제 말만 하시면 됩니다.</li>
              <li>🔗 문자 링크만 누르세요 — 매주 질문이 문자로 갑니다.</li>
              <li>⤓ 다운로드 없음 — 앱 설치 없이 크롬에서 60초.</li>
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
          <h1 className="font-display text-[26px] leading-snug sm:text-[32px]">사장님 가게 이름부터<br />알려주세요</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: "var(--muted)" }}>글 못 써도 됩니다. 말은 하시잖아요. 여기선 이름만 적어 주세요.</p>
          {pickedQuestion && (
            <p className="mt-4 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: "var(--lime)", color: "var(--forest)" }}>
              고르신 첫 질문: <b>{pickedQuestion.text}</b> — 홈페이지가 생기면 이 질문부터 문자로 보내드려요.
            </p>
          )}
          <input className="inp mt-8" value={name} maxLength={40} autoFocus onChange={(e) => { setName(e.target.value); setPlaces(null); }} placeholder="예: 바른전기 · 카페 크로프트" />
          {placeOn && (
            <div className="mt-3 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px]"><b>네이버 플레이스에 등록된 가게</b>라면 이름·업종·주소·전화를 불러올 수 있어요.</p>
                <button type="button" disabled={!can1 || placeBusy} onClick={searchPlace} className="btn-forest !py-2 !text-[13px] disabled:opacity-40">{placeBusy ? "찾는 중…" : "플레이스에서 불러오기"}</button>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>영업시간·사진·소개는 네이버가 열어 두지 않아 가져올 수 없어요. 뒤에서 직접 적어 주세요.</p>
              {places && (
                <ul className="mt-3 space-y-2">
                  {places.length === 0 && <li className="text-[13px]" style={{ color: "var(--muted)" }}>찾지 못했어요. 이름을 조금 다르게 적어 보시거나, 그냥 다음으로 가셔도 됩니다.</li>}
                  {places.map((p, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => applyPlace(p)} className="w-full rounded-xl border p-3 text-left hover:bg-neutral-50" style={{ borderColor: "var(--line)" }}>
                        <p className="text-[14.5px] font-bold">{p.name} <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{p.source === "naver" ? "네이버" : "카카오"}</span></p>
                        <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>{p.category}{p.roadAddress || p.address ? ` · ${p.roadAddress || p.address}` : ""}{p.phone ? ` · ${p.phone}` : ""}</p>
                        <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--green)" }}>이 매장이 맞나요? → 불러오기</p>
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
          <h1 className="font-display text-[26px] leading-snug sm:text-[32px]">어떤 일을 하시나요?</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: "var(--muted)" }}>가장 가까운 것 하나만 고르세요. 나중에 바꿀 수 있어요. (쇼핑몰은 지원하지 않아요)</p>
          <input className="inp mt-6" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="업종 검색 — 예: 도배, 네일, 카페" />
          {!filter && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {INDUSTRY_GROUPS.map((g) => (
                <button key={g.id} type="button" onClick={() => setGroup(g.id)} className="shrink-0 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold"
                  style={{ borderColor: group === g.id ? "var(--forest)" : "var(--line)", background: group === g.id ? "var(--forest)" : "#fff", color: group === g.id ? "var(--cream)" : "var(--forest)" }}>
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
                <button key={s.label} type="button" onClick={() => setSub(s)} className="rounded-xl border px-3.5 py-2.5 text-[14px] font-medium"
                  style={{ borderColor: on ? "var(--green)" : "var(--line)", background: on ? "var(--accent-soft)" : "#fff", color: on ? "var(--green)" : "var(--ink)", fontWeight: on ? 700 : 500 }}>
                  {on ? "✓ " : ""}{s.label}
                </button>
              );
            })}
          </div>
          {sub && <p className="mt-4 text-[13.5px]" style={{ color: "var(--muted)" }}>선택: <b style={{ color: "var(--forest)" }}>{sub.label}</b></p>}
          {nav({ next: () => { if (!slug) setSlug(slugSuggest(name)); setStep(2); }, canNext: can2 })}
        </section>
      )}

      {/* 3 가게 정보 */}
      {step === 2 && (
        <section className="mt-6 space-y-7">
          <div>
            <h1 className="font-display text-[26px] leading-snug sm:text-[32px]">가게를 한 줄로 소개해 주세요</h1>
            <p className="mt-2 text-[14.5px]" style={{ color: "var(--muted)" }}>사장님 말투 그대로. 문구는 온스토리가 다듬어요.</p>
          </div>
          <Field label="하는 일 한 줄">
            <input className="inp" value={oneLiner} maxLength={120} onChange={(e) => setOneLiner(e.target.value)} placeholder={`예: ${sub?.label ?? "인테리어"}를 해요. 작은 현장도 갑니다.`} />
          </Field>
          <Field label="로고" hint="직접 올리거나(정사각 512×512 이상 · PNG/JPG/SVG · 2MB), 온스토리가 만든 4안 중 고르세요. 나중에 바꿀 수 있어요.">
            <div className="grid grid-cols-5 gap-2">
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white text-center text-[11.5px]" style={{ borderColor: logoFile ? "var(--green)" : "var(--line)" }}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="올린 로고" className="h-full w-full rounded-xl object-contain p-1" />
                ) : (<><span className="text-[20px]">＋</span>직접 올리기</>)}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} />
              </label>
              {marks.map((m) => (
                <button key={m.id} type="button" onClick={() => { setLogoAuto(m.id); onLogoFile(null); setLogoAuto(m.id); }} className="aspect-square overflow-hidden rounded-xl border bg-white" style={{ borderColor: logoAuto === m.id ? "var(--green)" : "var(--line)", boxShadow: logoAuto === m.id ? "0 0 0 2px var(--green)" : undefined }} title={m.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={svgUrl(m.svg)} alt={`자동 로고 ${m.label}`} className="h-full w-full" />
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>{logoFile ? "올린 로고를 써요" : logoAuto ? `자동 로고 · ${marks.find((m) => m.id === logoAuto)?.label}` : "로고 없이 시작해도 돼요"}</p>
          </Field>
          <Field label="홈페이지 주소" hint={slugMsg ? slugMsg.msg : "영문 소문자·숫자·하이픈 3~30자"} hintColor={slugMsg ? (slugMsg.ok ? "text-green-700" : "text-red-600") : undefined}>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[14px]" style={{ color: "var(--muted)" }}>onstori.com/</span>
              <input className="inp flex-1" value={slug} maxLength={30} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="mystore" />
            </div>
          </Field>
          <Field label="전화번호 (필수)" hint={phoneErr} hintColor={phoneErr ? "text-red-600" : undefined}>
            <input
              className="inp"
              value={phone}
              maxLength={20}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              aria-invalid={!!phoneErr}
              aria-describedby="phone-why"
            />
            {/* 회색 힌트로 만들지 않는다 — 문의 문자가 이 번호로만 가므로 눈에 걸려야 한다 */}
            <p id="phone-why" className="mt-2 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed" style={{ background: "var(--accent-soft)", color: "var(--forest)" }}>
              고객 문의가 오면 사장님 연락처로 문자가 옵니다. 반드시 사장님의 정확한 전화번호를 입력해주세요.
            </p>
          </Field>
          <Field label="주소 (선택)" hint="오시는 길 섹션에 들어가요">
            <input className="inp" value={address} maxLength={120} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 광진구 …" />
          </Field>
          <Field label="이 일을 시작한 이유 (선택)" hint="첫 번째 이야기로 만들어 드려요. 비워 두면 첫 질문 때 말로 하셔도 됩니다.">
            <textarea className="inp min-h-20" value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder="예: 아버지 밑에서 10년 배우고 독립했어요" />
          </Field>
          {nav({ next: () => setStep(3), canNext: can3 })}
        </section>
      )}

      {/* 4 분위기 */}
      {step === 3 && (
        <section className="mt-6">
          <h1 className="font-display text-[26px] leading-snug sm:text-[32px]">분위기를 골라 주세요</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: "var(--muted)" }}>바탕은 다크/화이트, 포인트색은 8가지. 미리보기를 보고 고르세요.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {(["light", "dark"] as Tone[]).map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)} className="rounded-2xl border p-4 text-left" style={{ borderColor: tone === t ? "var(--green)" : "var(--line)", background: TONE_PREVIEW[t].bg, color: TONE_PREVIEW[t].ink, boxShadow: tone === t ? "0 0 0 2px var(--green)" : undefined }}>
                <p className="text-[15px] font-bold">{t === "light" ? "화이트" : "다크"}</p>
                <p className="text-[12.5px]" style={{ color: TONE_PREVIEW[t].muted }}>{t === "light" ? "밝고 깔끔한 바탕" : "묵직하고 고급스러운 바탕"}</p>
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
                    <span className="text-[13px] font-bold">{a.name}</span>
                    <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{a.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {nav({ next: () => { setStep(4); void create(); }, canNext: true, label: "홈페이지 만들기 — 무료" })}
        </section>
      )}

      <style>{`.inp{width:100%;border:1px solid var(--line);border-radius:14px;padding:13px 15px;font-size:15px;outline:none;background:#fff}.inp:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(0,91,42,.12)}`}</style>
    </>
  );
}

function Field({ label, hint, hintColor, children }: { label: string; hint?: string; hintColor?: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[14px] font-bold">{label}</span>
      {children}
      {hint && <span className={`mt-1.5 block text-[12px] ${hintColor ?? ""}`} style={hintColor ? undefined : { color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}
