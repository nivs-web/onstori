"use client";

import { useCallback, useEffect, useState } from "react";
import { PHONE_PRIVATE_NOTICE, WEEKLY_UPGRADE_NOTICE } from "@/lib/weekly";

/**
 * 「주 1회 촬영 알림」 설정. (2026-09-12 회장님 지시 8)
 *
 * ★★ 이게 제품의 심장이다. 지금까지는 사장님이 **버튼을 눌러야만** 링크가 나갔는데,
 *   그 버튼을 누르러 들어오게 만드는 것이 바로 그 문자였다 — 고리가 닫혀 있었다.
 *
 * ⚠ 알림톡은 아직 심사 전이라 **카카오톡을 골라도 지금은 문자로 간다.** 그 사실을 그대로 적는다.
 * ⚠ 「거부」와 「아직 설정 안 함」은 다르다 — 거부한 사장님에게 설정하라고 또 조르지 않는다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Weekly = { on: boolean; channel: "email" | "kakao" | "sms"; phone?: string; weekday: number; hour: number };

export function WeeklyPanel({ slug }: { slug: string }) {
  const [w, setW] = useState<Weekly | null>(null);
  const [sitePhone, setSitePhone] = useState("");
  /** 번호를 홈페이지에 공개할까 — **기본은 비공개**다 (2026-09-13 대표님 결정 · lib/phone-privacy.ts) */
  const [phonePublic, setPhonePublic] = useState(false);
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
      const d = (await r.json().catch(() => ({}))) as { weekly?: Weekly; sitePhone?: string; phonePublic?: boolean; error?: string };
      if (!r.ok) { setErr(d.error ?? "설정을 불러오지 못했어요."); return; }
      setW(d.weekly ?? null);
      setSitePhone(d.sitePhone ?? "");
      setPhonePublic(d.phonePublic === true);
    } catch { setErr("연결이 끊겼어요."); }
  }, [slug]);

  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

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
      setW(d.weekly ?? next);
      setMsg("저장했어요.");
    } catch { setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (!w) return <p className="mt-6 t-small text-[var(--text-soft)]">{err || "불러오는 중…"}</p>;

  const set = (patch: Partial<Weekly>) => setW({ ...w, ...patch });

  return (
    <section className="space-y-4">
      <p className="t-caption leading-relaxed text-[var(--text-soft)]">
        주 1회 설정하신 시간대에 60초 촬영 알림이 갑니다.<br />
        주 1회는 최소 등록 권장 사양입니다. 매일 5회 이상 글 등록을 하시면 보다 뛰어난 마케팅 효과를 보실 수 있습니다.
      </p>

      {/* 받을까 말까 — 거부도 떳떳한 선택지로 둔다.
          ★★★ **누르는 즉시 저장한다.** (2026-09-13 점검에서 잡힌 것)
          ⚠ 전에는 화면 안에서만 바뀌고 아래 [저장]을 눌러야 꺼졌다. 그런데 버튼이 초록으로
            바뀌니 **스위치처럼 보였고**, 사장님은 분명히 껐다고 믿은 채 다음 주에 또 문자를 받았다.
          ★★ 이 기능은 «묻지 않고 보내는» 기본값이라(가입 3단계 안내), **끄는 길이 확실히
            듣는 것**이 그 기본값의 유일한 근거다. 여기가 헐거우면 전체가 광고 무단 발송이 된다. */}
      <div className="flex flex-wrap gap-2">
        {([[true, "알림 받기"], [false, "받지 않기"]] as const).map(([v, label]) => (
          <button key={label} type="button" disabled={busy}
            onClick={() => { const next = { ...w, on: v }; setW(next); void save(next); }}
            className={`rounded-full px-4 py-2 t-caption font-semibold disabled:opacity-40 ${w.on === v ? "bg-green-700 text-white" : "border border-n-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ★★★ **전화번호 공개 — 기본은 비공개다.** (2026-09-13 대표님 결정 3)
          ⚠ 어느 사장님도 번호가 홈페이지에 박히는 것을 원하지 않는다. 크롤링당해 광고에 쓰인다.
          ★ 이 스위치는 주 1회 알림과 **별개**다 — 알림을 꺼도 이 자리는 보여야 한다.
            그래서 아래 `w.on` 묶음 «밖»에 둔다. */}
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

      {w.on && (
        <>
          <div>
            <p className="t-small font-bold">어디로 받을까요?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([["email", "이메일"], ["kakao", "카카오톡"], ["sms", "문자"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => set({ channel: v })}
                  className={`rounded-full px-4 py-2 t-caption font-semibold ${w.channel === v ? "bg-green-700 text-white" : "border border-n-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* ★★ **이메일은 무조건 간다.** 문자·카톡은 그 위에 «더하는» 것이다
                (2026-09-13 대표님 결정 6 — 메일 거의 0원 · 카톡 13원 · 문자 20원).
                ⚠ 「메일 대신 문자」로 읽히면 안 된다. 그렇게 읽히면 메일을 끈 줄 아신다. */}
            <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
              {w.channel === "email"
                ? WEEKLY_UPGRADE_NOTICE
                : "이메일은 그대로 가고, 여기에 더해서 보내 드려요."}
            </p>
            {/* ⚠ 조용히 다른 길로 보내지 않는다 — 사실대로 말한다 */}
            {w.channel === "kakao" && (
              <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
                카카오톡은 <b>준비 중</b>이에요. 준비되는 대로 열어 드리고 알려드리겠습니다 — <b>그때까지는 문자로 갑니다.</b>
              </p>
            )}
          </div>

          {/* 문자로 받겠다면 번호를 보여 주고 고칠 수 있게 한다 */}
          {w.channel === "sms" && (
            <div>
              <p className="t-small font-bold">받을 번호</p>
              <input className="field mt-2" inputMode="tel" maxLength={20}
                value={w.phone ?? sitePhone} onChange={(e) => set({ phone: e.target.value })}
                placeholder="010-0000-0000" />
              <p className="mt-1 t-caption text-[var(--text-soft)]">비워 두면 홈페이지에 적힌 번호로 갑니다.</p>
            </div>
          )}

          <div>
            <p className="t-small font-bold">언제 받을까요?</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => set({ weekday: i })}
                  className={`h-10 w-10 rounded-full t-caption font-semibold ${w.weekday === i ? "bg-green-700 text-white" : "border border-n-300"}`}>
                  {d}
                </button>
              ))}
            </div>
            {/* ⚠ 시각은 «그 무렵»이다. 자동 발송이 하루 한 번 도는 구간이 있어서
                고르신 시각이 지난 뒤 가장 가까운 발송 시간에 나간다. 정확한 척하지 않는다. */}
            <select className="field mt-2" value={w.hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h < 12 ? `오전 ${h === 0 ? 12 : h}시` : `오후 ${h === 12 ? 12 : h - 12}시`}</option>
              ))}
            </select>
          </div>

          <p className="t-caption leading-relaxed text-[var(--text-soft)]">
            고르신 요일에 보내 드려요. 시각은 <b>그 무렵</b>이고, 조금 늦어질 수 있어요.
          </p>
        </>
      )}

      <button type="button" disabled={busy} onClick={() => void save(w)}
        className="rounded-full bg-green-700 px-5 py-2.5 t-caption font-semibold text-white disabled:opacity-40">
        {busy ? "저장 중…" : "저장"}
      </button>
      {msg && <p className="t-caption font-semibold text-green-700">{msg}</p>}
      {err && <p className="rounded-lg bg-danger-soft p-2.5 t-caption font-semibold text-danger">{err}</p>}
    </section>
  );
}
