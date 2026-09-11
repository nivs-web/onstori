import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

export const dynamic = "force-dynamic";

/**
 * 유튜브 게이트 — off / review / on. (2026-09-11)
 *
 * ★ 왜 필요한가: 회장님 지시로 유튜브는 **지금 열지 않는다.** 그런데 켤 수단이 아예 없으면
 *   심사가 끝나도 영영 못 연다. 그래서 운영자만 돌릴 수 있는 손잡이를 하나 둔다.
 *
 * ★ 표를 새로 만들지 않는다 — `app_settings` 의 key='sns:youtube' 한 줄이다.
 *   **줄이 없으면 off** 로 읽는다(lib/sns/youtube.ts 의 readGate).
 *
 * · off    — 화면에 「준비 중」. 연결도 올리기도 막힌다
 * · review — 심사용. 연결·올리기는 되지만 영상은 비공개로 올라간다
 * · on     — 정식. 영상이 공개로 올라간다
 *
 * ⚠ **확인 필요** — review 와 on 의 경계(심사 중 요구되는 공개 범위)는 김팀장 조사를
 *   못 읽어 확정하지 못했다. 지금은 「review=비공개 업로드, on=공개 업로드」로 두었다.
 */
const Input = z.object({ mode: z.enum(["off", "review", "on"]) });

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  const { data } = await sbAdmin().from("app_settings").select("value").eq("key", "sns:youtube").maybeSingle();
  const mode = (data as { value?: { mode?: string } } | null)?.value?.mode;
  return NextResponse.json({ mode: mode === "on" || mode === "review" ? mode : "off" });
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "off · review · on 중 하나여야 해요" }, { status: 400 });

  const { error } = await sbAdmin().from("app_settings").upsert({
    key: "sns:youtube", value: { mode: parsed.data.mode }, updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) {
    /* app_settings 표가 아직 없을 수 있다 — db push 전. 무엇을 해야 하는지 말한다 */
    const missing = /relation .*app_settings.* does not exist|42P01|could not find the table/i.test(error.message);
    return NextResponse.json({
      error: missing
        ? "app_settings 표가 아직 없어요. `npx supabase db push` 를 한 번 돌려야 저장됩니다."
        : "저장하지 못했어요.",
    }, { status: 500 });
  }
  console.log(JSON.stringify({ evt: "sns_youtube_gate", mode: parsed.data.mode }));
  return NextResponse.json({ mode: parsed.data.mode });
}
