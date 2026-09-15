"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { INDUSTRY_GROUPS, findSubIndustry, type SubIndustry } from "@/config/industry-picker";
import { ACCENTS, TONE_PREVIEW, themeFor, type Tone } from "@/config/palettes";
import { QUESTIONS } from "@/config/questions";
import { TRIAL_DAYS, COPY } from "@/lib/trial";
import { isValidPhone } from "@/lib/phone";
import { PHONE_PRIVATE_NOTICE, WEEKLY_NOTICE, WEEKLY_CHANNEL_HINT } from "@/lib/weekly";
/* ★ 받침에 맞는 조사 — 세부 업종 109개 중 57개가 「…를 해요」로 깨져 있었다(2026-09-13 박팀장) */
import { josa } from "@/lib/sns/status-say";
import { OWNER_CHANNELS, isUsableChannelUrl } from "@/config/owner-channels";
import { sbBrowser } from "@/lib/supabase/browser";
import { Logo } from "@/components/site/logo";

/* ─────────────────────────── 공용 ─────────────────────────── */

const STEPS = ["상호명", "업종", "가게 정보", "채널 연결", "분위기", "만들기"] as const;

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
  /**
   * ★★ **고른 매장 — 2026-09-15 대표님 지적으로 신설.**
   *
   * ⚠ **버그가 아니라 «말이 없던 것»이었다.** 전에는 매장을 누르면 값은 다 들어갔는데
   *   `setPlaces(null)` 로 **목록만 사라지고 아무 말도 안 했다.** 상호는 위 칸에 보이니까
   *   「가게명만 불러온다」로 보였고, 주소·전화는 **3단계에 있어서 안 보였을 뿐**이다.
   * ★ 그래서 고른 것을 **카드로 남겨** 무엇이 들어왔는지 그 자리에서 보여 준다.
   */
  const [picked, setPicked] = useState<Place | null>(null);
  // 2
  const [group, setGroup] = useState(INDUSTRY_GROUPS[0].id);
  const [sub, setSub] = useState<SubIndustry | null>(null);
  const [filter, setFilter] = useState("");
  // 3
  const [oneLiner, setOneLiner] = useState("");
  const [phone, setPhone] = useState("");
  /**
   * ★★ **홈페이지 주소 — 2026-09-15 대표님 지시로 되살렸다.**
   *
   * ⚠ 2026-09-12 에 이 칸을 **없앴었다.** 가입 이탈 1위였기 때문이다. 이유는 칸 자체가 아니라
   *   **「한글을 치면 글자가 안 찍히는데 왜인지 안 알려준 것」**이었다. 그래서 이번에는:
   *   ① 한글을 치는 **그 순간** 이유를 말한다  ② **비어 있는 주소 3개**를 단추로 먼저 보여 준다
   *   ③ **비워 두면 지금까지처럼 서버가 짓는다** — 안 건드리면 아무것도 달라지지 않는다
   * ★ 대표님이 `onstori.com/feliz` 를 못 만드신 것이 이 칸이 없어서였다.
   */
  const [slug, setSlug] = useState("");
  const [slugSuggest, setSlugSuggest] = useState<string[]>([]);
  /** null = 아직 안 봤다 · true/false = 서버가 답했다 */
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [slugMsg, setSlugMsg] = useState("");
  /** ★ 문의 알림이 가는 주소. 비면 문의가 와도 사장님이 모른다(2026-09-11 회장님 결정) */
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [why, setWhy] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoAuto, setLogoAuto] = useState<string | null>(null); // 선택한 자동 로고 id
  // 4 — 채널 연결 (2026-09-15 신설)
  /**
   * ★ 사장님이 이미 운영 중인 채널 주소. **전부 선택**이다.
   * ⚠ 저장 위치는 `sites.settings.channels` 다 — `lib/jsonld.ts` 가 그 자리를 읽어
   *   구조화 데이터의 `sameAs` 를 만든다. 이름을 바꾸면 검색 연결이 조용히 끊긴다.
   */
  const [channels, setChannels] = useState<Record<string, string>>({});
  // 5
  const [tone, setTone] = useState<Tone>("light");
  const [accent, setAccent] = useState(ACCENTS[0].id);

  /* ★ 가입 동의 (2026-09-12 회장님 지시 2). 손님은 체크박스로 보호받는데 사장님은
     하나도 없었다.
     ★ 2026-09-13 — **선택(광고) 칸을 없앴다.** 할인·행사 문자를 보내지 않기로 했기 때문이다.
       안 보낼 것을 물어 두면 그 칸이 「언젠가 보내겠다」는 약속이 된다.
       남는 것은 **필수 둘뿐**이고, 둘 다 눌러야 [홈페이지 만들기] 가 눌린다. */
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
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
    setPicked(p); /* ★ 고른 것을 남긴다 — 이게 없어서 「아무 반응이 없다」로 보였다 */
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
  /* ★ 주소는 **선택**이다. 비워 두면 서버가 짓는다(lib/slug.ts).
     ⚠ 그래서 「안 썼다」로는 막지 않는다. **썼는데 못 쓰는 주소일 때만** 막는다 —
       안 그러면 2026-09-12 의 이탈이 그대로 돌아온다. */
  /** 화면과 서버가 **같은 규칙**으로 거른다 — 한쪽만 고쳐지는 일이 없게 */
  const usableChannels = useMemo(
    () => Object.fromEntries(Object.entries(channels).filter(([, v]) => isUsableChannelUrl(v))),
    [channels],
  );

  const can3 = oneLiner.trim().length >= 2 && isValidPhone(phone) && emailOk && slugOk !== false;

  /* 3단계에 들어오면 **비어 있는 주소 3개**를 미리 받아 둔다.
     ⚠ 상호·업종이 바뀌면 다시 받는다 — 옛 상호로 지은 추천을 보여 주면 그게 더 헷갈린다. */
  useEffect(() => {
    if (step !== 2 || !name.trim()) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/slug-check?suggest=1&name=${encodeURIComponent(name.trim())}&industry=${encodeURIComponent(sub?.industryId ?? "")}`);
        const d = await r.json();
        if (alive && Array.isArray(d.suggestions)) setSlugSuggest(d.suggestions);
      } catch { /* 추천이 없어도 직접 입력으로 만들 수 있다 — 조용히 넘어간다 */ }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [step, name, sub?.industryId]);

  /* 사장님이 친 주소를 **치는 동안** 검사한다.
     ⚠ 400ms 를 기다린다 — 글자마다 부르면 서버를 때리고, 답이 엇갈려 늦은 답이 이긴다. */
  useEffect(() => {
    const v = slug.trim().toLowerCase();
    if (!v) { setSlugOk(null); setSlugMsg(""); return; }
    /* ★ **한글은 서버를 기다리지 않는다.** 그 자리에서 바로 말한다 — 이것이 그때 없던 한 줄이다 */
    if (/[^a-z0-9-]/.test(v)) {
      setSlugOk(false);
      setSlugMsg("주소는 영문 소문자·숫자·하이픈(-)만 됩니다. 한글은 쓸 수 없어요 — 위 추천을 눌러 보세요");
      return;
    }
    let alive = true;
    setSlugMsg("확인하는 중…");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/slug-check?slug=${encodeURIComponent(v)}`);
        const d = await r.json();
        if (!alive) return;
        setSlugOk(Boolean(d.available));
        setSlugMsg(d.available ? `onstori.com/${v} — 쓸 수 있어요` : String(d.reason ?? "쓸 수 없는 주소예요"));
      } catch {
        /* 못 물어봤으면 «막지 않는다». 서버가 만들 때 한 번 더 본다(app/api/generate) */
        if (alive) { setSlugOk(null); setSlugMsg(""); }
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [slug]);

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
        /* ★ 주소를 비워 두면 **안 보낸다** — 서버가 상호·업종에서 짓는다(lib/slug.ts).
           ⚠ 빈 문자열을 보내면 서버 검사(3~30자)에 걸려 가입이 통째로 실패한다. */
        slug: slug.trim().toLowerCase() || undefined,
        /* ★ 채널 주소 — **쓸 만한 것만** 보낸다. 서버도 같은 규칙으로 한 번 더 거른다.
           ⚠ 빈 객체면 아예 안 보낸다 — 빈 칸을 만들어 두면 「넣었는데 안 됐다」와 구별이 안 된다. */
        ...(Object.keys(usableChannels).length ? { channels: usableChannels } : {}),
        /* ★ 동의는 서버가 다시 검사한다 — 화면 값을 믿지 않는다(불변 규칙 4의 정신)
           ⚠ `marketing: false` 를 **일부러 보낸다.** 묻지 않았으니 「동의 못 받았다」가 사실이고,
             그 사실이 기록에 남아야 나중에 「동의받았다」고 오해할 여지가 없다(2026-09-13). */
        consents: { terms: agreeTerms, privacy: agreePrivacy, marketing: false },
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
  if (step === 5) {
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
                {/* ⚠ 2026-09-13 — 「문자로」를 «메일로»로 고쳤다. 대표님 결정으로 주 1회 알림의
                    기본이 메일이 됐다. 고치지 않았으면 이 줄이 곧바로 거짓말이 됐다. */}
                {signedIn ? "지금 바로 전 기능을 쓰실 수 있어요. 첫 질문은 메일로 보내드릴게요." : "정회원 이용은 회원가입(카카오 또는 이메일)이 필요해요. 가입하면 이 홈페이지가 사장님 계정에 연결되고, 첫 질문이 메일로 갑니다."}
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
            <button type="button" onClick={() => setStep(4)} className="btn btn-text w-full" style={{ marginTop: "var(--s-3)" }}>이전 단계로</button>
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
          <input className="field mt-8" value={name} maxLength={40} autoFocus onChange={(e) => { setName(e.target.value); setPlaces(null); setPicked(null); }} placeholder="예: 바른전기 · 카페 크로프트" />

          {/* ★★ **고른 매장 확인 카드** (2026-09-15 대표님 지적으로 신설)
              ⚠ 「선택되었습니다」를 **글자로 말한다.** 값이 조용히 들어가는 것은 «안 된 것»과 구별이 안 된다.
              ⚠ 무엇이 들어왔는지 **줄마다 보여 준다** — 주소·전화는 3단계에 있어 지금은 안 보인다.
                안 보이는 것을 「들어갔습니다」라고만 하면 믿을 근거가 없다. */}
          {picked && (
            <div className="mt-3 rounded-2xl border-2 p-4" style={{ borderColor: "var(--green)", background: "var(--green-50)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="t-body font-bold" style={{ color: "var(--forest)" }}>✓ 선택되었습니다</p>
                <button
                  type="button"
                  onClick={() => { setPicked(null); searchPlace(); }}
                  className="tap-row t-small underline"
                  style={{ color: "var(--forest)" }}
                >
                  다시 고르기
                </button>
              </div>
              <p className="mt-2 t-body font-bold">{picked.name}</p>
              <ul className="mt-2 space-y-1 t-small">
                {picked.category && <li>업종 · {picked.category}</li>}
                {(picked.roadAddress || picked.address) && <li>주소 · {picked.roadAddress || picked.address}</li>}
                {picked.phone && <li>전화 · {picked.phone}</li>}
              </ul>
              <p className="mt-3 t-small font-semibold" style={{ color: "var(--forest)" }}>
                {[picked.phone && "전화번호", (picked.roadAddress || picked.address) && "주소", "가게명"].filter(Boolean).join(", ")} 정보를 바탕으로 홈페이지 제작을 시작합니다
              </p>
              <p className="mt-1 t-caption" style={{ color: "var(--muted)" }}>
                다음 단계에서 하나하나 고치실 수 있어요. 틀린 곳이 있어도 괜찮습니다.
              </p>
            </div>
          )}

          {placeOn && !picked && (
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
          <p className="mt-2 t-small" style={{ color: "var(--muted)" }}>
            가장 가까운 것 하나만 고르세요. 나중에 바꿀 수 있어요. (쇼핑몰은 지원하지 않아요)<br />
            {/* ★ 2026-09-15 대표님 — 목록에 없는 업종에서 사장님이 «막혔다»고 느끼신다.
                직접 적으면 된다는 것을 여기서 말해 준다. 아래 검색칸이 그 역할을 이미 한다. */}
            본인의 업종이 없으면, 업종명을 직접 입력하시고 [다음] 버튼을 누르세요
          </p>
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
            <input className="field" value={oneLiner} maxLength={120} onChange={(e) => setOneLiner(e.target.value)} placeholder={(() => { const t = sub?.label ?? "인테리어"; return `예: ${t}${josa(t, "을/를")} 해요. 작은 현장도 갑니다.`; })()} />
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
          {/* ★★★ 2026-09-15 — 「홈페이지 주소」 칸을 **되살렸다** (대표님 지시).
              ⚠ 2026-09-12 에 없앴던 칸이다. 이탈 1위였다. 하지만 원인은 «칸»이 아니라
                **한글을 쳤을 때 아무 말도 안 해 준 것**이었다. 그래서 세 가지를 같이 넣었다:
                ① 비어 있는 주소 3개를 **단추로 먼저** ② 한글을 치면 **그 자리에서** 이유를
                ③ **비워 두면 예전 그대로** — 서버가 짓는다. 안 건드린 사장님은 아무 변화가 없다.
              ⚠ 주소를 나중에 바꾸는 길은 아직 없다 — 이미 발행된 주소가 깨지므로
                되돌리기(리다이렉트)까지 같이 만들어야 한다. 그래서 **여기가 정하는 유일한 자리**다. */}
          <Field
            label="홈페이지 주소 (선택)"
            hint={slugMsg || "안 정하셔도 됩니다 — 비워 두시면 상호에 맞춰 저희가 지어 드려요"}
            hintColor={slugOk === false ? "text-danger" : undefined}
          >
            {slugSuggest.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {slugSuggest.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlug(s)}
                    className="tap-row t-small rounded-full border px-3 py-1"
                    style={{
                      borderColor: slug === s ? "var(--green)" : "var(--line)",
                      background: slug === s ? "var(--green-50)" : "transparent",
                      fontWeight: slug === s ? 700 : 400,
                    }}
                  >
                    onstori.com/{s}
                  </button>
                ))}
              </div>
            )}
            {/* 주소 앞부분을 «칸 안»에 붙여 둔다 — 「onstori.com/」까지 치시는 분이 실제로 있다 */}
            <div
              className="field flex items-center gap-1"
              style={{ borderColor: slugOk === false ? "var(--danger)" : undefined }}
            >
              <span className="t-small shrink-0" style={{ color: "var(--muted)" }}>onstori.com/</span>
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={slug}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
                placeholder={slugSuggest[0] ?? "myshop"}
                aria-invalid={slugOk === false}
              />
            </div>
          </Field>
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
            {/* ★★ 2026-09-15 대표님 개정 — **한 줄로 줄였다.**
                「입력은 오타 없이 정확히 받기 위해서 심플한 멘트. 기본은 공개 안 함이야.
                 부가적으로 설명하지 말고, 그냥 공개 안 하는 게 기본인 게 맞는 것 같아.」
                ⚠ 주 1회 질문 안내는 **이메일 칸 아래로 옮겼다** — 이제 메일로 가기 때문이다. */}
            <p id="phone-why" className="t-small" style={{ marginTop: "var(--s-2)", borderRadius: "var(--r-md)", padding: "var(--s-2) var(--s-3)", background: "var(--green-50)", color: "var(--n-800)" }}>
              사장님의 정확한 전화번호를 입력해주세요.
            </p>
            {/* ★★★ 「주 1회 질문」은 **광고가 아니라 우리가 판 상품**이다 (2026-09-12 상무님 지적).
                ⚠ 전에는 이것이 4단계의 «선택 체크박스»에 광고와 한 칸으로 묶여 있었다. 그러면
                  체크를 안 한 사장님이 **돈을 내고도 상품을 못 받는** 상태가 된다.
                ★ 그래서 여기서는 **묻지 않고 알린다.** 「받겠습니까」가 아니라 「보내 드립니다」다.
                ★ 대신 **끄는 길을 같은 줄에서** 말한다 — 알리기만 하고 끌 길이 없으면 그것이 광고다.
                  (끄는 곳: 편집화면 「연결」 탭 · 첫 문자의 【받지 않으시려면】 줄)
                ⚠ 문구는 **2026-09-13 회장님 확정본**이다. 고치려면 허락을 먼저 받아라. */}
            {/* ★★★ **번호가 홈페이지에 안 박힌다는 것을 «적기 전»에 말한다.**
                (2026-09-13 대표님 결정 · 지시 5)
                ⚠ 어느 사장님도 번호가 홈페이지에 박히는 것을 원하지 않는다. 박히면
                  크롤링당해 광고 전화가 온다. 그래서 이 줄이 번호 칸 바로 아래에 있다.
                ⚠ 문구의 출처는 `lib/weekly.ts` 한 곳이다 — 관리자 화면과 같은 말을 해야 한다. */}
            <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--n-800)" }}>
              {PHONE_PRIVATE_NOTICE.lead}<b>{PHONE_PRIVATE_NOTICE.strong}</b>{PHONE_PRIVATE_NOTICE.tail}
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
              이메일 알림을 켜면, 메일 도착 즉시 핸드폰에 알림이 오도록 셋팅하세요
            </p>
            {/* ★★ 주 1회 질문은 **상품**이라 묻지 않고 알린다. 기본은 «메일»이므로 이 칸 아래가 맞다.
                (2026-09-15 대표님이 전화번호 칸에서 여기로 옮기라 하심) */}
            <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--n-800)" }}>
              {WEEKLY_NOTICE.lead}<b>{WEEKLY_NOTICE.strong}</b>{WEEKLY_NOTICE.tail}<br />
              {WEEKLY_CHANNEL_HINT}
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

      {/* ★★★ 4 채널 연결 — 2026-09-15 대표님 지시로 신설.
          ⚠ **이 단계는 위젯이 아니라 «SEO 엔진»이다.** 여기서 받은 주소가 구조화 데이터의
            `sameAs` 가 되어 「이 홈페이지 = 저 네이버 플레이스와 같은 업체」를 검색엔진에 알린다.
            경쟁사 홈ON 이 네이버 상단에 뜨는 가장 큰 이유가 그것이었다
            (`fable51plandept/AI_Context/BANJANG/SEO-홈온-분석-2026-09-15.md`).
          ⚠ **전부 선택이다.** 하나도 안 넣어도 [다음]이 눌린다 — 여기서 막으면 가입이 끊긴다. */}
      {step === 3 && (
        <section className="mt-6">
          <h1 className="font-display t-h1 leading-snug">채널 연결을 해보시겠습니까?</h1>
          <p className="mt-3 t-body">
            홈페이지는 <b>모든 채널의 최종 종착지</b>입니다.<br />
            다양한 채널에서 홍보를 도와주고, 실적은 홈페이지에서 쌓입니다!
          </p>
          <p className="mt-3 t-small" style={{ color: "var(--muted)" }}>
            채널 연결을 통해 홈페이지의 규모가 커 보이고, 다양한 채널을 통해서 홍보할 수 있습니다.<br />
            최대한 많은 채널을 연결해 주세요. (추후에 어드민에서 연결 가능)
          </p>
          <p className="mt-4 rounded-xl px-4 py-3 t-small" style={{ background: "var(--green-50)", color: "var(--n-800)" }}>
            <b>현재 운영 중인 채널만</b> 선택해 주세요.<br />
            선택한 채널은 홈페이지에 <b>문의 위젯으로 자동 생성</b>되어, 고객이 더 쉽고 빠르게 연락할 수 있습니다.<br />
            생성 후에도 「수정하기」에서 언제든 자유롭게 변경할 수 있습니다.
          </p>

          <div className="mt-6 space-y-4">
            {OWNER_CHANNELS.map((c) => {
              const v = channels[c.id] ?? "";
              /* ⚠ 「비었다」와 「틀렸다」를 가른다. 안 쓰신 것을 빨갛게 칠하면 겁을 드린다 */
              const bad = v.trim().length > 0 && !isUsableChannelUrl(v);
              return (
                <Field
                  key={c.id}
                  label={c.label}
                  hint={bad ? "https:// 로 시작하는 주소를 붙여 주세요" : c.hint}
                  hintColor={bad ? "text-danger" : undefined}
                >
                  <div className="flex items-center" style={{ gap: "var(--s-2)" }}>
                    {/* 위젯에 뜰 모양을 «여기서 미리» 보여 준다 — 무엇이 생기는지 알고 넣으시게 */}
                    <span
                      aria-hidden
                      className="flex shrink-0 items-center justify-center font-bold text-white"
                      style={{
                        width: 36, height: 36, borderRadius: "50%", background: c.color,
                        fontSize: c.mark.length > 2 ? 11 : 14,
                        opacity: isUsableChannelUrl(v) ? 1 : 0.25,
                        transition: "opacity .15s",
                      }}
                    >
                      {c.mark}
                    </span>
                    <input
                      className="field min-w-0 flex-1"
                      style={{ borderColor: bad ? "var(--danger)" : undefined }}
                      value={v}
                      maxLength={300}
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={c.placeholder}
                      aria-invalid={bad}
                      onChange={(e) => setChannels((p) => ({ ...p, [c.id]: e.target.value }))}
                    />
                  </div>
                </Field>
              );
            })}
          </div>

          <p className="mt-5 t-caption" style={{ color: "var(--muted)" }}>
            하나도 넣지 않으셔도 됩니다. 나중에 편집화면에서 언제든 추가하실 수 있어요.
          </p>

          {nav({ next: () => setStep(4), canNext: true })}
        </section>
      )}

      {/* 5 분위기 */}
      {step === 4 && (
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
              · **필수 둘뿐**이다. 안 누르면 [홈페이지 만들기] 가 눌리지 않는다
              · 선택(광고) 칸은 **없앴다** (2026-09-13) — 아래 주석 참고
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
            {/* ★★★ **광고 체크박스를 아예 두지 않는다.** (2026-09-13 회장님 확정)
                · 할인·행사 문자는 **보내지 않는다** — 스팸으로 읽혀 이미지를 해친다
                · 안 보낼 것을 물어 두면 그 칸 자체가 「언젠가 보내겠다」는 약속이 된다
                · 주 1회 질문은 **상품**이라 3단계에서 «안내»로 말한다(묻지 않는다)
                ⚠ 남는 것은 **필수 둘뿐**이다. 여기에 선택 칸을 다시 만들지 마라 —
                  만들려면 「무엇을 보낼 것인가」가 먼저 정해져야 한다. */}
          </div>

          {nav({
            next: () => { setStep(5); void create(); },
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
