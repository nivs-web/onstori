/**
 * ★★★ **사장님이 «이미 운영 중인» 다른 채널 — 단일 출처.** (2026-09-15 대표님 지시로 신설)
 *
 * 🔴 **`config/channels.ts` 와 헷갈리지 마라. 둘은 완전히 다른 것이다:**
 *
 * | 파일 | 무엇 | 방향 |
 * |---|---|---|
 * | `config/channels.ts` | **우리가 영상을 «내보내는» 곳** (유튜브 쇼츠·인스타 릴스·틱톡…) | 온스토리 → 바깥 |
 * | **`config/owner-channels.ts`(여기)** | **사장님이 이미 갖고 있는 곳** (플레이스·블로그·스마트스토어…) | 바깥 → 사장님 홈페이지 |
 *
 * ⚠ 2026-09-15 에 권반장이 실제로 헷갈려 `channels.ts` 를 **통째로 덮어썼다.** git 으로 되살렸다.
 *   **파일을 새로 만들기 전에 그 이름이 이미 있는지 먼저 확인하라.**
 *
 * ★ 대표님 말씀 그대로:
 *   「홈페이지는 모든 채널의 최종 종착지입니다. 다양한 채널에서 홍보를 도와주고,
 *    실적은 홈페이지에서 쌓입니다! … 다양한 연결을 하면 홈페이지에 **플로팅으로 위젯처럼
 *    공중에 뜨게** 만들 거야. 클릭하면 연결되는 거야.」
 *
 * ★★ **이것은 위젯이 아니라 «SEO 엔진»이다 — 이 파일의 진짜 존재 이유다.**
 *
 *   2026-09-15 에 경쟁사 **홈ON(homon.co.kr)** 의 원본 HTML 을 받아 뜯어봤다. 고객 사이트가
 *   네이버 상단에 뜨는 가장 큰 이유가 구조화 데이터의 `sameAs` 였다 —
 *   **「이 홈페이지는 저 네이버 블로그·저 네이버 지도 가게와 같은 업체다」**를 알려 주는 줄이다.
 *
 *   네이버는 그 가게를 **플레이스로 이미 알고 있다.** 새 홈페이지를 처음부터 알아봐 달라고
 *   조르는 것보다 **이미 아는 것에 붙는 것**이 압도적으로 빠르다.
 *   (보고서: `fable51plandept/AI_Context/BANJANG/SEO-홈온-분석-2026-09-15.md`)
 *
 * ⇒ 여기서 받은 주소는 **두 곳에 동시에** 쓰인다:
 *   ① 홈페이지의 **떠 있는 채널 위젯** (`components/sections/channel-widget.tsx`)
 *   ② **구조화 데이터의 `sameAs`** (`lib/jsonld.ts`) — 검색엔진에 보내는 기계 쪽지
 *
 * ⚠ **저장 위치를 바꾸지 마라.** `sites.settings.channels[id]` 다. `lib/jsonld.ts` 가 그 자리를 읽는다.
 * ⚠ **`https://` 로 시작하는 것만 싣는다.** 우리가 추측해서 채우면 틀린 가게와 이어질 수 있고,
 *   그건 구글·네이버가 **스팸으로 본다.** 사장님이 직접 넣은 것만이다.
 */

export type OwnerChannelDef = {
  id: string;
  /** 화면에 보이는 이름 */
  label: string;
  /** 칸 아래 한 줄 설명. ⚠ 대표님 방침 — **부가적으로 길게 쓰지 않는다** */
  hint: string;
  /** 입력칸에 흐리게 보이는 예시 */
  placeholder: string;
  /** 위젯 원 안의 글자 — 그림 파일을 안 쓴다(아래 주석 참고) */
  mark: string;
  /** 위젯 원 색 */
  color: string;
};

/**
 * ⚠ **차례가 화면 차례다.** 사장님이 가장 많이 가진 것부터 위에 둔다 —
 *   첫 두세 개만 채우고 넘어가시는 분이 대부분이다.
 * ★ 네이버 플레이스가 맨 위인 이유: **SEO 로 가장 값지다**(위 주석 참고).
 */
export const OWNER_CHANNELS: OwnerChannelDef[] = [
  {
    id: "naverPlace",
    label: "네이버 플레이스",
    hint: "네이버 지도에서 내 가게를 열고 주소창의 주소를 붙여 주세요. 검색에 가장 큰 도움이 됩니다.",
    placeholder: "https://map.naver.com/p/entry/place/...",
    mark: "N", color: "#03C75A",
  },
  {
    id: "instagram",
    label: "인스타그램",
    hint: "연결할 인스타그램 주소를 입력해 주세요.",
    placeholder: "https://instagram.com/내계정",
    mark: "IG", color: "#E1306C",
  },
  {
    id: "naverBlog",
    label: "네이버 블로그",
    hint: "블로그 글이 쌓여 있으면 검색에서 서로 끌어 줍니다.",
    placeholder: "https://blog.naver.com/내아이디",
    mark: "B", color: "#03C75A",
  },
  {
    id: "youtube",
    label: "유튜브",
    hint: "채널 주소를 넣으시면 영상이 홈페이지와 이어집니다.",
    placeholder: "https://youtube.com/@내채널",
    mark: "YT", color: "#FF0000",
  },
  {
    id: "naverBooking",
    label: "네이버 예약",
    hint: "예약을 받으시면 손님이 바로 예약 화면으로 갑니다.",
    placeholder: "https://booking.naver.com/...",
    mark: "예약", color: "#03C75A",
  },
  {
    id: "naverMap",
    label: "네이버 지도 (길찾기)",
    hint: "찾아오시는 손님이 바로 길찾기를 누를 수 있습니다.",
    placeholder: "https://naver.me/...",
    mark: "길", color: "#2DB400",
  },
  {
    id: "smartStore",
    label: "스마트스토어",
    hint: "파시는 물건이 있으면 구매 페이지로 이어집니다.",
    placeholder: "https://smartstore.naver.com/내스토어",
    mark: "S", color: "#03C75A",
  },
];

/**
 * 주소 하나가 쓸 만한가 — **화면과 서버가 같은 것을 쓴다.**
 * ⚠ 일부러 느슨하다. 플랫폼이 주소 모양을 자주 바꾸는데 우리가 조이면
 *   **멀쩡한 주소가 막힌다.** 그게 틀린 주소 하나를 받는 것보다 나쁘다.
 * ⚠ 다만 `https://` 는 양보하지 않는다 — `http://` 는 손님 브라우저가 경고를 띄운다.
 */
export function isUsableChannelUrl(v: unknown): v is string {
  return typeof v === "string" && /^https:\/\/\S{4,300}$/.test(v.trim());
}

/**
 * 사장님이 넣은 것만 골라 **깨끗하게** 만든다.
 * ⚠ 서버에서도 이것을 통과시킨다 — 화면 값을 믿지 않는다(불변 규칙 4의 정신).
 */
export function cleanOwnerChannels(input: unknown): Record<string, string> {
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const c of OWNER_CHANNELS) {
    const v = src[c.id];
    if (isUsableChannelUrl(v)) out[c.id] = v.trim().slice(0, 300);
  }
  return out;
}
