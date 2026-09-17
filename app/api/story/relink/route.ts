import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { signStoryLink } from "@/lib/story-link";

/**
 * 「녹화 링크를 **새로 받기**」 — 홈 화면 바로가기가 죽지 않게 하는 자리다. (2026-09-17 지시 [20])
 *
 * ★★ **왜 필요한가 — 이걸 안 만들면 대표님 아이디어가 «2주 만에» 죽는다.**
 *   `/rec/{slug}?k=…` 의 `k` 는 **주 단위 서명**이다(`lib/story-link.ts`) — **이번 주와 지난 주에만**
 *   유효하다. 그래서 홈 화면 바로가기에 `?k=` 를 그대로 박아 두면, 사장님이 **2주 뒤에 눌렀을 때**
 *   「이 링크는 만료됐어요」만 보게 된다. **매일 눈에 띄게 하려고 만든 아이콘이 매일 실망을 준다.**
 *
 * ⇒ 그래서 바로가기는 **`k` 없이** `/rec/{slug}` 로 간다. 그 자리에서 **주인임이 확인되면**
 *   서버가 **그 주의 새 `k` 를 즉석에서 찍어 준다.** 아이콘은 영원히 살아 있다.
 *
 * 🔴 **문을 넓히지 않았다.** 주인 판정은 **이미 쓰던 `loadOwnedSite` 그대로**다 —
 *   ①로그인 세션이 `owner_id` 와 같거나 ②브라우저 익명표가 `anon_id` 와 같거나 ③운영자.
 *   **새 판정 규칙을 하나도 만들지 않았다.** 링크 서명이 하던 일을 «주인 확인»이 대신할 뿐이다.
 *   ⚠ 주인이 아니면 403 이다 — 남의 가게 녹화 링크를 이걸로 캐낼 수 없다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { slug, anonId } = (await req.json().catch(() => ({}))) as { slug?: string; anonId?: string };
  const r = await loadOwnedSite(String(slug ?? ""), anonId ?? null);
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  }
  return NextResponse.json({ k: signStoryLink(r.site.slug as string) });
}
