import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";

/**
 * **사장님마다 다른 홈 화면 바로가기.** (2026-09-17 지시 [20])
 *
 * ★ 권반장 지시 2번: 「🔴 `start_url` 에 그 사장님 주소가 들어가야 합니다. 그냥 `/rec` 로 두면
 *   **아이콘을 눌렀을 때 어느 가게인지 모릅니다.** 사장님마다 다른 바로가기여야 합니다.」
 *
 * ⇒ 그래서 `app/manifest.ts`(온스토리 전체용) **하나로는 안 된다.** 주소마다 이 파일이
 *   다른 내용을 내준다. 화면은 `<link rel="manifest">` 로 **자기 주소의 것**을 가리킨다.
 *
 * 🔴 **`start_url` 에 `?k=` 를 넣지 않는다.** 그 열쇠는 **주 단위로 만료**된다 —
 *   박아 두면 2주 뒤 아이콘이 「만료됐어요」만 띄운다. 대신 `/rec/{slug}` 로 보내고,
 *   그 화면이 **주인임을 확인해 새 열쇠를 즉석에서** 만든다(`app/api/story/relink`).
 *
 * ⚠ **서비스워커는 만들지 않는다**(지시 3번). 오프라인 캐시는 지금 필요 없고,
 *   잘못 만들면 **옛 화면이 계속 나온다.**
 * ⚠ 아이콘은 이미 있는 것을 쓴다 — 새로 만들지 않았다(`public/brand/v1/icon/`).
 */
export const dynamic = "force-dynamic";

const BRAND_BASE = process.env.NEXT_PUBLIC_BRAND_URL ?? "/brand/v1";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return new NextResponse("bad slug", { status: 400 });

  /* 상호를 못 읽어도 바로가기는 만들어져야 한다 — 이름만 밋밋해질 뿐이다 */
  let name = "";
  try {
    const { data } = await sbAdmin().from("sites").select("business_name").eq("slug", slug).maybeSingle();
    name = String(data?.business_name ?? "").slice(0, 24);
  } catch { /* 넘어간다 */ }

  const body = {
    /** ⚠ `id` 가 주소마다 달라야 **가게가 둘인 사장님도 아이콘을 둘** 두실 수 있다 */
    id: `/rec/${slug}`,
    name: name ? `${name} 60초` : "온스토리 60초",
    /** 폰 홈 화면의 아이콘 밑에 들어가는 글자 — 길면 잘린다 */
    short_name: name ? name.slice(0, 12) : "60초 녹화",
    description: "생각날 때 바로 60초. 찍으면 홈페이지에 바로 걸립니다.",
    start_url: `/rec/${slug}?src=home`,
    scope: `/rec/${slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#273D3D",
    /* --green (app/globals.css) 과 같은 값. manifest 는 CSS 변수를 못 읽어 값을 적는다 */
    theme_color: "#005B2A",
    icons: [
      { src: `${BRAND_BASE}/icon/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BRAND_BASE}/icon/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BRAND_BASE}/icon/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      /* 상호를 바꾸시면 다음 날 반영된다. 아이콘 이름 하나 때문에 매번 DB 를 읽을 이유는 없다 */
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
