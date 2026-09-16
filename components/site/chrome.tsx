import Link from "next/link";
import { BIZ } from "@/config/company";
import { CHANNELS } from "@/config/channels";
import { COPY } from "@/lib/trial";
import { Logo } from "./logo";
import { SiteHeaderClient } from "./header-client";
/* ★ 채널 로고는 `blocks.tsx` 한 곳에서만 그린다 — 띠와 푸터가 갈라지면 또 한쪽만 고쳐진다.
   (2026-09-11 에 채널 «목록»이 두 군데라 갈라졌던 것과 같은 실수를 로고로 되풀이하지 않는다) */
import { ChannelIcon, channelLabel, CHANNEL_ICONS_OFF } from "./blocks";

/**
 * 본사 페이지 공용 크롬 — 헤더·프로모 띠·푸터.
 * 첫 페이지·작동방식·온스토리·FAQ·리뷰·블로그·비교 페이지가 전부 이 파일을 쓴다.
 *
 * 색·간격·글자는 app/globals.css 의 토큰만 쓴다 (CLAUDE.md 규칙 11 · docs/DESIGN.md).
 */

export const NAV = [
  { href: "/how-it-works", label: "작동방식" },
  { href: "/our-story", label: "온스토리" },
  { href: "/faq", label: "자주묻는질문" },
  { href: "/reviews", label: "리뷰" },
  { href: "/blog", label: "블로그" },
] as const;

/* ★★ 2026-09-11 — 채널 목록을 여기에 **두지 않는다.** `config/channels.ts` 하나가 단일 출처다.
   전에는 같은 목록이 두 군데 있어 순서·표기가 갈라져 있었다. 다시 갈라지지 않게
   여기서는 가져다 쓰기만 하고, 옛 이름으로 부르던 코드를 위해 그대로 내보낸다. */
export { CHANNELS };

export { Logo };

/** 상단 프로모 띠 — 높이를 고정한다. 조건부로 나타나면 아래가 통째로 밀린다(CLS). */
export function PromoBar() {
  return (
    <Link
      href="/new"
      className="flex items-center justify-center text-center t-caption font-semibold"
      style={{ height: "var(--s-7)", background: "var(--n-800)", color: "var(--n-0)", paddingInline: "var(--s-4)" }}
    >
      {/* 높이 한 줄에 맞춰 폰에서는 뒷문장을 접는다 — 잘린 문장을 보여주는 것보다 낫다 */}
      <span className="truncate">
        오픈 기념 — {COPY.trialShort} · 이후 {COPY.priceLine}
        <span className="hidden sm:inline"> · 사장님 이야기부터 들려주세요</span> →
      </span>
    </Link>
  );
}

/**
 * 헤더 — 화면은 클라이언트 쪽이 그린다(스크롤·시트).
 *
 * ★ 여기서 **세션을 읽지 않는다.** 전에는 `getSessionUser()` 를 불렀는데, 그게 쿠키를 읽는
 *   바람에 **이 헤더를 쓰는 모든 페이지가 요청마다 다시 그려졌다.**
 *   첫 페이지 TTFB 가 1.85~2.23초였던 진짜 원인이다(2026-09-07 실측.
 *   헤더가 없는 /how-it-works 는 같은 조건에서 0.28초였다).
 *   로그인 여부는 [로그인]/[마이페이지] 글자 하나를 바꾸는 데만 쓰인다 —
 *   그것 때문에 손님 전원에게 2초를 물릴 이유가 없다. 브라우저에서 확인한다.
 */
export function SiteHeader({ current }: { current?: string }) {
  return <SiteHeaderClient nav={NAV} current={current} />;
}

export function SiteFooter() {
  return (
    <footer className="surface-900">
      <div
        className="wrap grid md:grid-cols-[1.4fr_1fr_1fr]"
        style={{ gap: "var(--s-7)", paddingBlock: "var(--s-8)" }}
      >
        <div>
          {/* ⚠ 푸터 로고는 priority 를 끈다 — 페이지 맨 아래라 preload 할 이유가 없다 */}
          <Logo variant="dark" height={22} priority={false} />
          <p className="t-small measure" style={{ marginTop: "var(--s-3)", color: "var(--n-300)" }}>
            홈페이지는 빈 집입니다. 스토리에는 진짜 사람이 있습니다.<br />
            사장님이 들려주시는 스토리가 사업을 굴러가게 만듭니다.
          </p>
          {/* ★ 2026-09-16 로고 복구 — 끄는 방법은 blocks.tsx 의 `CHANNEL_ICONS_OFF` 한 줄이다.
              ⚠ 푸터는 **어두운 바탕**이라 검은 로고(X·쓰레드·틱톡)가 그냥 두면 안 보인다 → `onDark`.
              ⚠ 칩이 작아 아이콘도 14px 로 줄인다(띠는 18px). 준비 중인 곳은 흐리게 + (준비 중). */}
          <p className="flex flex-wrap" style={{ marginTop: "var(--s-4)", gap: "var(--s-2)" }}>
            {CHANNELS.map((c) => (
              <span
                key={c.id}
                className="t-caption flex items-center"
                style={{
                  border: "1px solid var(--n-700)", color: "var(--text-soft)",
                  borderRadius: "var(--r-full)", padding: "var(--s-1) var(--s-3)",
                  gap: "var(--s-2)",
                }}
              >
                <ChannelIcon id={c.id} live={c.live} onDark size={14} />
                {channelLabel(c)}
              </span>
            ))}
          </p>
        </div>
        <FooterCol title="둘러보기" links={[["/how-it-works", "작동방식"], ["/#portfolio", "완성 예시"], ["/#pricing", "가격"], ["/faq", "자주묻는질문"], ["/reviews", "리뷰"], ["/blog", "블로그"]]} />
        <FooterCol title="회사" links={[["/our-story", "온스토리"], ["/privacy", "개인정보처리방침"], ["/terms", "이용약관"], ["/login", "로그인"], ["/my", "마이페이지"], ["/admin", "운영자"]]} />
      </div>
      {/* ── 아래칸 — 왼쪽 사업자 정보 · 오른쪽 동그란 소셜 (2026-09-16 대표님 지시) ──
          ⚠ PC 는 `1fr auto` 두 단, 폰은 한 단으로 **쌓인다.** 둘 다 폭을 스스로 정하지 않아
             («칸 하나가 몇 px» 같은 값을 적지 않았다) 가로 스크롤이 생길 자리가 없다. */}
      <div style={{ borderTop: "1px solid var(--n-800)" }}>
        <div
          className="wrap grid md:grid-cols-[1fr_auto] md:items-start"
          style={{ gap: "var(--s-5)", paddingBlock: "var(--s-6)" }}
        >
          <BizBlock />
          <SocialRow />
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--n-800)" }}>
        <div className="wrap t-caption" style={{ paddingBlock: "var(--s-4)" }}>
          © {new Date().getFullYear()} 온스토리 onstori.com · 문의: 카카오톡 채널 (준비 중)
        </div>
      </div>
    </footer>
  );
}

/**
 * 사업자 정보 — 전자상거래법 제10조 표시 의무. **값의 단일 출처는 `config/company.ts`.**
 *
 * ★ 왜 줄을 나눴나 (2026-09-16)
 *   전에는 `BIZ_LINE` **한 줄**을 오른쪽 구석에 통째로 붙이고 있었다. 90자가 넘어서
 *   좁은 화면에서 **줄이 아무 데서나 끊겼다** — 「사업자등록번」/「호 139-…」처럼.
 *   항목마다 줄을 나누면 **끊길 자리를 우리가 정한다.** 폰에서도 읽히는 이유가 이것이다.
 *
 * ★★ 밝기를 «3단»으로 쓴다 — 라벨(밝게) · 값(한 톤 아래) · 구분자(가장 흐리게).
 *   정보가 다섯 줄인데도 시끄럽지 않은 이유가 이 하나다. 눈이 라벨을 먼저 잡고 값을 나중에 읽는다.
 *   ⚠ 값 색을 따로 적지 않는다 — 어두운 면에서는 `.t-caption` 이 이미 `--n-400`(7.51:1)이다.
 */
function BizBlock() {
  return (
    <div className="t-caption grid" style={{ gap: "var(--s-2)" }}>
      <p><BizItem label="상호" value={BIZ.name} /><BizBar /><BizItem label="대표" value={BIZ.ceo} /></p>
      <p><BizItem label="사업자등록번호" value={BIZ.bizNo} /><BizBar /><BizItem label="통신판매업신고" value={BIZ.mailOrderNo} /></p>
      <p><BizItem label="주소" value={BIZ.address} /></p>
      <p>
        {/* ★ 폰에서 번호를 누르면 바로 걸린다. 손님 대부분이 폰으로 본다 */}
        <BizItem label="전화" value={<a href={`tel:${BIZ.phone}`} className="hover:underline">{BIZ.phone}</a>} />
        <BizBar />
        <BizItem label="이메일" value={<a href={`mailto:${BIZ.email}`} className="hover:underline">{BIZ.email}</a>} />
      </p>
      <p><BizItem label="호스팅" value={BIZ.hosting} /></p>
    </div>
  );
}

/** 「라벨 · 값」 한 쌍. ⚠ flex 를 쓰지 않는다 — 글 흐름 그대로 두어야 긴 주소가 **글자 사이에서** 접힌다 */
function BizItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span style={{ color: "var(--n-200)" }}>{label}</span>
      <span style={{ color: "var(--n-500)" }}> · </span>
      {value}
    </>
  );
}

/** 한 줄 안에서 항목을 가르는 막대. ⚠ 아주 흐리다 — 이건 «선»이 아니라 «숨 쉴 자리»다 */
function BizBar() {
  return <span aria-hidden style={{ color: "var(--n-700)", paddingInline: "var(--s-3)" }}>|</span>;
}

/* ════════ 푸터 소셜 — 온스토리 «우리» 계정 (2026-09-16 대표님 지시: remento 식 동그란 아이콘) ════════ */

/**
 * ★★ `config/channels.ts` 의 **`CHANNELS` 와 다른 것**이다. 한 목록으로 합치지 마라.
 *   - `CHANNELS` = 사장님 이야기가 **나가는 곳**. 우리가 파는 기능이다 (위칸 칩).
 *   - `SOCIAL`   = **온스토리 회사 계정**. 손님이 우리를 따라오는 곳이다 (아래칸 동그라미).
 *   상표가 겹쳐 보여도 뜻이 달라서, 묶으면 둘 중 하나가 반드시 거짓말이 된다.
 *
 * 🔴 **`href` 가 `null` 인 줄은 화면에 나오지 않는다.** 일부러 그렇게 만들었다. 이유가 둘이다:
 *   ① 우리 계정이 **아직 없다.** `docs/specs/meta-앱심사-진행.md` 기준으로 인스타는 개인 계정
 *      (`nivs_poem`) 뿐이고 「온스토리 계정이 아니다」라고 적혀 있다. 카카오톡 채널도 미개설이다.
 *      **없는 주소를 지어내지 않는다.**
 *   ② `blocks.tsx` 가 이미 적어 둔 위험 그대로 — **유튜브 브랜드 규칙은 로고를 쓰면
 *      «유튜브로 가는 링크»일 것을 요구한다.** 눌러도 아무 데도 안 가는 로고를 걸면 그 규칙에 걸린다.
 *
 * ★ 계정이 열리면 **그 줄의 `null` 을 주소로 바꾸기만 하면** 그날부터 동그라미가 보인다. 그게 전부다.
 * ★ `id` 는 `config/channels.ts` 와 **같은 글자**를 쓴다 — 로고를 `blocks.tsx` 의 `ChannelIcon`
 *   하나에서 가져오기 때문이다. ⚠ 로고를 여기에 다시 그리지 않는다(띠·칩·동그라미가 갈라진다).
 */
type SocialDef = { id: string; name: string; href: string | null };

const SOCIAL: SocialDef[] = [
  { id: "youtube", name: "유튜브", href: null },
  { id: "instagram", name: "인스타그램", href: null },
  { id: "tiktok", name: "틱톡", href: null },
  { id: "threads", name: "쓰레드", href: null },
  { id: "x", name: "X", href: null },
  { id: "facebook", name: "페이스북", href: null },
];

/**
 * 동그란 소셜 아이콘 — remento 실측값을 우리 토큰으로 옮겼다.
 *   지름 32px = `var(--s-6)` · 사이 간격 24px = `var(--s-5)` · hover 0.6 을 200ms(`var(--dur-2)`)에 걸쳐.
 *
 * ⚠ remento 는 **«꽉 찬 원판»이 SVG 파일 안에** 들어 있다(`border-radius` 가 한 군데도 없다).
 *   그대로 베끼면 원판 버전이 없는 로고는 영영 못 넣는다. 그래서 우리는 반대로 간다 —
 *   **원은 CSS 로 그리고 로고를 그 안에 얹는다.** 채널이 늘고 줄어도 따라온다.
 * ⚠ 원판을 **흰색**으로 두는 이유: 상표색 로고(유튜브 빨강·인스타 자주·페북 파랑)는
 *   어두운 푸터 위에서 흐려진다. 흰 원 위에 얹어야 상표색 그대로 또렷하게 알아본다.
 * ⚠ 폰에서는 원(32px)이 손가락보다 작다 → **겉을 `var(--tap)`(48px)로 키워** 누를 자리를 넓힌다.
 *   PC 에서는 끈다(`md:min-h-0`) — 안 그러면 푸터만 길어진다(globals.css `.tap-row` 와 같은 이유).
 */
function SocialRow() {
  /* 주소가 없는 곳과, 브랜드 심사로 로고를 끈 곳은 **빈 흰 동그라미**가 되므로 아예 뺀다 */
  const shown = SOCIAL.filter(
    (s): s is SocialDef & { href: string } => !!s.href && !CHANNEL_ICONS_OFF.includes(s.id),
  );
  if (shown.length === 0) return null;
  return (
    <nav
      aria-label="온스토리 소셜"
      className="flex flex-wrap items-center gap-[var(--s-1)] md:gap-[var(--s-5)] md:justify-end"
    >
      {shown.map((s) => (
        <a
          key={s.id}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`온스토리 ${s.name}`}
          className="grid place-items-center min-h-[var(--tap)] min-w-[var(--tap)] md:min-h-0 md:min-w-0 transition-opacity duration-[var(--dur-2)] hover:opacity-60 motion-reduce:transition-none"
          style={{ borderRadius: "var(--r-full)" }}
        >
          <span
            className="grid place-items-center"
            style={{
              width: "var(--s-6)", height: "var(--s-6)",
              borderRadius: "var(--r-full)", background: "var(--n-0)",
            }}
          >
            <ChannelIcon id={s.id} />
          </span>
        </a>
      ))}
    </nav>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="t-caption font-bold" style={{ color: "var(--text-soft)", letterSpacing: "var(--tracking-kicker)" }}>{title}</p>
      <ul style={{ marginTop: "var(--s-3)" }}>
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="t-small tap-row" style={{ color: "var(--n-300)" }}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 페이지 상단 공통 히어로 (메뉴 페이지용) — .reveal 을 붙이지 않는다(LCP) */
export function PageHero({ kicker, title, sub, children }: { kicker: string; title: React.ReactNode; sub?: string; children?: React.ReactNode }) {
  return (
    <section className="wrap" style={{ paddingTop: "var(--s-7)", paddingBottom: "var(--s-6)" }}>
      <p className="t-caption font-bold" style={{ color: "var(--green-700)", letterSpacing: "var(--tracking-kicker)" }}>{kicker}</p>
      <h1 className="t-h1" style={{ marginTop: "var(--s-3)", maxWidth: "18ch", textWrap: "balance" }}>{title}</h1>
      {sub && <p className="t-lead measure" style={{ marginTop: "var(--s-4)" }}>{sub}</p>}
      {children}
    </section>
  );
}

/** 페이지 하단 공통 CTA 밴드 */
export function CtaBand({
  title = "사장님 이야기부터 들려주세요",
  sub = `${COPY.trialShort} · 이후 ${COPY.priceLine} 자동 결제 · 언제든 해지`,
}: { title?: string; sub?: string }) {
  return (
    <section className="surface-50 section reveal">
      <div className="wrap text-center">
        <h2 className="t-h2" style={{ textWrap: "balance" }}>{title}</h2>
        <p className="t-small" style={{ marginTop: "var(--s-3)", color: "var(--text)" }}>{sub}</p>
        <div style={{ marginTop: "var(--s-6)" }}>
          <Link href="/new" className="btn btn-primary">녹화를 시도해보세요 · 60초</Link>
        </div>
      </div>
    </section>
  );
}
