import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/sns";
import { guard } from "../guard";

export const dynamic = "force-dynamic";

/**
 * 연결 끊기. (2026-09-11)
 *
 * ★★ **토큰을 실제로 지운다.** 표시만 바꾸지 않는다 — 유튜브 약관이
 *   「사용자가 연결을 끊으면 저장한 토큰을 파기하라」고 요구한다.
 *   ⚠ 불변 규칙 10(「삭제는 복구 가능한 표시 변경으로」)의 **예외**다. 그 이유를
 *     `lib/sns/db.ts` 의 `deleteConnection` 에 적어 뒀다.
 *   ⚠ 대신 **올린 기록(sns_posts)은 지우지 않는다** — 그건 사장님의 이력이다.
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { siteId, provider } = g.v;

  const out = await getAdapter(provider).disconnect(siteId);
  if (!out.ok) return NextResponse.json({ error: out.detail ?? "연결을 끊지 못했어요." }, { status: 500 });

  console.log(JSON.stringify({ evt: "sns_disconnected", provider }));
  return NextResponse.json({ ok: true });
}
