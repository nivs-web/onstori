import { servePrivateStatic } from "@/lib/private-static";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path: segs = [] } = await ctx.params;
  return servePrivateStatic(req, "onstoriplandept", segs);
}
