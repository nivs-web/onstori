import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero } from "@/components/site/chrome";
import { notFound } from "next/navigation";
import { CUSTOM_PRODUCTS, priceLabel, daysLabel, VAT_NOTE, CUSTOM_PAGE_OPEN } from "@/config/custom-products";
import { BIZ } from "@/config/company";

export const metadata: Metadata = {
  title: "맞춤 제작 — 온스토리",
  description: "홈페이지를 손봐 드립니다. 기본 손질 · 섹션 추가 · 맞춤 디자인 · 기능 제작 네 가지. 금액과 제공 기간을 먼저 공개합니다.",
};

/**
 * 맞춤 제작 판매 — 단건 결제 상품 4종 (2026-09-16 권반장 지시 [14]).
 *
 * ★★ **왜 만드나:** 토스페이먼츠 **일반결제(단건) 계약 심사**에 필요하다.
 *   심사는 「홈페이지에 결제 가능한 상품이 올라가 있을 것」과
 *   「구매자가 **서비스제공기간**을 인지할 수 있도록 상품페이지에 명확히 기재되어 있을 것」을 요구한다.
 *
 * 🔴 **결제 버튼을 붙이지 않았다.** 우리에겐 **빌링(정기결제) 상점아이디만** 있고
 *   **단건 결제 상점아이디가 없다.** 지금은 [문의하고 견적 받기]로만 받는다.
 *   ⚠ `lib/toss.ts` · `app/api/billing/*` 를 **건드리지 않았다** — 정기결제가 심사 중이다.
 *
 * ★ 값의 단일 출처는 `config/custom-products.ts` 다. 금액·기간을 이 파일에 적지 마라.
 * ★ 사업자정보는 `SiteFooter` 가 이미 그린다(`config/company.ts` 의 `BIZ`).
 */
export default function CustomPage() {
  /* 🔴 **2026-09-17 대표님 지시 [26] — 토스 구독 심사가 끝날 때까지 숨긴다.**
     심사관이 49만원짜리 상품을 보면 「최고가가 구독료라면서요?」로 걸린다.
     ⚠ 화면을 지우지 않는다. 스위치(`config/custom-products.ts`) 하나로 되살아난다.
     ⚠ `notFound()` 라 **404** 다 — 검색에도 안 올라간다(`noindex` 보다 확실하다). */
  if (!CUSTOM_PAGE_OPEN) notFound();

  return (
    <main className="min-h-svh surface-0">
      <PromoBar />
      <SiteHeader />
      <PageHero
        kicker="맞춤 제작"
        title={<>손이 필요한 곳은,<br />저희가 대신 해 드립니다.</>}
        sub="온스토리 홈페이지는 사장님이 직접 고치실 수 있습니다. 그래도 손이 안 가거나 더 하고 싶은 것이 있으면 맡겨 주세요. 닙스(nivs.com)가 26년 해 온 일입니다."
      />

      {/* ───────── 상품 네 가지 ───────── */}
      <section className="surface-0 reveal" style={{ paddingBottom: "var(--s-8)" }}>
        <div className="wrap grid" style={{ gap: "var(--s-4)" }}>
          {CUSTOM_PRODUCTS.map((p) => (
            <article key={p.id} className="card" style={{ padding: "var(--s-5)" }}>
              <div className="flex flex-wrap items-baseline justify-between" style={{ gap: "var(--s-2)" }}>
                <h2 className="t-h3">{p.name}</h2>
                <p className="t-h3" style={{ color: "var(--brand-ink)" }}>
                  {priceLabel(p)}{" "}
                  {/* 🔴 부가세 표기 — 빼지 마라. 안 적으면 분쟁이 난다 */}
                  <span className="t-caption font-normal" style={{ color: "var(--text-soft)" }}>({VAT_NOTE})</span>
                </p>
              </div>
              <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>{p.what}</p>
              {/* 🔴 제공 기간 — 토스 심사 요건이다. 빼지 마라 */}
              <p className="t-small" style={{ marginTop: "var(--s-3)", color: "var(--text-soft)" }}>
                제공 기간 · <b style={{ color: "var(--text)" }}>{daysLabel(p)}</b>
                {" "}(사장님이 자료를 주신 날부터 셉니다)
              </p>
              {/* 🔴 결제 버튼이 «아니다». 단건 결제 상점아이디가 아직 없다(지시 [14]) */}
              <a
                href={`mailto:${BIZ.email}?subject=${encodeURIComponent(`[맞춤 제작 문의] ${p.name}`)}&body=${encodeURIComponent(
                  `홈페이지 주소(onstori.com/○○○):\n무엇을 바꾸고 싶으신가요:\n연락 받을 번호:\n`,
                )}`}
                className="btn btn-secondary w-full"
                style={{ marginTop: "var(--s-4)" }}
              >
                문의하고 견적 받기
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── 어떻게 진행되나 ───────── */}
      <section className="surface-50 section reveal">
        <div className="wrap">
          <h2 className="t-h2">어떻게 진행되나요</h2>
          <ol className="t-body" style={{ marginTop: "var(--s-5)", color: "var(--text)", display: "grid", gap: "var(--s-3)" }}>
            <li><b>① 문의</b> — 위 [문의하고 견적 받기]를 누르시면 메일 창이 열립니다. 홈페이지 주소와 바꾸고 싶은 것을 적어 보내 주세요.</li>
            <li><b>② 확인</b> — 저희가 홈페이지를 보고 <b>영업일 1일 안에</b> 답을 드립니다. 네 가지 중 어디에 해당하는지, 더 드는 것이 있는지 먼저 말씀드립니다.</li>
            <li><b>③ 결제</b> — 금액에 동의하시면 그때 결제 안내를 드립니다.</li>
            <li><b>④ 제작</b> — 위에 적힌 제공 기간 안에 끝내 드립니다. 끝나면 사장님이 먼저 보시고, 고칠 곳이 있으면 한 번 더 손봐 드립니다.</li>
          </ol>
          <p className="t-small" style={{ marginTop: "var(--s-5)", color: "var(--text-soft)" }}>
            ⚠ 지금은 <b>문의만 받습니다.</b> 화면에서 바로 결제하시는 길은 준비 중입니다.
          </p>
        </div>
      </section>

      {/* ───────── 환불·약관 ───────── */}
      <section className="surface-0 section reveal">
        <div className="wrap">
          <h2 className="t-h2">환불</h2>
          {/* 🔴 법률 문구다. 권반장 지시로 넣었고 **대표님 확인 전**이다(보고서 §4). */}
          <p className="t-body measure" style={{ marginTop: "var(--s-4)", color: "var(--text)" }}>
            결제하신 날부터 <b>7일 이내</b>에는 청약철회를 하실 수 있습니다. 다만 사장님 요청에 맞춰
            <b> 제작이 이미 시작된 뒤에는</b> 전자상거래법 제17조 제2항에 따라 청약철회가 제한될 수 있습니다.
            그때는 진행 상황을 먼저 알려 드리고 상의합니다. 자세한 내용은{" "}
            <Link href="/terms" className="underline underline-offset-2">이용약관</Link>에 있습니다.
          </p>
          <p className="t-small" style={{ marginTop: "var(--s-4)", color: "var(--text-soft)" }}>
            문의 · <a href={`mailto:${BIZ.email}`} className="underline underline-offset-2">{BIZ.email}</a>
            {" · "}
            <a href={`tel:${BIZ.phone.replace(/[^0-9]/g, "")}`} className="underline underline-offset-2">{BIZ.phone}</a>
          </p>
        </div>
      </section>

      {/* 사업자정보는 여기서 그린다 — 상호·등록번호·주소를 손으로 적지 않는다(config/company.ts) */}
      <SiteFooter />
    </main>
  );
}
