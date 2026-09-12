"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { josa } from "@/lib/sns/status-say";
import { WEEKLY_NOTICE } from "@/lib/weekly";

/**
 * **넘겨받기 단추.** (2026-09-13 회장님 지시 B1·B3)
 *
 * ★ 로그인이 안 돼 있으면 로그인으로 보냈다가 **이 자리로 되돌아온다**(`next`).
 *   되돌아오지 않으면 사장님이 「어디로 갔지」 하고 길을 잃는다.
 * ★ 누르기 «전»에 주 1회 문자가 켜진다는 것을 **미리** 말한다 — 문구의 출처는 한 곳이다
 *   (`WEEKLY_NOTICE`, 위저드 3단계와 같은 줄).
 */
export function ClaimClient({
  slug, k, businessName, loggedIn,
}: { slug: string; k: string; businessName: string; loggedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const here = `/claim/${slug}?k=${encodeURIComponent(k)}`;

  async function take() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, k }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "넘겨받지 못했어요. 잠시 후 다시 시도해 주세요.");
        setBusy(false);
        return;
      }
      router.replace(`/${slug}/edit`);
    } catch {
      setErr("연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <p className="t-small opacity-70">온스토리</p>
      <h1 className="font-display t-h1 mt-2">
        {businessName}{josa(businessName, "은/는")} 홈페이지, 준비해 뒀어요
      </h1>
      <p className="mt-4 t-small">
        지금 [가져가기]를 누르시면 이 홈페이지의 주인이 되세요.
        그때부터 사진·글·영업시간을 사장님이 직접 고치실 수 있어요.
      </p>

      {/* ★ 켜지는 것을 «미리» 말한다. 켠 뒤에 알리면 그것이 광고다 */}
      <p
        className="t-small"
        style={{
          marginTop: "var(--s-4)", borderRadius: "var(--r-md)",
          padding: "var(--s-3)", background: "var(--green-50)", color: "var(--n-800)",
        }}
      >
        {WEEKLY_NOTICE.lead}<b>{WEEKLY_NOTICE.strong}</b>{WEEKLY_NOTICE.tail}
      </p>

      {err && (
        <p className="t-small" style={{ marginTop: "var(--s-4)", color: "var(--danger)" }}>
          {err}
        </p>
      )}

      {loggedIn ? (
        <button type="button" className="btn-lime mt-8" onClick={take} disabled={busy}>
          {busy ? "가져오는 중…" : "이 홈페이지 가져가기"}
        </button>
      ) : (
        <>
          {/* ⚠ 링크로 바로 보낸다 — 로그인 뒤 이 자리로 돌아와 단추를 누르시게 된다 */}
          <a className="btn-lime mt-8 text-center" href={`/login?next=${encodeURIComponent(here)}`}>
            로그인하고 가져가기
          </a>
          <p className="mt-3 t-small opacity-70">
            카카오로 3초면 됩니다. 사장님 것인지 확인하기 위한 절차예요.
          </p>
        </>
      )}

      <p className="mt-8 t-small opacity-60">
        미리 보기: <a className="underline" href={`/${slug}`} target="_blank" rel="noreferrer">onstori.com/{slug}</a>
      </p>
    </main>
  );
}
