/**
 * 파일 «머리»로 진짜 형식을 알아낸다 — 브라우저·서버가 **같은 코드**를 쓴다 (2026-09-10, V-1).
 *
 * ★ 왜 필요한가: 회장님 지시 —
 *   「업로드받을 때 형식을 확인해 mp4 가 아니면 «다시 찍어 주세요» 로 되돌려라.
 *     조용히 받아서 나중에 재생이 안 되는 것이 최악이다.」
 *
 * ★ `MediaRecorder.mimeType` 을 믿으면 안 된다. 그건 «우리가 요청한 형식»을 되돌려주는
 *   문자열이지 **실제로 찍힌 파일을 잰 값이 아니다.** 회장님이 `public/mime-check.html` 을
 *   따로 만드신 이유가 정확히 이것이다(docs/specs/mime-check-실측-2026-09-07.md).
 *
 * ★ 판정은 딱 두 자리로 끝난다.
 *   · 0~3바이트 `1A 45 DF A3` → webm/mkv (EBML 머리)
 *   · 4~7바이트 `ftyp` → mp4 계열. **8~11바이트가 무엇인지**로 mp4 와 .mov 를 가른다
 *     - `qt  ` (뒤 두 칸이 공백) = 애플 퀵타임 .mov → **거절**
 *     - `isom`·`mp42`·`avc1` 등 = mp4 → 통과
 *
 * ⚠ 모르는 브랜드는 **거절하지 않는다.** 아는 나쁜 것(.mov·webm·ogg)만 막는다.
 *   「조용히 받는 것이 최악」이지만 「멀쩡한 녹화를 되돌리는 것」도 그만큼 나쁘다 —
 *   사장님은 60초를 이미 쓴 뒤다. 대신 브랜드를 서버 로그에 남겨 나중에 볼 수 있게 한다.
 *
 * ⚠ 이 파일에는 DOM 도 Node API 도 없다. 순수 함수라 양쪽에서 그대로 import 한다.
 */

export type Container = "mp4" | "quicktime" | "webm" | "ogg" | "unknown";

/** 머리를 몇 바이트나 읽으면 되나. ftyp 박스는 보통 24~32바이트라 64면 넉넉하다 */
export const SNIFF_BYTES = 64;

export type Sniff = {
  container: Container;
  /** mp4 계열일 때의 major_brand (예: "isom"). 아니면 빈 문자열 */
  brand: string;
};

const ascii = (h: Uint8Array, o: number): string =>
  h.length >= o + 4 ? String.fromCharCode(h[o], h[o + 1], h[o + 2], h[o + 3]) : "";

/** 파일 앞부분(최소 12바이트)을 보고 컨테이너를 판정한다 */
export function sniff(h: Uint8Array): Sniff {
  if (h.length >= 4 && h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) {
    return { container: "webm", brand: "" };
  }
  if (ascii(h, 0) === "OggS") return { container: "ogg", brand: "" };
  if (ascii(h, 4) === "ftyp") {
    const brand = ascii(h, 8);
    // "qt  " — 애플 퀵타임. 아이폰 «폰 기본 카메라»가 내놓는 것이 이것이다(2026-09-09 실측)
    if (brand.startsWith("qt")) return { container: "quicktime", brand };
    return { container: "mp4", brand };
  }
  return { container: "unknown", brand: "" };
}

/** 손님 사이트에서 재생할 수 있는가 — 영상은 mp4 만, 소리만 녹음한 것은 예외 */
export const isPlayableVideo = (s: Sniff): boolean => s.container === "mp4";

/** 사장님에게 보여줄 한 줄. 어려운 말을 쓰지 않는다 */
export function whyNotPlayable(s: Sniff): string {
  switch (s.container) {
    case "quicktime":
      return "폰 기본 카메라로 찍은 영상이라 손님 폰에서 안 열릴 수 있어요. 이 화면에서 바로 찍어 주세요.";
    case "webm":
    case "ogg":
      return "이 브라우저가 만든 영상은 아이폰 손님에게 검은 화면으로 보여요. 크롬이나 사파리로 열어 다시 찍어 주세요.";
    default:
      return "영상이 제대로 저장되지 않았어요. 한 번만 다시 찍어 주세요.";
  }
}

/** 저장할 때 쓸 확장자 */
export function extOf(s: Sniff, fallback = "mp4"): string {
  switch (s.container) {
    case "mp4": return "mp4";
    case "quicktime": return "mov";
    case "webm": return "webm";
    case "ogg": return "ogg";
    default: return fallback;
  }
}
