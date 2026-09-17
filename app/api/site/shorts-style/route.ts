import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { revalidatePath } from "next/cache";
import { SHORTS_STYLES, SHORTS_ORDERS, STAGE_N_CHOICES, shortsStyleOf, shortsOrderOf, stageNOf } from "@/config/shorts";

/**
 * 🔴 **사장님이 「숏폼 모양」을 고르는 창구.** (2026-09-17 지시 [42] §4)
 *
 * 저장 자리는 **`sites.settings.shorts.style`** 이다. `settings` 가 자유 형식(jsonb)이라
 * **칸을 새로 만들 필요가 없다**(db push 불필요 — 클코 조사 §2).
 *
 * ⚠⚠ **`settings` 는 «통째로 다시 쓰는» 칸이다. 반드시 «있던 것 위에» 얹는다.**
 *   저장소에서 이 칸을 쓰는 곳이 열 곳이 넘고 전부 읽어서 통째로 다시 쓴다.
 *   🔴 얹지 않고 덮으면 **채널·주간알림·로고·사진 설정이 통째로 날아간다.**
 *   (2026-09-17 시험에서 9칸 → 10칸 → 9칸으로 «그대로»인 것을 확인하고 넣었다.)
 *
 * ⚠ 모르는 값은 받지 않는다 — 목록(`SHORTS_STYLES`)에 없는 것이 들어오면 거절한다.
 *   화면이 고장 나서 이상한 값을 보내도 **손님 홈페이지가 깨지면 안 된다.**
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; anonId?: string; style?: string; order?: string; stageN?: number };
  const r = await loadOwnedSite(String(body.slug ?? ""), body.anonId);
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });
  }

  /**
   * ⚠ **모양과 순서를 «한 창구»로 받는다.** 둘 다 `settings.shorts` 안에 살고
   *   저장 방식(얹어 쓰기·되살리기)이 똑같다 — 창구를 둘로 나누면 그 규칙을 두 번 적게 된다.
   * 🔴 **보낸 것만 바꾼다.** 순서만 보냈는데 모양이 기본값으로 덮이면 안 된다.
   */
  const patch: Record<string, string> = {};
  const patchN: Record<string, number> = {};
  if (body.style !== undefined) {
    if (!SHORTS_STYLES.some((s) => s.key === body.style)) {
      return NextResponse.json({ error: "모르는 모양이에요" }, { status: 400 });
    }
    patch.style = body.style;
  }
  if (body.order !== undefined) {
    if (!SHORTS_ORDERS.some((o) => o.key === body.order)) {
      return NextResponse.json({ error: "모르는 순서예요" }, { status: 400 });
    }
    patch.order = body.order;
  }
  if (body.stageN !== undefined) {
    /* 🔴 범위 밖 숫자는 **받지 않는다** — 화면이 고장 나도 무대 높이가 이상해지면 안 된다 */
    if (!STAGE_N_CHOICES.includes(Number(body.stageN))) {
      return NextResponse.json({ error: "고를 수 없는 편수예요" }, { status: 400 });
    }
    patchN.stageN = Number(body.stageN);
  }
  if (!Object.keys(patch).length && !Object.keys(patchN).length) {
    return NextResponse.json({ error: "바꿀 것이 없어요" }, { status: 400 });
  }

  const now = (r.site.settings as Record<string, unknown> | null) ?? {};
  const shorts = (now.shorts as Record<string, unknown> | undefined) ?? {};
  /* 🔴 **있던 것 위에 얹는다**(위 주석). 두 겹 다 얹어야 `shorts` 안의 다른 값도 안 날아간다 */
  const next = { ...now, shorts: { ...shorts, ...patch, ...patchN } };

  const { error } = await sbAdmin().from("sites").update({ settings: next }).eq("id", r.site.id);
  if (error) {
    console.error(JSON.stringify({ evt: "shorts_style_failed", slug: body.slug, err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "바꾸지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  /* ⚠ 손님 화면은 ISR(60초)이다. 이 한 줄이 없으면 **바꿔 놓고 1분 동안 옛 모양**이 보인다 —
     사장님은 「안 바뀌네?」 하고 또 누른다. */
  revalidatePath(`/${r.site.slug}`);

  console.log(JSON.stringify({ evt: "shorts_style_set", slug: r.site.slug, ...patch, ...patchN }));
  return NextResponse.json({ ok: true, style: shortsStyleOf(next), order: shortsOrderOf(next), stageN: stageNOf(next) });
}
