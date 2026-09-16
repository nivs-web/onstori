"use client";

import { useCallback, useEffect, useState } from "react";
import { PHONE_PRIVATE_NOTICE, WEEKLY_UPGRADE_NOTICE } from "@/lib/weekly";
import { lockedPayload } from "@/lib/plan-gate";

/**
 * 「주 1회 촬영 알림」 설정. (2026-09-12 회장님 지시 8 → 2026-09-16 대표님 지시로 «카드 + 토글»로 개편)
 *
 * ★★ 이게 제품의 심장이다. 지금까지는 사장님이 **버튼을 눌러야만** 링크가 나갔는데,
 *   그 버튼을 누르러 들어오게 만드는 것이 바로 그 문자였다 — 고리가 닫혀 있었다.
 *
 * ★★ 2026-09-16 대표님 지시 — **「토글을 켜거나 버튼을 누르면 하단에 메뉴가 등장하는 방식」**.
 *   이유는 하나다: /edit 이 **심플해 보여야** 한다. 그래서 «꺼져 있으면 아래가 아예 안 보인다».
 *   요일·시각·받는 방법은 **켠 분에게만** 필요한 것이지, 안 켠 분에게는 화면 쓰레기다.
 *
 * ⚠ 알림톡은 아직 심사 전이라 **카카오톡을 골라도 지금은 문자로 간다.** 그 사실을 그대로 적는다.
 * ⚠ 「거부」와 「아직 설정 안 함」은 다르다 — 거부한 사장님에게 설정하라고 또 조르지 않는다.
 *
 * 🔴 저장 자리는 `settings.weekly` **그대로**다. 칸 이름을 새로 만들지 않았다 —
 *   크론(`app/api/cron/weekly/route.ts`)이 바로 그 자리를 읽는다. 저장 길도 기존
 *   `/api/site/weekly` 하나뿐이다(새 API 를 만들지 않았다).
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Weekly = {
  on: boolean;
  channel: "email" | "kakao" | "sms";
  phone?: string;
  weekday: number;
  hour: number;
  /**
   * 🔴 **문자를 실제로 내보내는 두 번째 자물쇠.** (2026-09-15 대표님 확정)
   *   크론은 ①정회원인가(`canUse(site,"sms")`) ②사장님이 직접 켰는가(`smsOptIn`)
   *   **둘 다**여야 문자를 보낸다. 그래서 「문자로 받기」를 고르시면 이 칸도 함께 켠다.
   */
  smsOptIn?: boolean;
};

/**
 * 「받는 방법」 — 대표님이 정하신 세 갈래.
 * ⚠ 저장은 기존 `channel` 칸에 얹는다. **이메일은 언제나 간다**(lib/weekly.ts) —
 *   그래서 「문자로 받기」도 실제로는 «메일 + 문자»다. 그 사실을 화면에 그대로 적는다.
 */
type Method = "sms" | "email" | "both";

const METHODS = [
  ["sms", "문자로 받기"],
  ["email", "메일로 받기"],
  ["both", "둘 다 받기"],
] as const;

/** 저장된 값에서 「받는 방법」을 되읽는다 — 메일이 아니면 «둘 다»로 보여 준다(사실이 그렇다) */
function methodOf(w: Weekly): Method {
  return w.channel === "email" ? "email" : "both";
}

export function WeeklyPanel({ slug, paid }: {
  slug: string;
  /**
   * 정회원인가 — ★ 안 주시면 이 부품이 `/api/site/get` 으로 **직접** 확인한다.
   * (ui.tsx 가 이미 `data.trial` 을 갖고 있으니, 나중에 `paid={data.trial?.paid === true}`
   *  한 줄만 얹으면 이 여벌 호출이 사라진다.)
   */
  paid?: boolean;
}) {
  const [w, setW] = useState<Weekly | null>(null);
  const [method, setMethod] = useState<Method>("email");
  const [sitePhone, setSitePhone] = useState("");
  /** 번호를 홈페이지에 공개할까 — **기본은 비공개**다 (2026-09-13 대표님 결정 · lib/phone-privacy.ts) */
  const [phonePublic, setPhonePublic] = useState(false);
  /** null = 아직 모른다. **모를 때는 잠금 안내를 띄우지 않는다**(멀쩡한 정회원을 놀래지 않으려고) */
  const [isPaid, setIsPaid] = useState<boolean | null>(paid ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const anon = () => { try { return localStorage.getItem("onstori:anonId") ?? ""; } catch { return ""; } };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/site/weekly", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon(), read: true }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        weekly?: Weekly; configured?: boolean; sitePhone?: string; phonePublic?: boolean; error?: string;
      };
      if (!r.ok) { setErr(d.error ?? "설정을 불러오지 못했어요."); return; }
      const base = d.weekly ?? null;
      /**
       * 🔴🔴 **기본은 «꺼짐»이다.** (2026-09-16 대표님 지시)
       * ⚠ 읽기 API 는 아직 설정 안 한 분께 `WEEKLY_DEFAULT`(=켜짐)를 «제안»으로 내려준다.
       *   그 제안을 그대로 켜 두면, 한 번도 켠 적 없는 사장님 화면이 **켜진 것처럼** 보인다.
       * ★ 그래서 `configured` 가 참일 때만 저장된 값을 믿고, 아니면 무조건 끈다.
       *   실제 발송도 같은 판정이다 — 저장 전에는 `settings.weekly` 가 아예 없어서
       *   크론의 `shouldSend` 가 false 다. 화면과 현실이 어긋나지 않는다.
       */
      const on = d.configured === true ? base?.on === true : false;
      setW(base ? { ...base, on } : null);
      if (base) setMethod(methodOf(base));
      setSitePhone(d.sitePhone ?? "");
      setPhonePublic(d.phonePublic === true);
    } catch { setErr("연결이 끊겼어요."); }
  }, [slug]);

  /** 정회원인지 확인 — 문자는 정회원만이라(lib/plan-gate.ts) 잠금 안내를 띄울지 정해야 한다 */
  const loadPaid = useCallback(async () => {
    if (typeof paid === "boolean") return;            // 위에서 내려주셨으면 묻지 않는다
    try {
      const r = await fetch("/api/site/get", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon() }),
      });
      const d = (await r.json().catch(() => ({}))) as { trial?: { paid?: boolean } };
      if (r.ok) setIsPaid(d.trial?.paid === true);
      /* ⚠ 실패하면 null 로 둔다 — 「모른다」와 「무료다」는 다르다 */
    } catch { /* 잠금 안내를 못 띄우는 것뿐이다. 설정 화면은 그대로 쓰실 수 있다 */ }
  }, [slug, paid]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); void loadPaid(); }, 0);
    return () => window.clearTimeout(t);
  }, [load, loadPaid]);

  /** 번호 공개를 «누르는 즉시» 저장한다 — 스위치처럼 보이는 것은 스위치여야 한다 */
  async function savePhonePublic(v: boolean) {
    setPhonePublic(v);
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/site/weekly", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon(), ...w, phonePublic: v }),
      });
      const d = (await r.json().catch(() => ({}))) as { phonePublic?: boolean; error?: string };
      if (!r.ok) { setErr(d.error ?? "저장하지 못했어요."); setPhonePublic(!v); return; }
      setPhonePublic(d.phonePublic === true);
      setMsg(v ? "홈페이지에 번호를 공개했어요." : "홈페이지에서 번호를 내렸어요.");
    } catch { setErr("연결이 끊겼어요."); setPhonePublic(!v); }
    finally { setBusy(false); }
  }

  async function save(next: Weekly) {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/site/weekly", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, anonId: anon(), ...next, phonePublic }),
      });
      const d = (await r.json().catch(() => ({}))) as { weekly?: Weekly; error?: string };
      if (!r.ok) { setErr(d.error ?? `저장하지 못했어요 (${r.status})`); return; }
      /* ⚠ 서버가 돌려주는 값에는 `smsOptIn` 이 안 실린다(lib/weekly.ts `readWeekly` 가 안 읽는다).
           그래서 서버 답으로 통째로 갈아끼우지 않고, **내가 보낸 값 위에** 덮는다 —
           안 그러면 방금 켠 문자 신청이 화면에서 도로 꺼진 것처럼 보인다. */
      setW({ ...next, ...(d.weekly ?? {}), smsOptIn: next.smsOptIn });
      setMsg("저장했어요.");
    } catch { setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (!w) return <p className="mt-6 t-small text-[var(--text-soft)]">{err || "불러오는 중…"}</p>;

  const set = (patch: Partial<Weekly>) => setW({ ...w, ...patch });

  /**
   * 「받는 방법」을 누르면 저장할 값으로 바꾼다.
   * ⚠ 예전에 카카오톡을 고르신 분이 「둘 다」를 누르셨다고 카카오톡 설정을 뺏지 않는다 —
   *   알림톡이 열리는 날 그 설정이 그대로 살아야 한다(lib/weekly.ts).
   */
  function pickMethod(m: Method) {
    setMethod(m);
    if (m === "email") { set({ channel: "email", smsOptIn: false }); return; }
    set({ channel: w!.channel === "kakao" ? "kakao" : "sms", smsOptIn: true });
  }

  const wantsSms = method !== "email";
  /** 🔴 문자는 정회원만(lib/plan-gate.ts). **버튼은 보이게 두고** 잠금 안내만 띄운다 */
  const lock = wantsSms && isPaid === false ? lockedPayload("sms") : null;

  return (
    <div className="space-y-4">
      {/* ★★ 카드 하나로 접는다 — 꺼져 있으면 제목·설명·토글만 보인다 (2026-09-16 대표님 지시) */}
      <section className="rounded-[var(--r-md)] border border-n-300 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-small font-bold">녹화 링크 주 1회 자동으로 받기 설정</p>
            <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
              녹화 링크를 주 1회 자동 전송할 시간대를 설정 가능합니다<br />
              주 1회 꾸준히 SNS 마케팅을 진행하시면 탁월한 홍보효과를 누릴 수 있습니다
            </p>
          </div>

          {/* 켜고 끄는 스위치.
              ★★★ **누르는 즉시 저장한다.** (2026-09-13 점검에서 잡힌 것)
              ⚠ 전에는 화면 안에서만 바뀌고 아래 [저장]을 눌러야 꺼졌다. 그런데 초록으로
                바뀌니 **스위치처럼 보였고**, 사장님은 분명히 껐다고 믿은 채 다음 주에 또 받았다.
              ★★ 이 기능은 «묻지 않고 보내는» 기본값이라, **끄는 길이 확실히 듣는 것**이
                그 기본값의 유일한 근거다. 여기가 헐거우면 전체가 광고 무단 발송이 된다.
                그래서 아래 [저장하기] 와 **별개로** 이 스위치만은 즉시 저장한다. */}
          <div className="shrink-0 text-right">
            <p className="t-caption font-semibold">주 1회 자동 받기</p>
            <button
              type="button" role="switch" aria-checked={w.on} disabled={busy}
              aria-label={`주 1회 자동 받기 ${w.on ? "끄기" : "켜기"}`}
              onClick={() => { const next = { ...w, on: !w.on }; setW(next); void save(next); }}
              className={`mt-1 rounded-full px-4 py-2 t-caption font-semibold disabled:opacity-40 ${
                w.on ? "bg-green-700 text-white" : "border border-n-300"
              }`}>
              {w.on ? "켜짐" : "꺼짐"}
            </button>
          </div>
        </div>

        {/* 🔴 꺼져 있으면 여기 아래가 «아예» 안 보인다 — 그래야 /edit 이 심플하다 */}
        {w.on && (
          <div className="mt-4 space-y-5 border-t border-n-200 pt-4">
            <div>
              <p className="t-small font-bold">무슨 요일에 받을까요?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => set({ weekday: i })}
                    className={`h-10 w-10 rounded-full t-caption font-semibold ${w.weekday === i ? "bg-green-700 text-white" : "border border-n-300"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="t-small font-bold">몇 시에 받을까요?</p>
              {/* ⚠ 시각은 «그 무렵»이다. 자동 발송이 하루 한 번 도는 구간이 있어서
                  고르신 시각이 지난 뒤 가장 가까운 발송 시간에 나간다. 정확한 척하지 않는다. */}
              <select className="field mt-2" value={w.hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{h < 12 ? `오전 ${h === 0 ? 12 : h}시` : `오후 ${h === 12 ? 12 : h - 12}시`}</option>
                ))}
              </select>
              <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                고르신 요일에 보내 드려요. 시각은 <b>그 무렵</b>이고, 조금 늦어질 수 있어요.
              </p>
            </div>

            <div>
              <p className="t-small font-bold">어떻게 받을까요?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {METHODS.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => pickMethod(v)}
                    className={`rounded-full px-4 py-2 t-caption font-semibold ${method === v ? "bg-green-700 text-white" : "border border-n-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* ★★ **이메일은 무조건 간다.** 문자·카톡은 그 위에 «더하는» 것이다
                  (2026-09-13 대표님 결정 6 — 메일 거의 0원 · 카톡 13원 · 문자 20원).
                  ⚠ 「메일 대신 문자」로 읽히면 안 된다. 그렇게 읽히면 메일을 끈 줄 아신다. */}
              <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                {method === "email" ? WEEKLY_UPGRADE_NOTICE : "이메일은 그대로 가고, 여기에 더해서 보내 드려요."}
              </p>
              {/* ⚠ 조용히 다른 길로 보내지 않는다 — 사실대로 말한다 */}
              {wantsSms && w.channel === "kakao" && (
                <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                  카카오톡은 <b>준비 중</b>이에요. 준비되는 대로 열어 드리고 알려드리겠습니다 — <b>그때까지는 문자로 갑니다.</b>
                </p>
              )}

              {/* 🔴 잠금 안내 — 문구는 `lib/plan-gate.ts` 한 곳에서 온다. 여기서 다시 쓰지 않는다.
                  ⚠ 버튼을 «숨기지» 않는다. 보이게 두고 「결제하시면 됩니다」를 보여 주는 것이 대표님 뜻이다. */}
              {lock && (
                <div className="mt-3 rounded-[var(--r-md)] border border-n-300 p-3">
                  <p className="t-caption font-bold">{lock.title}</p>
                  <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">{lock.body}</p>
                  <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">{lock.why}</p>
                  <a href={lock.href}
                    className="mt-2 inline-block rounded-full bg-green-700 px-4 py-2 t-caption font-semibold text-white">
                    {lock.cta}
                  </a>
                </div>
              )}
            </div>

            {/* 문자로 받겠다면 번호를 보여 주고 고칠 수 있게 한다 */}
            {wantsSms && (
              <div>
                <p className="t-small font-bold">받을 번호</p>
                <input className="field mt-2" inputMode="tel" maxLength={20}
                  value={w.phone ?? sitePhone} onChange={(e) => set({ phone: e.target.value })}
                  placeholder="010-0000-0000" />
                <p className="mt-1 t-caption text-[var(--text-soft)]">비워 두면 홈페이지에 적힌 번호로 갑니다.</p>
              </div>
            )}

            {/* 맨 하단 저장 (2026-09-16 대표님 지시) */}
            <div>
              <button type="button" disabled={busy} onClick={() => void save(w)}
                className="rounded-full bg-green-700 px-5 py-2.5 t-caption font-semibold text-white disabled:opacity-40">
                {busy ? "저장 중…" : "저장하기"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ★★★ **전화번호 공개 — 기본은 비공개다.** (2026-09-13 대표님 결정 3)
          ⚠ 어느 사장님도 번호가 홈페이지에 박히는 것을 원하지 않는다. 크롤링당해 광고에 쓰인다.
          ★ 이 스위치는 주 1회 알림과 **별개**다 — 알림을 꺼도 이 자리는 보여야 한다.
            그래서 위 카드 «밖»에 둔다. 카드 안에 넣으면 토글을 끈 분에게 영영 안 보인다. */}
      <div className="rounded-[var(--r-md)] border border-n-300 p-4">
        <p className="t-small font-bold">홈페이지에 전화번호 보이기</p>
        <p className="mt-1 t-caption leading-relaxed text-[var(--text-soft)]">
          {PHONE_PRIVATE_NOTICE.lead}<b>{PHONE_PRIVATE_NOTICE.strong}</b>
          {" 켜시면 손님이 홈페이지에서 바로 전화를 거실 수 있어요."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([[false, "숨기기 (권장)"], [true, "보이기"]] as const).map(([v, label]) => (
            <button key={label} type="button" disabled={busy}
              onClick={() => { void savePhonePublic(v); }}
              className={`rounded-full px-4 py-2 t-caption font-semibold disabled:opacity-40 ${phonePublic === v ? "bg-green-700 text-white" : "border border-n-300"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="t-caption font-semibold text-green-700">{msg}</p>}
      {err && <p className="rounded-lg bg-danger-soft p-2.5 t-caption font-semibold text-danger">{err}</p>}
    </div>
  );
}
