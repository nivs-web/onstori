import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { adminPwState, setAdminPw } from "@/lib/admin-pw";

/**
 * 어드민 아이디·비밀번호 **만들기 / 바꾸기**. (2026-09-17 지시 [34])
 *
 * ★ 대표님: 「**첫 로그인할 때 즉시 내가 스스로 바꿀게.**」 — 그 「스스로」가 이 자리다.
 *
 * 🔴 **이미 들어와 계신 분만** 바꿀 수 있다(`isAdmin`). 그래서 바깥에서 남의 비밀번호를 못 바꾼다.
 * 🔴 **비밀번호를 응답에도 기록에도 한 글자도 안 쓴다.** 「됐다/안 됐다」와 «아이디»만 말한다.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await adminPwState());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, password } = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  const r = await setAdminPw(String(id ?? ""), String(password ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ...(await adminPwState()), saved: true });
}
