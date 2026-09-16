import { PROVIDERS, type SnsProvider } from "./sns/types";

/**
 * 「한 방 등록」 기본 설정 — 한 번 정해 두면 영상마다 다시 안 적는다. (2026-09-16 대표님 지시)
 *
 * ★★ **왜 만들었나.** 대표님 말씀:
 *   「인스타 릴스 영상 한 번, 각각의 설정 값 넣고 수정하고 등록하기 누르고, 그리고 또 틱톡도
 *    또 각각 설정 한 번 등록하기 누르고 — 이게 무슨 한 방 등록이야.」
 *   지금은 채널마다 «글 칸»이 따로 있어 같은 말을 두 번 적어야 한다. 채널이 셋이 되면 세 번이다.
 *
 * ★★ **글·해시태그·영상은 «공통»이다.** 그러니 한 곳에 적고 한 번에 나가야 한다.
 *   채널별로 다르게 쓰고 싶은 분은 지금까지의 개별 상자를 그대로 쓰시면 된다 — 그 길을 없애지 않는다.
 *
 * 🔴 **틱톡의 «공개범위»만은 예외다. 그건 우리가 미리 정할 수 없다.**
 *   틱톡 심사는 「사장님이 **매번 스스로** 골랐는가」를 본다(`lib/sns/tiktok.ts` 의 `canPrefill:false`).
 *   미리 골라 두면 그것으로 심사에서 떨어진다. 그래서 한 방 등록에서도 **공개범위 한 번은 묻는다.**
 *   ⇒ 「완전한 한 방」이 아닌 이유는 우리 기술이 아니라 **틱톡 규정** 때문이다.
 *
 * ★ 표를 새로 만들지 않는다 — `sites.settings.snsDefaults` 에 넣는다(jsonb). 마이그레이션이 필요 없다.
 */

export type SnsDefaults = {
  /** 모든 채널에 공통으로 들어갈 글. 비우면 그 영상의 질문·제목이 들어간다 */
  text: string;
  /** 해시태그 한 줄. `#` 을 안 쓰셔도 우리가 붙인다 */
  tags: string;
  /** 어디에 올릴까 — 체크된 채널. 홈페이지는 따로(`home`) */
  providers: SnsProvider[];
  /** 홈페이지에도 같이 걸까 */
  home: boolean;
};

export const SNS_DEFAULTS: SnsDefaults = {
  text: "",
  tags: "",
  /* ★ 기본은 «지금 살아 있는 곳»이다. 준비 중인 곳을 기본으로 켜 두면
     사장님이 눌렀을 때 아무 일도 안 일어나고 이유도 모른다. */
  providers: ["instagram", "tiktok"],
  home: true,
};

/** 글자 상한 — 인스타 2,200자가 가장 짧은 축에 속한다. 그 안에서 논다 */
export const TEXT_MAX = 1800;
export const TAGS_MAX = 300;

/** 해시태그 한 줄을 다듬는다 — `#` 없이 적으셔도, 쉼표로 나누셔도 받는다 */
export function normalizeTags(raw: string): string[] {
  return String(raw ?? "")
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 30);
}

/** 화면·발행에 함께 쓰는 «최종 글» — 글 + 빈 줄 + 해시태그 */
export function composeCaption(d: Pick<SnsDefaults, "text" | "tags">, fallback: string): string {
  const body = (d.text ?? "").trim() || (fallback ?? "").trim();
  const tags = normalizeTags(d.tags).map((t) => `#${t}`).join(" ");
  if (!tags) return body;
  return body ? `${body}\n\n${tags}` : tags;
}

/**
 * 저장된 값을 읽는다. 없거나 망가졌으면 기본값이다.
 * ⚠ **절대 던지지 않는다.** 설정 한 칸 때문에 영상 화면 전체가 안 뜨면 안 된다.
 */
export function readSnsDefaults(settings: unknown): SnsDefaults {
  const raw = (settings as { snsDefaults?: unknown } | null)?.snsDefaults;
  if (!raw || typeof raw !== "object") return { ...SNS_DEFAULTS };
  const o = raw as Record<string, unknown>;
  const provs = Array.isArray(o.providers)
    ? (o.providers.filter((p): p is SnsProvider => typeof p === "string" && (PROVIDERS as readonly string[]).includes(p)))
    : SNS_DEFAULTS.providers;
  return {
    text: typeof o.text === "string" ? o.text.slice(0, TEXT_MAX) : SNS_DEFAULTS.text,
    tags: typeof o.tags === "string" ? o.tags.slice(0, TAGS_MAX) : SNS_DEFAULTS.tags,
    providers: provs,
    home: typeof o.home === "boolean" ? o.home : SNS_DEFAULTS.home,
  };
}
