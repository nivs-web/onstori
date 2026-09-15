import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { writeConfig, type AdminConfig } from "@/lib/admin-config";

/**
 * 운영자 설정 저장 — `lib/admin-config.ts` 한 덩이를 부분 갱신한다.
 *
 * ⚠ **화면 값을 그대로 믿지 않는다.** 어떤 칸이 와도 `writeConfig` 안의 `merge` 가
 *   모양을 다시 맞춘다(불변 규칙 4의 정신).
 * ⚠ 문구가 바뀌면 첫 페이지 캐시를 푼다 — 안 풀면 최대 1분간 옛 글자가 나간다.
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

  try { revalidatePath("/"); } catch { /* 캐시 실패가 저장을 무르게 하지 않는다 */ }
  console.log(JSON.stringify({ evt: "admin_config_saved", keys: Object.keys(body) }));
  return NextResponse.json({ ok: true });
}
