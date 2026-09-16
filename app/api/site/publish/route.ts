import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { applyPublish } from "@/lib/publish-site";

/**
 * 사이트 반영 — draft→published 복사 + 이전 발행본 스냅샷(롤백용).
 * ⚠ 실제 처리(스냅샷·revalidate·스크린샷·markFunnel·recomputeScore)는 전부
 *   lib/publish-site.ts 의 applyPublish 하나뿐이다(CLAUDE.md 불변 규칙 5) —
 *   app/api/site/photos(가입 직후 사진 자동 반영, T-0031)도 같은 함수를 쓴다.
 *   이 라우트의 동작 자체는 바뀌지 않았다(순서·응답 형태 동일).
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  if (!r.site.draft) return NextResponse.json({ error: "no-draft" }, { status: 400 });

  const result = await applyPublish(r.site, r.site.draft, new URL(req.url).origin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, score: result.score });
}
