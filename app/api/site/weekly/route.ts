import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { readWeekly, WEEKLY_DEFAULT } from "@/lib/weekly";

export const dynamic = "force-dynamic";

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  on: z.boolean(),
  channel: z.enum(["kakao", "sms"]),
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

  const { error } = await sbAdmin().from("sites")
    .update({ settings: { ...settings, weekly: next } })
    .eq("id", r.site.id);
  if (error) {
    console.error(JSON.stringify({ evt: "weekly_save_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  console.log(JSON.stringify({ evt: "weekly_saved", on: v.on, channel: v.channel, weekday: v.weekday, hour: v.hour }));
  return NextResponse.json({ weekly: next });
}
