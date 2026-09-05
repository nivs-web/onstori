import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";

export const maxDuration = 30;

/**
 * 로고 저장 — 온보딩 3단계·에디터 (기획1 /mainplan #onboarding).
 * multipart: slug · anonId · file(PNG/JPG/SVG ≤2MB) 또는 svg(문자열, 자동 로고 4안 중 선택).
 * 정사각 512 기준으로 정규화(래스터는 WebP 512, SVG는 그대로) → storage `uploads/{slug}/logo-*.webp|svg` → sites.settings.logo
 * 섹션 스키마(lib/schema.ts)는 건드리지 않는다 — 로고는 settings 에만 산다.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad-form" }, { status: 400 });
  const slug = String(form.get("slug") ?? "");
  const anonId = form.get("anonId") ? String(form.get("anonId")) : undefined;
  const file = form.get("file");
  const svg = form.get("svg") ? String(form.get("svg")) : "";

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  try {
    let key: string;
    if (svg) {
      if (svg.length > 200_000 || !/^\s*<svg[\s>]/i.test(svg) || /<script|on\w+=/i.test(svg)) {
        return NextResponse.json({ error: "svg-invalid" }, { status: 400 });
      }
      ({ key } = await storage.put("media", `uploads/${slug}/logo-${randomUUID()}.svg`, Buffer.from(svg, "utf-8"), "image/svg+xml"));
    } else if (file instanceof File) {
      if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "2MB 이하만 가능해요" }, { status: 413 });
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.type === "image/svg+xml") {
        const text = buf.toString("utf-8");
        if (/<script|on\w+=/i.test(text)) return NextResponse.json({ error: "svg-invalid" }, { status: 400 });
        ({ key } = await storage.put("media", `uploads/${slug}/logo-${randomUUID()}.svg`, buf, "image/svg+xml"));
      } else {
        const webp = await sharp(buf).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
        ({ key } = await storage.put("media", `uploads/${slug}/logo-${randomUUID()}.webp`, webp, "image/webp"));
      }
    } else {
      return NextResponse.json({ error: "file or svg required" }, { status: 400 });
    }
    const url = storage.publicUrl(key);
    const settings = { ...(r.site.settings as Record<string, unknown>), logo: url };
    await sbAdmin().from("sites").update({ settings }).eq("id", r.site.id);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: "로고 저장에 실패했어요", detail: String(e).slice(0, 120) }, { status: 500 });
  }
}
