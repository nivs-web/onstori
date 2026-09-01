"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase/browser";

/** 로그아웃 — 세션 쿠키는 @supabase/ssr가 httpOnly 없이 심으므로 브라우저 클라이언트로 지울 수 있다(별도 API 불필요) */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await sbBrowser().auth.signOut();
    router.replace("/");
    router.refresh(); // 서버 컴포넌트(헤더)가 비로그인 상태로 다시 그려지도록
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="rounded-full border px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
    >
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
