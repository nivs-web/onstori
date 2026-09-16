import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getSiteForAdmin } from "@/lib/sites";
import { PALETTES, RenderSection, onColor } from "@/components/sections";
import { SiteChrome } from "@/components/sections/site-chrome";

/**
 * ★★★ **비공개 홈페이지 보관실 — `/x/{상호}`** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀 그대로:
 *   「돈을 안 내서 기간이 지났는데 결제를 안 한 고객은 **나중에 돈을 낼 수도 있는 고객**이다.
 *    절대로 바로 삭제되면 안 됨. **우리는 그 어떤 사이트도 삭제하지 않는다.**
 *    단, 권한을 아예 없애서 **관리자만 볼 수 있는 곳**으로 바꾼다.
 *    도메인도 `onstori.com/x/sample-interior` 이런 식으로 비공개 사이트 주소를 정해서
 *    그쪽으로 이동해서 관리한다. 나중에 돈을 낼 수도 있으니 **살려 둬야 함.**」
 *
 * ★★ **세 갈래를 분명히 해 둔다 — 헷갈리면 사고가 난다**
 *
 * | 누가 | `/{상호}` 에서 보는 것 | `/x/{상호}` 에서 보는 것 |
 * |---|---|---|
 * | 손님 | 「쉬고 있어요」 안내만 (`components/sections/paused`) | **로그인 화면.** 내용 한 글자도 안 나간다 |
 * | 운영자 | 같음 | **홈페이지 원본 그대로** |
 *
 * ★ **자물쇠가 둘이다. 하나가 뚫려도 안 샌다:**
 *   ① 이 화면이 `isAdmin()` 을 먼저 본다. 아니면 **자료를 읽기 전에** 404 로 끝낸다
 *   ② `getSiteForAdmin()` 이 운영자 열쇠를 쓰지만, ①을 지나야만 불린다
 *   ⚠ 순서를 바꾸지 마라. 읽고 나서 판단하면 그 사이에 새어 나갈 길이 생긴다.
 *
 * ★ **되살리는 데 할 일이 없다.** 결제가 들어오면 `status` 가 `active` 로 돌아가고
 *   `/{상호}` 가 곧바로 원래대로 열린다. 자료를 옮기거나 복구하는 절차가 **없다** —
 *   애초에 아무것도 지우지 않았기 때문이다.
 */
export const dynamic = "force-dynamic";

/** 🔴 비공개 보관실이다. 검색에 **절대** 걸리면 안 된다 */
export const metadata: Metadata = {
  title: "비공개 홈페이지 — 온스토리",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivateSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /* 🔴 자물쇠 ① — 자료를 읽기 «전»에 본다. 운영자가 아니면 «이 주소는 없는 것»이다.
     ⚠ 「권한이 없습니다」라고 알려 주지 않는다. 그 말 자체가 «여기 뭔가 있다»는 힌트다. */
  if (!(await isAdmin())) notFound();

  const site = await getSiteForAdmin(slug);
  if (!site) notFound();

  const p = PALETTES[site.doc.theme.palette];
  const accent = site.doc.theme.accent ?? p.accent;
  const vars = {
    "--s-bg": p.bg, "--s-ink": p.ink, "--s-muted": p.muted, "--s-line": p.line,
    "--s-accent": accent, "--s-soft": p.soft,
    "--s-on-accent": onColor(accent),
  } as React.CSSProperties;

  /** 상태를 사람 말로. 운영자가 «왜 내려갔는지»를 한눈에 알아야 한다 */
  const 상태말 =
    site.realStatus === "expired" ? "무료 기간이 끝나 내려간 홈페이지"
    : site.realStatus === "suspended" ? "해지·미결제로 내려간 홈페이지"
    : site.realStatus === "active" ? "지금 정상으로 열려 있는 홈페이지"
    : "아직 발행 전인 홈페이지";

  const 열려있음 = site.realStatus === "trial" || site.realStatus === "active";

  return (
    <div style={vars}>
      {/* 운영자 전용 머리띠 — 손님은 여기까지 못 온다. 그래서 편하게 정보를 넣는다 */}
      <div
        className="t-small"
        style={{ padding: "var(--s-3) var(--gutter)", background: "var(--n-900)", color: "var(--n-0)" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <b>비공개 보관실</b>
          <span>·</span>
          <span>{site.businessName || slug}</span>
          <span>·</span>
          <span>{상태말}</span>
          <span>·</span>
          {/* 되살리는 길·고치는 길을 같은 줄에 둔다 — 보관실에 와서 할 일은 이 둘뿐이다 */}
          <a className="underline" href={`/${slug}/edit`}>내용 고치기</a>
          {열려있음 && <a className="underline" href={`/${slug}`}>공개 주소로 보기</a>}
          <a className="underline" href="/admin/sites">사이트 목록</a>
        </div>
        <p className="mt-1 text-center" style={{ opacity: 0.75 }}>
          손님에게는 이 주소가 보이지 않습니다. 자료는 지워지지 않았고, 결제가 들어오면 그대로 다시 열립니다.
        </p>
      </div>

      <main
        className="relative min-h-svh"
        style={{
          background: "var(--s-bg)",
          /* ⚠ 손님 화면과 달리 위를 항상 비운다 — 머리띠가 이미 자리를 먹었다 */
          paddingTop: "var(--bar-h)",
          paddingBottom: "var(--dock-pad)",
          fontFamily: "var(--font-body)",
        }}
      >
        <SiteChrome doc={site.doc} businessName={site.doc.businessName} logo={site.logo} />
        {site.doc.sections.map((s, i) => (
          <RenderSection key={i} s={s} index={i} ctx={{ doc: site.doc, stories: site.stories, slug, shorts: site.shorts }} />
        ))}
      </main>
    </div>
  );
}
