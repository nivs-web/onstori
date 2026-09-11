/**
 * 주 1회 촬영 알림 설정. (2026-09-12)
 *
 * ★★ 왜 제품의 심장인가: 지금은 **매주 문자를 보내는 장치가 아예 없다.**
 *   사장님이 편집화면에서 버튼을 눌러야만 링크가 나간다. 그런데 그 버튼을 누르러
 *   들어오게 만드는 것이 바로 그 문자다 — **고리가 닫혀 있었다.**
 *
 * ★ 표를 새로 만들지 않는다. `sites.settings` 가 jsonb 라 그 안에 넣는다.
 *   `settings.weekly` 한 칸이면 되고 마이그레이션이 필요 없다.
 */

export type WeeklyChannel = "kakao" | "sms";

export type Weekly = {
  /** 거부하면 false. ⚠ «설정 안 함»(undefined)과 «거부»(false)는 다르다 —
   *  전자에게는 「설정해 주세요」를 띄우고 후자에게는 안 띄운다 */
  on: boolean;
  channel: WeeklyChannel;
  /** 문자로 받을 때 쓸 번호. 비면 settings.phone 을 쓴다 */
  phone?: string;
  /** 0=일 … 6=토 */
  weekday: number;
  /** 0~23 (한국 시각) */
  hour: number;
  /** ★ 같은 주에 두 번 보내지 않기 위한 열쇠 */
  lastSentAt?: string;
};

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 기본값 — ★ 기본은 **카카오톡**이다(회장님: 폰에서 카톡 링크로 녹화가 잘 되는 것을 확인) */
export const WEEKLY_DEFAULT: Weekly = { on: true, channel: "kakao", weekday: 2, hour: 10 };

/**
 * ⚠ 알림톡은 아직 심사 전이다. 그때까지는 **문자로 보낸다.**
 *   화면에는 「카카오톡(준비 중) — 지금은 문자로 갑니다」라고 **사실대로** 적는다.
 *   고른 값(kakao)은 그대로 저장한다 — 열리는 날 그 설정이 그대로 살아야 한다.
 */
export const KAKAO_READY = false;

/** 한국 시각의 «지금 요일·시』 — 서버가 어느 지역에 있든 같은 답이 나오게 한다 */
export function nowInSeoul(d = new Date()): { weekday: number; hour: number; ymd: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: map[String(p.weekday)] ?? 0,
    hour: Number(p.hour) % 24,
    ymd: `${p.year}-${p.month}-${p.day}`,
  };
}

/**
 * 지금 이 사장님에게 보낼 때인가.
 *
 * ★★ 2026-09-12 재설계 — 「지금이 딱 그 시각인가」가 아니라 **「그 시각이 지났는가」**로 본다.
 *
 * ⚠ 왜 바꿨나: 처음엔 «요일·시가 정확히 맞을 때»만 보내게 했다. 그러려면 크론이
 *   **매시 정각**에 돌아야 하는데, Vercel **Hobby 요금제는 크론이 하루 1회뿐**이고
 *   매시 표현식(`0 * * * *`)은 **배포 자체를 실패시킨다**
 *   (「Hobby accounts are limited to daily Cron Jobs」 — 2026-09-12 문서 확인).
 *   실제로 그 한 줄 때문에 배포가 통째로 막혔다.
 *
 * ★ 그래서 **크론이 자주 돌든 하루 한 번 돌든 똑같이 동작하게** 만들었다:
 *   · 매시로 돌면 → 고르신 시각 그 시간에 나간다 (정확)
 *   · 하루 한 번 돌면 → 고르신 시각이 지난 뒤 **첫 발송 시간**에 나간다 (조금 늦지만 간다)
 *   어느 쪽이든 **주 1회**는 지켜지고, 요금제가 바뀌어도 코드를 안 고쳐도 된다.
 *
 * ⚠ 두 번 보내는 것은 `lastSentAt` 이 막는다. 크론이 겹쳐 돌거나 재시도해도 안전하다.
 */
export function shouldSend(w: Weekly | undefined, at = new Date()): boolean {
  if (!w?.on) return false;

  /* 이번 주 「그 슬롯」이 언제였나 — 한국 시각 기준으로 계산한다 */
  const now = nowInSeoul(at);
  const minutesNow = now.weekday * 1440 + now.hour * 60;
  const minutesSlot = w.weekday * 1440 + w.hour * 60;
  /* 아직 이번 주 그 시각이 안 됐다 */
  if (minutesNow < minutesSlot) return false;

  if (!w.lastSentAt) return true;
  /* 6일 안에 보낸 적이 있으면 건너뛴다 — 「같은 주」를 날짜 계산 없이 안전하게 본다.
     ⚠ 정확히 7일로 잡으면 크론이 1분 늦게 도는 주에 한 주를 통째로 거른다. */
  const since = at.getTime() - new Date(w.lastSentAt).getTime();
  return since > 6 * 86400_000;
}

/** 저장된 값이 이상해도 화면이 깨지지 않게 정리해서 돌려준다 */
export function readWeekly(settings: Record<string, unknown> | null | undefined): Weekly | undefined {
  const raw = (settings ?? {})["weekly"] as Partial<Weekly> | undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const weekday = Number(raw.weekday);
  const hour = Number(raw.hour);
  return {
    on: raw.on !== false,
    channel: raw.channel === "sms" ? "sms" : "kakao",
    phone: typeof raw.phone === "string" ? raw.phone : undefined,
    weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : WEEKLY_DEFAULT.weekday,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : WEEKLY_DEFAULT.hour,
    lastSentAt: typeof raw.lastSentAt === "string" ? raw.lastSentAt : undefined,
  };
}
