import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";

/** 슬러그(주소) 실시간 검사 — 형식·예약어·중복. 검증은 서버에서 (CLAUDE.md 규칙 4) */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")?.toLowerCase().trim() ?? "";

  if (!/^[a-z0-9-]{3,30}$/.test(slug) || slug.startsWith("-") || slug.endsWith("-")) {
    return NextResponse.json({ available: false, reason: "영문 소문자·숫자·하이픈 3~30자로 지어주세요" });
  }
  const sb = sbAdmin();
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", slug).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", slug).maybeSingle(),
  ]);
  if (reserved) return NextResponse.json({ available: false, reason: "사용할 수 없는 주소예요" });
  if (taken) return NextResponse.json({ available: false, reason: "이미 사용 중인 주소예요" });
  return NextResponse.json({ available: true });
}
