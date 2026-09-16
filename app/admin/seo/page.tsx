import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
/* ⚠ 미리보기는 «지금 실제로 나가는 값»을 보여야 정직하다 — `/admin/copy` 저장값이 이긴다
   (2026-09-16 지시 [9]). 코드 기본값 `CHANNELS_LINE_MARKED` 는 `defaultConfig()` 안에 있다. */
import { PENDING_NOTE } from "@/config/channels";
import { readConfig } from "@/lib/admin-config";
import { SITEMAP_MIN_SCORE } from "@/lib/indexable";
/* ★ 기간 숫자를 손으로 적지 않는다 — 요금·기간의 유일한 출처는 lib/trial.ts 다(CLAUDE.md 규칙 9) */
import { TRIAL_DAYS } from "@/lib/trial";

export const metadata = { title: "검색 노출(SEO) 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ★★★ **검색 노출(SEO) 관리 — 2026-09-15 대표님 지시로 신설.**
 *
 * 대표님 말씀: 「검색 SEO 부분 완벽하게 처리해야 해. 수정되는 데 오래 걸리니까,
 *   문구·멘트 어찌 넣을지, 우리 홈페이지 onstori.com 도 네이버랑 구글에 등록해야 하고,
 *   고객 홈페이지도 등록되게 하려면 어떤 문구로 할지 세팅해야 해.
 *   **그런 부분을 자세히 설명서와 내용을 기재해서 /admin 에 메뉴를 넣고 관리하는 곳을 만들어 두자.**
 *   그래야 수정이 필요할 때 빠르게 입력할 수 있을 듯.」
 *
 * ★ 이 화면은 **「지금 어떤 상태인가」를 보여 주는 계기판**이다. 값을 바꾸는 곳은 둘로 나뉜다:
 *   · **환경변수**(Vercel) — 소유확인 값처럼 자주 안 바뀌는 것. 화면에서 «있다/없다»만 본다
 *   · **코드**(`config/`) — 문구처럼 여러 화면이 함께 쓰는 것. 단일 출처를 고친다
 *   ⚠ 여기서 **직접 저장하게 만들지 않았다.** 지금 값이 어디서 오는지를 흐리면
 *     나중에 「화면에서 바꿨는데 왜 안 바뀌죠?」가 된다. **출처를 한 곳으로 유지하는 것이 먼저다.**
 *
 * 🔴 **근거 문서:** `fable51plandept/AI_Context/BANJANG/SEO-홈온-분석-2026-09-15.md`
 *   경쟁사 홈ON 의 원본 HTML·robots·sitemap 을 직접 받아 대조한 실측이다. 추측이 아니다.
 */

function Ok({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className="whitespace-nowrap font-bold" style={{ color: on ? "var(--green)" : "var(--danger)" }}>
      {on ? `✅ ${yes}` : `🔴 ${no}`}
    </span>
  );
}

export default async function SeoAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;
  const cfg = await readConfig();

  const naver = (process.env.NAVER_SITE_VERIFICATION ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const google = (process.env.GOOGLE_SITE_VERIFICATION ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  /* 지금 검색에 올라갈 수 있는 사이트가 몇 곳인가 — 숫자가 0 이면 위 설정이 다 있어도 소용없다 */
  const sb = sbAdmin();
  const { data: sites } = await sb.from("sites").select("slug, status, published_at").limit(200);
  const live = (sites ?? []).filter((s) => (s.status === "active" || s.status === "trial") && s.published_at);

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">검색 노출(SEO) 관리</h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        네이버·구글에 우리와 사장님 홈페이지가 어떻게 올라가는지, 지금 무엇이 막혀 있는지를 한 장에 모았습니다.
      </p>

      {/* ───────── ① 가장 중요한 것 ───────── */}
      <section className="card mt-6 p-5">
        <h2 className="t-body font-bold">① 사이트 소유확인 — 이게 없으면 나머지가 다 소용없습니다</h2>
        <p className="mt-2 t-small">
          검색엔진은 <b>「이 도메인의 주인이 맞다」는 도장</b>을 확인한 뒤에야 제대로 수집합니다.
          경쟁사 홈ON 은 네이버 도장 <b>3개</b>, 구글 도장 <b>2개</b>를 달고 있습니다.
        </p>
        <p className="mt-2 rounded-xl px-4 py-3 t-small" style={{ background: "var(--green-50)" }}>
          ★ <b>도장은 도메인 하나에 한 번이면 됩니다.</b> <code>onstori.com</code> 을 한 번 등록하면
          <b> onstori.com/&#123;상호&#125; 사장님 홈페이지가 전부 따라 들어옵니다.</b>
          사장님이 각자 네이버에 등록하실 필요가 없습니다 — 이것이 우리 주소 방식의 가장 큰 무기입니다.
        </p>

        <table className="mt-4 w-full t-small">
          <tbody>
            <tr className="border-t border-n-100">
              <td className="py-2 font-bold">네이버</td>
              <td className="py-2"><Ok on={naver.length > 0} yes={`도장 ${naver.length}개 붙어 있음`} no="도장 없음 — 네이버가 우리를 거의 안 옵니다" /></td>
            </tr>
            <tr className="border-t border-n-100">
              <td className="py-2 font-bold">구글</td>
              <td className="py-2"><Ok on={google.length > 0} yes={`도장 ${google.length}개 붙어 있음`} no="도장 없음" /></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--n-300)" }}>
          <p className="t-small font-bold">넣는 법 (5분)</p>
          <ol className="mt-2 space-y-1 t-small" style={{ paddingLeft: "1.2em", listStyle: "decimal" }}>
            <li>
              <a className="underline" href="https://searchadvisor.naver.com" target="_blank" rel="noreferrer">네이버 서치어드바이저</a>
              {" "}→ 웹마스터도구 → 사이트 등록에 <code>https://onstori.com</code> → <b>「HTML 태그」</b> 방식 선택
            </li>
            <li>화면에 나오는 <code>content=&quot;…&quot;</code> 안의 글자만 복사</li>
            <li>
              <a className="underline" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">구글 서치콘솔</a>
              {" "}→ 속성 추가 → <b>URL 접두어</b> → <code>https://onstori.com</code> → <b>HTML 태그</b> → 같은 방식으로 복사
            </li>
            <li>
              Vercel → Settings → Environment Variables 에 넣습니다 (Production)
              <div className="mt-1 rounded-lg bg-n-50 p-2 font-mono t-caption">
                NAVER_SITE_VERIFICATION = 복사한값<br />
                GOOGLE_SITE_VERIFICATION = 복사한값
              </div>
              <span className="t-caption text-[var(--text-soft)]">여러 개면 쉼표로 이어 적으시면 됩니다.</span>
            </li>
            <li><b>Redeploy</b> → 이 화면을 새로고침하면 위 표가 초록으로 바뀝니다</li>
            <li>마지막으로 두 곳에 <b>사이트맵을 제출</b>합니다 — <code>https://onstori.com/sitemap.xml</code></li>
          </ol>
          <p className="mt-2 t-caption text-[var(--text-soft)]">
            ⚠ 값이 없으면 <b>태그 자체가 안 나갑니다.</b> 빈 태그는 검색엔진에 「고장난 사이트」로 보이기 때문입니다.
          </p>
        </div>
      </section>

      {/* ───────── ② 사장님 홈페이지 ───────── */}
      <section className="card mt-5 p-5">
        <h2 className="t-body font-bold">② 사장님 홈페이지가 검색에 올라가는 조건</h2>
        <p className="mt-2 t-small">
          지금 발행된 사장님 홈페이지 <b>{live.length}곳</b>이 후보입니다.
          그중 아래 <b>네 가지를 모두 통과한 곳만</b> 우리가 검색엔진에 먼저 알립니다.
        </p>
        <ul className="mt-3 space-y-1.5 t-small">
          <li>① <b>발행했다</b> — 만들기만 하고 발행 안 하면 올리지 않습니다</li>
          <li>② <b>완성도 {SITEMAP_MIN_SCORE}점 이상</b> — 속이 빈 홈페이지가 색인되면 그 손해가 <b>다른 사장님들께도</b> 갑니다(도메인 평판을 함께 씁니다)</li>
          <li>③ <b>올바른 전화번호</b> — 검색으로 데려와도 연락이 안 되면 의미가 없습니다</li>
          <li>④ <b>한 번이라도 직접 고쳤다</b> — AI 가 지어 준 그대로면 아직 「그 가게」가 아닙니다. <b>가짜를 막는 핵심 관문</b>입니다</li>
        </ul>
        <p className="mt-3 rounded-xl px-4 py-3 t-small" style={{ background: "var(--green-50)" }}>
          ★ <b>2026-09-15 대표님 결정으로 「돈을 냈는가」 조건을 뺐습니다.</b>
          전에는 유료 결제를 해야만 검색에 올랐습니다. 그러면 무료 {TRIAL_DAYS}일 동안 <b>검색에 아예 안 잡혀서</b>
          「만들었는데 안 뜨네」로 해지하십니다. <b>돈을 내기 전에 가치를 보셔야 결제하십니다.</b>
        </p>
        <p className="mt-2 t-caption text-[var(--text-soft)]">
          ⚠ 문턱을 바꾸려면 <code>lib/indexable.ts</code> 한 곳만 고칩니다. 화면마다 다시 판정하지 않습니다.
        </p>
      </section>

      {/* ───────── ③ 네이버에서 빨리 뜨게 하는 법 ───────── */}
      <section className="card mt-5 p-5">
        <h2 className="t-body font-bold">③ 네이버에서 빨리 뜨게 하는 법 — 「채널 연결」이 답입니다</h2>
        <p className="mt-2 t-small">
          네이버는 그 가게를 <b>플레이스로 이미 알고 있습니다.</b> 새 홈페이지를 처음부터 알아봐 달라고
          조르는 것보다, <b>이미 아는 것에 붙이는 것</b>이 압도적으로 빠릅니다.
        </p>
        <p className="mt-2 t-small">
          가입 4단계 <b>「채널 연결」</b>에서 받은 주소(네이버 플레이스·블로그·인스타…)가
          홈페이지의 <b>구조화 데이터 <code>sameAs</code></b> 로 들어갑니다 —
          「이 홈페이지 = 저 플레이스와 같은 업체」라고 검색엔진에 직접 말해 주는 줄입니다.
          <b> 경쟁사 홈ON 이 네이버 상단에 뜨는 가장 큰 이유가 이것이었습니다.</b>
        </p>
        <p className="mt-2 t-caption text-[var(--text-soft)]">
          ⚠ 정직하게 말씀드립니다 — <b>네이버 수집은 등록 후 보통 1~4주</b> 걸립니다. 며칠이 아닙니다.
          그리고 네이버는 자기 것(플레이스·블로그·카페)을 위에 두므로,
          <b> 현실적인 목표는 그 아래 「웹사이트」 칸에 들어가는 것</b>입니다.
        </p>
      </section>

      {/* ───────── ④ 핵심 문구 ───────── */}
      <section className="card mt-5 p-5">
        <h2 className="t-body font-bold">④ 핵심 문구 — 🔴 함부로 바꾸지 않습니다</h2>
        <p className="mt-2 t-small">
          아래 한 줄은 <b>온스토리 전체 홈페이지의 핵심 키워드이자 핵심 문구</b>입니다(2026-09-15 대표님).
          <b> AI 는 이 문구를 대표님 허락 없이 바꾸지 않습니다.</b> 채널이 열리면 권한다고 «말씀만» 드립니다.
        </p>
        <div className="mt-3 rounded-xl bg-n-50 p-3 t-small font-semibold">{cfg.snsLine}</div>
        <p className="mt-2 t-caption text-[var(--text-soft)]">{PENDING_NOTE}</p>
        <p className="mt-3 t-small">
          <b>바꾸는 곳은 한 곳입니다</b> — <code>config/channels.ts</code> 의 <code>live</code> 값.
          채널이 열리면 그 한 줄을 <code>true</code> 로 바꾸면 <b>「(준비 중)」이 저절로 사라지고
          「2곳」 같은 숫자도 함께 바뀝니다.</b> 화면 여섯 곳이 이 한 곳을 읽습니다.
        </p>
        <p className="mt-2 t-caption text-[var(--text-soft)]">
          ⚠ 숫자를 손으로 적지 마십시오. 2026-09-06 에 요금·기간을 손으로 적어 둔 것이
          <b> 182곳 중 175곳이 어긋나는</b> 사고가 났습니다. 같은 실수를 문구에서 되풀이하지 않습니다.
        </p>
      </section>

      <p className="mt-6 t-caption text-[var(--text-soft)]">
        근거 실측 보고서: <code>fable51plandept/AI_Context/BANJANG/SEO-홈온-분석-2026-09-15.md</code>
        {" "}— 경쟁사 홈ON 의 원본 HTML·robots·sitemap 을 직접 받아 대조했습니다.
      </p>
    </main>
  );
}
