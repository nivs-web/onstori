import { createClient } from "@supabase/supabase-js";
import { getSiteBySlug } from "@/lib/sites";
import { PortfolioTabs } from "./portfolio-ui";

/**
 * 랜딩 포트폴리오 — 폰 프레임 안에서 실제 사이트가 라이브로 스크롤되는 쇼케이스.
 * 목록은 어드민(/admin/showcase)에서 URL 등록·태그·순서·추천으로 관리.
 *
 * ★ 첫 화면에 뜨려면 아래 자격 조건을 통과해야 한다 (2026-09-06 회장님 지시).
 *   showcase 표에 행이 있는 것만으로는 부족하다 — 미완성 테스트 사이트가 저절로
 *   손님 첫 화면에 뜨는 사고를 막는다(실제로 bls 가 전화 010-0000-0000 인 채로 떠 있었다).
 */
export type ShowcaseItem = { slug: string; tag: string; featured: boolean; name: string; pc?: string; phone?: string };

/**
 * 자동 편입 조건: 공개 중(trial·active) + 전화번호가 자리표시가 아님.
 * ALLOW 에 적힌 슬러그는 이 조건을 건너뛴다 — 온스토리가 직접 만든 시연용 샘플이라
 * 아직 결제 전(trial)이어도 첫 화면에 둔다.
 */
const ALLOW = new Set(["sample-interior", "moksu"]);

/** 0000·1111 처럼 반복되거나 안내 문구가 들어간 번호는 자리표시로 본다 */
function realPhone(v: unknown): boolean {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (digits.length < 9) return false;
  if (/^(\d)\1+$/.test(digits)) return false;               // 전부 같은 숫자 (0000000000 등)
  if (/0{4,}$/.test(digits)) return false;                  // 010-0000-0000 류
  return true;
}

export async function loadShowcase(): Promise<ShowcaseItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await sb
      .from("showcase")
      .select("slug, tag, featured, sort")
      .order("featured", { ascending: false })
      .order("sort", { ascending: true })
      .limit(24);
    // 전화번호는 sites.settings 에 있다 — 공개 렌더용 SiteDoc 에는 없어서 따로 읽는다
    const slugs = (data ?? []).map((r) => r.slug);
    const { data: meta } = slugs.length
      ? await sb.from("sites").select("slug, status, settings").in("slug", slugs)
      : { data: [] };
    const bySlug = new Map((meta ?? []).map((m) => [m.slug as string, m]));

    const items = await Promise.all(
      (data ?? []).map(async (r) => {
        if (!ALLOW.has(r.slug)) {
          const m = bySlug.get(r.slug) as { status?: string; settings?: { phone?: string } } | undefined;
          // 정지된 사이트, 전화가 자리표시인 사이트는 첫 화면에 올리지 않는다
          if (!m || m.status === "expired") return null;
          if (!realPhone(m.settings?.phone)) return null;
        }
        const site = await getSiteBySlug(r.slug);
        if (!site) return null as ShowcaseItem | null;
        // 미리 찍은 스크린샷 — 없으면 카드가 사진 없이 뜬다(그래도 화면은 안 깨진다)
        const sh = (bySlug.get(r.slug) as { settings?: { shots?: { pc?: string; phone?: string } } } | undefined)?.settings?.shots;
        return { slug: r.slug, tag: r.tag, featured: r.featured, name: site.doc.businessName, pc: sh?.pc, phone: sh?.phone };
      }),
    );
    return items.filter((x): x is ShowcaseItem => !!x);
  } catch {
    return [];
  }
}

export async function Portfolio({ items }: { items?: ShowcaseItem[] }) {
  const list = items ?? (await loadShowcase());
  if (list.length === 0) return null;
  return (
    <section id="portfolio">
      <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ textWrap: "balance" }}>온스토리로 만든 홈페이지</h2>
      <p className="mt-2 t-body" style={{ color: "var(--muted)" }}>
        {/* ⚠ 전에는 "안을 직접 스크롤해보세요" 였다. iframe 을 걷어낸 뒤로는 안에서 스크롤할 수
            없으니 그대로 두면 거짓말이 된다. 실제 동작(마우스 올리면 내려감)으로 고쳐 적는다.
            ★ 2026-09-11 — **폰에는 마우스가 없다**(박팀장 발견). 기기에 따라 말을 바꾼다.
            ⚠ 「화면 폭」이 아니라 **「마우스가 있느냐」**로 가른다. 아이패드는 폭이 넓어도
              마우스가 없어서, 폭으로 가르면 태블릿 사장님에게 또 거짓말을 하게 된다.
              CSS 만으로 갈라 손님 사이트에 자바스크립트를 한 글자도 더하지 않는다. */}
        <span className="say-touch">눌러서 실제 사이트를 볼 수 있어요.</span>
        <span className="say-hover">마우스를 올리면 화면이 아래로 내려가요. 누르면 진짜 사이트가 열립니다.</span>
        {/* ⚠ 실고객 사이트가 아니라는 사실은 계속 밝힌다 — 빼면 남의 실적처럼 보인다.
            "샘플"이라는 낱말만 쓰지 않는다 (2026-09-07 회장님). 규칙 7 취지는 그대로다. */}
        {" "}(온스토리가 직접 만든 화면입니다.)
      </p>
      <PortfolioTabs items={list} />
    </section>
  );
}
