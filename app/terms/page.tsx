import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero } from "@/components/site/chrome";
import { MEMBERSHIP_PRICE, TRIAL_DAYS } from "@/lib/trial";

export const metadata: Metadata = {
  title: "이용약관 — 온스토리",
  description: "온스토리 서비스 이용 조건입니다.",
};

/**
 * 이용약관 (2026-09-06 초안 · docs/specs/legal-pages.md)
 *
 * ⚠ 2026-09-06 회장님이 채워 주신 값: 상호 이안월드 · 대표 권병철 · 연락 info@onstori.com · 환불 기준 7일.
 * ⚠ 남은 빈칸 ⟪ ⟫ 2개(사업자등록번호 · 통신판매업신고번호)는 아직 등록 전이라 값이 없다. 그동안 배포하지 않는다.
 * ⚠ 금액·기간은 lib/trial.ts 에서 읽는다 — 약관과 화면의 숫자가 갈라지지 않게 (규칙 4 와 같은 원칙).
 * ⚠ 기술참모 초안이다. 배포 전 변호사 검토를 받는다.
 */

const UPDATED = "2026-09-06";

function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-extrabold" style={{ color: "var(--forest)" }}>
        제{n}조 · {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.85]" style={{ color: "var(--ink)" }}>{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const price = MEMBERSHIP_PRICE.toLocaleString("ko-KR");
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader />
      <PageHero
        kicker="이용약관"
        title={<>서로 지킬 것을<br />짧게 적었습니다.</>}
        sub={`시행일 ${UPDATED}. 어려운 말을 줄이려고 애썼습니다.`}
      />

      <div className="wrap max-w-3xl pb-24">
        <Sec n="1" title="이 약관은 무엇인가요">
          <p>
            온스토리(onstori.com, 이하 &ldquo;서비스&rdquo;)를 쓰실 때의 조건입니다.
            서비스는 이안월드(대표 권병철, 사업자등록번호 ⟪000-00-00000⟫)가 운영합니다.
          </p>
          <p>회원가입을 하시거나 홈페이지를 만드시면 이 약관에 동의하신 것으로 봅니다.</p>
        </Sec>

        <Sec n="2" title="어떤 서비스인가요">
          <p>
            사장님이 60초 동안 말씀하시면, 온스토리가 그것을 자막 영상 · 글 · 사진 카드로 만들어
            사장님 홈페이지와 여러 채널에 올릴 수 있게 도와드립니다. 홈페이지 주소는 <code>onstori.com/○○○</code> 형태입니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            일부 기능(외부 SNS 자동 게시 등)은 각 플랫폼의 승인 상태에 따라 제공 시점이 달라질 수 있습니다.
          </p>
        </Sec>

        <Sec n="3" title="요금과 무료 기간">
          <p>
            가입하시면 <b>{TRIAL_DAYS}일 동안 전 기능을 무료</b>로 쓰실 수 있습니다.
            이후 계속 쓰시려면 <b>정회원 {price}원</b>을 결제하시면 됩니다.
          </p>
          <p>
            무료 기간이 끝나면 <b>홈페이지가 비공개로 바뀝니다.</b> 사장님 자료는 지우지 않고 보관하며,
            결제하시면 그대로 다시 공개됩니다. 자료 삭제 기준은{" "}
            <Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>개인정보처리방침</Link>에 있습니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            결제는 토스페이먼츠를 통해 이루어지며, 카드 정보는 온스토리가 보관하지 않습니다.
          </p>
        </Sec>

        <Sec n="4" title="환불">
          <p>
            결제 후 <b>7일 이내</b>에 요청하시면 전액 환불해 드립니다.
            다만 그 사이에 영상 제작·발행 등 서비스를 실제로 쓰셨다면, 쓰신 만큼을 뺀 금액을 돌려드립니다.
          </p>
          <p>환불은 info@onstori.com 로 요청해 주세요.</p>
        </Sec>

        <Sec n="5" title="사장님이 올리시는 것">
          <p>
            사장님이 올리신 사진 · 영상 · 글의 <b>권리는 전부 사장님 것</b>입니다.
            온스토리는 서비스를 제공하기 위해 필요한 범위(홈페이지 표시, 자막 영상 제작, 사장님이 선택한 채널로 발행)에서만 씁니다.
          </p>
          <p>다만 아래는 올리실 수 없습니다.</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>다른 사람의 사진 · 글 · 상표를 허락 없이 쓴 것</li>
            <li>사실과 다른 광고, 없는 경력 · 자격 · 수상 내역</li>
            <li>법을 어기거나 다른 사람을 해치는 내용</li>
          </ul>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            표시광고법 방침에 따라 온스토리는 <b>별점 · 평점 입력 기능을 제공하지 않습니다.</b>
          </p>
        </Sec>

        <Sec n="6" title="손님이 남긴 정보 — 사장님의 의무">
          <p>
            손님이 사장님 홈페이지에 남긴 이름 · 연락처 · 문의 내용 · 사진은 <b>손님의 개인정보</b>입니다.
            사장님은 이 정보를 <b>문의에 답하는 목적으로만</b> 쓰셔야 합니다.
          </p>
          <p>다른 곳에 넘기거나, 동의 없이 광고 문자를 보내는 것은 법으로 금지돼 있습니다.</p>
        </Sec>

        <Sec n="7" title="AI 가 만든 문구와 사진">
          <p>
            온스토리는 AI 로 홈페이지 문구와 사진을 만들어 드립니다.
            <b>내용이 사실과 맞는지 확인하실 책임은 사장님께 있습니다.</b> 수정 화면에서 언제든 고치실 수 있습니다.
          </p>
        </Sec>

        <Sec n="8" title="서비스가 멈출 수 있는 때">
          <p>
            점검 · 장애 · 외부 서비스(결제 · 문자 · 저장소 등) 문제로 일시적으로 멈출 수 있습니다.
            미리 알 수 있는 점검은 사전에 알려드립니다.
          </p>
          <p>
            약관을 반복해서 어기시거나 다른 이용자에게 피해를 주시는 경우, 사전 통지 후 이용을 제한할 수 있습니다.
          </p>
        </Sec>

        <Sec n="9" title="해지">
          <p>
            언제든 해지하실 수 있습니다. 해지하셔도 <b>홈페이지 · 영상 · 기록은 사장님 것</b>이라 내려받아 가져가실 수 있습니다.
            자료 삭제를 원하시면{" "}
            <Link href="/privacy#delete" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>삭제 요청 안내</Link>를 따라 주세요.
          </p>
        </Sec>

        <Sec n="10" title="책임의 한계">
          <p>
            온스토리는 서비스가 끊기지 않도록 최선을 다하지만, 천재지변 · 외부 서비스 장애처럼
            온스토리의 잘못이 아닌 사유로 생긴 손해에 대해서는 책임지지 않습니다.
          </p>
          <p>
            온스토리의 책임이 인정되는 경우, 그 범위는 <b>사장님이 최근 1년간 실제로 지급하신 금액</b>을 넘지 않습니다.
          </p>
        </Sec>

        <Sec n="11" title="약관이 바뀔 때">
          <p>
            바뀌면 시행 7일 전에(사장님에게 불리한 변경은 30일 전에) 이 페이지와 서비스 화면에 알려드립니다.
            그때까지 거절 의사를 알리지 않으시면 동의하신 것으로 봅니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>시행일: {UPDATED}</p>
        </Sec>

        <Sec n="12" title="분쟁">
          <p>
            문제가 생기면 먼저 info@onstori.com 로 알려주세요. 대화로 풀리지 않을 때는
            대한민국 법을 따르고, 관할 법원은 민사소송법이 정하는 곳으로 합니다.
          </p>
        </Sec>
      </div>

      <SiteFooter />
    </main>
  );
}
