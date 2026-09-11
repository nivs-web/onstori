import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { PROVIDERS, type SnsProvider } from "@/lib/sns";

/**
 * SNS 라우트 공통 문지기. (2026-09-11)
 *
 * ★ 다섯 라우트가 같은 검사를 한다 — 한 곳에 모아 둔다. 복사하면 한쪽만 고쳐진다.
 * ⚠ 실패는 **이유를 갈라서** 돌려준다. 「안 됐어요」 하나로 뭉뚱그리지 않는다.
 */
export type Guarded = { siteId: string; slug: string; provider: SnsProvider };

export async function guard(req: Request, needProvider = true): Promise<
  { ok: true; v: Guarded } | { ok: false; res: NextResponse }
> {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; anonId?: string; provider?: string };
  const slug = String(body.slug ?? "");
  const provider = String(body.provider ?? "") as SnsProvider;

  if (needProvider && !PROVIDERS.includes(provider)) {
    return { ok: false, res: NextResponse.json({ error: "어느 SNS 인지 알 수 없어요." }, { status: 400 }) };
  }

  const r = await loadOwnedSite(slug, body.anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return {
      ok: false,
      res: NextResponse.json(
        { error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
        { status: forbidden ? 403 : 404 },
      ),
    };
  }
  return { ok: true, v: { siteId: r.site.id as string, slug: r.site.slug as string, provider } };
}

/** 콜백이 돌아올 주소 — ★ 메타·구글에 등록한 값과 **글자까지 같아야** 한다 */
export const redirectUriFor = (req: Request, provider: SnsProvider) =>
  `${new URL(req.url).origin}/api/sns/callback/${provider}`;
