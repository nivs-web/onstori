import { NextResponse } from "next/server";

// 진단용 최소 미들웨어 — 이것도 Vercel에서 실패하면 환경 문제로 확정
export function middleware() {
  return NextResponse.next();
}
