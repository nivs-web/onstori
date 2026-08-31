import { getSiteBySlug } from "@/lib/sites";

/** 사이트별 sitemap — {slug}.onstori.com/sitemap.xml (next.config rewrites) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const base = `https://${slug}.onstori.com`;
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${lastmod}</lastmod></url>
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
