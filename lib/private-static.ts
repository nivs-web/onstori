import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAdmin } from "@/lib/admin-auth";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

/**
 * 운영자 전용 정적 폴더 서빙 — content/<folder>/ 의 파일을 ADMIN_KEY 쿠키 확인 뒤 내준다.
 * public/ 에 두면 누구나 볼 수 있으므로 내부 대시보드(전략기획실·사업 설계서)는 이 경로로만 나간다.
 */
export async function servePrivateStatic(req: Request, folder: string, segs: string[] = []) {
  const url = new URL(req.url);
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL(`/admin?next=${encodeURIComponent(url.pathname)}`, url.origin), 302);
  }
  const root = path.join(process.cwd(), "content", folder);
  const rel = segs.length ? segs.join("/") : "index.html";
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return new NextResponse("Not found", { status: 404 });
  const ext = path.extname(abs).toLowerCase();
  if (!TYPES[ext]) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(buf, {
      headers: { "Content-Type": TYPES[ext], "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
