import type { SiteDocT } from "./schema";

/**
 * **전화번호는 홈페이지에 공개하지 않는다 — 기본이 비공개다.** (2026-09-13 대표님 결정)
 *
 * ★★★ **왜 이 결정이 나왔나.**
 *   어느 사장님도 자기 번호가 홈페이지에 박히는 것을 원하지 않는다. 박히면 **크롤링당해
 *   광고 전화에 쓰인다.** 우리가 만들어 드린 홈페이지가 사장님께 스팸을 끌어오는 물건이
 *   되면 안 된다.
 *
 * ★★ **왜 렌더러를 안 고치고 여기서 지우나.**
 *   번호는 `settings.phone` 에만 있는 것이 아니다. 홈페이지를 만들 때 **섹션 안으로
 *   복사돼 들어간다**(`lib/generate.ts` — 견적 문의 · 오시는 길). 그래서 손님 화면에
 *   번호가 나오는 자리가 **넷**이다:
 *     ① 견적 문의의 「📞 …」 단추      (`components/sections/quote-form.tsx`)
 *     ② 오시는 길의 「전화하기 …」     (`components/sections/index.tsx`)
 *     ③ 위쪽 띠의 전화 단추           (`site-chrome.tsx` ← `contactOf`)
 *     ④ 아래쪽 바의 전화 단추          (같음)
 *   네 곳에 각각 조건을 달면 **한 곳을 빼먹는다.** 대신 손님에게 나가는 자료에서
 *   **번호를 한 번 지운다.** 네 곳 모두 「번호가 없으면 안 보인다」로 이미 돼 있다
 *   (③④는 `telValue("")` → 빈 값 → 단추가 사라진다).
 *
 * ⚠ **표를 새로 만들지 않았다.** `sites.settings` 가 jsonb 라 `settings.phonePublic` 에
 *   넣는다 — **db push 가 필요 없다.**
 * ⚠ 값이 없으면 **비공개**다. 새 홈페이지든 예전 홈페이지든 켜기 전에는 안 나온다.
 * ⚠ 편집화면(사장님 화면)에서는 **지우지 않는다.** 사장님은 자기 번호를 봐야 고친다.
 *   이 함수는 손님에게 나가는 길(`lib/sites.ts`)에서만 부른다.
 */

/** 사장님이 「공개」로 켜 두셨나. 값이 없으면 **비공개**다 */
export function isPhonePublic(settings: unknown): boolean {
  const s = (settings as Record<string, unknown> | null) ?? {};
  return s.phonePublic === true;
}

/**
 * 손님에게 나갈 자료에서 **번호를 지운다.**
 *
 * ⚠ `SiteDoc.parse()` 를 **지난 뒤에** 부른다. 견적 문의의 번호 칸은 스키마상 필수라
 *   («빈 값 금지») 검사 전에 비우면 홈페이지 전체가 안 열린다. 검사를 지난 뒤에
 *   비우는 것은 안전하다 — 화면은 「없으면 안 보인다」로 이미 돼 있다.
 * ⚠ 원본을 건드리지 않고 사본을 돌려준다. 이 자료는 캐시에 얹히므로 원본을 고치면
 *   다른 요청까지 함께 바뀐다.
 */
export function hidePhoneInDoc(doc: SiteDocT): SiteDocT {
  let touched = false;
  const sections = doc.sections.map((s) => {
    if ((s.type === "quoteForm" || s.type === "map") && "phone" in s && s.phone) {
      touched = true;
      return { ...s, phone: "" };
    }
    return s;
  });
  return touched ? { ...doc, sections: sections as SiteDocT["sections"] } : doc;
}

/** 공개면 그대로, 비공개면 지운 사본 — 부르는 쪽이 갈림길을 또 쓰지 않게 한다 */
export function forVisitors(doc: SiteDocT, settings: unknown): SiteDocT {
  return isPhonePublic(settings) ? doc : hidePhoneInDoc(doc);
}
