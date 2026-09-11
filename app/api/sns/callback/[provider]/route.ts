import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { PROVIDERS, getAdapter, type SnsProvider } from "@/lib/sns";

export const dynamic = "force-dynamic";

/**
 * OAuth 가 돌아오는 자리. (2026-09-11)
 *
 * ★★ **여기서 소유권을 다시 확인한다.** `state` 에 실어 보낸 slug 만 믿으면,
 *   남이 그 주소를 흉내 내서 **자기 SNS 계정을 남의 홈페이지에 붙일 수 있다.**
 *   세션으로 「이 사람이 이 홈페이지 주인인가」를 반드시 다시 묻는다.
 *
 * ⚠ 익명 소유(로그인 안 한) 사이트는 여기서 막힌다 — anonId 는 브라우저 안에만 있어
 *   서버가 알 수 없기 때문이다. 그래서 연결 화면이 **미리** 「로그인이 필요해요」를 띄운다.
 *
 * ⚠ 결과를 JSON 으로 주지 않는다. 사장님은 브라우저로 돌아오는 중이라 **화면**이 필요하다.
 *   편집화면 영상 메뉴로 되돌리고 `?sns=` 로 결과를 알린다.
 */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = raw as SnsProvider;
  const url = new URL(req.url);
  const slug = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const oauthErr = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const back = (q: string) => NextResponse.redirect(new URL(`/${slug}/edit?tab=video&${q}`, url.origin));

  if (!PROVIDERS.includes(provider)) return back("sns=bad");
  if (!slug) return back("sns=bad");

  /* 사장님이 그쪽 화면에서 «취소»를 눌렀거나 그쪽이 거절한 경우 */
  if (oauthErr) {
    console.warn(JSON.stringify({ evt: "sns_oauth_denied", provider, err: oauthErr.slice(0, 160) }));
    return back(`sns=denied&p=${provider}`);
  }
  if (!code) return back(`sns=bad&p=${provider}`);

  /* ★ 소유권 재확인 — state 를 믿지 않는다 */
  const r = await loadOwnedSite(slug);
  if ("error" in r) {
    console.warn(JSON.stringify({ evt: "sns_callback_forbidden", provider, slug, why: r.error }));
    return back(`sns=login&p=${provider}`);
  }

  const out = await getAdapter(provider).connect({
    siteId: r.site.id as string,
    redirectUri: `${url.origin}/api/sns/callback/${provider}`,
    code,
  });

  if (out.stage === "connected") {
    console.log(JSON.stringify({ evt: "sns_connected", provider, slug }));
    return back(`sns=ok&p=${provider}`);
  }
  if (out.stage === "failed") {
    console.error(JSON.stringify({ evt: "sns_connect_failed", provider, slug, kind: out.kind, detail: out.detail.slice(0, 160) }));
    /* ⚠ 이유를 주소에 그대로 싣지 않는다(길고, 원문이 새어 나간다). 종류만 싣고
       자세한 말은 화면이 연결 현황을 다시 읽어 보여 준다. */
    return back(`sns=fail&p=${provider}&k=${out.kind}`);
  }
  return back(`sns=bad&p=${provider}`);
}
