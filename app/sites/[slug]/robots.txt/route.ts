import { getSiteBySlug } from "@/lib/sites";

/** 사이트별 robots — 체험(trial) 사이트는 색인 차단, 활성 사이트만 허용 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const body =
    site.status === "active"
      ? `User-agent: *\nAllow: /\n\nSitemap: https://${slug}.onstori.com/sitemap.xml\n`
      : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
