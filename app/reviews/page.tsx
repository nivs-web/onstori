import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "리뷰 — 온스토리", description: "첫 30일을 써 보신 사장님들의 이야기를 기다립니다. 없는 후기를 만들지 않습니다." };

/**
 * 리뷰 — 레멘토 Reviews 구조(태그 필터 · 카드). 지금은 실후기 0건 → 없는 후기를 만들지 않는다 (기획1 /mainplan #reviews).
 * 실후기가 들어오면 여기 REVIEWS 배열에 사장님 승인분만 추가한다. 별점 없음(CLAUDE.md 규칙 7).
 */
const TAGS = ["전체", "시공·출장", "카페·식당", "뷰티·케어", "교육·레슨", "기타"];
const REVIEWS: { name: string; industry: string; region: string; body: string; slug?: string }[] = [];

export default function ReviewsPage() {
  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader current="/reviews" />
      <PageHero kicker="리뷰" title="사장님들의 이야기" sub="온스토리는 별점을 받지 않습니다. 후기는 사장님이 직접 남긴 글과 영상만, 사장님 승인 뒤에 올립니다.">
        <div className="flex flex-wrap" style={{ marginTop: "var(--s-5)", gap: "var(--s-2)" }} aria-label="분류">
          {TAGS.map((t, i) => (
            <span
              key={t}
              className="t-small flex items-center font-semibold"
              style={{
                border: "1px solid var(--n-200)", borderRadius: "var(--r-full)",
                padding: "0 var(--s-4)", minHeight: "var(--tap)",
                background: i === 0 ? "var(--n-800)" : "var(--n-0)",
                color: i === 0 ? "var(--n-0)" : "var(--n-700)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </PageHero>

      <section className="surface-0 reveal" style={{ paddingBottom: "var(--s-8)" }}>
        <div className="wrap">
          {REVIEWS.length === 0 ? (
            <div
              className="text-center"
              style={{ border: "2px dashed var(--n-200)", background: "var(--n-0)", borderRadius: "var(--r-lg)", padding: "var(--s-7) var(--s-5)" }}
            >
              <p className="t-h2">첫 30일을 써 보신 사장님의 이야기를 기다립니다</p>
              <p className="t-body measure mx-auto" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>
                아직 후기가 없습니다. 없는 후기를 만들어 채우지 않습니다. 첫 사장님 10분의 홈페이지와 60초 영상이 이 자리에 올라옵니다 — 사장님 가게 링크와 함께.
              </p>
              <div style={{ marginTop: "var(--s-5)" }}>
                {/* 페이지 끝 CtaBand 가 이 페이지의 주 버튼이다 — 한 화면에 초록이 둘 잡혀서 보조로 내린다 */}
                <Link href="/new" className="btn btn-secondary">첫 10명에 들어가기 (30일 무료)</Link>
              </div>
            </div>
          ) : (
            <ul className="grid md:grid-cols-3" style={{ gap: "var(--s-4)" }}>
              {REVIEWS.map((r) => (
                <li key={r.name} className="card" style={{ padding: "var(--s-5)" }}>
                  <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>{r.industry} · {r.region}</p>
                  <p className="t-body" style={{ marginTop: "var(--s-2)" }}>{r.body}</p>
                  <p className="t-small font-semibold" style={{ marginTop: "var(--s-3)" }}>
                    {r.name} {r.slug && <Link href={`/${r.slug}`} className="btn btn-text">홈페이지</Link>}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="t-caption font-bold" style={{ marginTop: "var(--s-7)", color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>
            이런 사장님께 — 후기가 아니라 저희가 생각하는 첫 손님입니다
          </p>
          <div className="grid md:grid-cols-3" style={{ marginTop: "var(--s-4)", gap: "var(--s-4)" }}>
            {[
              ["홈페이지는 있는데 손님이 없는 사장님", "만든 지 1년, 방문자 하루 3명. 새 페이지가 안 생기니 검색도 안 됩니다."],
              ["글은 못 쓰지만 말은 잘하는 사장님", "블로그 쓰라는 말은 많이 들었는데 한 번도 못 썼습니다. 말은 매일 합니다."],
              ["유튜브를 시작하고 싶은데 편집이 무서운 사장님", "60초 찍으면 자막과 컷 편집은 온스토리가 합니다."],
            ].map(([t, d]) => (
              <div key={t} className="card" style={{ padding: "var(--s-5)" }}>
                <h3 className="t-h3" style={{ textWrap: "balance" }}>{t}</h3>
                <p className="t-body" style={{ marginTop: "var(--s-2)", color: "var(--text)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand title="사장님 이야기가 이 페이지의 첫 줄이 됩니다" />
      <SiteFooter />
    </main>
  );
}
