import * as storage from "@/lib/storage";
import { sniff, type Container } from "@/lib/media-sniff";

/**
 * 올리기 전 **영상 규격 검사**. (2026-09-11)
 *
 * ★ 인스타 요구(회장님 지시 5): 가로 최대 1920 · 300MB 이하 · moov atom 이 앞쪽.
 *   우리는 다시 인코딩할 수단이 없다(자막 워커가 아직 없다). 그래서 **고칠 수는 없고
 *   정확히 «왜 안 되는지»를 말한다.** 조용히 보내 놓고 그쪽에서 거절당하면
 *   사장님은 이유를 영영 모른다.
 *
 * ⚠ 못 잰 것은 **막지 않는다.** 「모르니까 거절」은 멀쩡한 영상을 버린다.
 *   잰 것만 판정하고, 못 잰 항목은 `unknown` 으로 남겨 기록에 적는다.
 */

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_WIDTH = 1920;
/** 박스 머리를 훑을 만큼만 읽는다 — 파일 전체를 받지 않는다 */
const SCAN = 256 * 1024;

const u32 = (b: Uint8Array, o: number) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
const type4 = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** 최상위 박스를 순서대로 훑는다 */
function topBoxes(b: Uint8Array): { type: string; start: number; size: number }[] {
  const out: { type: string; start: number; size: number }[] = [];
  let o = 0;
  while (o + 8 <= b.length) {
    let size = u32(b, o);
    const t = type4(b, o + 4);
    let head = 8;
    if (size === 1) {
      if (o + 16 > b.length) break;
      /* 64비트 크기 — 상위 4바이트는 사실상 0이다(4GB 미만) */
      size = u32(b, o + 12); head = 16;
    }
    if (size === 0) { out.push({ type: t, start: o, size: b.length - o }); break; }
    if (size < head) break;
    out.push({ type: t, start: o, size });
    o += size;
  }
  return out;
}

/** moov 안에서 tkhd 를 찾아 가로폭을 읽는다. 못 찾으면 null */
function widthFromMoov(b: Uint8Array, moovStart: number, moovEnd: number): number | null {
  let best: number | null = null;
  /* tkhd 를 통째로 뒤진다 — trak 중첩을 따라가지 않고 바이트열에서 찾는다.
     ⚠ 거칠지만 안전하다: 잘못 읽으면 null 이 되고, null 이면 막지 않는다. */
  for (let o = moovStart; o + 8 < Math.min(moovEnd, b.length); o++) {
    if (type4(b, o + 4) !== "tkhd") continue;
    const p = o + 8;                       // payload 시작
    if (p + 4 > b.length) continue;
    const version = b[p];
    const off = p + 4 + (version === 1 ? 32 : 20) + 8 + 8 + 36;
    if (off + 8 > b.length) continue;
    const w = u32(b, off) >>> 16;          // 16.16 고정소수
    if (w > 0 && w < 20000) best = Math.max(best ?? 0, w);
  }
  return best;
}

export type VideoCheck = {
  ok: boolean;
  why: string;
  bytes: number | null;
  width: number | null;
  moovFirst: boolean | null;
  /** 진짜 파일 형식 (2026-09-12). 못 재면 null */
  container: Container | null;
};

export async function checkForInstagram(key: string): Promise<VideoCheck> {
  let bytes: number | null = null;
  let width: number | null = null;
  let moovFirst: boolean | null = null;
  let container: Container | null = null;

  /* 크기 — 서명 주소에 HEAD 를 던져 Content-Length 를 읽는다 */
  try {
    const url = await storage.signedGetUrl(key, 300);
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    const len = r.headers.get("content-length");
    if (len) bytes = Number(len) || null;
  } catch { /* 못 재면 null */ }

  /* 박스 순서와 가로폭 */
  try {
    const head = await storage.readHead("private", key, SCAN);
    container = sniff(head).container;
    const boxes = topBoxes(head);
    const iMoov = boxes.findIndex((x) => x.type === "moov");
    const iMdat = boxes.findIndex((x) => x.type === "mdat");
    if (iMoov >= 0 && iMdat >= 0) moovFirst = iMoov < iMdat;
    else if (iMoov >= 0) moovFirst = true;          // mdat 이 아직 안 보인다 = moov 가 앞이다
    if (iMoov >= 0) {
      const m = boxes[iMoov];
      width = widthFromMoov(head, m.start, m.start + m.size);
    }
  } catch { /* 못 재면 null */ }

  const out = { bytes, width, moovFirst, container };

  /* ★★ **형식을 «맨 먼저» 본다** (2026-09-12).
     ⚠ 이걸 안 보면 무슨 일이 벌어지나: 녹화기가 안드로이드·크롬에서 만드는 파일은 **webm** 인데,
       `copyToPublic` 이 그걸 `video-….mp4` 라는 이름에 `video/mp4` 딱지를 붙여 공개 창고에 복사한다.
       인스타는 그 주소를 가져가 열어 보고 «mp4 가 아니다»를 알아채고 거절한다 —
       그때 오는 말은 사장님이 무엇을 고쳐야 하는지 알려 주지 않는다.
       **한도 1개도 이미 써 버린 뒤**다. 그래서 보내기 전에 여기서 막는다.
     ★ 2026-09-12 실측: 지금 저장소에 쌓인 녹화 11건이 **전부 webm** 이다. */
  if (container === "webm" || container === "ogg") {
    return { ok: false, ...out, why: "이 영상은 인스타그램이 받지 않는 형식(webm)이에요. 아이폰 사파리로 찍으면 인스타가 받는 형식(mp4)으로 저장됩니다." };
  }
  if (container === "quicktime") {
    return { ok: false, ...out, why: "폰 기본 카메라로 찍은 영상(mov)이라 인스타그램이 받지 않아요. 녹화 화면에서 바로 찍어 주세요." };
  }

  if (bytes !== null && bytes > MAX_BYTES) {
    return { ok: false, ...out, why: `영상이 너무 커요 (${Math.round(bytes / 1048576)}MB). 인스타그램은 300MB까지만 받아요.` };
  }
  if (width !== null && width > MAX_WIDTH) {
    return { ok: false, ...out, why: `영상 가로가 너무 넓어요 (${width}px). 인스타그램은 1920px까지만 받아요.` };
  }
  if (moovFirst === false) {
    return { ok: false, ...out, why: "영상 파일 구조가 인스타그램이 받는 모양이 아니에요. 다시 찍어 주세요." };
  }
  return { ok: true, why: "", ...out };
}
