import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { revalidatePath } from "next/cache";
import { isPhonePublic } from "@/lib/phone-privacy";
import { readWeekly, WEEKLY_DEFAULT } from "@/lib/weekly";

export const dynamic = "force-dynamic";

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  on: z.boolean(),
  channel: z.enum(["email", "kakao", "sms"]),
  /** 번호를 홈페이지에 공개할까 — 안 보내면 **건드리지 않는다**(지금 값을 지킨다) */
  phonePublic: z.boolean().optional(),
  phone: z.string().max(20).optional(),
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
});

/**
 * 주 1회 알림 설정 읽기·저장. (2026-09-12)
 * ★ 표를 새로 만들지 않는다 — `sites.settings.weekly` 에 넣는다(jsonb).
 * ⚠ `lastSentAt` 은 **크론만 쓴다.** 화면이 저장할 때 그 값을 덮어쓰면
 *   설정을 만질 때마다 「이번 주 안 보냄」으로 되돌아가 두 번 갈 수 있다.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const peek = body as { slug?: string; anonId?: string; read?: boolean };

  const r = await loadOwnedSite(String(peek.slug ?? ""), peek.anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json({ error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" }, { status: forbidden ? 403 : 404 });
  }
  const settings = (r.site.settings as Record<string, unknown>) ?? {};
  const current = readWeekly(settings);

  /* 읽기만 — 아직 설정 안 한 사장님에게는 «기본값 제안»을 준다(저장은 안 한다) */
  if (peek.read) {
    return NextResponse.json({
      weekly: current ?? { ...WEEKLY_DEFAULT },
      configured: !!current,
      sitePhone: (settings.phone as string) ?? "",
      /* ★ 기본은 **비공개**다 — 값이 없으면 false (2026-09-13 대표님 결정 · lib/phone-privacy.ts) */
      phonePublic: isPhonePublic(settings),
    });
  }

  const parsed = Input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 설정이에요" }, { status: 400 });
  const v = parsed.data;

  const next = {
    on: v.on, channel: v.channel,
    phone: v.phone?.trim() || undefined,
    weekday: v.weekday, hour: v.hour,
    /* ⚠ 크론이 찍어 둔 값을 그대로 들고 간다 — 여기서 지우면 같은 주에 또 간다 */
    lastSentAt: current?.lastSentAt,
  };

  /**
   * ★★ **번호 공개 여부도 여기서 저장한다.** (2026-09-13 대표님 결정 3)
   * ⚠ 값을 «안 보냈을 때»와 «false 로 보냈을 때»는 다르다. 안 보냈으면 지금 값을 지킨다 —
   *   다른 설정을 만졌다가 번호가 조용히 공개로 바뀌면 안 된다.
   * ⚠ 화면에서 켜자마자 손님 화면에 반영되려면 캐시를 풀어야 한다(아래 revalidatePath).
   */
  const nextSettings: Record<string, unknown> = { ...settings, weekly: next };
  if (typeof v.phonePublic === "boolean") nextSettings.phonePublic = v.phonePublic;

  const { error } = await sbAdmin().from("sites")
    .update({ settings: nextSettings })
    .eq("id", r.site.id);
  if (error) {
    console.error(JSON.stringify({ evt: "weekly_save_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  /* ★ 손님 사이트는 ISR 로 캐시된다(app/[slug]/page.tsx revalidate=60).
       번호 공개를 껐는데 1분 동안 계속 보이면 「안 꺼지네」가 된다 — 곧바로 푼다. */
  if (typeof v.phonePublic === "boolean") {
    try { revalidatePath(`/${v.slug}`); } catch { /* 캐시 해제 실패가 저장을 무르게 하지 않는다 */ }
  }

  console.log(JSON.stringify({ evt: "weekly_saved", on: v.on, channel: v.channel, weekday: v.weekday, hour: v.hour, phonePublic: v.phonePublic }));
  return NextResponse.json({ weekly: next, phonePublic: nextSettings.phonePublic === true });
}
