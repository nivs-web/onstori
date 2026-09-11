import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { PROVIDER_NAME, PROVIDERS, type SnsProvider } from "@/lib/sns";
import { readXBalance, readXPricing } from "@/lib/sns/x-billing";

export const dynamic = "force-dynamic";

/**
 * SNS 발행 현황 — 몇 건 올렸고 **얼마나 썼나.** (2026-09-11)
 *
 * ★★ 왜 필요한가: 회장님이 「100건도 안 썼는데 $10 이 사라졌다」를 **알아채실 수 있어야** 한다.
 *   지금은 X 에 몇 건 나갔는지 볼 곳이 아예 없다.
 *
 * ★ 세는 값은 **우리 DB(`sns_posts`)** 다. 그쪽 API 를 부르지 않는다 —
 *   부르면 그 자체가 한도를 먹고, 그쪽이 죽으면 우리 화면도 죽는다.
 *   ⚠ 그래서 이것은 «우리가 보낸 횟수»다. 그쪽 청구서와 1:1 이 아닐 수 있다(재시도·실패분).
 *     그 차이를 화면에 분명히 적는다 — 추정치를 사실처럼 보여주지 않는다.
 */

/** ★ 2026-09-11 확인 완료 — X 공식 요금표에 「Post: Create $0.015 / Post: Create (with URL) $0.200」이
 *  그대로 적혀 있다. 회장님이 주신 13배가 **문서로 확인됐다.**
 *  ⚠ 우리는 X 로 나가는 글에서 URL 을 서버가 지운다(lib/sns/no-url.ts). 그래서 $0.015 로 잡는다. */
const UNIT_USD: Partial<Record<SnsProvider, number>> = { x: 0.015 };

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const sb = sbAdmin();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows: {
    provider: SnsProvider; name: string;
    published: number; failed: number; inFlight: number;
    published30: number; estUsd: number | null;
  }[] = [];

  let tableMissing = false;

  for (const p of PROVIDERS) {
    const count = async (q: (b: ReturnType<typeof sb.from>) => unknown) => {
      try {
        const { count: c, error } = (await (q(sb.from("sns_posts")) as unknown as Promise<{ count: number | null; error: { message: string } | null }>));
        if (error) {
          if (/relation .*sns_posts.* does not exist|42P01|could not find the table/i.test(error.message)) tableMissing = true;
          return 0;
        }
        return c ?? 0;
      } catch { return 0; }
    };

    const published = await count((b) => b.select("id", { count: "exact", head: true }).eq("provider", p).eq("status", "published"));
    const failed = await count((b) => b.select("id", { count: "exact", head: true }).eq("provider", p).eq("status", "failed"));
    const inFlight = await count((b) => b.select("id", { count: "exact", head: true }).eq("provider", p).in("status", ["queued", "uploading", "processing"]));
    const published30 = await count((b) => b.select("id", { count: "exact", head: true }).eq("provider", p).eq("status", "published").gte("created_at", since30));

    const unit = UNIT_USD[p];
    rows.push({
      provider: p, name: PROVIDER_NAME[p], published, failed, inFlight, published30,
      estUsd: unit === undefined ? null : Number((published * unit).toFixed(2)),
    });
  }

  /* ★ 2026-09-11 — 잔액 조회가 **실제로 있다**(GET /2/usage/credits, 공식 문서·OpenAPI 확인).
     못 읽어도 «왜 못 읽었는지»를 같이 준다 — 조용히 0 으로 보여주지 않는다. */
  const [balance, pricing] = await Promise.all([readXBalance(), readXPricing()]);

  return NextResponse.json({ rows, tableMissing, balance, pricing, unitUsd: UNIT_USD });
}
