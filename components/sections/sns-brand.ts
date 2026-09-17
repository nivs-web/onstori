import type { ShortLink } from "@/lib/shorts";

/**
 * SNS 이름·색의 **단일 출처**. (2026-09-17 지시 [31] 로 한데 모음)
 *
 * ⚠ 전에는 `shorts-feed.tsx` 와 `shorts-stage.tsx` 가 **같은 표를 따로** 들고 있었다.
 *   한쪽만 고치면 화면 둘이 다른 말을 한다. 한 곳으로 모은다.
 * ⚠ **로고 그림을 쓰지 않는다** — 상표 문제가 생긴다. 색 점 하나와 글자로만 구분한다
 *   (`channel-widget.tsx` 가 같은 이유로 직접 그린 도형을 쓴다).
 */

export const SNS_LABEL: Record<ShortLink["provider"], string> = {
  instagram: "인스타에서 보기",
  tiktok: "틱톡에서 보기",
  youtube: "쇼츠에서 보기",
  facebook: "페이스북에서 보기",
  threads: "쓰레드에서 보기",
  x: "X에서 보기",
};

/** 「연결된 SNS 모음」에서 쓰는 **짧은 이름** — 「…에서 보기」가 여섯 번 반복되면 읽기 힘들다 */
export const SNS_SHORT: Record<ShortLink["provider"], string> = {
  instagram: "인스타그램",
  tiktok: "틱톡",
  youtube: "유튜브 쇼츠",
  facebook: "페이스북",
  threads: "쓰레드",
  x: "X",
};

/** 각 SNS 의 상징색 — 알약 버튼 왼쪽 **점 하나**로만 쓴다(로고를 쓰면 상표 문제가 생긴다) */
export const SNS_DOT: Record<ShortLink["provider"], string> = {
  instagram: "#E1306C", tiktok: "#25F4EE", youtube: "#FF0000",
  facebook: "#1877F2", threads: "#FFFFFF", x: "#FFFFFF",
};

/**
 * 🔴 **영상 위에 띄우는 바깥 링크는 «둘»뿐이다.** (2026-09-17 대표님 지시 [31]④)
 *
 * > 「유튜브 쇼츠와 인스타 릴스, 이거 2개가 대한민국에서 가장 많이 쓰니깐 **그거 2개만**.
 * >   **버튼이 6개 이상 뜨면 너무 너저분**할 듯」
 *
 * ⚠ **데이터를 지우지 않는다.** 틱톡·페북 기록은 그대로 쌓이고,
 *   「연결된 SNS 모음」 칸(`shorts-sns.tsx`)에서는 **전부 보인다.** 여기서 «가리기»만 한다.
 */
export const PILL_PROVIDERS: ShortLink["provider"][] = ["instagram", "youtube"];

export function pillLinks(links: ShortLink[]): ShortLink[] {
  return links.filter((l) => PILL_PROVIDERS.includes(l.provider));
}
