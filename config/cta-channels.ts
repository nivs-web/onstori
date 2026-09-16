/**
 * ★★★ **손님 문의를 받는 «CTA(문의 채널)» — 단일 출처.** (2026-09-15 대표님 지시 [3])
 *
 * 대표님: 「이건 매우 중요하다. 우리끼리 용어는 CTA 버튼이다.」
 *
 * 🔴 **`config/owner-channels.ts` 와 다른 것이다. 헷갈리지 마라:**
 *
 * | 파일 | 무엇 | 방향 |
 * |---|---|---|
 * | `config/owner-channels.ts` | 사장님이 **이미 갖고 있는** 채널(플레이스·블로그…) — SEO `sameAs` | 바깥 → 사장님 |
 * | **`config/cta-channels.ts`(여기)** | **손님이 사장님께 연락하는** 버튼(하단 바·최종 CTA) | 손님 → 사장님 |
 *
 * ★ 최대 2개까지만 고른다. `MAX_CTA_CHANNELS` 가 단일 출처다 — 화면(위저드)과
 *   서버(app/api/generate/route.ts)가 **같은 숫자**를 쓴다.
 *
 * ⚠ **저장 위치**: `sites.settings.ctaChannels`. `owner-channels.ts` 의 `settings.channels`
 *   와는 **다른 칸**이다 — `lib/jsonld.ts` 의 `sameAs` 는 이 칸을 읽지 않는다(문의 채널은
 *   SEO 용도가 아니라 손님이 누르는 버튼이다).
 *
 * ⚠ **전화번호가 필요한 항목** (`requiresPublicPhone`) 을 고르면 `settings.phonePublic` 을
 *   함께 켜야 한다 — 안 켜면 `lib/phone-privacy.ts` 가 손님에게 나가는 문서에서 번호를 지워
 *   **버튼은 있는데 눌러도 번호가 없는** 죽은 버튼이 된다(불변 규칙 12 의 정신 — 판정·화면·
 *   힌트가 어긋나면 안 된다). `app/api/generate/route.ts` 가 이 둘을 함께 켠다.
 *
 * ⚠ **문의 버튼 글자는 `config/industries.ts` 의 `INQUIRY_CTA_LABEL` 단일 출처다(대표 결정 R-0001,
 *   2026-09-13 — 「전부 다 문의하기 버튼으로 통일해」). 여기서 "문의하기" 를 새로 타이핑하지 않는다.**
 */

import { isUsableChannelUrl } from "@/config/owner-channels";
import { INQUIRY_CTA_LABEL } from "@/config/industries";

export type CtaChannelKind =
  | "none" // 이미 3단계에서 받은 전화·이메일을 그대로 쓴다 — 추가 입력이 없다
  | "url"; // 채널 자체 주소가 필요하다

export type CtaChannelDef = {
  id: string;
  /** 위저드 카드 제목 */
  label: string;
  /** 카드 아래 한 줄 설명. 대표님 원문이 있는 항목은 원문을 그대로 옮겼다 */
  hint: string;
  kind: CtaChannelKind;
  /** kind === "url" 일 때만 쓰는 입력칸 예시 */
  placeholder?: string;
  /** 하단 고정 바·최종 CTA 버튼에 쓰는 짧은 글자 (8자 안) */
  dockLabel: string;
  /** 골랐을 때 사장님 전화번호를 공개로 바꿔야 하는 항목인가 (call · form_tel) */
  requiresPublicPhone?: boolean;
};

/**
 * ⚠ **차례가 화면 차례다.** 대표님이 주신 일곱(원문 표) 뒤에 권반장이 조사해 권고한 셋을 붙였다.
 *   문구는 표에 적힌 것을 최대한 그대로 옮겼다. 대표님 원문이 없는 셋(당근·네이버예약·문자바로보내기)
 *   은 지시서에 화면 문구가 없어 **짧은 한 줄로 새로 썼다** — 없는 사실(연차·건수)은 넣지 않았다.
 */
export const CTA_CHANNELS: CtaChannelDef[] = [
  {
    id: "form_email",
    label: "문의하기 (메일문의)",
    hint: "이메일 주소로 — 기본 셋팅은 입력하신 메일로 자동 발송됩니다",
    kind: "none",
    dockLabel: INQUIRY_CTA_LABEL,
  },
  {
    id: "form_sms",
    label: "문의하기 (전화번호 비공개)",
    hint: "사장님 전화번호는 공개하지 않지만 문의는 문자로 받으실 수 있습니다",
    kind: "none",
    dockLabel: INQUIRY_CTA_LABEL,
  },
  {
    id: "form_tel",
    label: "문의하기 (전화번호 공개형)",
    hint: "사장님 전화번호를 공개하고 싶으신 분들을 위한 선택입니다",
    kind: "none",
    dockLabel: INQUIRY_CTA_LABEL,
    requiresPublicPhone: true,
  },
  {
    id: "call",
    label: "전화걸기",
    hint: "전화번호가 공개됩니다. 버튼을 누르면 바로 전화 걸기로 연결됩니다",
    kind: "none",
    dockLabel: "전화",
    requiresPublicPhone: true,
  },
  {
    id: "kakao_channel",
    label: "카카오톡 채널",
    hint: "채널 주소를 주세요. 카카오톡 채널은 카카오비즈니스 파트너센터에서 무료로 간단하게 만드실 수 있습니다",
    kind: "url",
    placeholder: "https://pf.kakao.com/_내채널",
    dockLabel: "카카오톡",
  },
  {
    id: "kakao_open",
    label: "오픈채팅",
    hint: "카카오톡 오픈채팅은 간단하게 만들 수 있습니다. 다수와 실시간 소통하세요",
    kind: "url",
    placeholder: "https://open.kakao.com/o/내오픈채팅",
    dockLabel: "오픈채팅",
  },
  {
    id: "naver_talk",
    label: "네이버 톡톡",
    hint: "네이버에서 검색해 오신 손님이 앱을 바꾸지 않고 바로 물어볼 수 있습니다. 네이버 톡톡 파트너센터에서 무료로 만드실 수 있어요",
    kind: "url",
    placeholder: "https://talk.naver.com/ct/내계정",
    dockLabel: "톡톡",
  },
  // ── 여기부터 권반장이 추가로 권고한 셋 ──
  {
    id: "danggeun",
    label: "당근 비즈프로필",
    hint: "당근마켓 비즈프로필 주소를 붙여 주세요",
    kind: "url",
    placeholder: "https://www.daangn.com/kr/biz-profiles/내프로필",
    dockLabel: "당근",
  },
  {
    id: "naver_booking",
    label: "네이버 예약",
    hint: "예약을 받으시면 손님이 여기로 바로 예약하러 갑니다",
    kind: "url",
    placeholder: "https://booking.naver.com/booking/...",
    dockLabel: "예약하기",
  },
  {
    id: "sms_direct",
    label: "문자 바로 보내기",
    hint: "버튼을 누르면 사장님 번호로 문자 보내기 화면이 바로 열립니다",
    kind: "none",
    dockLabel: "문자",
    requiresPublicPhone: true,
  },
];

/** 🔴 **최대 개수 — 화면·서버가 이 숫자 하나만 본다.** 대표님: 「최대 2개까지 선택」 */
export const MAX_CTA_CHANNELS = 2;

export function findCtaChannel(id: string): CtaChannelDef | undefined {
  return CTA_CHANNELS.find((c) => c.id === id);
}

/** 문의 폼(선택)의 기본 입력 칸 — 대표님 원문: 성함·연락처·이메일·문의내용 */
export type CtaFormFields = { name: boolean; phone: boolean; email: boolean; message: boolean };
export const CTA_FORM_DEFAULT: CtaFormFields = { name: true, phone: true, email: true, message: true };

/** 추가 입력칸 이름 최대 길이 — 사장님이 자유롭게 적는 글자다(예: 가격대·미용종류) */
export const CTA_EXTRA_FIELD_MAX = 20;

/**
 * 화면이 보낸 선택을 **서버가 다시 검증**한다(불변 규칙 4의 정신 — 화면 값을 믿지 않는다).
 * ⚠ url 이 필요한 항목인데 쓸 만한 주소가 없으면 그 항목은 버린다 — 죽은 버튼을 만들지 않는다.
 */
export function cleanCtaSelection(
  selected: unknown,
  links: unknown,
): { selected: string[]; links: Record<string, string> } {
  const rawSelected = Array.isArray(selected) ? selected.filter((v): v is string => typeof v === "string") : [];
  const rawLinks = (links ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  const outLinks: Record<string, string> = {};
  for (const id of rawSelected) {
    if (out.length >= MAX_CTA_CHANNELS) break; // 🔴 서버도 2개에서 자른다
    const def = findCtaChannel(id);
    if (!def) continue;
    if (def.kind === "url") {
      const v = rawLinks[id];
      // ⚠ 주소 모양 검사는 `config/owner-channels.ts` 의 `isUsableChannelUrl` 한 곳만 쓴다 —
      //   같은 규칙(https:// 필수)을 두 군데서 따로 두지 않는다(규칙 4).
      if (!isUsableChannelUrl(v)) continue; // 못 쓰는 주소면 그 항목 자체를 버린다
      outLinks[id] = v.trim().slice(0, 300);
    }
    out.push(id);
  }
  return { selected: out, links: outLinks };
}

/** 고른 것 중 하나라도 전화 공개가 필요한가 — generate 라우트가 `settings.phonePublic` 을 함께 켜는 데 쓴다 */
export function ctaNeedsPublicPhone(selected: string[]): boolean {
  return selected.some((id) => findCtaChannel(id)?.requiresPublicPhone === true);
}

/** 문의 폼 추가 입력칸 — 자유 글자 하나. 길이만 자른다(내용 검열은 안 한다) */
export function cleanCtaExtraField(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, CTA_EXTRA_FIELD_MAX) : "";
}

/** 문의 폼 기본 입력 체크 — 넷 중 켠 것만 통과시킨다 */
export function cleanCtaFormFields(v: unknown): CtaFormFields {
  const s = (v ?? {}) as Partial<CtaFormFields>;
  return {
    name: s.name !== false, // 기본 켜짐 — 대표님 원문: 「기본 입력받기만 체크하셔도 됩니다」
    phone: s.phone !== false,
    email: s.email !== false,
    message: s.message !== false,
  };
}
