import { isPhonePublic } from "./phone-privacy";
import type { SiteData } from "./sites";

/**
 * **지역 업체 구조화 데이터(JSON-LD)** — 검색 결과에 상호·주소를 함께 띄우기 위한 것.
 * (2026-09-13 김팀장 지시서 `구조화데이터-JSON-LD-지시서.md` · 회장님 지시 11)
 *
 * ★ 쉬운 말로: 홈페이지에는 사람이 읽는 글만 있어서, 검색엔진은 「이 글자가 상호인지
 *   전화번호인지」를 **추측**해야 한다. 이것은 그 답을 페이지 안에 **기계용 쪽지**로 적어 두는 것이다.
 *   동네 장사에는 이것이 가장 값진 SEO 요소다(지도 검색에 잡힐 확률이 올라간다).
 *
 * ★★ 원칙: **모르는 값은 넣지 않는다.** 구글은 「페이지에 안 보이는 정보」나 「틀린 정보」를
 *   구조화 데이터에 넣는 것을 스팸으로 본다. 빈 값을 넣느니 키를 빼는 게 낫다.
 *
 * ⚠ **영업시간(openingHours)은 일부러 뺐다.** `hoursCard.hours` 가 자유 문장이라
 *   「평일 9시~6시, 일요일 휴무」 같은 글을 기계 형식으로 옮기다 틀리면 그게 더 나쁘다.
 *   요일별 입력으로 바꾸는 것이 먼저다(불변 규칙 2 — 스키마·에디터·렌더러를 함께 고치는 일).
 * ⚠ **별점(aggregateRating)·후기(review)는 넣지 않는다** — 불변 규칙 7.
 */
export function localBusinessJsonLd(site: SiteData, settings: Record<string, unknown>): string | null {
  /* 발행 안 된 체험 사이트는 noindex 라 구조화 데이터도 의미가 없다 */
  if (site.status !== "active") return null;
  /* ★ 예시 홈페이지를 «진짜 업체»로 검색엔진에 알리지 않는다 — 구글이 스팸으로 본다 */
  if (site.sample) return null;

  const secs = site.doc.sections;
  const hero = secs.find((s) => s.type === "hero");
  const map = secs.find((s) => s.type === "map");
  const quote = secs.find((s) => s.type === "quoteForm");

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  /**
   * ★★★ **번호는 «공개»로 켜 두신 분만 싣는다.** (2026-09-13 대표님 결정 3)
   *
   * ⚠ 김팀장 지시서의 원안은 \`settings.phone\` 을 그냥 실었다. 그 사이에 대표님이
   *   **「전화번호를 홈페이지에 공개하지 않는다」**로 정하셨다. 그대로 실으면
   *   **화면에서는 숨긴 번호를 검색엔진에는 넘겨주는** 꼴이 된다 — 숨긴 의미가 없어진다.
   * ★ 김팀장도 같은 것을 확인해 뒀다: 구글 공식 문서의 **필수는 이름과 주소 둘뿐**이고
   *   \`telephone\` 은 «권장»이다. 빼도 구조화 데이터가 깨지지 않는다
   *   (`★전화번호-미공개-SEO영향.md`).
   * ⚠ 화면용 자료(`site.doc`)의 번호는 이미 비워져서 온다(lib/phone-privacy.ts).
   *   그래도 여기서 한 번 더 본다 — 자물쇠는 둘이어야 한다.
   */
  const phone = isPhonePublic(settings)
    ? (str(settings.phone)
      ?? (quote && "phone" in quote ? str(quote.phone) : undefined)
      ?? (map && "phone" in map ? str(map.phone) : undefined))
    : undefined;

  /**
   * ⚠ **이메일은 넣지 않는다.** 김팀장이 같은 경고를 남겼다 —
   *   `settings.notify.email` 은 **사장님이 알림을 받는 주소**라 공개용이 아니다.
   *   그것을 실으면 사장님 개인 메일이 검색에 노출된다.
   *   「손님이 연락할 주소」를 따로 받는 칸이 생기면 그때 넣는다.
   */

  const address = str(settings.address)
    ?? (map && "address" in map ? str(map.address) : undefined);

  const description = str(settings.oneLiner)
    ?? (hero && "sub" in hero ? str(hero.sub) : undefined);

  const image = (hero && "image" in hero ? str(hero.image) : undefined) ?? str(settings.logo);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.doc.businessName,
    url: `https://onstori.com/${site.slug}`,
  };
  if (description) data.description = description;
  if (image) data.image = image;
  if (phone) data.telephone = phone;
  if (address) {
    data.address = { "@type": "PostalAddress", streetAddress: address, addressCountry: "KR" };
  }

  /**
   * ★★★ **XSS 를 막는 줄이다. 지우지 마라.** (김팀장 지시서 그대로)
   *   상호·주소는 사장님이 직접 친 글자다. 그 안에 `</script>` 가 들어오면 스크립트 태그가
   *   거기서 끊기고 그 뒤가 **코드로 실행된다.** `JSON.stringify` 만으로는 안 막힌다 —
   *   `<` 를 유니코드로 바꿔야 한다.
   */
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
