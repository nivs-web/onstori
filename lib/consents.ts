import { sbAdmin } from "@/lib/db-admin";

/**
 * 가입 동의 — 기록과 판정의 단일 출처. (2026-09-12 회장님 지시 2)
 *
 * ★★ **왜 표를 따로 두나:** `sites.settings` 는 사장님이 홈페이지를 저장할 때마다
 *   얕은 병합으로 덮인다. 동의했다는 증거가 조용히 사라진다. 증거는 사장님의 다른
 *   조작에 휘말리면 안 된다 → `consents` 표 (20260912090000_consents.sql).
 *
 * ★★ **필수와 선택을 섞지 않는다.** 선택 동의를 안 했다고 가입이 막히면 그 자체가 법 위반이다.
 *
 * ★ 2026-09-13 — 가입 화면에서 **광고 동의 칸을 없앴다.** 할인·행사 문자를 보내지 않기로
 *   했기 때문이다(회장님 확정). 그래서 `marketing` 은 이제 **항상 `false` 로 기록된다.**
 *   ⚠ 칸을 지우지 않고 **기록은 남긴다** — 「묻지 않았고 받지 않았다」가 사실이고,
 *     그 사실이 남아야 나중에 「동의받았다」고 오해할 여지가 없다.
 *   ⚠ 「주 1회 촬영 질문」은 광고가 아니라 **우리가 판 상품**이라 이 동의와 무관하다.
 *     그것을 끄는 길은 편집화면 「연결」 탭과 첫 문자의 【받지 않으시려면】 줄이다.
 */

/** 어느 판본에 동의했는가 — 화면(`/terms`·`/privacy`)이 이 값을 함께 쓴다 */
export const LEGAL_VERSION = {
  terms: "2026-09-06",
  /* 2026-09-12 개정 — §17 「SNS 연결과 게시」 신설, §6·§7 표에 유튜브·인스타·틱톡 추가.
     ⚠ 방침을 고치면 **이 날짜를 반드시 함께 올린다.** 화면의 「시행일」과 동의 기록의
       `doc_version` 이 이 한 값을 같이 읽는다 — 안 올리면 「무엇에 동의했는지」가 어긋난다. */
  privacy: "2026-09-12",
} as const;

export const CONSENT_KINDS = ["terms", "privacy", "marketing"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** ★ 없으면 가입이 안 되는 것 — 딱 둘이다 */
export const REQUIRED_CONSENTS: ConsentKind[] = ["terms", "privacy"];

export type ConsentInput = { terms: boolean; privacy: boolean; marketing: boolean };

/** 필수 동의가 다 들어왔나 — 서버가 판단한다. 화면 값을 믿지 않는다(불변 규칙 4의 정신) */
export function hasRequired(c: Partial<ConsentInput> | undefined | null): boolean {
  return REQUIRED_CONSENTS.every((k) => c?.[k] === true);
}

const versionOf = (kind: ConsentKind) =>
  kind === "marketing" ? null : LEGAL_VERSION[kind];

/**
 * 동의를 적는다. **가입이 끝난 «뒤»에 부른다** — site_id 가 있어야 하기 때문이다.
 *
 * ⚠ 여기서 실패해도 가입 자체를 되돌리지 않는다. 사장님은 이미 화면에서 동의를 눌렀고,
 *   홈페이지도 만들어졌다. 기록이 안 된 것은 **우리 쪽 문제**라 로그로 남겨 사람이 챙긴다.
 *   (동의를 못 받은 것과, 받았는데 못 적은 것은 다른 일이다.)
 */
export async function recordConsents(siteId: string, input: ConsentInput, now = new Date()): Promise<boolean> {
  const stamp = now.toISOString();
  const rows = CONSENT_KINDS.map((kind) => ({
    site_id: siteId,
    kind,
    agreed: input[kind] === true,
    agreed_at: input[kind] === true ? stamp : null,
    revoked_at: input[kind] === true ? null : stamp,
    doc_version: versionOf(kind),
    updated_at: stamp,
  }));

  const { error } = await sbAdmin().from("consents").upsert(rows, { onConflict: "site_id,kind" });
  if (error) {
    console.error(JSON.stringify({ evt: "consent_record_failed", siteId, err: error.message.slice(0, 200) }));
    return false;
  }
  return true;
}
