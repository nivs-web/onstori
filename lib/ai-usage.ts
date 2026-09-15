import { sbAdmin } from "./db-admin";

/**
 * ★★★ **AI 토큰 사용 내역 — 「영수증」.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「샘플 하나 만들 때마다 얼마만큼의 구글 제미나이 토큰을 썼는지 나오게 하고 싶어.
 *   … 이야기 쓰기, 동영상 편집하기, 자막 달기, 사이트 제작 시 들었던 토큰, 이런 **토큰 사용
 *   영수증 및 내역서**가 있으면 좋겠어. … 그래야 무료 회원에게 기능을 막아 두거나,
 *   얼마 안 쓴다면 **마이너스 손해를 보더라도 열어 줄 수 있잖아.**」
 *
 * ★★ **왜 이제야 되나 — 값이 이미 오고 있었는데 버리고 있었다.**
 *   Vertex 응답에 `usageMetadata.{promptTokenCount, candidatesTokenCount, totalTokenCount}` 가
 *   **매번 들어 있다.** `lib/gemini.ts` 가 글자만 꺼내 쓰고 그 칸을 버렸다. 이제 주워 담는다.
 *
 * ★★ **왜 새 표를 안 만들었나.** `sites.settings.aiUsage` 에 배열로 쌓는다.
 *   · **마이그레이션이 필요 없다** — 대표님이 `db push` 를 하실 때까지 기다리지 않아도 된다
 *   · 사이트 하나의 내역이 **그 사이트 옆에** 있다. 지울 때 같이 지워진다(개인정보 관점에서도 낫다)
 *   ⚠ 대신 **무한히 쌓으면 안 된다.** 최근 `MAX_ROWS` 개만 남기고, 넘친 것은 **합계로 접는다** —
 *     숫자는 잃지 않고 줄 수만 줄인다. (아래 `fold` 참고)
 *   ⚠ 사장님이 수천 명이 되면 그때 진짜 표로 옮긴다. 그때까지 이 구조로 충분하다.
 *
 * 🔴 **돈 숫자는 «추정»이다.** 구글 단가는 모델·지역·시점마다 다르고, 우리가 화면에 적은 값이
 *   실제 청구서와 다를 수 있다. 그래서 **토큰 수(정확한 값)를 먼저** 보여 주고
 *   원화는 **「추정」이라고 써서** 곁들인다. 단가는 환경변수로 바꿀 수 있게 열어 두었다.
 */

/** 무엇에 썼나 — 화면에 한국어로 보여 줄 이름까지 한 곳에 둔다 */
export const USAGE_KINDS = {
  site_create: "홈페이지 제작",
  site_edit: "홈페이지 수정",
  story_write: "이야기 쓰기",
  video_edit: "영상 편집",
  caption: "자막 달기",
  image: "이미지 생성",
  other: "기타",
} as const;
export type UsageKind = keyof typeof USAGE_KINDS;

export type UsageRow = {
  /** ISO 시각 */
  at: string;
  kind: UsageKind;
  model: string;
  /** 보낸 글자 토큰 */
  inTok: number;
  /** 받은 글자 토큰 */
  outTok: number;
  /** 합계 — 구글이 준 값이 있으면 그것을 그대로 쓴다(우리가 더하지 않는다) */
  total: number;
  /** 여러 줄을 접어 만든 줄이면 몇 줄을 접었는지 */
  folded?: number;
};

/** 한 사이트에 남기는 최대 줄 수. 넘으면 오래된 것부터 **합계로 접는다** */
const MAX_ROWS = 300;

/**
 * 100만 토큰당 미국 달러 — **추정값**이다.
 * ⚠ 구글 단가는 바뀐다. 환경변수로 덮을 수 있게 열어 두었다:
 *   `AI_USD_PER_MTOK_IN` · `AI_USD_PER_MTOK_OUT` · `AI_USD_KRW`
 * ⚠ 이 숫자를 「사실」로 말하지 마라. 화면에도 **「추정」**이라고 적혀 있다.
 */
const USD_IN = Number(process.env.AI_USD_PER_MTOK_IN ?? 0.3);
const USD_OUT = Number(process.env.AI_USD_PER_MTOK_OUT ?? 2.5);
const KRW = Number(process.env.AI_USD_KRW ?? 1380);

/** 한 줄의 «추정» 원화 */
export function krwOf(r: { inTok: number; outTok: number }): number {
  return ((r.inTok / 1e6) * USD_IN + (r.outTok / 1e6) * USD_OUT) * KRW;
}

export const RATE_NOTE =
  `추정 단가 — 입력 100만 토큰당 $${USD_IN} · 출력 $${USD_OUT} · 환율 ${KRW}원. ` +
  `실제 청구서와 다를 수 있습니다(환경변수 AI_USD_PER_MTOK_IN·OUT·AI_USD_KRW 로 바꿉니다).`;

/**
 * Vertex 응답에서 토큰 수를 꺼낸다.
 * ⚠ **없으면 0 이 아니라 `null` 이다.** 0 으로 적으면 「안 썼다」로 읽혀 숫자가 거짓이 된다.
 */
export function usageOf(data: unknown): { inTok: number; outTok: number; total: number } | null {
  const u = (data as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!u) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const inTok = n(u.promptTokenCount);
  const outTok = n(u.candidatesTokenCount) + n(u.thoughtsTokenCount);
  /* 구글이 합계를 주면 그것을 쓴다 — 우리가 더하면 숨은 항목(캐시·생각)을 놓친다 */
  const total = n(u.totalTokenCount) || inTok + outTok;
  if (!total) return null;
  return { inTok, outTok, total };
}

/** 오래된 줄을 «합계 한 줄»로 접는다 — 숫자는 잃지 않고 줄 수만 줄인다 */
function fold(rows: UsageRow[]): UsageRow[] {
  if (rows.length <= MAX_ROWS) return rows;
  const keep = rows.slice(-MAX_ROWS + 1);
  const old = rows.slice(0, rows.length - keep.length);
  const sum: UsageRow = {
    at: old[old.length - 1]?.at ?? new Date().toISOString(),
    kind: "other",
    model: `(예전 ${old.length}건을 합침)`,
    inTok: old.reduce((a, b) => a + b.inTok, 0),
    outTok: old.reduce((a, b) => a + b.outTok, 0),
    total: old.reduce((a, b) => a + b.total, 0),
    folded: old.length,
  };
  return [sum, ...keep];
}

/**
 * 한 건을 적는다.
 *
 * 🔴 **절대 던지지 않는다.** 영수증을 못 적었다고 홈페이지 만들기가 실패하면 그게 훨씬 나쁘다.
 *   실패하면 로그만 남기고 조용히 넘어간다.
 * ⚠ `slug` 가 없으면(= 아직 사이트가 안 만들어진 단계) 아무것도 안 한다.
 *   가입 도중의 호출은 사이트가 생긴 «뒤에» `attachPendingUsage` 로 옮겨 붙인다.
 */
export async function recordAiUsage(
  slug: string | null | undefined,
  kind: UsageKind,
  model: string,
  data: unknown,
): Promise<void> {
  try {
    const u = usageOf(data);
    if (!u || !slug) return;
    const sb = sbAdmin();
    const { data: site } = await sb.from("sites").select("id, settings").eq("slug", slug).maybeSingle();
    if (!site) return;
    const settings = ((site.settings as Record<string, unknown>) ?? {});
    const prev = Array.isArray(settings.aiUsage) ? (settings.aiUsage as UsageRow[]) : [];
    const row: UsageRow = { at: new Date().toISOString(), kind, model, ...u };
    settings.aiUsage = fold([...prev, row]);
    await sb.from("sites").update({ settings }).eq("id", site.id);
  } catch (e) {
    console.warn(JSON.stringify({ evt: "ai_usage_record_failed", slug, err: String(e).slice(0, 160) }));
  }
}

/** 한 사이트의 합계 */
export function sumUsage(rows: UsageRow[]): { calls: number; inTok: number; outTok: number; total: number; krw: number } {
  const calls = rows.reduce((a, r) => a + (r.folded ?? 1), 0);
  const inTok = rows.reduce((a, r) => a + r.inTok, 0);
  const outTok = rows.reduce((a, r) => a + r.outTok, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { calls, inTok, outTok, total, krw: krwOf({ inTok, outTok }) };
}

/** `settings` 에서 안전하게 꺼낸다 — 깨진 값이 와도 화면을 죽이지 않는다 */
export function usageRowsOf(settings: unknown): UsageRow[] {
  const v = (settings as { aiUsage?: unknown } | null)?.aiUsage;
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const r = x as Partial<UsageRow>;
    if (typeof r?.total !== "number") return [];
    return [{
      at: typeof r.at === "string" ? r.at : "",
      kind: (r.kind && r.kind in USAGE_KINDS ? r.kind : "other") as UsageKind,
      model: typeof r.model === "string" ? r.model : "",
      inTok: typeof r.inTok === "number" ? r.inTok : 0,
      outTok: typeof r.outTok === "number" ? r.outTok : 0,
      total: r.total,
      folded: typeof r.folded === "number" ? r.folded : undefined,
    }];
  });
}
