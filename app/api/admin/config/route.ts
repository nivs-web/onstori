import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { writeConfig, type AdminConfig } from "@/lib/admin-config";

/**
 * 운영자 설정 저장 — `lib/admin-config.ts` 한 덩이를 부분 갱신한다.
 *
 * ⚠ **화면 값을 그대로 믿지 않는다.** 어떤 칸이 와도 `writeConfig` 안의 `merge` 가
 *   모양을 다시 맞춘다(불변 규칙 4의 정신).
 * ⚠ 문구가 바뀌면 **그 문구를 읽는 화면 넷의** 캐시를 전부 푼다 — 안 풀면 `/faq` 같은 곳은
 *   **최대 한 시간** 옛 글자가 나간다 (2026-09-16 지시 [9]).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<AdminConfig> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "보낼 값이 없어요" }, { status: 400 });

  /* 🔴 손님이 보는 글은 길이를 막는다 — 실수로 붙여 넣은 긴 글이 화면을 무너뜨리지 않게 */
  if (typeof body.snsLine === "string" && body.snsLine.length > 300) {
    return NextResponse.json({ error: "SNS 문구가 너무 깁니다 (300자 이내)" }, { status: 413 });
  }
  if (typeof body.expiryText === "string" && body.expiryText.length > 500) {
    return NextResponse.json({ error: "문자 내용이 너무 깁니다 (500자 이내)" }, { status: 413 });
  }

  const r = await writeConfig(body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });

  /* 🔴 **2026-09-16 지시 [9] — 여기를 같이 안 고치면 「저장했는데 안 바뀐다」가 그대로 남는다.**
     전에는 `/` 하나만 풀었다. 그런데 SNS 한 줄을 읽는 손님 화면은 **넷**이고,
     `/faq` · `/how-it-works` · `/our-story` 는 **ISR 1시간**이다(빌드 출력 실측).
     안 풀면 대표님이 저장하시고 **한 시간을 기다려야** 바뀐다 — 그게 이 지시의 병 자체다.
     ⚠ 화면을 새로 만들어 `readConfig()` 를 읽게 하면 **이 목록에도 반드시 더한다.** */
  for (const path of ["/", "/faq", "/how-it-works", "/our-story"]) {
    try { revalidatePath(path); } catch { /* 캐시 실패가 저장을 무르게 하지 않는다 */ }
  }
  console.log(JSON.stringify({ evt: "admin_config_saved", keys: Object.keys(body) }));
  return NextResponse.json({ ok: true });
}
