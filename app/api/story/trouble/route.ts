import { NextResponse } from "next/server";
import { verifyStoryLink } from "@/lib/story-link";

export const dynamic = "force-dynamic";

/**
 * 녹화 화면이 「막혔다」고 알리는 자리 (2026-09-11).
 *
 * ★ 두 가지를 **한 번에** 한다.
 *   ① 이 응답이 돌아왔다는 것은 **폰 인터넷이 살아 있다**는 뜻이다.
 *      브라우저는 업로드가 왜 실패했는지 알려 주지 않는다 — 진짜 끊김도, 저장소가
 *      거절한 것도 똑같은 `onerror` 하나로 온다. 그 둘을 가르는 유일한 방법이 이것이다.
 *   ② 무슨 일이 있었는지 **서버 기록에 남긴다.** 다음 실패는 조용하지 않다.
 *
 * ⚠ DB 를 건드리지 않는다. 링크 서명(HMAC)만 확인하고 끝낸다 — 실패한 사람이 누르는
 *   자리라 여기서 또 느려지면 안 된다.
 */
export async function POST(req: Request) {
  const { slug, k, stage, detail } = await req.json().catch(() => ({}));
  const s = typeof slug === "string" ? slug : "";
  if (!verifyStoryLink(s, typeof k === "string" ? k : null)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  console.error(JSON.stringify({
    evt: "rec_trouble",
    slug: s,
    stage: String(stage ?? "").slice(0, 40),
    detail: String(detail ?? "").slice(0, 200),
    ua: (req.headers.get("user-agent") ?? "").slice(0, 160),
  }));
  return NextResponse.json({ ok: true });
}
