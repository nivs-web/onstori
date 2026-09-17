"use client";

import { useEffect, useState } from "react";

/**
 * 「이 링크는 만료됐어요」 화면에서 **스스로 다시 열어 보는** 단추. (2026-09-17 지시 [20])
 *
 * ★ 홈 화면 바로가기는 `?k=` 없이 `/rec/{slug}` 로 들어온다. 서버는 **로그인한 주인**이면
 *   거기서 바로 열어 준다. 그런데 **가입 «전»에 만든 홈페이지**는 주인이 `owner_id` 가 아니라
 *   **브라우저 안의 익명표(anonId)** 다 — 그 값은 **서버가 못 읽는다**(localStorage 라서).
 *
 * ⇒ 그래서 화면이 한 번 더 시도한다. 브라우저에서 익명표를 꺼내 물어보고, 맞으면 새 열쇠를 받아
 *   **그 자리에서 녹화 화면으로 들어간다.** 사장님은 아무것도 안 하셔도 된다.
 *
 * ⚠ 주인이 아니면 아무 일도 안 일어난다 — 판정은 서버의 `loadOwnedSite` 가 한다.
 */
export function Relink({ slug }: { slug: string }) {
  const [state, setState] = useState<"try" | "no">("try");

  useEffect(() => {
    let alive = true;
    (async () => {
      let anonId: string | undefined;
      try { anonId = localStorage.getItem("onstori:anonId") ?? undefined; } catch { /* 막혀 있으면 넘어간다 */ }
      try {
        const r = await fetch("/api/story/relink", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, anonId }),
        });
        const d = (await r.json().catch(() => ({}))) as { k?: string };
        if (!alive) return;
        if (r.ok && d.k) { location.replace(`/rec/${slug}?k=${d.k}`); return; }
      } catch { /* 넘어간다 */ }
      if (alive) setState("no");
    })();
    return () => { alive = false; };
  }, [slug]);

  if (state === "try") return <p className="mt-6 t-small opacity-70">다시 열어 보는 중이에요…</p>;
  return null;
}
