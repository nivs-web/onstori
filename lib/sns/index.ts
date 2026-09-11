import * as db from "./db";
import { instagram } from "./instagram";
import { youtube } from "./youtube";
import { PROVIDERS, type SnsAdapter, type SnsProvider } from "./types";

/**
 * 어댑터 서랍. (2026-09-11)
 *
 * ★ 이번에 실제로 여는 것은 **인스타그램·유튜브 둘뿐**이다.
 *   나머지 넷(틱톡·페이스북·쓰레드·X)은 **자리만 파 둔다** — 나중에 파일 하나만 꽂으면 된다
 *   (회장님 지시: 서랍 구조는 지켜라).
 *
 * ⚠ 아직 안 만든 것을 «있는 척» 하지 않는다. `isAvailable()` 이 **왜 못 쓰는지**를 말한다.
 *   화면은 그 말을 그대로 보여 주고 체크를 못 누르게 한다 — 조용히 실패하지 않는다.
 */

/** 아직 안 만든 SNS 의 자리. 눌러도 아무 일이 안 나는 대신 «왜»를 말한다 */
function notReady(provider: SnsProvider, why: string): SnsAdapter {
  return {
    provider,
    isAvailable: async () => ({ ok: false, why }),
    isConnected: async () => null,
    connect: async () => ({ stage: "failed", kind: "REJECTED", detail: why }),
    disconnect: async () => ({ ok: true }),          // 연결 자체가 없으니 끊긴 것과 같다
    upload: async () => ({ state: "failed", kind: "REJECTED", detail: why }),
    translateError: () => "TRANSIENT",               // ★ 모르면 TRANSIENT
    isDuplicate: (siteId, entryId) => db.isDuplicate(siteId, entryId, provider),
    getQuota: async () => ({ remaining: 0, limit: 0, windowSec: 86400 }),
  };
}

const LATER = "아직 준비 중이에요. 인스타그램부터 먼저 열고 있습니다.";

const ADAPTERS: Record<SnsProvider, SnsAdapter> = {
  instagram,
  youtube,
  tiktok: notReady("tiktok", LATER),
  facebook: notReady("facebook", LATER),
  threads: notReady("threads", LATER),
  /* ⚠⚠ X 를 실제로 만들 때 **반드시** 읽어라: 글에 링크가 들어가면 요금이 13배다.
     `lib/sns/no-url.ts` 의 `captionFor()` 를 거친 글만 보내야 하고, 라우트 두 곳
     (publish · publish/poll)이 이미 그렇게 하고 있다. 새 경로를 만들면 거기도 똑같이 걸어라. */
  x: notReady("x", LATER),
};

export function getAdapter(provider: SnsProvider): SnsAdapter {
  return ADAPTERS[provider];
}

/** 화면이 쓰는 순서 — 이번에 여는 둘을 앞에 둔다 */
export const ORDERED: SnsProvider[] = ["instagram", "youtube", ...PROVIDERS.filter((p) => p !== "instagram" && p !== "youtube")];

export { PROVIDERS };
export * from "./types";
