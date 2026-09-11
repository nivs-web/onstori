import { NextResponse } from "next/server";
import { agreeDisclaimer, getConnection } from "@/lib/sns/db";
import { guard } from "../guard";

export const dynamic = "force-dynamic";

/**
 * 면책 동의 — 「내 계정에 온스토리가 올리는 것에 동의한다」를 누른 시각을 적는다. (2026-09-11)
 *
 * ★ 왜 필요한가: 우리가 사장님 계정으로 글을 올린다. 사장님이 **그 사실을 알고 동의했다**는
 *   기록이 없으면 분쟁에서 다툴 자리가 생기고, 플랫폼 심사에서도 요구한다.
 * ⚠ 동의 시각이 비어 있으면 올리기를 **시작하지 않는다**(sns_connections.disclaimer_agreed_at).
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { siteId, provider } = g.v;

  const c = await getConnection(siteId, provider);
  if (!c) return NextResponse.json({ error: "먼저 연결해 주세요." }, { status: 409 });

  await agreeDisclaimer(siteId, provider);
  console.log(JSON.stringify({ evt: "sns_disclaimer_agreed", provider }));
  return NextResponse.json({ connection: await getConnection(siteId, provider) });
}
