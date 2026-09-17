import { NextResponse } from "next/server";

/**
 * 🔴 **운영자 나가기.** (2026-09-17 지시 [34] 의 남은 것 · 권반장 「P7 로 미루지 마십시오」)
 *
 * ★ 왜 급한가: 운영자 쿠키는 **`ADMIN_SESSION_DAYS` 일**이나 산다(`lib/admin-auth.ts`). 대표님은 **여러 PC 를 쓰시고 원격으로도** 접속하신다.
 *   나가는 버튼이 없으면 **그 PC 에 그동안 계속 로그인된 채로** 남는다 —
 *   거기에는 회원 명부·결제 내역·문자 발송이 다 있다.
 *
 * ⚠ **쿠키만 지운다.** 서버에 세션 같은 것이 없어 이걸로 끝이다.
 * ⚠ 심는 쪽(`api/admin/login`)과 **같은 이름·같은 경로**여야 지워진다. 한쪽만 고치지 마라.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("onstori_admin", "", {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0,
  });
  console.log(JSON.stringify({ evt: "admin_logout" }));
  return res;
}
