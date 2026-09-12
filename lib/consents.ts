import { sbAdmin } from "@/lib/db-admin";

/**
 * 가입 동의 — 기록과 판정의 단일 출처. (2026-09-12 회장님 지시 2)
 *
 * ★★ **왜 표를 따로 두나:** `sites.settings` 는 사장님이 홈페이지를 저장할 때마다
 *   얕은 병합으로 덮인다. 동의했다는 증거가 조용히 사라진다. 증거는 사장님의 다른
 *   조작에 휘말리면 안 된다 → `consents` 표 (20260912090000_consents.sql).
 *
 * ★★ **필수와 선택을 섞지 않는다.** 알림 수신(marketing)은 **선택**이다.
 *   선택 동의를 안 하면 가입이 막히게 만드는 순간 그 자체가 법 위반이다.
 */

/** 어느 판본에 동의했는가 — 화면(`/terms`·`/privacy`)이 이 값을 함께 쓴다 */
export const LEGAL_VERSION = {
  terms: "2026-09-06",
  privacy: "2026-09-06",
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
