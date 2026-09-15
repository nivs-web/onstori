/**
 * **로고 SVG 에 글꼴을 «심는다».** (2026-09-16 대표님 지시 [5])
 *
 * ★★★ **왜 필요한가 — 안 심으면 사장님이 고른 로고와 다른 로고가 나간다.**
 *
 *   저장된 로고는 `<img src="…logo.svg">` 로 쓰인다. 그렇게 쓰이는 SVG 는 **바깥 글꼴을 못 부른다** —
 *   우리 웹폰트(Pretendard)도, 구글 폰트도 안 먹는다. 그러면 **보는 사람 컴퓨터에 있는 글꼴**로
 *   그려진다. 한국 사장님 PC 에 Pretendard 는 거의 없으므로 실제로는 「맑은 고딕」이 된다.
 *
 *   ⇒ 위저드 미리보기(인라인 SVG, 웹폰트 먹음)와 **저장된 로고가 달라진다.**
 *     대표님이 「기본으로 나온 글자 로고의 품질이 만족스러워야 해」라고 하신 것이 바로 여기서 깨진다.
 *
 * ★ 그래서 **글꼴 파일을 SVG 안에 `@font-face` 로 심는다.** 그러면 어디서 봐도 같다.
 *
 * ★★ **용량을 어떻게 줄였나:** Pretendard 는 `unicode-range` 로 **92조각**으로 쪼개져 있다
 *   (`app/fonts.css`). 상호에 쓰인 글자가 든 조각만 고르면 보통 **1~2조각(30~60KB)** 이다.
 *   전체(2.8MB)를 심는 것과 비교하면 50분의 1이다.
 *
 * ⚠ **Pretendard 만 심는다.** 나머지 글꼴은 저장소에도 R2 에도 파일이 없다 —
 *   그것들은 심을 것이 없어서 예전처럼 «보는 사람 컴퓨터의 글꼴»로 그려진다.
 *   그 사실은 `docs/WAITING.md` 에 적어 두었다.
 *
 * ⚠ 이 파일은 **브라우저에서** 돈다(위저드가 저장 직전에 부른다). `fetch` 로 조각을 받는다.
 */

/** `app/fonts.css` 를 그대로 읽어 「글자 → 조각 주소」 지도를 만든다 */
type Chunk = { url: string; ranges: [number, number][] };
let rangeMap: Chunk[] | null = null;

async function loadRangeMap(): Promise<Chunk[]> {
  if (rangeMap) return rangeMap;
  /**
   * 🔴 **`/fonts.css` 로는 못 받는다.** Next 가 `app/fonts.css` 를 번들에 넣어 버려서
   *   그 주소는 **404** 다(2026-09-16 운영에서 실측). 그래서 빌드 때 뽑아 둔 지도를 받는다
   *   (`scripts/build-font-ranges.mjs` → `prebuild`).
   * ⚠ 이 파일이 없으면 글꼴을 못 심고 **미리보기와 다른 로고**가 저장된다.
   */
  try {
    const res = await fetch("/fonts/pretendard/ranges.json", { cache: "force-cache" });
    rangeMap = res.ok ? ((await res.json()) as Chunk[]) : [];
  } catch {
    rangeMap = [];
  }
  return rangeMap;
}
/** 이 글자들을 그리는 데 필요한 조각 주소들 */
async function chunksFor(text: string): Promise<string[]> {
  const map = await loadRangeMap();
  if (!map.length) return [];
  const need = new Set<string>();
  for (const ch of new Set([...text])) {
    const cp = ch.codePointAt(0)!;
    const hit = map.find((m) => m.ranges.some(([a, b]) => cp >= a && cp <= b));
    if (hit) need.add(hit.url);
  }
  return [...need];
}

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

/** 심을 것이 너무 커지면 포기한다 — 로고 한 장이 수백 KB 가 되면 안 된다 */
const MAX_EMBED_BYTES = 200 * 1024;

/**
 * **로고 SVG 에 Pretendard 를 심어 돌려준다.**
 *
 * ⚠ 실패해도 **던지지 않는다.** 심지 못하면 원본을 그대로 준다 — 로고가 아예 안 만들어지는 것보다
 *   「글꼴이 다른 로고」가 낫다. 가입 흐름을 멈추면 안 된다.
 */
export async function embedPretendard(svgText: string, usedText: string): Promise<string> {
  /* Pretendard 를 쓰는 로고가 아니면 심을 것이 없다 */
  if (!/Pretendard/i.test(svgText)) return svgText;

  try {
    const urls = await chunksFor(usedText);
    if (!urls.length) return svgText;

    const faces: string[] = [];
    let total = 0;
    for (const u of urls) {
      const res = await fetch(u, { cache: "force-cache" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      total += buf.byteLength;
      if (total > MAX_EMBED_BYTES) break;         // 너무 크면 거기까지만
      faces.push(
        `@font-face{font-family:'Pretendard Variable';font-style:normal;font-weight:400 700;` +
        `src:url(data:font/woff2;base64,${toBase64(buf)}) format('woff2-variations')}`,
      );
    }
    if (!faces.length) return svgText;

    /* ⚠ `<style>` 는 `<svg>` 바로 안, 그림보다 «앞»에 와야 한다 */
    return svgText.replace(/(<svg[^>]*>)/, `$1<style>${faces.join("")}</style>`);
  } catch {
    return svgText;                                // 심기 실패는 조용히 넘어간다
  }
}
