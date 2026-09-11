import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/sns";
import { guard, redirectUriFor } from "../guard";

export const dynamic = "force-dynamic";

/**
 * 연결 시작 — 사장님을 그 SNS 로그인으로 보낼 주소를 만들어 준다. (2026-09-11)
 *
 * ★ 여기서 창을 띄우지 않는다. 주소만 돌려주고 **화면이** 이동시킨다 —
 *   팝업 차단·인앱 브라우저 사정을 화면이 더 잘 안다.
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { siteId, slug, provider } = g.v;

  const a = getAdapter(provider);
  const av = await a.isAvailable();
  if (!av.ok) return NextResponse.json({ error: av.why }, { status: 409 });

  const out = await a.connect({ siteId, redirectUri: redirectUriFor(req, provider) });
  if (out.stage === "redirect") {
    /* ⚠ state 에 slug 를 실어 보낸다 — 돌아왔을 때 어느 홈페이지인지 알아야 한다.
       ★ 그것만으로 «주인»을 믿지는 않는다. 콜백이 세션으로 소유권을 다시 확인한다. */
    const u = new URL(out.authUrl);
    u.searchParams.set("state", slug);
    return NextResponse.json({ authUrl: u.toString() });
  }
  if (out.stage === "connected") return NextResponse.json({ connection: out.connection });
  return NextResponse.json({ error: out.detail, kind: out.kind }, { status: 409 });
}
