import { createHmac, timingSafeEqual } from "crypto";

/**
 * **미리 만들어 둔 홈페이지를 그 가게 사장님께 넘겨주는 열쇠.** (2026-09-13 회장님 지시 B1·B3)
 *
 * ★★★ **왜 이것이 없으면 장사를 못 하나 — 넘겨줄 길이 아예 없었다.**
 *
 *   회장님이 콜드콜용으로 홈페이지를 미리 만들어 두신다. 사장님이 「좋다」고 하셔도
 *   **그 사장님이 그것을 가져갈 방법이 없었다.** 이유가 둘이다:
 *   ① 가져가기(claim)는 **그 브라우저의 익명표(anonId)** 로만 됐다.
 *      회장님 PC 에서 만든 것이라 익명표도 회장님 PC 에 있다 — 사장님 폰에는 없다.
 *   ② 사장님이 새로 만들면 딴 홈페이지가 된다. 회장님이 공들여 채운 내용이 버려진다.
 *
 * ★★ **그래서 「한 번만 쓰이는 열쇠」다.** 회장님이 사장님께 링크를 하나 보낸다.
 *   그 링크로 들어와 로그인하면 그 홈페이지의 주인이 된다.
 *
 * ★ **「한 번만」이 어떻게 지켜지나 — 표를 새로 만들지 않았다.**
 *   가져가는 순간 그 홈페이지에 `owner_id`(주인)가 박힌다. 그리고 이 열쇠는
 *   **주인이 없는 홈페이지에만** 듣는다(`app/api/auth/handover`). 그러니 두 번째 사람이
 *   같은 링크를 열면 **아무 일도 일어나지 않는다.** 열쇠가 스스로 죽는 것이다.
 *   ⇒ DB 마이그레이션이 필요 없다. (2026-09-13 회장님은 아침에 db push 하실 예정이라
 *      새 표를 하나라도 덜 만드는 것이 낫다.)
 *
 * ⚠ **아무나 가져가면 안 된다.** 링크를 아는 사람만 가져간다. 그래서 주소를 찍어 보는
 *   것으로는 안 되게 **서명(HMAC)** 을 붙인다. 비밀은 서버에만 있다.
 *
 * ⚠ 유효 기간은 **{@link HANDOVER_DAYS}일**이다. 콜드콜하고 「생각해 보겠다」는 답을
 *   들은 뒤 다시 연락드리는 데 걸리는 기간을 잡았다. 지나면 회장님이 다시 뽑으면 된다
 *   (`npx tsx scripts/handover-link.ts <slug>`).
 *
 * ★ 서명 방식은 60초 녹화 링크(`lib/story-link.ts`)와 **같은 틀**이다. 다른 방식을
 *   또 만들면 한쪽만 고쳐진다.
 */

/** 열쇠가 듣는 기간(일). 넘으면 회장님이 다시 뽑는다 */
export const HANDOVER_DAYS = 14;

const DAY_MS = 86_400_000;

function secret(): string {
  const s =
    process.env.STORY_LINK_SECRET?.trim() ||
    process.env.INQUIRY_SALT?.trim() ||
    process.env.ADMIN_KEY?.trim();
  if (!s) throw new Error("handover: STORY_LINK_SECRET(또는 INQUIRY_SALT/ADMIN_KEY) 가 필요하다");
  return s;
}

/** 오늘이 며칠째인가 — 날짜 단위로 서명해 기간을 잰다 */
export function dayIndex(d = new Date()): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/**
 * ⚠ 녹화 링크(`story-link`)와 **다른 문구**를 넣어 섞이지 않게 한다.
 *   같은 비밀을 쓰므로, 문구가 같으면 녹화 링크가 넘겨주기 링크로 둔갑할 수 있다.
 */
function mac(slug: string, day: number): string {
  return createHmac("sha256", secret()).update(`handover|${slug}|${day}`).digest("hex").slice(0, 16);
}

export function signHandover(slug: string, day = dayIndex()): string {
  return `${day}.${mac(slug, day)}`;
}

/** 열쇠가 맞는가 — 서명과 기간만 본다. 「주인이 있나」는 부르는 쪽에서 본다 */
export function verifyHandover(slug: string, k: string | null | undefined): boolean {
  if (!k || !/^[a-z0-9-]{2,30}$/.test(slug)) return false;
  const m = k.match(/^(\d+)\.([0-9a-f]{16})$/);
  if (!m) return false;
  const day = Number(m[1]);
  const now = dayIndex();
  /* ⚠ 앞날짜(now 보다 큰 값)도 막는다 — 서버 시계가 틀리면 영원히 사는 열쇠가 된다 */
  if (day > now || now - day > HANDOVER_DAYS) return false;
  try {
    const a = Buffer.from(m[2]);
    const b = Buffer.from(mac(slug, day));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function handoverUrl(slug: string, origin = "https://onstori.com"): string {
  return `${origin}/claim/${slug}?k=${signHandover(slug)}`;
}
