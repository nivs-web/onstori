import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isPostAlive } from "@/lib/sns/instagram";
import * as db from "@/lib/sns/db";

/**
 * 🔴🔴 **「그 영상 아직 SNS 에 살아 있나」를 «사장님이 볼 때» 그 자리에서 확인한다.** (2026-09-17 지시 [48]①)
 *
 * ## 무엇이 문제였나
 *
 * > 대표님: 「나머지에는 영상을 다 지웠어. **그러면 링크가 사라져?** … **버그가 있으면 안 됨**」
 *
 * 크론은 매일 돌지만 `RECHECK_AFTER_DAYS` 만큼 지나야 **다시** 물어본다.
 * ⇒ 사장님이 오늘 지워도 화면은 **한참 동안 「올라갔어요 [보기]」**라고 말한다.
 *
 * ## 왜 «따로» 부르나 — 목록을 느리게 만들지 않으려고
 *
 * ⚠ 영상 목록(`/api/site/videos`) 안에서 물어보면 **인스타에 다녀오는 시간만큼 목록이 늦게 뜬다**
 *   (한 건에 수백 ms · 열 건이면 몇 초). 사장님은 **빈 화면을 몇 초 보게 된다.**
 * ⇒ 목록은 **바로** 주고, 화면이 뜬 «뒤에» 이 창구를 부른다.
 *   안 보이는 것이 있으면 그때 **사장님께 한 줄로 알린다**(아래 주석 — 감추지는 않는다).
 *
 * ## 🔴🔴 **이 창구는 «손님 화면의 링크를 감추지» 않는다. 알려만 준다.**
 *
 * 권반장님이 **「몇 번 연속 실패해야 지운 것으로 볼지 정하고 이유를 쓰라」**고 하셨다. **이유는 이것이다:**
 *
 * ⚠⚠ **2026-09-17 실측 — 이 판정이 «믿을 만한지 확인이 안 됐다».**
 *   시험 삼아 한 번 돌렸더니 **살아 있는 글 2건을 2건 다 「없다」**고 답했다(`checked:2, gone:2`).
 *   그래서 **그 주소를 직접 열어 봤더니** —
 *   ```
 *   HTTP 200 · 627KB · <title>Instagram</title> · og:title 없음 · 「없는 페이지」 문구도 없음
 *   ```
 *   🔴 **인스타는 비로그인에게 «있는 글이든 없는 글이든» 똑같은 껍데기를 준다.**
 *   ⇒ **밖에서는 «진짜 지워졌는지» 가릴 수가 없다.** 우리가 아는 것은
 *     **「우리 토큰으로는 안 보인다」**까지다 — 그건 **지워진 것일 수도, 비공개·권한 문제일 수도** 있다.
 *
 * ⇒ **그래서 이 창구는 `remote_deleted_at` 을 «안 쓴다».**
 *   한 번의 답으로 **멀쩡한 「인스타에서 보기」를 손님 화면에서 감추는 일**이 없어야 한다.
 *   **사장님에게 「확인해 보세요」라고 알리는 것**까지만 한다 — 그것이 대표님이 걱정하신
 *   「**버그가 있으면 안 됨**」에 답하는 가장 안전한 선이다.
 *
 * ⚠ **감추는 일은 여전히 크론이 한다**(`lib/sns/maintenance.ts`). 지금까지 하던 그대로다 —
 *   이 창구가 **위험을 «더 빠르게» 만들지 않는다.**
 * 🔴 **두 번 연속 「없다」일 때만 감추게 하려면 «칸이 하나 더» 필요하다**(첫 번째를 기억할 자리).
 *   DB 를 바꾸는 일이라 **대표님 확인 없이는 못 한다** — 권반장님께 올렸다.
 *
 * ## 호출을 함부로 쓰지 않는다
 *
 * · 한 번에 **최대 `PER_CALL` 건** · 최근 **`FRESH_MIN` 분 안에 확인한 건은 건너뛴다**
 * · 그 위에 **횟수 제한**까지 — 사장님이 새로고침을 연타해도 인스타 한도를 축내지 않는다
 *
 * ⚠ **인스타만 확인한다.** 유튜브·틱톡은 「없는 영상에 오류를 주는지 빈 답을 주는지」를
 *   **아무도 확인하지 못했다**(권반장 지시서). 모르는 채로 「지워졌다」고 적으면 그게 더 나쁘다.
 */
export const dynamic = "force-dynamic";

/** 한 번 부를 때 물어보는 최대 건수 — 화면이 기다리는 시간과 호출 수를 함께 묶는다 */
const PER_CALL = 8;
/** 이 시간 안에 이미 확인한 것은 다시 안 묻는다 */
const FRESH_MIN = 10;

export async function POST(req: Request) {
  const { slug, anonId } = (await req.json().catch(() => ({}))) as { slug?: string; anonId?: string };
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  }

  /* ⚠ 새로고침 연타로 인스타 한도를 축내지 않게 — 사이트마다 센다 */
  const rl = await checkRateLimit(`sns-recheck:${r.site.id}`, clientIp(req), [
    { window: 600, max: 6, label: "10m" },
    { window: 86400, max: 120, label: "24h" },
  ]);
  if (!rl.ok) return NextResponse.json({ ok: true, checked: 0, suspect: 0, skipped: "limit" });

  const sb = sbAdmin();
  const fresh = new Date(Date.now() - FRESH_MIN * 60_000).toISOString();

  /* ⚠ `remote_deleted_at` 칸이 없는 옛 DB 에서는 조용히 넘어간다 —
     이 기능 때문에 편집화면이 멈추면 안 된다(크론도 같은 방식이다). */
  const { data, error } = await sb.from("sns_posts")
    .select("id, site_id, provider, remote_post_id, remote_checked_at")
    .eq("site_id", r.site.id)
    .eq("status", "published")
    .eq("provider", "instagram")
    .is("remote_deleted_at", null)
    .not("remote_post_id", "is", null)
    .or(`remote_checked_at.is.null,remote_checked_at.lte.${fresh}`)
    .limit(PER_CALL);
  if (error) {
    console.warn(JSON.stringify({ evt: "sns_recheck_skipped", slug, err: error.message.slice(0, 160) }));
    return NextResponse.json({ ok: true, checked: 0, suspect: 0, skipped: "no-column" });
  }

  const rows = data ?? [];
  if (!rows.length) return NextResponse.json({ ok: true, checked: 0, suspect: 0 });

  const tk = await db.readTokens(r.site.id, "instagram");
  const token = tk?.accessToken ?? null;
  /* 토큰이 없으면 물어볼 수가 없다 — **아무것도 안 적는다**(모르는 것은 모르는 것이다) */
  if (!token) return NextResponse.json({ ok: true, checked: 0, suspect: 0, skipped: "no-token" });

  let checked = 0, suspect = 0;
  for (const p of rows) {
    const verdict = await isPostAlive(String(p.remote_post_id), token);
    const stamp = new Date().toISOString();
    checked++;
    if (verdict === "gone") {
      /* 🔴 **감추지 않는다**(위 주석). 세어서 알려 주기만 한다 */
      suspect++;
      console.warn(JSON.stringify({ evt: "sns_post_suspect", where: "recheck", provider: "instagram", postId: p.id }));
    } else if (verdict === "alive") {
      await sb.from("sns_posts").update({ remote_checked_at: stamp }).eq("id", p.id as string);
    }
    /* unknown — 아무것도 안 적는다. 다음에 다시 묻는다 */
  }

  /** `suspect` = **「우리 토큰으로는 안 보인다」**는 뜻이지 **「지워졌다」가 아니다**(위 주석) */
  return NextResponse.json({ ok: true, checked, suspect });
}
