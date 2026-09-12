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
/**
 * 한국 시각 기준 **이번 주가 시작된 순간**(일요일 00:00 KST)을 밀리초로.
 * 「이번 주에 이미 보냈나」를 정확히 가르는 데 쓴다 — 「6일 지났나」보다 정확하다.
 */
export function weekStartMs(at = new Date()): number {
  const now = nowInSeoul(at);
  /* 오늘 한국 날짜의 자정을 구한 뒤, 요일 수만큼 뒤로 물린다.
     ⚠ `ymd` 는 한국 날짜다. 뒤에 KST 오프셋을 붙여야 그 «한국 자정»이 된다. */
  const todayMidnightKst = new Date(`${now.ymd}T00:00:00+09:00`).getTime();
  return todayMidnightKst - now.weekday * 86_400_000;
}

/**
 * 지금 이 사장님에게 보낼 때인가.
 *
 * ★★ 2026-09-12 **다시 고쳤다 — 「오늘이 그 요일인가」로.** (회장님 지시 D4)
 *
 * ⚠ 앞의 방식(「그 시각이 지났는가」를 **주 안의 분**으로 계산)에 결함이 둘 있었다.
 *   크론은 하루 한 번(한국 09:00)만 돈다는 점을 계산에 넣지 않은 탓이다.
 *
 *   **① 고르신 요일보다 하루 늦게 갔다**
 *      화요일 10시를 고르셨다 하자. 화요일 09:00 크론에서는 «아직 10시가 안 됐다»고 판정해
 *      건너뛰고, 다음 실행인 **수요일 09:00** 에 나갔다.
 *
 *   **② 토요일 늦은 시각을 고르신 분께는 «영영» 안 갔다**
 *      토요일 10시를 고르셨다 하자. 그 주의 마지막 실행은 토요일 09:00 — 아직 10시가 아니라 건너뛴다.
 *      다음 실행은 일요일 09:00 인데, 그때는 **주가 바뀌어** 계산이 0분부터 다시 시작한다.
 *      그래서 그 슬롯에는 **한 번도 닿지 못한다.** 조용히, 영원히.
 *
 * ★ 지금 규칙은 둘뿐이라 이런 구멍이 안 생긴다:
 *   1. **이번 주에 이미 보냈으면** 안 보낸다 (일요일 00:00 KST 기준)
 *   2. **오늘이 그 요일이거나 이미 지났으면** 보낸다
 *
 *   2의 «지났으면»이 «따라잡기»다 — 크론이 하루 쉬어도 그 주를 통째로 잃지 않는다.
 *
 * ⚠ **시각(hour)은 지금 보지 않는다.** 크론이 하루 한 번이라 지킬 수 없는 약속이기 때문이다.
 *   화면도 그렇게 «사실대로» 말한다. 나중에 요금제를 올려 크론을 매시로 돌리게 되면,
 *   위 2번의 «오늘» 갈래에만 `now.hour >= w.hour` 를 더하면 된다. 그 한 줄이 전부다.
 */
export function shouldSend(w: Weekly | undefined, at = new Date()): boolean {
  if (!w?.on) return false;

  /* 1) 이번 주에 이미 보냈나 */
  if (w.lastSentAt) {
    const sent = new Date(w.lastSentAt).getTime();
    if (Number.isFinite(sent) && sent >= weekStartMs(at)) return false;
  }

  /* 2) 오늘이 그 요일이거나, 이미 지났나 */
  return nowInSeoul(at).weekday >= w.weekday;
}

/* ════════════════ 알림톡 준비 (2026-09-12 회장님 지시 D5) ════════════════ */

/** 녹화 링크가 살아 있는 날수 — 다음 주 질문이 오기 전까지 */
export const LINK_VALID_DAYS = 6;

/**
 * `#{마감일}` — 알림톡 템플릿에 들어갈 값. **보낸 날 + 6일**.
 *
 * ★ 왜 마감일이 필요한가: 김팀장 조사 — 알림톡이 «정보성»으로 인정받으려면
 *   **「무엇을, 언제까지」**가 분명해야 한다. 「이번 주 녹화 링크가 도착했습니다」에
 *   유효기간이 붙어야 «배송물»로 읽힌다.
 * ⚠ 한국 날짜로 적는다. 서버가 어디에 있든 사장님이 보는 날짜와 같아야 한다.
 */
export function deadlineText(at = new Date(), days = LINK_VALID_DAYS): string {
  const ms = at.getTime() + days * 86_400_000;
  const f = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short",
  });
  /* 예: 「9월 18일 (목)」 */
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.month} ${p.day}일 (${p.weekday})`;
}

/**
 * ★★ **알림톡·문자에 쓰면 안 되는 말.** (2026-09-12 김팀장 조사)
 *
 * 「60초만 말씀해 주세요」처럼 **행동을 시키는 문장**은 광고성으로 읽혀 **반려 사유**가 된다.
 * 알림은 「무엇이 도착했다」까지만 말하고, **무엇을 하라는 말은 링크 너머 화면**에서 한다.
 *
 * ⚠ 이 목록은 «검사»용이다. 문구를 새로 쓸 때 `hasBannedPhrase()` 로 스스로 확인한다.
 */
export const BANNED_IN_NOTIFY = ["60초만 말씀해 주세요", "말씀해 주세요", "지금 바로", "무료", "할인", "이벤트"] as const;

export const hasBannedPhrase = (text: string): string | null =>
  BANNED_IN_NOTIFY.find((w) => text.includes(w)) ?? null;

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

/* ════════════ C안 — 첫 문자에 거부 안내 (2026-09-12 회장님 결정 A1) ════════════ */

/**
 * ★★ 왜 있나: 기존 15곳 중 **알림 수신에 명시적으로 동의한 곳이 한 곳도 없다**
 *   (`consents` 표가 0줄이다 — 오늘 만든 동의 절차 «이전»에 가입한 분들이라 그렇다).
 *   회장님 결정은 **C안** — 「그대로 켜되, **거부할 길을 첫 문자 그 자리에서** 드린다」.
 *
 * ⚠ **문자에는 굵게가 없다.** 그래서 한 줄을 통째로 `【】` 로 감싼다 — 이것이 문자에서의 굵게다.
 * ⚠ 「~해 주세요」류를 일부러 뺐다. `BANNED_IN_NOTIFY` 에 걸리면 **발송 자체가 막힌다**
 *   (`hasBannedPhrase` 가 보내기 전에 검사한다).
 * ⚠ 경로는 화면과 **글자 그대로** 맞춰야 한다 — 편집화면 「연결」 탭 > 「주 1회 촬영 알림」 >
 *   [받지 않기] (app/[slug]/edit/ui.tsx · weekly-panel.tsx). 화면 글자가 바뀌면 여기도 바꿔라.
 */
export const OPT_OUT_LINE = "【받지 않으시려면】 홈페이지 관리 > 연결 > 주 1회 촬영 알림 > 받지 않기";

/**
 * **첫 문자에만** 붙인다 — `lastSentAt` 이 비어 있으면 이 사장님께 «처음» 가는 문자다.
 *
 * ⚠ 매주 붙이지 않는 이유: 회장님 지시가 「첫 문자에」였고, 매주 붙으면 본문이 길어져
 *   정작 이번 주 질문이 안 읽힌다. 끄는 길은 편집화면에 **늘** 열려 있다.
 */
export function withOptOut(text: string, isFirstEver: boolean): string {
  return isFirstEver ? `${text}\n${OPT_OUT_LINE}` : text;
}

/* ════════ 같은 번호로 두 번 가지 않게 (2026-09-12 회장님 지시 A2) ════════ */

/**
 * 번호 비교용 열쇠. 하이픈·공백·`+82` 표기가 달라도 **같은 번호면 같은 열쇠**가 나온다.
 * ⚠ 표기를 그대로 비교하면 `010-1111-2222` 와 `01011112222` 를 다른 사람으로 본다.
 */
export function phoneKey(phone: string): string {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.startsWith("82") ? `0${d.slice(2)}` : d;
}

export type PhoneCandidate = {
  phone: string;
  slug: string;
  status?: string | null;
  updatedAt?: string | null;
};

/**
 * ★★ **한 번호에는 한 주에 한 통만.**
 *
 * ⚠ 왜 필요한가: 한 분이 사이트를 둘 이상 가진 경우가 실제로 있다(2026-09-12 확인 —
 *   「안녕월드」와 「욕실 인테리어 전문가」가 같은 번호다). 그대로 두면 **같은 번호로 같은 날
 *   두 통**이 간다. 받는 쪽에서는 그것이 스팸의 첫인상이고, 통신사 필터에도 그렇게 읽힌다.
 *
 * ★ 어느 사이트 것으로 보낼지 — **고르는 규칙과 그 이유**:
 *   1. **`active` 가 `trial` 을 이긴다** — 돈이 오가기 시작한 곳이 사장님의 «진짜 가게»다.
 *   2. **최근에 손댄 곳**(`updated_at` 최신) — 사장님의 눈이 지금 가 있는 곳이다.
 *      덤으로 «안정»도 얻는다: 보내고 나면 그 사이트의 `settings.lastSentAt` 이 찍혀
 *      `updated_at` 이 다시 최신이 되므로, **다음 주에도 같은 곳이 뽑힌다.**
 *      매주 다른 사이트 이름으로 문자가 가면 그것이야말로 사장님을 헷갈리게 한다.
 *   3. 그래도 같으면 **slug 사전순** — 뽑기가 실행마다 흔들리지 않게 하는 마지막 못이다.
 *
 * ⚠ 이 함수는 **보낼 때가 된 후보만** 받아야 한다. 아직 때가 아닌 사이트까지 넣어 놓고
 *   그중 하나를 뽑으면, 뽑힌 쪽이 건너뛰어져 그 번호에는 **아무것도 안 간다.**
 */
export function pickOnePerPhone<T extends PhoneCandidate>(
  cands: T[],
): { chosen: T[]; dropped: Array<{ slug: string; inFavorOf: string }> } {
  const groups = new Map<string, T[]>();
  for (const c of cands) {
    const k = phoneKey(c.phone);
    const g = groups.get(k);
    if (g) g.push(c); else groups.set(k, [c]);
  }

  const chosen: T[] = [];
  const dropped: Array<{ slug: string; inFavorOf: string }> = [];
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => {
      const rank = (s?: string | null) => (s === "active" ? 0 : 1);
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      const at = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
    chosen.push(sorted[0]);
    for (const rest of sorted.slice(1)) dropped.push({ slug: rest.slug, inFavorOf: sorted[0].slug });
  }
  return { chosen, dropped };
}
