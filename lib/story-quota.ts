import { sbAdmin } from "@/lib/db-admin";
import { VIDEOS_PER_DAY } from "@/config/limits";

/**
 * 🔴🔴 **하루에 영상 몇 편까지 올릴 수 있나 — 세는 곳은 여기 하나다.** (2026-09-18 대표님 지시 B-5)
 *
 * > 대표님: 「하루 영상 제한 5개라고 **여러 번** 말했는데 **못 올리게 막아**」
 *
 * ## ⚠⚠ 「하루」가 «두 가지»다 — 헷갈리면 버그로 오해한다
 * | 어디 | 하루의 기준 | 왜 |
 * |---|---|---|
 * | **여기(우리 녹화)** | 🔴 **한국 시간 자정** | **사장님이 한국에 사신다.** 「오늘 다 쓰셨어요 →
 * |  |  | 내일 다시」가 말이 되려면 «한국 날짜»여야 한다 (권반장이 정함) |
 * | `lib/sns/limits.ts` | **UTC 자정**(한국 오전 9시) | 인스타·틱톡이 그렇게 센다. **우리가 못 바꾼다** |
 *
 * ⇒ **둘이 다른 것이 «맞다».** 오전 9시 전에는 「우리 한도는 남았는데 인스타 한도는 찼다」가
 *   있을 수 있다. 그건 고장이 아니다.
 */

/** 지금 이 순간이 속한 **한국 날짜의 자정**을 «UTC 시각»으로 돌려준다 */
export function kstDayStart(now: Date = new Date()): Date {
  const KST = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST);
  /* UTC 달력으로 읽으면 그 값이 곧 «한국 달력»이다(9시간을 더해 뒀으므로) */
  const kstMidnight = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  return new Date(kstMidnight - KST);
}

/**
 * 오늘(한국 시간) 이 홈페이지에 **찍어 올린 영상 수**.
 *
 * ⚠ **글로 쓴 이야기는 세지 않는다** — `video_key` 가 있는 줄만 센다.
 *   사장님이 소개글을 다섯 번 고치셨다고 녹화가 막히면 그것이야말로 고장이다.
 * ⚠ **옛 DB(마이그레이션 전)에는 `video_key` 칸이 없다.** 그때는 **막지 않는다**(-1 을 돌려준다) —
 *   셀 수 없는 것을 근거로 사장님을 멈춰 세우지 않는다.
 * ⚠ `head:true` 로 **줄을 안 가져오고 수만** 센다. 하루 몇 줄이라 비용은 없다시피 하다.
 */
export async function videosToday(siteId: string, now: Date = new Date()): Promise<number> {
  try {
    const { count, error } = await sbAdmin()
      .from("story_entries")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .not("video_key", "is", null)
      .gte("created_at", kstDayStart(now).toISOString());
    if (error) {
      console.warn(JSON.stringify({ evt: "quota_count_failed", err: error.message.slice(0, 160) }));
      return -1;   /* 못 셌다 = 막지 않는다 */
    }
    return count ?? 0;
  } catch (e) {
    console.warn(JSON.stringify({ evt: "quota_count_threw", err: String(e).slice(0, 160) }));
    return -1;
  }
}

/** 한도를 넘었나. ⚠ **못 센 경우(-1)는 «넘지 않았다»**로 본다 */
export function overDailyLimit(used: number): boolean {
  return used >= 0 && used >= VIDEOS_PER_DAY;
}
