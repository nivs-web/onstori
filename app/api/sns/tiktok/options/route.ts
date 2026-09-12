import { NextResponse } from "next/server";
import { guard } from "../../guard";
import { creatorOptions } from "@/lib/sns/tiktok";

export const dynamic = "force-dynamic";

/**
 * 틱톡에 올리기 «전에» 사장님이 골라야 하는 것들. (2026-09-12 회장님 지시 8)
 *
 * ★★ **틱톡 심사 요건이다.** 올리기 화면을 그리기 전에 틱톡에게
 *   「이 계정이 고를 수 있는 공개범위가 무엇인가」를 반드시 물어봐야 하고,
 *   **그 목록 안에서만** 고르게 해야 한다. 우리가 값을 지어내면 심사에서 떨어진다.
 *
 * ★ 그래서 이 창구는 «화면을 열 때»가 아니라 **[틱톡에 올리기]를 누른 그 순간** 불린다.
 *   목록 화면에서 미리 다 불러 두면 영상 20개마다 틱톡 호출이 20번 나간다.
 *
 * ⚠ 토큰이 24시간이라 여기서 갱신이 함께 일어난다(`creatorOptions` → `freshToken`).
 *   즉 이 창구가 **연결이 살아 있는지 확인하는 자리**이기도 하다.
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { siteId, provider } = g.v;
  if (provider !== "tiktok") {
    return NextResponse.json({ error: "틱톡 전용 창구예요" }, { status: 400 });
  }

  const r = await creatorOptions(siteId);
  if (!r.ok) {
    /* 조용히 빈 화면을 주지 않는다 — 왜 못 여는지 그대로 말한다 */
    return NextResponse.json({ error: r.why }, { status: 409 });
  }
  return NextResponse.json({ options: r.options });
}
