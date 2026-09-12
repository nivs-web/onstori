/**
 * 유튜브 «문» — 누가 올릴 수 있나. (2026-09-12 상무님 지적으로 다시 씀)
 *
 * ★★★ **왜 이 파일이 따로 있나 — 되돌릴 수 없는 일이 걸려 있다.**
 *
 *   ════ 구글 공식 문서 **원문** (2026-09-13 김팀장 확인) ════
 *
 *   출처 ①  https://support.google.com/youtube/answer/7300965
 *     "For videos that have been locked as private due to upload via an unverified API service,
 *      you will not be able to appeal."
 *     "You'll need to re-upload the video via a verified API service or via the YouTube app/site."
 *
 *   출처 ②  https://developers.google.com/youtube/v3/revision_history  (2020-07-28 항목)
 *     "All videos uploaded via the videos.insert endpoint from unverified API projects created
 *      after 28 July 2020 will be restricted to private viewing mode."
 *     "To lift this restriction, each project must undergo an audit…"
 *
 *   ⇒ **감사 통과 «전»에 사장님이 올리면, 그 영상은 영영 죽은 채로 채널에 쌓인다.**
 *     · **항소가 안 된다** — "you will not be able to appeal" 은 달리 읽을 여지가 없다
 *     · 감사를 나중에 통과해도 **이미 잠긴 것은 안 풀린다.** 「자동으로 풀린다」는 문장이
 *       공식 문서 어디에도 없고, 대신 **"re-upload"** 하라고만 적혀 있다
 *     · 즉 사장님이 **다시 찍어 다시 올려야** 한다. 우리가 그 60초를 버리게 만드는 것이다
 *
 *   ★ 그래서 이 파일의 규칙은 하나다 — **「확실히 안전할 때만 연다.」**
 *     애매하면 닫는다. 값이 없으면 닫는다. 표가 없어도 닫는다.
 *
 * ⚠ `privacyStatus: "public"` 을 보내도 **감사 전이면 유튜브가 비공개로 되돌린다.**
 *   즉 코드가 「공개로 올린다」고 말해도 그것은 **거짓말**이다. 그 거짓말을 막는 유일한 길은
 *   «감사 통과»를 우리가 따로 적어 두고, 그 표시가 없으면 **아예 안 올리는 것**이다.
 *   (유튜브 API 는 「감사 통과했나」를 물어볼 방법을 주지 않는다 — 그래서 운영자가 적는다.)
 */

export type GateMode = "off" | "review" | "on";

export type Gate = {
  mode: GateMode;
  /**
   * `review` 에서 **올릴 수 있는 사이트 목록.** 여기 없으면 못 올린다.
   * ★ 심사 기간에는 **온스토리 자체 계정·자체 사이트**만 올린다(회장님 확정).
   *   사장님 계정으로 올리면 그분 채널에 죽은 영상이 남는다.
   */
  allowSites: string[];
  /**
   * ★★ **감사를 통과했다고 운영자가 적어 둔 표시.**
   *   이것이 `true` 가 아니면 `mode` 가 `on` 이어도 **아무도 못 올린다.**
   * ⚠ 이 값을 «짐작»으로 켜지 마라. 구글에서 통과 통보를 받은 뒤에만 켠다.
   */
  auditPassed: boolean;
};

export const GATE_DEFAULT: Gate = { mode: "off", allowSites: [], auditPassed: false };

/** 저장된 값이 이상해도 **닫힌 쪽**으로 정리해서 돌려준다 */
export function readGateValue(value: unknown): Gate {
  const v = (value ?? {}) as { mode?: unknown; allowSites?: unknown; auditPassed?: unknown };
  const mode: GateMode = v.mode === "on" || v.mode === "review" ? v.mode : "off";
  const allowSites = Array.isArray(v.allowSites)
    ? v.allowSites.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  /* ⚠ `true` 하나만 통과시킨다. "true"·1·"yes" 는 **안 켠다** — 실수로 켜지는 길을 막는다 */
  return { mode, allowSites, auditPassed: v.auditPassed === true };
}

/**
 * ★★★ **이 설정을 «저장해도» 되나.** (2026-09-13 회장님 지시 2 — 「코드로도 막아라」)
 *
 * `canUpload()` 가 이미 업로드를 막는다. 그런데 그것만으로는
 * **화면에 「정식 공개」라고 적혀 있는데 아무도 못 올리는** 이상한 상태가 남는다.
 * 그 상태를 본 사람은 「고장났다」고 생각하고, 그다음에 하는 일이
 * «감사 표시를 확인 없이 켜는 것»이다. 그래서 **애초에 저장되지 않게** 막는다.
 *
 * ⚠ 문은 **한 번에 하나씩만** 열린다 — 먼저 «감사 통과»를 켜고 저장한 다음,
 *   그러고 나서 «정식 공개»를 고른다. 한 번에 둘 다 켜는 길을 남기지 않는다.
 */
export function canSaveGate(next: Gate): { ok: true } | { ok: false; why: string } {
  if (next.mode === "on" && !next.auditPassed) {
    return {
      ok: false,
      why: "「정식 공개」는 감사 통과 표시를 먼저 켜야 저장됩니다. 구글에서 «통과» 메일을 받으셨나요? 신청서를 «낸 것»만으로는 켜면 안 됩니다 — 그 사이 올라간 영상은 영구히 비공개로 잠기고 되살릴 수 없어요.",
    };
  }
  return { ok: true };
}

export type UploadVerdict =
  | { ok: true; privacy: "public" | "private"; note?: string }
  | { ok: false; why: string; operator?: string };

/**
 * ★★★ **이 사이트가 지금 유튜브에 올려도 되나.**
 *
 * 갈래는 넷뿐이다:
 *   1. `off`                         → 아무도 못 올린다
 *   2. `review` + 허용 목록에 있음    → 올린다. **비공개**로. (온스토리 자체 계정)
 *   3. `review` + 허용 목록에 없음    → **못 올린다.** 올리면 그 사장님 채널에 죽은 영상이 남는다
 *   4. `on`                          → **감사 통과 표시가 있어야만** 올린다. 없으면 못 올린다
 *
 * ⚠ 4번이 이 함수의 핵심이다. 게이트를 `on` 으로 켰다는 것은 「우리가 열었다」는 뜻일 뿐이고,
 *   **유튜브가 열어 줬다는 뜻이 아니다.** 둘을 구분하지 않으면 사장님 영상이 죽는다.
 */
export function canUpload(gate: Gate, siteId: string): UploadVerdict {
  if (gate.mode === "off") {
    return { ok: false, why: "유튜브는 준비 중입니다. 준비되는 대로 열어 드리고 알려드리겠습니다." };
  }

  if (gate.mode === "review") {
    if (!gate.allowSites.includes(siteId)) {
      /* ★ 사장님에게는 「준비 중」이라고만 말한다 — 우리 사정을 설명할 이유가 없고,
         「심사」는 금지어다(회장님). 대신 로그에는 진짜 이유를 남긴다. */
      return {
        ok: false,
        why: "유튜브는 준비 중입니다. 준비되는 대로 열어 드리고 알려드리겠습니다.",
        operator: "준비 기간에는 허용 목록(allowSites)에 있는 사이트만 올릴 수 있어요. 지금 올리면 그 영상은 영영 비공개로 잠깁니다.",
      };
    }
    return {
      ok: true,
      privacy: "private",
      note: "지금은 준비 기간이라 «비공개»로 올라갔어요. 사장님 유튜브에서는 보이지만 손님에게는 아직 안 보입니다.",
    };
  }

  /* mode === "on" */
  if (!gate.auditPassed) {
    /* ★★ 여기가 상무님이 찾은 자리다. 게이트만 켜고 감사 표시를 안 켜면,
       올라간 영상이 **전부 영영 비공개로 잠긴다.** 그래서 막는다.

       ⚠⚠ **「제출했다」와 「통과했다」는 다르다.** (2026-09-13 김팀장 확인)
         신청서를 낸 것만으로는 아무것도 바뀌지 않는다. **통과 메일**을 받아야 한다.
         급한 마음에 「일단 냈으니 켜자」가 바로 이 사고를 부른다 — 그래서 값을 따로 둔다. */
    return {
      ok: false,
      why: "유튜브는 준비 중입니다. 준비되는 대로 열어 드리고 알려드리겠습니다.",
      operator: "게이트가 «정식 공개»인데 감사 통과 표시가 없어요. 이대로 올리면 영상이 영영 비공개로 잠기고 되돌릴 수 없습니다. /admin 에서 감사 통과를 먼저 켜 주세요.",
    };
  }
  return { ok: true, privacy: "public" };
}
