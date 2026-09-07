import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/server";
import { sbAdmin } from "@/lib/db-admin";
import { LogoutButton, MyCardActions } from "./ui";
import { trialInfo, COPY } from "@/lib/trial";
import { SITES_PER_ACCOUNT } from "@/config/limits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "마이페이지 — 온스토리" };

type MySite = {
  slug: string;
  business_name: string;
  published_at: string | null;
  updated_at: string;
  status: string;
  trial_ends_at: string | null;
  paid_at: string | null;
  settings: Record<string, unknown> | null;
};

/** 계정 표시 이름 — 카카오는 닉네임, 이메일 로그인은 주소 */
function displayName(meta: Record<string, unknown>, email?: string) {
  const nick = meta.name ?? meta.nickname ?? meta.full_name;
  return typeof nick === "string" && nick.trim() ? nick : (email ?? "내 계정");
}

/** 미리 찍어 둔 스크린샷 주소 — 첫 페이지 테마 카드가 쓰는 것과 **같은 것**을 재사용한다 */
function shotOf(settings: Record<string, unknown> | null): string | null {
  const shots = settings?.shots as { pc?: string } | undefined;
  return typeof shots?.pc === "string" ? shots.pc : null;
}

/** 상태 배지 — 계산은 lib/trial.ts 하나만 쓴다(규칙 9). 여기서 새로 세지 않는다. */
function badgeOf(site: MySite): { label: string; bg: string; fg: string } {
  const t = trialInfo(site);
  if (t.paid) return { label: "정회원", bg: "var(--green-700)", fg: "var(--n-0)" };
  if (t.expired) return { label: "정지됨", bg: "var(--terra)", fg: "var(--n-0)" };
  if (!site.published_at) return { label: "작성 중", bg: "var(--n-100)", fg: "var(--text)" };
  const urgent = t.daysLeft <= 3;
  return {
    label: `무료 D-${t.daysLeft}`,
    bg: urgent ? "var(--terra)" : "var(--green-50)",
    fg: urgent ? "var(--n-0)" : "var(--green-700)",
  };
}

/**
 * 고객 대시보드.
 *
 * ★ 목표는 하나다 — **사장님이 주소창에 `/edit` 를 직접 치는 일이 없어야 한다.**
 *   소상공인에게 그건 불가능하다. 로그인하면 자기 홈페이지가 사진으로 보이고,
 *   [수정하기] 한 번이면 편집 화면이다.
 *
 * ⚠ 카드는 **한 장만** 그린다. 한 계정에 홈페이지 하나이기 때문이다(config/limits.ts).
 */
export default async function MyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fmy");

  // 데이터 접근은 service-role + 서버 세션 검증 (CLAUDE.md 아키텍처 유지)
  const { data } = await sbAdmin()
    .from("sites")
    .select("slug, business_name, published_at, updated_at, status, trial_ends_at, paid_at, settings")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const all = (data ?? []) as MySite[];
  const sites = all.slice(0, SITES_PER_ACCOUNT);
  /* ⚠ 규칙보다 많이 가진 옛 계정이 있을 수 있다. 화면에서 **지우지는 않는다**(규칙 10 정신) —
     아래에 작은 글씨로 몇 개가 더 있는지 알려 준다. */
  const extra = all.length - sites.length;

  return (
    <main className="min-h-svh surface-50">
      <header className="border-b" style={{ borderColor: "var(--n-200)", background: "var(--n-0)" }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="t-h3 font-extrabold tracking-tight">온스토리</Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6" style={{ paddingBlock: "var(--s-7)" }}>
        <h1 className="t-h2">내 홈페이지</h1>
        <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--text-soft)" }}>
          {displayName(user.user_metadata ?? {}, user.email)}님으로 로그인했어요.
        </p>

        {sites.length === 0 ? (
          <div
            className="card text-center"
            style={{ marginTop: "var(--s-7)", padding: "var(--s-8) var(--s-6)" }}
          >
            <p className="t-h3">아직 만든 홈페이지가 없어요</p>
            <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>
              가게 이름과 사진만 있으면 5분 만에 완성됩니다.
            </p>
            <Link href="/new" className="btn btn-primary" style={{ marginTop: "var(--s-6)" }}>
              홈페이지 만들기 — 무료
            </Link>
          </div>
        ) : (
          sites.map((s) => {
            const t = trialInfo(s);
            const badge = badgeOf(s);
            const shot = shotOf(s.settings);
            return (
              <article key={s.slug} className="card" style={{ marginTop: "var(--s-6)", padding: "var(--s-5)" }}>
                <div className="grid items-start sm:grid-cols-[240px_1fr]" style={{ gap: "var(--s-5)" }}>
                  {/* 미리보기 — 첫 페이지 테마 카드와 **같은 브라우저 틀**을 쓴다.
                      부품을 새로 만들지 않는다(globals.css .tcard-bar / .tcard-url). */}
                  <div className="tcard" style={{ pointerEvents: "none" }}>
                    <span className="tcard-bar" aria-hidden>
                      <i /><i /><i />
                      <span className="tcard-url">onstori.com/{s.slug}</span>
                    </span>
                    {shot ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="tcard-shot" src={shot} alt={`${s.business_name} 홈페이지 화면`} />
                    ) : (
                      /* 아직 안 찍힌 사이트 — 카드가 무너지지 않게 자리는 지킨다 */
                      <span
                        className="tcard-shot flex items-center justify-center t-caption"
                        style={{ height: "100%", background: "var(--n-100)", color: "var(--text-soft)" }}
                      >
                        미리보기 준비 중
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center" style={{ gap: "var(--s-2)" }}>
                      <h2 className="t-h3 truncate">{s.business_name}</h2>
                      <span
                        className="t-caption font-bold"
                        style={{ background: badge.bg, color: badge.fg, borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-3)" }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--text-soft)" }}>
                      onstori.com/{s.slug}
                    </p>
                    <p className="t-small" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>
                      {t.paid
                        ? `정회원 · 매달 ${COPY.priceOnly} 자동 결제`
                        : t.expired
                          ? "결제하시면 바로 다시 공개됩니다."
                          : `무료 기간이 ${t.daysLeft}일 남았어요. 이후 ${COPY.priceLine}입니다.`}
                    </p>

                    <MyCardActions slug={s.slug} trial={t} />
                  </div>
                </div>
              </article>
            );
          })
        )}

        {extra > 0 && (
          <p className="t-caption" style={{ marginTop: "var(--s-4)", color: "var(--text-soft)" }}>
            이 계정에 홈페이지가 {extra}개 더 있어요. 한 계정에 하나로 정리하는 중입니다 — 문의 주시면 도와드릴게요.
          </p>
        )}
      </div>
    </main>
  );
}
