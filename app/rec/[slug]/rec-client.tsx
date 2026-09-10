"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QuestionShuffle } from "@/components/site/question-shuffle";
import type { Question } from "@/config/questions";
import { SNIFF_BYTES, isPlayableVideo, sniff, whyNotPlayable } from "@/lib/media-sniff";

/**
 * 60초 녹화 화면 — 레멘토 web.remento.co 14화면을 9화면으로 (기획1 /mainplan #rec).
 * greet → ask → mode → permission/setup → countdown → rec → review → sending → done
 * 브라우저 MediaRecorder 만 쓴다(앱 없음). 60초에 자동 정지. 업로드는 R2 서명 URL 로 직접(폴백: 서버 경유).
 */

const MAX_SEC = 60;
type Screen = "greet" | "ask" | "mode" | "setup" | "count" | "rec" | "review" | "sending" | "done" | "error";

/**
 * 업로드 PUT 이 실패한 **모양**. (2026-09-11)
 *
 * ★ 왜 만들었나: 예전에는 넷을 전부 「네트워크 오류 — 다시 시도해 주세요」 한 줄로 뭉뚱그렸다.
 *   2026-09-11 회장님 실측에서 **와이파이는 멀쩡한데** 그 문구가 떴다. 진짜 원인은
 *   저장소가 브라우저의 예비 질문(preflight)을 거절한 것이었고, 화면은 **엉뚱한 곳**을
 *   가리키고 있었다. 사장님이 폰과 와이파이를 붙잡고 헛수고하게 만든다.
 *   브라우저는 `onerror` 에 이유를 **주지 않는다.** 그래서 우리가 모양을 나눠 들고,
 *   `explainPut()` 이 서버에 한 번 물어본 뒤 이유를 확정한다.
 */
class PutFail extends Error {
  constructor(readonly kind: "status" | "neterr" | "timeout" | "abort", readonly status: number) {
    super(`put-${kind}`);
  }
}

/** 촬영 안내 — 회장님 문구(2026-09-06). 화면 3곳이 이 하나를 쓴다. 사본을 만들지 않는다. */
const SHOOT_TIPS: [string, string][] = [
  ["얼굴이 안 나와도 됩니다",
   "목소리만으로도 충분합니다. 처음엔 목 아래만 나오게 찍으셔도 돼요."],
  /* ★ 2026-09-11 회장님 — 60초는 처음 하는 사람에게 길다. 20초에 할 말이 끝나면
     「더 말해야 하나」 하고 어색해진다. 끝낼 권한을 먼저 드린다. */
  ["꼭 60초를 다 쓰지 않으셔도 됩니다",
   "하실 말씀이 끝나면 정지를 눌러 주세요. 20초도 충분합니다."],
  /* ★ 「얼굴 안 나와도 된다」는 말만으로는 부족하다 — **안 나오게 하는 방법**을 줘야 실제로 찍는다 */
  ["얼굴이 어색하시면 [카메라 전환]",
   "카메라 확인 화면에 [카메라 전환]이 보이면 눌러 뒷면으로 바꾸실 수 있어요. 버튼이 없는 폰이면 폰을 돌려 매장을 비추면서 말씀하셔도 됩니다."],
  ["매장이라면, 60초 동안 매장을 걸으세요",
   "“오늘 매장을 보여드릴게요”처럼 편하게 말씀하시면 됩니다."],
  ["상품이 있다면, 상품을 보여주세요",
   "60초 동안 상품을 비추면서 “이 상품은 OOO입니다”라고 짧게 말씀해 주세요."],
  ["얼굴이 부담되시면 손만",
   "손에 제품을 들고 손과 제품만 나오게 찍으셔도 좋습니다."],
  ["카메라는 나 말고 매장 쪽으로",
   "카메라를 매장 쪽으로 두고 편하게 말씀하세요. 그게 가장 자연스럽습니다."],
];

/** 촬영 안내 — JS 없이 접었다 펴기. globals.css 의 details.faq 규칙을 그대로 쓴다. */
function ShootGuide({ compact = false }: { compact?: boolean }) {
  return (
    <details className="faq mt-5 rounded-2xl bg-white/10 px-4 py-3 text-left">
      <summary className="flex items-center justify-between gap-3 t-small font-bold">
        어떻게 찍나요? · 30초면 읽어요
        <span className="chev shrink-0 t-h3 font-light" aria-hidden>＋</span>
      </summary>
      <ul className="mt-3 space-y-2.5">
        {(compact ? SHOOT_TIPS.slice(0, 3) : SHOOT_TIPS).map(([t, d]) => (
          <li key={t}>
            <p className="t-small font-bold">{t}</p>
            <p className="mt-0.5 t-small leading-relaxed opacity-75">{d}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function isInApp(): boolean {
  const ua = navigator.userAgent;
  return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

/**
 * 폰 기본 카메라로 찍어 오기 — **안드로이드에서만** 보여준다.
 *
 * ★ 아이폰에는 보여주지 않는다(회장님 지시 1). 아이폰 기본 카메라는 `.mov` 를 내놓고,
 *   그 하나 때문에 변환 워커를 만들지 않기로 했다(2026-09-09 실측).
 * ★ 조건이 `device === "android"` **긍정형 하나뿐**인 것이 중요하다. `!isIOS` 로 쓰면
 *   판정이 틀렸을 때 곧바로 「아이폰에 폰 카메라 보여주기」가 된다.
 *
 * ⚠ 카메라 앱에는 오늘의 질문도 60초 타이머도 없다. 그래서 **먼저 카드로 알려 준다** —
 *   폰 카메라는 1분에 자동으로 멈추지 않는다.
 * ⚠ `capture` 는 값을 반드시 적는다. 빈 값의 해석이 브라우저마다 다르다.
 */
function CameraFallback({ device, mode, onFile, show }: {
  device: Device; mode: "video" | "audio"; onFile: (f: File | null) => void;
  /** ★ **브라우저 녹화를 시도해서 실패했을 때만** 켠다(2026-09-11 회장님 지시 3).
      평소에 띄워 두면 선택지가 둘이 되어 처음 오신 사장님이 그 자리에서 멈춘다. */
  show: boolean;
}) {
  if (!show || device !== "android" || mode !== "video") return null;
  return (
    <details className="faq mt-6 rounded-2xl bg-white/10 px-4 py-3 text-left">
      <summary className="flex items-center justify-between gap-3 t-small font-bold">
        카메라가 안 열리면 · 폰 카메라로 찍기
        <span className="chev shrink-0 t-h3 font-light" aria-hidden>＋</span>
      </summary>
      <p className="mt-3 t-small leading-relaxed opacity-80">
        폰 카메라로 찍으면 <b>1분에 자동으로 멈추지 않아요.</b> 1분 안쪽으로 짧게 찍고 직접 멈춰 주세요.
      </p>
      <label className="btn-lime mt-4 flex w-full cursor-pointer items-center justify-center !py-4 !t-body">
        폰 카메라로 찍기
        <input
          type="file" accept="video/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; onFile(f); }}
        />
      </label>
    </details>
  );
}

/**
 * 링크 복사 — 사파리 주소창에 붙여넣어 열 수 있게. 인앱 브라우저의 유일한 탈출구 중 하나다.
 * ⚠ `navigator.clipboard` 는 안 될 수 있다(구형·비보안 맥락). 실패하면 주소를 그대로 보여준다.
 */
function CopyLinkButton() {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(location.href); setState("done"); }
          catch { setState("fail"); }
        }}
        className="mt-3 w-full rounded-full border border-white/40 py-2.5 t-small font-bold"
      >
        {state === "done" ? "복사했어요 — 사파리 주소창에 붙여넣어 주세요" : "링크 복사"}
      </button>
      {state === "fail" && (
        <p className="mt-2 break-all t-caption opacity-70">{typeof location !== "undefined" ? location.href : ""}</p>
      )}
    </>
  );
}

/**
 * 녹화 형식 고르기 — **mp4 가 최우선**이다.
 *
 * 왜: 아이폰 사파리는 webm 을 재생하지 못한다. 안드로이드에서 webm 으로 찍힌 영상은
 * 아이폰 손님에게 검은 화면으로 보인다. 처음부터 mp4(H.264)로 찍으면 변환이 아예 필요 없다.
 *
 * ⚠ `isTypeSupported` 가 true 라고 진짜 mp4 가 나오는 건 아니다 — 실제로 녹화해
 *   파일 머리(`ftyp`)까지 봐야 안다. 검사판을 `public/mime-check.html` 에 두었다.
 *   2026-09-07 실측(Chromium 148): 고른 형식 `video/mp4;codecs=avc1` → 머리 `ftypisom` = 진짜 MP4.
 *   ⚠ `video/mp4;codecs=h264` 는 **false** 로 나온다. avc1 로 적어야 한다.
 */
function pickMime(mode: "video" | "audio"): string {
  /* ★ 2026-09-10 — **영상에서 webm 후보를 통째로 지웠다.**
     회장님 지시 4 가 「업로드 때 mp4 가 아니면 되돌린다」인데, 브라우저가 webm 을 만들도록
     놔두면 사장님이 **60초를 다 찍고 보내기를 누른 순간** 버려진다. 조용히 받는 것보다 나쁘다 —
     시간을 쓰게 만든 뒤에 버리기 때문이다. 못 만들게 막아야 되돌리기가 «있어도 안 터지는 안전망»이 된다.
     ⚠ 소리만 녹음(audio)은 webm 을 허용한다. 소리는 어느 컨테이너든 재생된다. */
  const c = mode === "audio"
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["video/mp4;codecs=avc1", "video/mp4"];
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  for (const m of c) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

/**
 * 지금 열린 카메라가 **앞면인가 뒷면인가** — 우리가 요청한 값이 아니라 **브라우저가 실제로 준 값**을 본다.
 * ⚠ 이게 틀리면 거울 반전이 틀린다. 뒷면인데 좌우를 뒤집으면 간판 글씨가 거꾸로 나온다.
 * ⚠ `facingMode` 를 안 채워 주는 기기가 있다. 그때는 카메라 «이름»으로 짐작하고,
 *   그것도 모르면 `unknown` 을 돌려 **뒤집지 않는다** — 셀카가 안 뒤집히는 건 어색할 뿐이지만
 *   뒷면이 뒤집히는 건 글씨가 깨지는 진짜 사고다.
 */
function facingOf(t: MediaStreamTrack | undefined, dev: MediaDeviceInfo | undefined): "user" | "environment" | "unknown" {
  const f = t?.getSettings?.().facingMode;
  if (f === "user" || f === "environment") return f;
  const l = (dev?.label ?? t?.label ?? "").toLowerCase();
  if (/back|rear|environment|후면|뒷/.test(l)) return "environment";
  if (/front|user|전면|앞/.test(l)) return "user";
  return "unknown";
}

/** 전환 실패 이유를 사장님 말로. ⚠ 「바꾸지 못했어요」만 띄우면 뭐가 문제인지 알 길이 없다 */
const SWITCH_WHY: Record<string, string> = {
  NotReadableError: "이 폰은 카메라를 한 번에 하나만 열 수 있어요",
  AbortError: "이 폰은 카메라를 한 번에 하나만 열 수 있어요",
  TrackStartError: "다른 앱이 카메라를 쓰고 있어요",
  NotFoundError: "바꿀 카메라를 찾지 못했어요",
  OverconstrainedError: "이 폰에서는 그 카메라를 열 수 없어요",
  NotAllowedError: "카메라 사용이 허용되지 않았어요",
  SecurityError: "카메라 사용이 허용되지 않았어요",
};

type Device = "ios" | "android" | "other";

/**
 * 어떤 폰인가 — **「안드로이드임이 확실한가」만 묻는다.**
 *
 * ★ 폰 카메라 폴백은 `device === "android"` 일 때만 보여준다. `!isIOS` 같은 부정형을 쓰지 않는다 —
 *   부정형이면 판정 실패가 곧 「아이폰에 폰 카메라 보여주기」가 되고, 아이폰 카메라는 .mov 를 낸다.
 *   틀릴 때 안전한 쪽: 안드로이드를 못 알아봐도 브라우저 녹화가 어차피 mp4 로 잘 된다(2026-09-09 실측).
 * ⚠ 아이패드는 iPadOS 13+ 부터 UA 를 **맥으로 위장한다.** 맥에는 터치가 없다(maxTouchPoints 0).
 */
function detectDevice(): Device {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** 여기서 녹화가 되나 — **권한창을 띄우지 않는 공짜 검사**다. 안 되는 이유를 갈라서 준다 */
type Block = null | "insecure" | "no-api" | "no-mp4";
function canRecordHere(mode: "video" | "audio"): Block {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "insecure";
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "no-api";
  if (!navigator.mediaDevices?.getUserMedia) return "no-api";
  return pickMime(mode) ? null : "no-mp4";
}

/**
 * 표지 사진 뽑기 — 녹화 직후 `blob:` 에서 **0.8초 지점** 한 장.
 *
 * ★ 확인 화면의 미리보기 <video>(controls 가 붙은 것)를 쓰지 않는다. 거기엔 muted 가 없어
 *   아이폰에서 디코더를 깨울 수 없고, 사장님이 재생 중이면 재생 위치를 빼앗는다.
 *   **숨긴 전용 요소**를 따로 만든다.
 * ⚠ `display:none` 으로 숨기지 않는다 — 사파리는 안 보이는 미디어의 디코딩을 건너뛴다.
 *   화면 밖으로 밀어 두되 렌더 트리에는 남긴다.
 * ⚠ MediaRecorder 가 만든 Blob 은 길이(duration)가 Infinity/NaN 으로 나오는 일이 흔하다.
 *   그래서 이미 세고 있는 녹화 초(`sec`)를 예비로 쓴다.
 * ⚠ WebP 로 바로 뽑지 않는다 — iOS 16 이전 사파리는 **조용히 PNG 를 돌려준다.**
 *   JPEG 로 뽑고 WebP 변환은 서버(sharp)에 맡긴다.
 * ★ **절대 던지지 않는다.** 실패하면 null 이고, 업로드는 그대로 진행된다(회장님 지시 5).
 */
async function capturePoster(blob: Blob, recordedSec: number): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  try {
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(v);
    v.src = url;

    const once = (ev: string, ms: number) =>
      new Promise<boolean>((res) => {
        const t = window.setTimeout(() => { v.removeEventListener(ev, ok); res(false); }, ms);
        const ok = () => { window.clearTimeout(t); v.removeEventListener(ev, ok); res(true); };
        v.addEventListener(ev, ok, { once: true });
      });

    v.load();
    if (!(await once("loadedmetadata", 3000))) return null;

    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : recordedSec;
    const at = Math.min(0.8, Math.max(0, (dur || 1) - 0.1));
    v.currentTime = at;
    if (!(await once("seeked", 1500))) {
      // 아이폰이 디코더를 안 깨우는 경우 — 소리 없이 잠깐 재생해 깨우고 다시 시도한다
      await v.play().catch(() => {});
      v.pause();
      v.currentTime = at;
      if (!(await once("seeked", 2000))) return null;
    }
    if (!v.videoWidth || !v.videoHeight) return null;

    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;   // ⚠ 여기서 삼키면 «검은 표지»가 조용히 저장된다
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((res) => {
      const t = window.setTimeout(() => res(null), 3000);
      canvas.toBlob((b) => { window.clearTimeout(t); res(b); }, "image/jpeg", 0.82);
    });
  } catch {
    return null;
  } finally {
    try { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); } catch { /* 무시 */ }
    URL.revokeObjectURL(url);
  }
}

export function RecClient({ slug, k, businessName }: { slug: string; k: string; businessName: string }) {
  const [screen, setScreen] = useState<Screen>("greet");
  const [q, setQ] = useState<Question | null>(null);
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  /* ⚠ `useState(() => …)` 로 읽으면 **서버가 그린 화면과 첫 클라이언트 화면이 어긋난다**(하이드레이션 불일치).
     같은 문제를 이미 푼 선례를 그대로 쓴다 — components/sections/quote-form.tsx 의 useSyncExternalStore.
     서버 스냅샷이 "other"/false 인 것이 **안전 기본값과도 일치한다**(폰 카메라 폴백을 감춘다). */
  const inApp = useSyncExternalStore(() => () => {}, isInApp, () => false);
  const device = useSyncExternalStore(() => () => {}, detectDevice, () => "other" as Device);
  /** 왜 녹화가 안 되는지 — 없으면 정상. 카메라를 켜기 전에 미리 안다(권한창을 띄우지 않는다) */
  const [block, setBlock] = useState<Block | "perm" | "busy">(null);
  /** 브라우저 녹화를 **실제로 시도해서 실패했나.** 「폰 카메라로 찍기」는 그때만 나타난다.
      ⚠ 처음 오신 사장님에게 길이 둘이면 «어느 걸 눌러야 하지»에서 멈춘다 —
        되는 길 하나만 보여 주고, 막혔을 때 다른 길을 준다(2026-09-11 회장님 지시 3). */
  const [camFailed, setCamFailed] = useState(false);
  /** 앞면(user) / 뒷면(environment) 카메라. 다시 켤 때도 고르신 쪽을 그대로 쓴다 */
  const [facing, setFacing] = useState<"user" | "environment">("user");
  /** 이 폰에 달린 카메라 목록. **deviceId 로 바꾼다** — `facingMode` 요청은 안드로이드에서
      무시되는 기기가 흔하다(2026-09-11 회장님 실측). 권한을 받은 뒤에만 이름·id 가 채워진다 */
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  /** 지금 켜져 있는 카메라의 deviceId */
  const [camId, setCamId] = useState("");
  const [switching, setSwitching] = useState(false);
  /** 이 폰에서는 전환이 **구조적으로 안 되는** 것으로 판명됐다 → 버튼을 감춘다.
      ⚠ 「권한 거부」는 여기 넣지 않는다. 그건 다시 누르면 되는 일이다 */
  const [switchDead, setSwitchDead] = useState("");
  /** 어느 길로 찍었나 — 브라우저 녹화 / 폰 기본 카메라 */
  const [source, setSource] = useState<"browser" | "camera">("browser");
  /** 표지 사진 — 못 만들어도 업로드는 막지 않는다(회장님 지시 5). 다만 사장님이 알 수 있게 한다 */
  const [poster, setPoster] = useState<{ st: "idle" | "work" | "ok" | "fail"; blob?: Blob }>({ st: "idle" });
  const posterJob = useRef<Promise<Blob | null> | null>(null);
  /** 뽑아 둔 표지의 미리보기 주소 — 확인 화면에서 **사장님이 직접 눈으로 본다.**
      말로 「표지가 있다」고 하는 것보다 보여 주는 편이 확실하다(2026-09-11 실패에서 배움) */
  const [posterUrl, setPosterUrl] = useState("");
  /** 찍힌 파일이 못 쓰는 형식일 때의 안내. 업로드 실패(err)와 섞지 않는다 — 원인이 다르다 */
  const [badWhy, setBadWhy] = useState("");
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
  /** 녹화 초의 «지금 값». rec.onstop 은 startRec 시점의 sec(0)을 붙잡고 있어 state 로는 못 읽는다 */
  const secRef = useRef(0);

  useEffect(() => () => { stopStream(); }, []);
  useEffect(() => { if (liveRef.current && streamRef.current) liveRef.current.srcObject = streamRef.current; }, [screen]);

  const questionText = q?.text ?? custom.trim();

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function setup() {
    setErr(""); setBadWhy("");
    /* ★ 카메라를 켜기 «전에» 먼저 본다 — 권한창을 띄우지 않는 공짜 검사다.
       여기서 걸리면 사장님이 네 걸음을 걷고 막히는 일이 없다(회장님 지시 3). */
    const b = canRecordHere(mode);
    if (b) { setBlock(b); setCamFailed(true); setScreen("error"); return; }
    setBlock(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mode === "video" ? { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true } : { audio: true });
      streamRef.current = stream;
      setScreen("setup");
      /* ⚠ 카메라 개수는 **권한을 받은 뒤에야** 정확하다. 그전에 세면 목록에 이름이 없어
         한 대로 보이는 폰이 있다 — 그러면 전환 버튼이 영영 안 뜬다. */
      void countCameras(stream);
      /* 실제로 열린 카메라가 앞면인지 뒷면인지 **브라우저에게 물어서** 정한다.
         우리가 «user 로 요청했으니 앞면일 것»이라고 단정하지 않는다 — 거울 반전이 걸려 있다. */
      setFacing(facingOf(stream.getVideoTracks()[0], undefined) === "environment" ? "environment" : "user");
    } catch (e) {
      /* ⚠ 전에는 오류를 통째로 버리고 한 문구만 띄웠다. 원인이 다르면 할 일도 다르다. */
      const name = (e as DOMException)?.name ?? "";
      if (name === "NotReadableError" || name === "AbortError") {
        setErr("다른 앱이 카메라를 쓰고 있어요. 카메라 앱을 닫고 다시 눌러 주세요.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setErr("이 폰에서 카메라를 찾지 못했어요.");
      } else if (inApp) {
        /* ★ 원인 설명을 앞에 두지 않는다(회장님 지시 2). 사장님은 「왜」가 아니라
           「다음에 뭘 누를지」가 궁금하다. 「인스타」는 뺐다 — 우리는 카톡·문자로만 보낸다. */
        setErr("오른쪽 위 ⋮ → 다른 브라우저로 열기 를 눌러 주세요. (크롬·사파리)");
      } else {
        setErr("카메라·마이크를 쓰려면 '허용'을 눌러 주세요.");
      }
      /* ★ 여기서 서버에 기록을 남긴다. 「카톡 인앱에서 카메라가 열리는가」는 저장소 안에서
         알 수 없다 — 폰이 있어야 안다. 이제 **실패했을 때만** 진짜 답이 서버에 쌓인다.
         짐작으로 경고를 띄우는 대신 사실을 모은다(2026-09-11 회장님 지시 2). */
      void tellServer("camera_open_failed", `${name || "unknown"} inApp=${inApp} dev=${device}`);
      setCamFailed(true);
      setBlock("perm");
      setScreen("error");
    }
  }

  /** 카메라 목록 읽기 — **권한을 받은 뒤에** 불러야 이름과 id 가 채워진다 */
  async function countCameras(stream: MediaStream | null) {
    try {
      const ds = await navigator.mediaDevices.enumerateDevices();
      const vids = ds.filter((d) => d.kind === "videoinput" && d.deviceId);
      setCams(vids);
      const now = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
      setCamId(now || vids[0]?.deviceId || "");
    } catch { setCams([]); }
  }

  /**
   * 앞↔뒤 카메라 바꾸기 — **녹화를 «시작하기 전»에만** 된다 (2026-09-11 회장님 지시 5).
   *
   * ★ 왜 필요한가: 「얼굴이 안 나와도 됩니다」라고 **말만** 해서는 부족하다.
   *   화면에 자기 얼굴이 떠 있으면 대부분 그 자리에서 말이 안 나온다.
   *   **안 나오게 하는 방법**을 손에 쥐여 드려야 실제로 찍으신다.
   *   뒷면으로 현장을 비추며 말하는 쪽이 손님에게도 더 좋은 영상이 된다.
   *
   * ⚠ **녹화 중에는 못 바꾼다.** MediaRecorder 는 `start()` 때 붙잡은 트랙을 끝까지 녹화하고,
   *   스트림을 갈아 끼워도 따라오지 않는다(브라우저 규격). 그래서 **녹화 화면에는 이 버튼을 두지 않는다** —
   *   눌러도 안 되는 버튼을 두느니 없는 편이 낫다.
   * ⚠ 실패하면 **쓰던 카메라를 그대로 둔다.** 화면이 검게 죽는 것이 최악이다.
   */
  async function switchCamera() {
    if (switching || mode !== "video" || cams.length < 2) return;
    const i = Math.max(0, cams.findIndex((c) => c.deviceId === camId));
    const target = cams[(i + 1) % cams.length];
    setSwitching(true); setErr("");

    const cur = streamRef.current;
    const oldVideo = cur?.getVideoTracks()[0] ?? null;
    /* ★★ **마이크는 다시 요청하지 않는다.** 쓰던 마이크 트랙을 그대로 들고 간다.
       2026-09-11 실측에서 「카메라, 마이크를 사용하려고 합니다」 팝업이 다시 뜬 이유가
       옛 코드의 `audio: true` 였다 — 이미 쓰고 있는 마이크를 또 달라고 했다. */
    const audio = cur?.getAudioTracks() ?? [];

    const openVideo = (id: string) => navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const attach = (v: MediaStreamTrack) => {
      const merged = new MediaStream([v, ...audio]);
      streamRef.current = merged;
      if (liveRef.current) liveRef.current.srcObject = merged;
      return merged;
    };

    let got: MediaStream | null = null;
    let why = "";
    /* ① 먼저 **옛 카메라를 켜 둔 채로** 새 카메라를 연다. 여기서 되면 화면이 한 순간도 안 끊긴다. */
    try { got = await openVideo(target.deviceId); }
    catch (e) { why = (e as DOMException)?.name || "unknown"; }

    /* ② 「이미 쓰는 중」이면 옛 카메라를 놓고 한 번 더 — **폰 한 대가 카메라를 하나만
       열 수 있는 기기가 흔하다.** 여기서 놓아도 ③의 되살리기가 있어서 안전하다. */
    if (!got && (why === "NotReadableError" || why === "AbortError" || why === "TrackStartError")) {
      oldVideo?.stop();
      try { got = await openVideo(target.deviceId); }
      catch (e) { why = (e as DOMException)?.name || why; }
    }

    if (got) {
      const v = got.getVideoTracks()[0];
      oldVideo?.stop();
      attach(v);
      setCamId(target.deviceId);
      setFacing(facingOf(v, target) === "environment" ? "environment" : "user");
      setSwitching(false);
      return;
    }

    /* ③ ★ 못 바꿨다 — **원래 카메라를 반드시 되살린다.** 화면이 멈춘 채로 두지 않는다
       (2026-09-11 회장님 지시). ②에서 옛 트랙을 놓았을 수 있다. */
    if (!oldVideo || oldVideo.readyState !== "live") {
      try { attach((await openVideo(camId)).getVideoTracks()[0]); }
      catch { /* 이것마저 실패하면 아래 문구가 «다시 켜기»로 안내한다 */ }
    }
    const backOk = (streamRef.current?.getVideoTracks()[0]?.readyState ?? "") === "live";

    setErr(
      `${SWITCH_WHY[why] ?? "카메라를 바꾸지 못했어요"} (오류: ${why})` +
      (backOk ? " — 지금 카메라로 그대로 찍으셔도 됩니다." : " — 아래 [카메라 다시 켜기]를 눌러 주세요."),
    );
    /* ★ 기기 문제로 확정된 것만 버튼을 감춘다. 「권한 거부」는 다시 누르면 되는 일이라 남긴다 */
    if (why !== "NotAllowedError" && why !== "SecurityError") setSwitchDead(why);
    /* ★ 실패를 서버에 남긴다 — 어떤 폰에서 안 되는지 저절로 쌓인다(회장님 지시) */
    void tellServer("camera_switch_failed", `${why} cams=${cams.length} label=${(target.label || "no-label").slice(0, 40)} back=${backOk}`);
    setSwitching(false);
  }

  function startCountdown() {
    setScreen("count"); setCount(3);
    let c = 3;
    const t = setInterval(() => { c -= 1; setCount(c); if (c <= 0) { clearInterval(t); startRec(); } }, 1000);
  }

  function startRec() {
    const stream = streamRef.current;
    /* ⚠ 여기서 그냥 return 하면 카운트다운 화면에 «●»만 남고 빠져나갈 길이 없다.
       폰 카메라로 들어온 뒤 [다시 찍기]를 누르면 실제로 그렇게 됐다(2026-09-10 반증 검사). */
    if (!stream) { setErr("카메라가 꺼졌어요. 한 번만 다시 켜 주세요."); setBlock("perm"); setScreen("error"); return; }
    chunks.current = [];
    const mime = pickMime(mode);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunks.current, { type: rec.mimeType || "" });
      setBlob(b); setBlobUrl(URL.createObjectURL(b));
      if (tickRef.current) clearInterval(tickRef.current);
      setSource("browser");
      setScreen("review");
      void checkAndPrepare(b, secRef.current, mode);
    };
    rec.start(1000);
    setSec(0); secRef.current = 0; setPaused(false); setScreen("rec");
    tickRef.current = setInterval(() => {
      setSec((s) => {
        if (recRef.current?.state === "paused") return s;
        if (s + 1 >= MAX_SEC) { secRef.current = MAX_SEC; recRef.current?.stop(); return MAX_SEC; }
        secRef.current = s + 1;
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
    const wasCamera = source === "camera";
    setBlob(null); setBlobUrl(""); setSec(0); secRef.current = 0;
    setBadWhy(""); setPoster({ st: "idle" }); setPosterUrl(""); posterJob.current = null; setSource("browser");
    /* ⚠ 폰 카메라로 찍어 온 사장님은 브라우저 녹화가 안 되는 폰일 수 있다.
       그 사람을 카메라 준비 화면으로 보내면 [시작]을 눌러도 아무 일이 없다. */
    setScreen(wasCamera ? "mode" : "setup");
  }

  /**
   * 찍자마자 하는 두 가지 — **① 진짜 mp4 인지 보고 ② 표지를 뽑는다.**
   *
   * ★ ①이 먼저다. 못 쓰는 형식이면 **바이트 하나 올리기 전에** 되돌린다(회장님 지시 4).
   *   서버도 같은 검사를 한 번 더 한다 — 이건 «사장님 시간을 아끼는» 1차 관문이다.
   * ★ ②는 불만 붙이고 기다리지 않는다. 사장님이 미리보기를 보는 몇 초 동안 뒤에서 끝난다.
   */
  async function checkAndPrepare(b: Blob, recordedSec: number, kind: "video" | "audio") {
    setBadWhy(""); setPoster({ st: "idle" }); setPosterUrl(""); posterJob.current = null;
    if (kind !== "video") return;
    const head = new Uint8Array(await b.slice(0, SNIFF_BYTES).arrayBuffer().catch(() => new ArrayBuffer(0)));
    const found = sniff(head);
    if (!isPlayableVideo(found)) { setBadWhy(whyNotPlayable(found)); return; }
    setPoster({ st: "work" });
    posterJob.current = capturePoster(b, recordedSec).then((pb) => {
      setPoster(pb ? { st: "ok", blob: pb } : { st: "fail" });
      setPosterUrl(pb ? URL.createObjectURL(pb) : "");
      return pb;
    });
  }

  /**
   * 폰 기본 카메라로 찍어 오기 — **안드로이드에서만** 보여주는 길이다.
   * ⚠ 아이폰 카메라는 `.mov` 를 내놓는다. 그래서 아이폰에는 이 버튼 자체를 안 보여준다.
   *   그래도 여기서 형식을 확인한다 — 판정이 틀렸을 때 조용히 받는 것이 최악이기 때문이다.
   */
  async function takeFromCamera(f: File | null) {
    if (!f) return;
    const head = new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer().catch(() => new ArrayBuffer(0)));
    const found = sniff(head);
    if (!isPlayableVideo(found)) { setBadWhy(whyNotPlayable(found)); return; }
    stopStream();
    setBadWhy(""); setSource("camera"); setSec(0); secRef.current = 0;
    setBlob(f); setBlobUrl(URL.createObjectURL(f));
    setScreen("review");
    void checkAndPrepare(f, 0, "video");
  }

  /**
   * 우리 서버에 한 번 말을 걸어 본다. **대답이 오면 폰 인터넷은 살아 있다.**
   * 겸사겸사 무슨 일이 있었는지 서버 기록에 남긴다 — 다음 실패는 조용하지 않다.
   * ⚠ 상태 코드는 보지 않는다. 「대답이 왔다」는 사실 하나만 쓴다.
   */
  async function tellServer(stage: string, detail: string): Promise<boolean> {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      await fetch("/api/story/trouble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, k, stage, detail }), signal: c.signal, cache: "no-store",
      });
      clearTimeout(t);
      return true;
    } catch { return false; }
  }

  /** 「네트워크 오류」로 뭉뚱그리지 않는다. **진짜 끊김인지 저장소 거절인지 가려서** 말한다 */
  async function explainPut(f: PutFail): Promise<string> {
    if (f.kind === "status") return `저장소가 ${f.status} 로 거절했어요. [보내기]를 한 번 더 눌러 주세요.`;
    if (f.kind === "abort") return "보내기가 중간에 멈췄어요. [보내기]를 다시 눌러 주세요.";
    const mb = blob ? (blob.size / 1048576).toFixed(1) : "?";
    const alive = await tellServer(`put_${f.kind}`, `${mb}MB ${blob?.type ?? ""} ${sec}s ${source}`);
    if (!alive) return "인터넷 연결이 끊겼어요. 연결된 뒤 [보내기]를 다시 눌러 주세요.";
    return f.kind === "timeout"
      ? `영상이 커서(${mb}MB) 시간 안에 다 못 올렸어요. 와이파이가 잘 잡히는 곳에서 [보내기]를 다시 눌러 주세요.`
      : "인터넷은 정상인데 저장소가 업로드를 받아 주지 않았어요. 폰 문제가 아니라 저희 쪽 설정 문제입니다 — 방금 온스토리에 자동으로 알렸어요. 찍은 영상은 그대로 있으니 잠시 뒤 [보내기]를 눌러 주세요.";
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
          /* ⚠ 여기가 «뭉뚱그리던» 자리다. 브라우저는 왜 실패했는지 알려 주지 않는다 —
             진짜 끊김도, 저장소가 예비 질문(preflight)을 거절한 것도 똑같이 `onerror` 로 온다.
             그래서 모양만 담아 던지고, 이유는 `explainPut()` 이 서버에 물어본 뒤 확정한다. */
          x.timeout = 180_000;
          x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new PutFail("status", x.status)));
          x.onerror = () => reject(new PutFail("neterr", 0));
          x.ontimeout = () => reject(new PutFail("timeout", 0));
          x.onabort = () => reject(new PutFail("abort", 0));
          x.send(blob);
        });
      } else {
        // 파일명 확장자를 실제 형식에 맞춘다 — mp4 를 story.webm 으로 올리면 서버 로그·재현이 헷갈린다
        const fd = new FormData(); fd.set("slug", slug); fd.set("k", k); fd.set("key", d.key);
        fd.set("file", blob, `story.${d.key.split(".").pop() || "webm"}`);
        const u = await fetch("/api/story/upload", { method: "POST", body: fd });
        if (!u.ok) throw new Error(((await u.json().catch(() => ({}))) as { error?: string }).error ?? "업로드 실패");
        setProgress(100);
      }
      /* ── 표지 사진 (있으면) ──
         ★ 영상이 먼저 올라간 뒤다. 표지는 **실패해도 60초를 날리지 않는다**(회장님 지시 5).
         ⚠ 최대 2초만 기다린다 — 뽑기가 아직 안 끝났다고 «보내기»가 멈춰 보이면 안 된다. */
      let posterOk = false;
      try {
        const pb = poster.blob ?? await Promise.race([
          posterJob.current ?? Promise.resolve(null),
          new Promise<null>((r) => setTimeout(() => r(null), 2000)),
        ]);
        if (pb) {
          const pf = new FormData();
          pf.set("slug", slug); pf.set("k", k); pf.set("key", d.key); pf.set("file", pb, "poster.jpg");
          const pr = await fetch("/api/story/poster", { method: "POST", body: pf });
          posterOk = pr.ok;
        }
      } catch { /* 표지는 여기서 절대 던지지 않는다 */ }
      if (!posterOk) setPoster({ st: "fail" });

      const s = await fetch("/api/story/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, k, key: d.key, question: questionText, questionId: q?.id, mode, durationSec: sec || undefined, source, poster: posterOk }) });
      if (!s.ok) {
        const sd = (await s.json().catch(() => ({}))) as { error?: string; retake?: boolean };
        // 서버가 «형식이 못 쓴다»고 되돌린 경우 — 업로드 실패가 아니라 «다시 찍기»로 안내한다
        if (sd.retake) { setBadWhy(sd.error ?? "다시 찍어 주세요"); setScreen("review"); return; }
        throw new Error(sd.error ?? "저장 실패");
      }
      stopStream();
      setScreen("done");
    } catch (e) {
      setErr(e instanceof PutFail ? await explainPut(e) : e instanceof Error ? e.message : "보내지 못했어요");
      setScreen("review");
    }
  }

  const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

  /* ⚠ 배경·글자색을 인라인으로 적지 않는다. `.t-caption`·`.t-h1` 이 클래스에 박아 둔
       밝은 화면용 색이 인라인 `color` 를 **이겨서** 초록 위에 초록 글자가 됐다(2026-09-11 실측).
       `.rec-shell` 이 토큰째 뒤집는다 — globals.css 참조. */
  return (
    <main className="rec-shell min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-md flex-col px-5 pb-10 pt-6">
        <div className="flex items-center justify-between t-caption opacity-70">
          <span>onstori.com/rec · {businessName}</span>
          <span>{screen === "rec" ? `REC ${mm(sec)} / ${mm(MAX_SEC)}` : "60초 녹화"}</span>
        </div>

        {/* 1 인사 */}
        {screen === "greet" && (
          <section className="flex flex-1 flex-col justify-center text-center">
            <p className="t-caption font-bold opacity-60">온스토리</p>
            <h1 className="font-display mt-3 t-h1 leading-tight">안녕하세요,<br />{businessName} 사장님</h1>
            <p className="mt-4 t-body leading-relaxed opacity-80">오늘 질문 하나에 60초만 말씀해 주세요. 찍으신 영상은 바로 홈페이지에 걸 수 있습니다.</p>
            <ul className="mx-auto mt-6 flex flex-wrap justify-center gap-2 t-caption font-semibold">
              {["✎ 글쓰기 금지", "🔗 이 링크가 로그인", "⤓ 앱 설치 없음"].map((t) => <li key={t} className="rounded-full border border-white/25 px-3 py-1.5">{t}</li>)}
            </ul>
            {/* ★ 2026-09-11 — 「카카오톡·인스타 안에서 열렸어요」 경고를 **없앴다.**
                ⚠ 그 경고는 **카메라를 열어 보지도 않고** 앱 이름(UA 문자열)만 보고 떴다.
                  한국 사장님은 거의 다 카톡으로 링크를 여신다. 첫 화면부터 「막혔다」고
                  말하면 대부분이 시작하기도 전에 겁을 먹는다 — 실제로는 열리는데도.
                ★ 대신 **진짜로 카메라를 열어 보고 실패했을 때만** 길을 안내한다(`setup()` 의 catch).
                  「하지 마라」가 아니라 「알 수 없는 것은 묻지 않고 해 본다」로 바꾼 것이다. */}
            <button type="button" onClick={() => setScreen("ask")} className="btn-lime mt-8 w-full !py-4 !t-body">60초 영상 촬영하기</button>
            <ShootGuide />
          </section>
        )}

        {/* 2 질문 */}
        {screen === "ask" && (
          <section className="flex-1 py-6">
            <QuestionShuffle dark onPick={(picked) => { setQ(picked); setCustom(""); setScreen("mode"); }} initialSeed={Date.now() % 1000} />
            <div className="mt-8 rounded-2xl bg-white/10 p-4">
              <p className="t-caption font-bold opacity-80">직접 주제를 적어도 돼요</p>
              <div className="mt-2 flex gap-2">
                <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} placeholder="예: 이번 주 바빴던 이유" className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 t-small text-white placeholder:text-white/40" />
                <button type="button" disabled={custom.trim().length < 2} onClick={() => { setQ(null); setScreen("mode"); }} className="rounded-xl px-4 t-small font-bold disabled:opacity-40" style={{ background: "var(--lime)", color: "var(--forest)" }}>이걸로</button>
              </div>
            </div>
          </section>
        )}

        {/* 3 영상/음성 */}
        {screen === "mode" && (
          <section className="flex flex-1 flex-col justify-center">
            <p className="t-caption font-bold opacity-60">오늘의 질문</p>
            <p className="font-display mt-2 t-h2 leading-snug">{questionText}</p>
            <button type="button" onClick={() => setScreen("ask")} className="mt-2 self-start t-small underline opacity-70">질문 바꾸기</button>
            <div className="mt-8 grid gap-3">
              {([["video", "영상으로", "매장·상품·손만 찍어도 됩니다. 얼굴은 선택이에요."], ["audio", "음성만", "목소리만 남깁니다. 얼굴도 매장도 안 나옵니다."]] as const).map(([m, t, d]) => (
                <button key={m} type="button" onClick={() => setMode(m)} className="rounded-2xl border p-4 text-left" style={{ borderColor: mode === m ? "var(--green-200)" : "var(--n-700)", background: mode === m ? "var(--n-800)" : "transparent", borderRadius: "var(--r-lg)" }}>
                  <p className="t-body font-bold">{mode === m ? "● " : "○ "}{t}</p>
                  <p className="mt-1 t-small opacity-75">{d}</p>
                </button>
              ))}
            </div>
            <ShootGuide compact />
            <button type="button" onClick={setup} className="btn-lime mt-8 w-full !py-4 !t-body">카메라·마이크 켜기</button>
            <p className="mt-3 text-center t-caption opacity-60">브라우저가 권한을 물으면 &lsquo;허용&rsquo;을 눌러 주세요</p>
            {/* ⚠ 이 화면에도 안내 자리를 둔다 — 폰 카메라로 찍고 돌아왔는데 아무 말이 없으면
                사장님은 버튼이 고장 난 줄 안다(2026-09-10 반증 검사가 잡아냈다). */}
            {badWhy && <p className="mt-4 rounded-xl bg-white/10 p-3 t-small leading-relaxed">{badWhy}</p>}
            <CameraFallback device={device} mode={mode} onFile={takeFromCamera} show={camFailed} />
          </section>
        )}

        {/* 4·5 카메라 확인 */}
        {screen === "setup" && (
          <section className="flex flex-1 flex-col">
            <p className="mt-4 t-caption font-bold opacity-60">카메라 확인</p>
            <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {mode === "video" ? (
                /* ⚠ 거울처럼 좌우를 뒤집는 것은 **앞면 카메라일 때만**이다. 뒷면으로 매장을 비추는데
                   좌우가 뒤집히면 간판 글씨가 거꾸로 보인다. 찍히는 파일은 원래 안 뒤집힌다(CSS 일 뿐). */
                <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center"><span className="t-h1">🎙</span><p className="mt-2 t-small opacity-80">음성만 녹음합니다</p></div>
              )}
              <div className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 t-small font-semibold leading-snug" style={{ color: "var(--forest)" }}>{questionText}</div>
              {/* ★ 카메라 앱과 같은 자리(오른쪽 아래)에 둔다. 어두운 알약 위 흰 글자 — 밝은 매장을
                  비춰도 읽힌다(8.46:1). 카메라가 하나뿐인 폰에는 아예 안 나타난다. */}
              {/* ★ 카메라가 둘 이상이고, **이 폰에서 전환이 불가능하다고 판명나지 않은** 동안만 보인다.
                  한 번 「이 기기는 안 된다」가 확인되면 사라진다 — 눌러도 안 되는 버튼은 없는 게 낫다. */}
              {mode === "video" && cams.length > 1 && !switchDead && (
                <button type="button" onClick={switchCamera} disabled={switching}
                  className="absolute bottom-3 right-3 rounded-full bg-black/70 px-4 py-2.5 t-small font-bold text-white disabled:opacity-60">
                  {switching ? "바꾸는 중…" : facing === "user" ? "⟲ 카메라 전환 · 뒷면으로" : "⟲ 카메라 전환 · 앞면으로"}
                </button>
              )}
            </div>
            {err && (
              <div className="mt-3">
                <p className="t-small font-semibold leading-relaxed" style={{ color: "var(--danger-soft)" }}>{err}</p>
                {/* ★ 미리보기가 죽었을 때 빠져나갈 길. 이것이 없으면 검은 화면 앞에서 갇힌다 */}
                <button type="button" onClick={setup} className="mt-2 rounded-full border border-white/40 px-4 py-2 t-caption font-bold">
                  카메라 다시 켜기
                </button>
              </div>
            )}
            {/* ★ 「얼굴 안 나와도 된다」는 말만으로는 부족하다 — **어떻게** 안 나오게 하는지 방법을 준다 */}
            <p className="mt-3 t-small leading-relaxed opacity-80">
              얼굴이 나오는 게 어색하실 수 있습니다.{" "}
              {cams.length > 1 && !switchDead
                ? <><b>[카메라 전환]</b> 을 눌러 매장이나 제품을 비추면서 말씀하셔도 됩니다.</>
                : <>카메라를 매장 쪽으로 돌려 비추면서 말씀하셔도 됩니다. 화면을 안 보셔도 괜찮아요.</>}
            </p>
            {/* ★ 「끝낼 권한」을 먼저 드린다 — 60초를 다 채워야 하는 줄 알면 20초에 말이 끝난 뒤
                어색해지고, 그 어색함이 그대로 영상에 남는다(2026-09-11 회장님 지시 4). */}
            <p className="mt-4 t-small leading-relaxed opacity-80">
              준비되셨으면 시작을 누르세요. 3·2·1 뒤 녹화가 시작됩니다.{" "}
              <b>꼭 60초를 다 쓰지 않으셔도 됩니다 — 하실 말씀이 끝나면 정지를 눌러 주세요.</b>{" "}
              다시 찍기는 무제한이에요.
            </p>
            <button type="button" onClick={startCountdown} className="btn-lime mt-6 w-full !py-4 !t-body">준비됐어요 · 시작</button>
          </section>
        )}

        {/* 6 카운트다운 · 7 녹화 */}
        {(screen === "count" || screen === "rec") && (
          <section className="flex flex-1 flex-col">
            <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {mode === "video" ? (
                <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }} />
              ) : (
                <div className="flex h-full items-center justify-center"><span className="t-h1">🎙</span></div>
              )}
              <div className="absolute inset-x-3 top-3 rounded-xl bg-white/95 p-3 t-small font-semibold leading-snug" style={{ color: "var(--forest)" }}>{questionText}</div>
              {screen === "count" ? (
                /* ⚠ 스크림 40% → 50%. 밝은 매장을 비추면 카운트다운 숫자가 2.85:1 로 묻혔다(→3.95:1) */
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="font-display t-h1 text-white">{count > 0 ? count : "●"}</span>
                  {/* ⚠ 「흰 글자 70%」가 스크림 위에 얹혀 2.16:1 이었다. 밝은 매장을 비추면
                      글자가 사라진다. 알약을 깔고 흰 글자를 100% 로 올린다(8.46:1). */}
                  <button type="button" onClick={startRec} className="absolute bottom-5 rounded-full bg-black/70 px-3 py-1 t-small font-semibold text-white underline">건너뛰기</button>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                  {/* ⚠ 알약을 50%→70% 로 어둡게 했다. 밝은 매장을 비추면 50% 로는 3.95:1 이라
                      「REC 0:42」가 안 읽힌다(2026-09-11 실측 → 8.46:1). */}
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 t-small font-bold text-white">
                    {/* 깜빡이지 않는다 — 무한 루프 애니메이션은 MOTION.md 금지 목록이다.
                        멈춤/녹화 중은 색으로 구분한다. */}
                    <span className="inline-block" style={{ width: 10, height: 10, borderRadius: "var(--r-full)", background: paused ? "var(--n-400)" : "var(--danger)" }} /> {paused ? "일시정지" : "REC"} {mm(sec)} / {mm(MAX_SEC)}
                  </span>
                </div>
              )}
            </div>
            {/* ⚠ 빨간 막대(--terra)는 홈 색과 1.55:1 이라 «얼마나 찍었는지»가 안 보였다.
                라임으로 바꾼다(4.55:1). 「녹화 중」은 위의 빨간 점과 REC 글자가 이미 말한다. */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-all" style={{ width: `${(sec / MAX_SEC) * 100}%`, background: "var(--lime)" }} /></div>
            {screen === "rec" && (
              <div className="mt-6 flex items-center justify-center gap-8">
                <button type="button" onClick={togglePause} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/60 t-small font-bold">{paused ? "재개" : "잠깐"}</button>
                {/* ⚠ 빨간 네모가 초록 바탕 위에 바로 얹혀 2.45:1 이었다 — 정지 버튼이 잘 안 보인다.
                    흰 원을 깔고 그 위에 빨간 네모를 올린다(3.70:1). 카메라 앱의 표준 모양이다. */}
                <button type="button" onClick={stopRec} aria-label="정지" className="flex h-20 w-20 items-center justify-center rounded-full bg-white"><span className="block h-8 w-8 rounded-md" style={{ background: "var(--terra)" }} /></button>
                <span className="h-14 w-14" />
              </div>
            )}
            <p className="mt-4 text-center t-caption leading-relaxed opacity-60">
              얼굴이 안 나와도 됩니다. 목소리면 충분합니다.<br />
              꼭 60초를 다 쓰지 않으셔도 됩니다 — 하실 말씀이 끝나면 정지를 눌러 주세요.
            </p>
          </section>
        )}

        {/* 8 확인 */}
        {screen === "review" && (
          <section className="flex flex-1 flex-col">
            <p className="mt-4 t-caption font-bold opacity-60">확인 · {mm(sec)}</p>
            <div className="mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
              {/* ★ `poster` 를 붙인다 — 붙이기 전에는 재생을 누르기 전까지 «회색 바탕에 재생 아이콘»만
                     보였다. 그래서 표지가 잘 뽑혔는지 사장님이 알 길이 없었다(2026-09-11 회장님 지적).
                     이제 여기 보이는 그림이 곧 손님이 처음 보게 될 그림이다. */}
              {mode === "video" ? <video src={blobUrl} poster={posterUrl || undefined} controls playsInline className="h-full w-full object-contain" /> :<div className="flex h-full flex-col items-center justify-center gap-4"><span className="t-h1">🎙</span><audio src={blobUrl} controls /></div>}
            </div>
            {/* ⚠ 못 쓰는 형식이면 «보내기»를 아예 없앤다. 남겨 두면 눌러도 또 되돌아와
                8MB 를 다시 올리게 된다 — 요금과 시간만 태운다(2026-09-10 반증 검사). */}
            {badWhy ? (
              <>
                <p className="mt-4 rounded-xl bg-white/10 p-3 t-small leading-relaxed">{badWhy}</p>
                <button type="button" onClick={reRecord} className="btn-lime mt-6 w-full !py-4 !t-body">다시 찍기</button>
              </>
            ) : (
              <>
                {err && <p className="t-small" style={{ marginTop: "var(--s-3)", color: "var(--danger-soft)" }}>{err}</p>}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button type="button" onClick={reRecord} className="rounded-full border border-white/40 py-4 t-body font-bold">다시 찍기</button>
                  <button type="button" onClick={send} className="btn-lime !py-4 !t-body">보내기</button>
                </div>
                {/* ★ 표지 안내는 버튼 «아래»에 둔다. 위에 두면 나중에 끼어들며 버튼을 밀어 내려
                    [보내기]로 뻗던 손가락이 [다시 찍기]를 누른다 — 60초를 되돌릴 수 없다.
                    ★ 성공했을 때는 아무 말도 하지 않는다. 사장님이 판단할 것이 없다(회장님 지시 5는 «알게 하라»다). */}
                <p className="mt-3 min-h-[2.5rem] text-center t-caption leading-relaxed opacity-60">
                  {/* ⚠ 실패를 «저희가 채워 드릴게요» 로만 말하면 사장님은 실패한 줄을 모른다.
                      2026-09-11 에 실제로 그랬다 — 못 뽑았다는 사실을 먼저 말한다(회장님 지시 1). */}
                  {poster.st === "fail"
                    ? "표지 사진을 못 뽑았어요. 손님 첫 화면은 저희가 채워 드릴게요 — 보내는 데는 문제 없습니다."
                    : poster.st === "work"
                      ? "표지 사진을 뽑는 중이에요…"
                      : "보내면 홈페이지에 걸 수 있어요."}
                </p>
              </>
            )}
          </section>
        )}

        {/* 보내는 중 */}
        {screen === "sending" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display t-h1">{progress}%</p>
            <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--lime)" }} /></div>
            <p className="mt-4 t-small opacity-80">보내는 중이에요. 화면을 닫지 마세요.</p>
          </section>
        )}

        {/* 9 완료 */}
        {screen === "done" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="t-h1">✓</p>
            <h2 className="font-display mt-2 t-h1">보냈어요</h2>
            {/* ★ 2026-09-10 — 「자막 영상과 다듬은 글을 30분쯤 뒤 문자로」를 지웠다.
                자막 워커도, 글 다듬기도, 그 문자도 **아직 없다.** 오지 않는 문자를 약속하면
                사장님은 고장으로 여긴다. 지금 진짜 되는 것만 말한다.
                ⚠ 자막·채널 발행이 실제로 도는 날 이 문구를 되살려라. 그전에는 안 된다. */}
            <p className="mt-3 max-w-xs t-small leading-relaxed opacity-80">영상이 저장됐어요. <b>홈페이지 관리</b>에서 이 영상을 홈페이지에 걸 수 있습니다.</p>
            <a href={`/${slug}/edit`} className="btn-lime mt-8">홈페이지 관리로</a>
            <button type="button" onClick={() => { setBlob(null); setBlobUrl(""); setSec(0); setQ(null); setCustom(""); setScreen("ask"); }} className="mt-4 t-small underline opacity-70">하나 더 녹화하기</button>
          </section>
        )}

        {screen === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            {/* ★ 「사파리로 열어 주세요」가 사는 자리 (회장님 지시 3).
                화면(Screen)을 늘리지 않고 **이유값 하나(block)** 로 제목·본문·버튼만 갈아 끼운다. */}
            <h2 className="font-display t-h2">
              {block === "no-api" || block === "no-mp4" ? "여기서는 촬영이 안 돼요" : "카메라를 열지 못했어요"}
            </h2>
            <p className="mt-3 max-w-xs t-small leading-relaxed opacity-80">
              {block === "no-api" || block === "no-mp4"
                ? "폰이나 브라우저가 조금 오래됐어요."
                : err}
            </p>

            {/* ⚠ 아이폰 인앱(카톡·인스타)에서는 «허용»을 누를 창 자체가 안 뜬다.
                누를 수 없는 것을 시키면 안 된다 — 실행 가능한 길을 **첫 줄에** 준다.
                ★ 메뉴 위치(「오른쪽 위 ⋮」)를 못 박지 않는다. 앱마다 다르다. */}
            {device === "ios" && (inApp || block === "no-api" || block === "no-mp4") && (
              <div className="mt-6 w-full max-w-xs rounded-2xl bg-white/10 p-4 text-left">
                <p className="t-small font-bold">사파리로 열어 주세요</p>
                <p className="mt-1.5 t-small leading-relaxed opacity-80">
                  <b>문자로 받은 그 링크를 다시 눌러 주세요.</b> 문자에서 열면 촬영이 됩니다.<br />
                  화면 구석의 ⋯ 또는 ⋮ 를 눌러 &lsquo;다른 브라우저로 열기&rsquo;를 골라도 됩니다.
                </p>
                <CopyLinkButton />
              </div>
            )}

            <button type="button" onClick={() => { setBlock(null); setErr(""); setScreen("mode"); }} className="btn-lime mt-8">다시 시도</button>
            {inApp && device === "android" && (
              <a
                href={`intent://${typeof location !== "undefined" ? location.host + location.pathname + location.search : ""}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${typeof location !== "undefined" ? encodeURIComponent(location.href) : ""};end`}
                className="mt-4 t-small underline opacity-80"
              >
                크롬으로 열기
              </a>
            )}
            {/* 안드로이드는 여기서도 폰 카메라로 빠져나갈 수 있다 */}
            <div className="w-full max-w-xs">
              {badWhy && <p className="mt-4 rounded-xl bg-white/10 p-3 text-left t-small leading-relaxed">{badWhy}</p>}
              <CameraFallback device={device} mode={mode} onFile={takeFromCamera} show={camFailed} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
