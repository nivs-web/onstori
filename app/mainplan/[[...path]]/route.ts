import { servePrivateStatic } from "@/lib/private-static";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** 기획1 — 온스토리 이야기 엔진 기획실. content/mainplan/ 을 운영자 로그인 뒤에만 서빙 (기획2·3과 같은 방식) */
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path: segs = [] } = await ctx.params;
  return servePrivateStatic(req, "mainplan", segs);
}
