import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero, CtaBand } from "@/components/site/chrome";

export const metadata: Metadata = { title: "리뷰 — 온스토리", description: "첫 14일을 써 보신 사장님들의 이야기를 기다립니다. 없는 후기를 만들지 않습니다." };

/**
 * 리뷰 — 레멘토 Reviews 구조(태그 필터 · 카드). 지금은 실후기 0건 → 없는 후기를 만들지 않는다 (기획1 /mainplan #reviews).
 * 실후기가 들어오면 여기 REVIEWS 배열에 사장님 승인분만 추가한다. 별점 없음(CLAUDE.md 규칙 7).
 */
const TAGS = ["전체", "시공·출장", "카페·식당", "뷰티·케어", "교육·레슨", "기타"];
const REVIEWS: { name: string; industry: string; region: string; body: string; slug?: string }[] = [];

export default function ReviewsPage() {
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader current="/reviews" />
      <PageHero kicker="리뷰" title="사장님들의 이야기" sub="온스토리는 별점을 받지 않습니다. 후기는 사장님이 직접 남긴 글과 영상만, 사장님 승인 뒤에 올립니다.">
        <div className="mt-6 flex flex-wrap gap-2" aria-label="분류">
          {TAGS.map((t, i) => <span key={t} className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold" style={{ borderColor: "var(--line)", background: i === 0 ? "var(--forest)" : "#fff", color: i === 0 ? "var(--cream)" : "var(--forest)" }}>{t}</span>)}
        </div>
      </PageHero>

      <section className="wrap pb-20">
        {REVIEWS.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed bg-white p-10 text-center" style={{ borderColor: "var(--line)" }}>
            <p className="font-display text-[24px]" style={{ color: "var(--forest)" }}>첫 14일을 써 보신 사장님의 이야기를 기다립니다</p>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
              아직 후기가 없습니다. 없는 후기를 만들어 채우지 않습니다. 첫 사장님 10분의 홈페이지와 60초 영상이 이 자리에 올라옵니다 — 사장님 가게 링크와 함께.
            </p>
            <Link href="/new" className="btn-lime mt-6">첫 10명에 들어가기 (14일 무료)</Link>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <li key={r.name} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
                <p className="text-[11.5px] font-bold tracking-[0.14em]" style={{ color: "var(--teal)" }}>{r.industry} · {r.region}</p>
                <p className="mt-2 text-[15px] leading-relaxed">{r.body}</p>
                <p className="mt-3 text-[13px] font-semibold">{r.name} {r.slug && <Link href={`/${r.slug}`} className="underline">홈페이지</Link>}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <p className="md:col-span-3 text-[12px] font-bold tracking-[0.18em]" style={{ color: "var(--teal)" }}>이런 사장님께 — 후기가 아니라 저희가 생각하는 첫 손님입니다</p>
          {[
            ["홈페이지는 있는데 손님이 없는 사장님", "만든 지 1년, 방문자 하루 3명. 새 페이지가 안 생기니 검색도 안 됩니다."],
            ["글은 못 쓰지만 말은 잘하는 사장님", "블로그 쓰라는 말은 많이 들었는데 한 번도 못 썼습니다. 말은 매일 합니다."],
            ["유튜브를 시작하고 싶은데 편집이 무서운 사장님", "60초 찍으면 자막과 컷 편집은 온스토리가 합니다."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-[15.5px] font-bold" style={{ color: "var(--forest)" }}>{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand title="사장님 이야기가 이 페이지의 첫 줄이 됩니다" />
      <SiteFooter />
    </main>
  );
}
