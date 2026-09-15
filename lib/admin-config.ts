import { sbAdmin } from "./db-admin";
import { CHANNELS_LINE_MARKED } from "@/config/channels";

/**
 * ★★★ **운영자가 화면에서 바꾸는 설정 — 한 곳.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「어드민에 **「카피 관리」**라는 메뉴를 신설해서 이런 문구들을 고정해 놓고
 *   **내가 직접 바꿀 수 있게** 만들어. … 그러면 내가 여기서 SNS 다중 채널이 확장될 때마다
 *   **수정을 간단하게** 할 수 있도록 해. 이게 오류도 적고 나도 관리하기 편하다.」
 *
 * ★★ **표를 새로 안 만들었다.** 이미 있는 `admin_notes`(id·body 두 칸)를 쓴다 —
 *   `id = "config"`, `body` 에 JSON 한 덩이. **마이그레이션이 필요 없다.**
 *   ⚠ 표가 아직 없으면(= `db push` 전) **기본값으로 돈다.** 화면이 죽지 않는다.
 *
 * ★★ **기본값의 출처를 흐리지 않는다.**
 *   · 대표님이 화면에서 «저장한 적이 없으면» → 코드의 기본값(`config/channels.ts` 등)
 *   · 한 번이라도 저장하시면 → **그 값이 이긴다**
 *   이렇게 두면 「화면에서 바꿨는데 왜 안 바뀌죠?」가 생기지 않는다.
 */

export type AdminConfig = {
  /* ── 카피 ── */
  /** 🔴 전체 홈페이지의 핵심 문구. 대표님이 직접 정하신다 */
  snsLine: string;
  /** 첫 페이지 맨 아래 저작권 줄 */
  copyright: string;

  /* ── 만료 예고 알림 ── */
  /** 🔴 **기본은 꺼짐.** 대표님이 켜야만 나간다 (2026-09-15 지시) */
  expiryAlertOn: boolean;
  /** 며칠 전에 보낼까 — 큰 수부터 */
  expiryAlertDays: number[];
  /** 문자로 보낼까 */
  expiryBySms: boolean;
  /** 메일로 보낼까 */
  expiryByEmail: boolean;
  /** 보낼 글. `{남은일}` · `{주소}` · `{상호}` 가 자동으로 채워진다 */
  expiryText: string;
  /** 🔴 하루에 보낼 수 있는 최대 건수 — 건수는 우리가 못 막는다. 상한이 마지막 방어선이다 */
  smsDailyCap: number;

  /* ── 검색 노출 ── */
  /** 무료 체험 사장님도 검색에 올릴까 (2026-09-15 대표님 「올린다」) */
  indexTrial: boolean;
};

/** ⚠ 코드 기본값. 대표님이 저장하신 적이 없을 때만 쓰인다 */
export function defaultConfig(): AdminConfig {
  return {
    snsLine: CHANNELS_LINE_MARKED,
    copyright: "Made with 온스토리",

    /* 🔴 대표님 지시: 「초기에는 꺼져 있으니까 문자 안 날아가는 걸로 하자.」 */
    expiryAlertOn: false,
    expiryAlertDays: [7, 3, 1],
    expiryBySms: true,
    expiryByEmail: true,
    expiryText:
      "온스토리 {기간}일 무료체험 남은기간이 {남은일}일 남았습니다. " +
      "https://onstori.com/{주소}/edit 으로 입장하셔서 로그인 하시고 " +
      "유료회원 결재하시면 계속 이용하실 수 있습니다",
    smsDailyCap: 200,

    indexTrial: true,
  };
}

/** 깨진 값이 와도 절대 던지지 않는다 — 설정 하나 때문에 화면 전체가 죽으면 안 된다 */
function merge(raw: unknown): AdminConfig {
  const d = defaultConfig();
  const v = (raw ?? {}) as Partial<AdminConfig>;
  const str = (a: unknown, b: string) => (typeof a === "string" && a.trim() ? a : b);
  const bool = (a: unknown, b: boolean) => (typeof a === "boolean" ? a : b);
  const num = (a: unknown, b: number) => (typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : b);
  const days = Array.isArray(v.expiryAlertDays)
    ? [...new Set(v.expiryAlertDays.filter((n) => typeof n === "number" && n > 0 && n <= 60))].sort((a, b) => b - a)
    : d.expiryAlertDays;
  return {
    snsLine: str(v.snsLine, d.snsLine),
    copyright: str(v.copyright, d.copyright),
    expiryAlertOn: bool(v.expiryAlertOn, d.expiryAlertOn),
    expiryAlertDays: days.length ? days : d.expiryAlertDays,
    expiryBySms: bool(v.expiryBySms, d.expiryBySms),
    expiryByEmail: bool(v.expiryByEmail, d.expiryByEmail),
    expiryText: str(v.expiryText, d.expiryText),
    smsDailyCap: num(v.smsDailyCap, d.smsDailyCap),
    indexTrial: bool(v.indexTrial, d.indexTrial),
  };
}

/** 지금 설정을 읽는다. 표가 없거나 오류면 **기본값**으로 돈다 */
export async function readConfig(): Promise<AdminConfig> {
  try {
    const { data } = await sbAdmin().from("admin_notes").select("body").eq("id", "config").maybeSingle();
    if (!data?.body) return defaultConfig();
    return merge(JSON.parse(data.body as string));
  } catch {
    return defaultConfig();
  }
}

/** 저장 — 부르는 쪽이 운영자인지 먼저 확인한다 */
export async function writeConfig(patch: Partial<AdminConfig>): Promise<{ ok: boolean; error?: string }> {
  try {
    const now = await readConfig();
    const next = merge({ ...now, ...patch });
    const { error } = await sbAdmin()
      .from("admin_notes")
      .upsert({ id: "config", body: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) {
      const missing = /admin_notes|42P01|could not find the table/i.test(error.message);
      return {
        ok: false,
        error: missing
          ? "admin_notes 표가 아직 없어요. `npx supabase db push` 를 한 번 돌려야 저장됩니다."
          : error.message.slice(0, 160),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

/**
 * 보낼 글을 만든다 — `{남은일}` 같은 자리를 채운다.
 * ⚠ 모르는 자리는 **그대로 둔다.** 빈칸으로 바꾸면 문장이 이상해지고, 그게 손님에게 나간다.
 */
export function fillTemplate(
  text: string,
  vars: { 남은일?: number | string; 주소?: string; 상호?: string; 기간?: number | string },
): string {
  return text.replace(/\{(남은일|주소|상호|기간)\}/g, (m, k: keyof typeof vars) =>
    vars[k] === undefined || vars[k] === null ? m : String(vars[k]),
  );
}
