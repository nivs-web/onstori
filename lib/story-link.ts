import { createHmac, timingSafeEqual } from "crypto";

/**
 * 60초 녹화 링크 서명 — DB 없이 검증 (기획1 /mainplan #rec · 2026-09-05)
 * onstori.com/rec/{slug}?k={주차}.{HMAC12}
 * 주차 단위라 그 주(+지난 주)에만 유효. "링크를 여는 것이 곧 로그인" — 카톡 인앱은 카메라가 안 되므로 크롬 안내.
 * 비밀은 STORY_LINK_SECRET → 없으면 INQUIRY_SALT → ADMIN_KEY 순으로 쓴다 (env 추가 없이도 돈다).
 */
function secret(): string {
  const s = process.env.STORY_LINK_SECRET?.trim() || process.env.INQUIRY_SALT?.trim() || process.env.ADMIN_KEY?.trim();
  if (!s) throw new Error("story-link: STORY_LINK_SECRET(또는 INQUIRY_SALT/ADMIN_KEY) 가 필요하다");
  return s;
}

export function weekIndex(d = new Date()): number {
  return Math.floor(d.getTime() / (7 * 86_400_000));
}

function mac(slug: string, week: number): string {
  return createHmac("sha256", secret()).update(`${slug}|${week}`).digest("hex").slice(0, 12);
}

export function signStoryLink(slug: string, week = weekIndex()): string {
  return `${week}.${mac(slug, week)}`;
}

export function verifyStoryLink(slug: string, k: string | null | undefined): boolean {
  if (!k || !/^[a-z0-9-]{2,30}$/.test(slug)) return false;
  const m = k.match(/^(\d+)\.([0-9a-f]{12})$/);
  if (!m) return false;
  const week = Number(m[1]);
  const now = weekIndex();
  if (week !== now && week !== now - 1) return false; // 이번 주·지난 주만
  try {
    const a = Buffer.from(m[2]); const b = Buffer.from(mac(slug, week));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export function storyLinkUrl(slug: string, origin = "https://onstori.com"): string {
  return `${origin}/rec/${slug}?k=${signStoryLink(slug)}`;
}
