"use client";

import { useState } from "react";

/**
 * 🔴 **「심사용 계정으로 일반 로그인이 안 돼요」를 한 번에 고치는 단추.** (2026-09-17 지시 [30])
 *
 * ★★ **대표님이 겪으신 일:** 로그아웃 뒤 `onstori.com/login` 에서 심사용 계정으로
 *   **수십 번 시도했는데 안 됩니다.**
 *
 * ★★ **왜 그런가(실측):** 그 계정은 **있습니다.** 다만 **비밀번호가 심겨 있지 않습니다** —
 *   `/login/review` 가 «일회용 링크»로 열어 온 계정이라 비밀번호를 가진 적이 없습니다.
 *   비밀번호가 없으면 일반 로그인은 **영원히** 「맞지 않아요」입니다.
 *
 * ★★ **왜 사람이 손으로 안 넣나 — 두 가지 때문입니다.**
 *   ① 🔴 **비밀번호를 옮겨 적으면 그 자체가 규칙 위반**입니다(불변 규칙 6 — 키는 환경변수에만).
 *   ② 한 글자만 틀려도 **`/login` 과 `/login/review` 가 서로 다른 비밀번호**를 갖게 됩니다.
 *   ⇒ 이 단추는 **Vercel 이 이미 갖고 있는 값을 서버가 직접 읽어** 심습니다.
 *     값이 **사람 손을 한 번도 안 거칩니다.**
 *
 * ⚠ **`/login/review` 는 그대로 삽니다** — 그 길은 환경변수를 직접 비교하므로 영향이 없습니다
 *   (유튜브·인스타 심사에 이미 낸 주소입니다).
 */
type Report = {
  계정?: string; 계정이있나?: boolean; 메일확인됨?: boolean; 가진홈페이지?: string[];
  비밀번호를심었나?: boolean; 일반로그인이되나?: boolean; 할일?: string; error?: string;
};

export function ReviewLoginFix() {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Report | null>(null);

  async function go(method: "GET" | "POST") {
    setBusy(true); setR(null);
    try {
      const res = await fetch("/api/auth/review/sync", { method });
      setR((await res.json().catch(() => ({}))) as Report);
    } catch { setR({ error: "불러오지 못했어요" }); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-10">
      <h2 className="t-body font-bold">심사용 로그인</h2>
      <div className="mt-3 rounded-2xl border border-n-200 bg-n-0 p-4">
        <p className="t-small">
          심사관이 <b>onstori.com/login</b> 에서 <b>심사용 메일 + 비밀번호</b>로 들어갈 수 있게 합니다.
        </p>
        <p className="mt-1 t-caption text-[var(--text-soft)]">
          비밀번호는 <b>Vercel 에 넣어 두신 값</b>을 서버가 직접 읽어 씁니다 — 여기에 적으실 것이 없습니다.
          <br />⚠ <b>［/login/review］는 그대로</b> 삽니다(유튜브·인스타 심사에 낸 주소입니다).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => go("GET")}
            className="rounded-full border border-n-300 px-3 py-1 t-small font-semibold disabled:opacity-40">
            {busy ? "보는 중…" : "지금 상태 보기"}
          </button>
          <button type="button" disabled={busy} onClick={() => go("POST")}
            className="btn btn-primary !py-1.5 !t-small disabled:opacity-40">
            {busy ? "하는 중…" : "일반 로그인 되게 하기"}
          </button>
        </div>

        {r && (
          <div className="mt-3 rounded-xl bg-n-50 p-3 t-small">
            {r.error ? <p className="text-danger">{r.error}</p> : (
              <ul className="space-y-1">
                <li>계정이 있나 : <b>{r.계정이있나 ? "예" : "아니오"}</b></li>
                {r.가진홈페이지 && (
                  <li>가진 홈페이지 : <b>{r.가진홈페이지.length ? r.가진홈페이지.join(" · ") : "없음"}</b></li>
                )}
                {r.비밀번호를심었나 !== undefined && <li>비밀번호를 심었나 : <b>{r.비밀번호를심었나 ? "예" : "아니오"}</b></li>}
                {r.일반로그인이되나 !== undefined && (
                  <li>🔴 <b>지금 일반 로그인이 되나</b> : <b style={{ color: r.일반로그인이되나 ? "var(--green)" : "var(--danger)" }}>
                    {r.일반로그인이되나 ? "됩니다" : "아직 안 됩니다"}
                  </b></li>
                )}
                {r.할일 && <li className="pt-1 text-[var(--text-soft)]">{r.할일}</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
