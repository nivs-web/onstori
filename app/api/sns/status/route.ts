import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { ORDERED, PROVIDER_NAME, getAdapter } from "@/lib/sns";

export const dynamic = "force-dynamic";

/**
 * 연결 화면이 읽는 현황. (2026-09-11)
 *
 * ★★ **토큰을 절대 싣지 않는다.** 어댑터가 돌려주는 `Connection` 타입에 토큰 칸이
 *   아예 없어서 실수로도 실을 수 없다(lib/sns/types.ts 의 설계).
 *
 * ★ 못 쓰는 SNS 도 **왜 못 쓰는지**를 함께 준다. 화면은 그 말을 그대로 보여 주고
 *   체크가 아예 안 눌리게 한다 — 조용히 실패하지 않는다(회장님 지시).
 */
export async function POST(req: Request) {
  const { slug, anonId } = (await req.json().catch(() => ({}))) as { slug?: string; anonId?: string };
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json(
      { error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
      { status: forbidden ? 403 : 404 },
    );
  }
  const siteId = r.site.id as string;

  /* ⚠ 로그인 없이(익명 소유) 쓰는 사장님은 SNS 연결을 못 한다 —
     OAuth 가 돌아올 때 «누구의 사이트인지»를 세션으로만 확인할 수 있기 때문이다.
     그걸 화면에서 미리 알려 준다. 눌렀다가 막히는 것보다 낫다. */
  const needsLogin = !r.site.owner_id && !r.admin;

  const items = await Promise.all(
    ORDERED.map(async (p) => {
      const a = getAdapter(p);
      const [available, connection, quota] = await Promise.all([
        a.isAvailable(siteId),
        a.isConnected(siteId).catch(() => null),
        a.getQuota(siteId).catch(() => ({ remaining: 0, limit: 0, windowSec: 86400 })),
      ]);
      return {
        provider: p,
        name: PROVIDER_NAME[p],
        available,
        connection,          // ← 토큰 없음
        quota,
      };
    }),
  );

  return NextResponse.json({ items, needsLogin });
}
