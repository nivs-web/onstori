import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { PROVIDERS } from "@/lib/sns/types";
import { readSnsDefaults, TEXT_MAX, TAGS_MAX } from "@/lib/sns-defaults";

export const dynamic = "force-dynamic";

/**
 * 「한 방 등록」 기본 설정 읽기·저장. (2026-09-16 대표님 지시)
 *
 * ★ 표를 새로 만들지 않는다 — `sites.settings.snsDefaults` 에 넣는다(jsonb).
 *   `app/api/site/weekly` 와 **같은 모양**이다. 설정 저장 방식을 두 가지로 만들지 않는다.
 * ⚠ `settings` 는 **통째로 덮어쓰지 않는다.** 다른 칸(weekly·channels·logo…)이 함께 날아간다.
 *   읽어서 이 칸만 갈아 끼운다.
 */

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  /** 읽기만 할 때 */
  read: z.boolean().optional(),
  text: z.string().max(TEXT_MAX).optional(),
  tags: z.string().max(TAGS_MAX).optional(),
  providers: z.array(z.enum(PROVIDERS)).max(6).optional(),
  home: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "입력이 올바르지 않아요" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json(
      { error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
      { status: forbidden ? 403 : 404 },
    );
  }

  const settings = (r.site.settings as Record<string, unknown>) ?? {};
  const current = readSnsDefaults(settings);

  /* 읽기만 — 아직 정한 적이 없어도 «기본 제안»을 준다(저장은 안 한다) */
  if (body.data.read) {
    return NextResponse.json({ defaults: current, configured: !!settings.snsDefaults });
  }

  /* ★ 안 보낸 칸은 «지금 값을 지킨다». 화면이 한 칸만 고쳐 보내도 나머지가 안 날아간다. */
  const next = {
    text: body.data.text ?? current.text,
    tags: body.data.tags ?? current.tags,
    providers: body.data.providers ?? current.providers,
    home: body.data.home ?? current.home,
  };

  const { error } = await sbAdmin()
    .from("sites")
    .update({ settings: { ...settings, snsDefaults: next } })
    .eq("id", r.site.id);

  if (error) {
    console.error(JSON.stringify({ evt: "sns_defaults_save_failed", slug: body.data.slug, err: error.message.slice(0, 160) }));
    return NextResponse.json({ error: "설정을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요" }, { status: 500 });
  }

  console.log(JSON.stringify({ evt: "sns_defaults_saved", slug: body.data.slug, providers: next.providers, home: next.home, tags: next.tags.length }));
  return NextResponse.json({ ok: true, defaults: next });
}
