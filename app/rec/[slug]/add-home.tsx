"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * 📱 **홈 화면에 바로가기 만들기** — 대표님 아이디어입니다. (2026-09-17 지시 [20])
 *
 * > 「폰 홈 화면에 바로가기로 60초 촬영이 박히는 거야. 그러면 폰 할 때마다 앱을 보게 될 거고,
 * >   **자주 영상 찍어 올려줄 거 같다.**」
 *
 * ★ 우리 사업의 급소가 「사장님이 **다시 안 찍는 것**」이다. 홈 화면 아이콘은 그 급소를 직접 친다.
 *
 * 🔴 **기기마다 되는 방법이 다르다. 그래서 «정직하게» 갈라 안내한다.**
 *   · **안드로이드 크롬** — `beforeinstallprompt` 를 잡아 뒀다가 누르면 한 번에 설치
 *   · **아이폰 사파리** — 🔴 애플이 막아 뒀다. 자동으로 «못» 한다 → [공유⬆] → [홈 화면에 추가] 를 그림으로
 *   · **카톡·인스타 안** — 안 된다 → 「다른 브라우저로 열기」 뒤 다시
 *   · **이미 설치됨** — 버튼을 아예 숨긴다
 *
 * ⚠⚠ **가장 중요한 원칙 — 「눌러도 아무 일이 안 나는 버튼」을 만들지 않는다.**
 *   크롬이 `beforeinstallprompt` 를 **안 줄 수도** 있다(설치 조건을 크롬이 자기 마음대로 정하고,
 *   서비스워커가 없으면 안 주던 시절이 있었다 — 그런데 **지시 3번이 서비스워커를 만들지 말라고 한다**).
 *   ⇒ 그래서 **자동 설치가 없으면 «손으로 하는 길»을 그대로 펼친다.** 어느 경우에도 길이 있다.
 *
 * ⚠ 값이 **브라우저 바깥**(크롬의 설치 이벤트·홈 화면 여부)에 있어 `useSyncExternalStore` 로 읽는다.
 *   `useEffect` 안에서 상태를 바꾸면 검사기가 잡고(react-hooks), 서버 화면과 어긋나 깜빡인다.
 */

/** 크롬이 주는 이벤트. 타입 정의가 표준에 없어 필요한 만큼만 적는다 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window { __onstoriBip?: InstallPrompt }
}

type Kind = "loading" | "installed" | "inapp" | "ios" | "android-auto" | "manual";

let picked: Kind | null = null;   // 눌러서 결과가 난 뒤에만 채운다
const subs = new Set<() => void>();
let wired = false;
const emit = () => subs.forEach((f) => f());

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!wired && typeof window !== "undefined") {
    wired = true;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      window.__onstoriBip = e as InstallPrompt;
      emit();
    });
    window.addEventListener("appinstalled", () => { picked = "installed"; emit(); });
  }
  return () => { subs.delete(cb); };
}

function snapshot(): Kind {
  if (picked) return picked;
  if (typeof window === "undefined") return "loading";
  /* 이미 바로가기로 들어와 있으면 권할 이유가 없다 */
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";

  const ua = navigator.userAgent;
  /* 카톡·인스타·페북·네이버 «앱 안의 브라우저» 는 홈 화면 추가 자체가 없다 */
  if (/KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|DaumApps|Line\//i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  /* ★ 화면이 붙기 «전»에 크롬이 던진 것을 page.tsx 의 잔스크립트가 여기에 담아 둔다 */
  if (window.__onstoriBip) return "android-auto";
  return "manual";
}

const serverSnapshot = (): Kind => "loading";

export function AddToHome({ dark = true }: { dark?: boolean }) {
  const kind = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");

  /* 아직 못 정했거나 이미 바로가기 안이면 아무것도 그리지 않는다 */
  if (kind === "loading" || kind === "installed") return null;

  async function go() {
    const bip = typeof window !== "undefined" ? window.__onstoriBip : undefined;
    if (kind === "android-auto" && bip) {
      try {
        await bip.prompt();
        const { outcome } = await bip.userChoice;
        window.__onstoriBip = undefined;
        if (outcome === "accepted") { picked = "installed"; emit(); return; }
        setSaid("괜찮아요. 나중에 다시 눌러 주셔도 됩니다.");
        picked = "manual"; emit();
        return;
      } catch {
        /* 크롬이 거절하면 손으로 하는 길로 떨어진다 — 버튼이 죽지 않는다 */
        picked = "manual"; emit();
      }
    }
    setOpen((v) => !v);
  }

  const soft = dark ? "opacity-75" : "text-[var(--text-soft)]";
  const box = dark ? "bg-white/10" : "bg-n-50";

  return (
    <div className="mt-3">
      <button type="button" onClick={go}
        className={`w-full rounded-2xl border px-4 py-3 t-small font-bold ${dark ? "border-white/25" : "border-n-300"}`}>
        📱 홈 화면에 바로가기 만들기
      </button>
      <p className={`mt-1.5 text-center t-caption ${soft}`}>
        홈 화면에 추가해 두고 생각이 나면 바로 찍어요!
      </p>
      {said && <p className={`mt-1 text-center t-caption ${soft}`}>{said}</p>}

      {open && kind !== "android-auto" && (
        <div className={`mt-3 rounded-2xl ${box} p-4 text-left`}>
          {kind === "ios" && (
            <>
              <p className="t-small font-bold">아이폰은 두 번만 누르시면 됩니다</p>
              <ol className={`mt-2 space-y-2 t-small leading-relaxed ${soft}`}>
                <li><b>1.</b> 화면 <b>맨 아래 가운데</b>의 <b>공유 단추</b>를 누르세요 — <b>네모에서 화살표가 올라가는</b> 모양입니다.</li>
                <li><b>2.</b> 목록을 조금 내리면 <b>［＋ 홈 화면에 추가］</b> 가 있습니다. 그걸 누르고 오른쪽 위 <b>［추가］</b>.</li>
              </ol>
              {/* 말로만 하면 못 찾으신다. 그 두 모양을 그대로 그려 드린다 */}
              <div className="mt-3 flex items-center justify-center gap-4">
                <span className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 ${dark ? "bg-white/10" : "bg-white"}`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                  <span className="t-caption font-bold">공유</span>
                </span>
                <span className={`t-body ${soft}`} aria-hidden>→</span>
                <span className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 ${dark ? "bg-white/10" : "bg-white"}`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8" /><path d="M8 12h8" />
                  </svg>
                  <span className="t-caption font-bold">홈 화면에 추가</span>
                </span>
              </div>
              <p className={`mt-3 t-caption ${soft}`}>
                ⚠ <b>사파리</b>에서만 됩니다. 크롬으로 보고 계시면 주소를 사파리에서 한 번 열어 주세요 — 애플이 그렇게 막아 뒀습니다.
              </p>
            </>
          )}

          {kind === "inapp" && (
            <>
              <p className="t-small font-bold">지금은 카카오톡(또는 다른 앱) 안에서 보고 계세요</p>
              <p className={`mt-2 t-small leading-relaxed ${soft}`}>
                앱 안에서는 홈 화면에 추가가 <b>안 됩니다.</b><br />
                <b>오른쪽 위 ⋮ (또는 … )</b> → <b>［다른 브라우저로 열기］</b> 를 누르신 뒤,
                이 버튼을 <b>한 번만 더</b> 눌러 주세요.
              </p>
            </>
          )}

          {kind === "manual" && (
            <>
              <p className="t-small font-bold">브라우저 메뉴에서 한 번에 됩니다</p>
              <p className={`mt-2 t-small leading-relaxed ${soft}`}>
                <b>오른쪽 위 ⋮</b> 를 누르고 <b>［홈 화면에 추가］</b> 를 고르세요.
                (폰에 따라 <b>［앱 설치］</b> 라고 적혀 있기도 합니다.)
              </p>
              <p className={`mt-2 t-caption ${soft}`}>
                ⚠ 아이폰이시면 <b>사파리</b>의 <b>공유 단추 → ［홈 화면에 추가］</b> 입니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
