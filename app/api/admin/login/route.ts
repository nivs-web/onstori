import { NextResponse } from "next/server";
import { verifyAdminPw } from "@/lib/admin-pw";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ADMIN_SESSION_DAYS } from "@/config/admin-session";

/**
 * 운영자 입장 — **두 개의 문**이 있다. (2026-09-17 지시 [34])
 *
 * ★ 대표님: 「**키 입력이 불편해.** 아이디랑 비밀번호로 들어가게 해 줘.」
 *
 * | 문 | 무엇으로 | 왜 남겨 두나 |
 * |---|---|---|
 * | ① **아이디 + 비밀번호** | 대표님이 화면에서 직접 정하신 값 | 새 길. 편하다 |
 * | ② **열쇠(ADMIN_KEY)** | Vercel 환경변수 | 🔴 **비상구.** 지우지 마라 |
 *
 * 🔴🔴 **②를 «절대» 먼저 지우지 마라**(권반장 지시 · 대표님 확인).
 *   아이디·비밀번호를 잊으시거나 저장소가 잠깐 안 읽히면 **대표님이 어드민에서 잠긴다.**
 *   비상구가 없으면 **아무도 못 여는 문**이 된다. 정리는 새 길이 «확실히» 돈 뒤에 한다.
 *
 * ⚠ 둘 다 **같은 쿠키**를 심는다 — `isAdmin()`(`lib/admin-auth.ts`)은 한 글자도 안 바뀐다.
 *   문을 하나 더 낸 것이지 자물쇠를 바꾼 것이 아니다.
 * ⚠ 비밀번호 쪽은 **무차별 대입을 막는다.** 열쇠 쪽은 원래 그런 장치가 없었는데,
 *   이제 **둘 다** 막는다 — 문이 둘이면 약한 쪽으로 들어온다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key0 = process.env.ADMIN_KEY;
  if (!key0) return NextResponse.json({ ok: false, error: "운영자 열쇠가 이 환경에 없습니다" }, { status: 500 });

  const rl = await checkRateLimit("admin-login", clientIp(req), [
    { window: 600, max: 10, label: "10m" },
    { window: 86400, max: 60, label: "24h" },
  ]);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { key?: string; id?: string; password?: string };

  let ok = false;
  let how = "";
  if (typeof body.id === "string" && typeof body.password === "string" && body.id && body.password) {
    ok = await verifyAdminPw(body.id, body.password);
    how = "pw";
  } else if (typeof body.key === "string" && body.key === key0) {
    ok = true;
    how = "key";
  }

  if (!ok) {
    /* ⚠ 어느 쪽이 틀렸는지 알려 주지 않는다. 비밀번호는 로그에도 안 남긴다 */
    console.warn(JSON.stringify({ evt: "admin_login_bad", how: how || "none" }));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  console.log(JSON.stringify({ evt: "admin_login_ok", how }));
  const res = NextResponse.json({ ok: true });
  /* ⚠ 어느 문으로 들어왔든 **같은 쿠키**다 — 안쪽 코드는 아무것도 안 바뀐다 */
  res.cookies.set("onstori_admin", key0, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * ADMIN_SESSION_DAYS,
  });
  return res;
}
