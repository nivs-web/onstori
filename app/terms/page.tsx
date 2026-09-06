import type { Metadata } from "next";
import Link from "next/link";
import { PromoBar, SiteHeader, SiteFooter, PageHero } from "@/components/site/chrome";
import { MEMBERSHIP_PRICE, TRIAL_DAYS } from "@/lib/trial";
import { BIZ } from "@/config/company";

export const metadata: Metadata = {
  title: "이용약관 — 온스토리",
  description: "온스토리 서비스 이용 조건입니다.",
};

/**
 * 이용약관 (2026-09-06 개정 2차 · docs/specs/legal-pages.md)
 *
 * 법정 요구사항 대조 — 조문을 지우거나 옮길 때 이 목록을 먼저 볼 것.
 *   전자상거래법 제10조 (신원 표시)        → 제1조 (config/company.ts)
 *   전자상거래법 제17조 (청약철회·환급기한)  → 제5조  ※ 3영업일·지연이자 필수
 *   개인정보보호법 제26조 제1항 (위탁 문서)  → 제7조  ※ 7개 항목 전부 필요
 *   약관규제법 제7조 (면책조항 제한)        → 제12조 ※ 고의·중과실 예외 없으면 무효
 *   약관규제법 제3조 (명시·설명 의무)       → 제3조
 *
 * ⚠ 제7조가 사장님(위탁자)과 온스토리(수탁자) 사이의 **위탁 문서** 역할을 한다.
 *    손님 문의 정보의 개인정보처리자는 사장님이고 온스토리는 수탁자다.
 *    제26조 제1항 각호를 하나라도 빼면 문서 요건을 못 채운다 — 항목을 줄이지 말 것.
 * ⚠ 제12조의 "고의 또는 중대한 과실" 예외 문장을 지우면 조항 전체가 무효가 될 수 있다.
 * ⚠ 금액·기간은 lib/trial.ts, 사업자 정보는 config/company.ts 에서 읽는다 —
 *    약관과 화면의 숫자가 갈라지지 않게 (규칙 4 와 같은 원칙).
 * ⚠ 변호사 검토 전이다. 법정 필수 항목은 전수 대조했으나, 최종 검토는 받아야 한다.
 */

const UPDATED = "2026-09-06";

function Sec({ n, title, id, children }: { n: string; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
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
            서비스는 <b>{BIZ.name}</b>(대표 {BIZ.ceo}, 사업자등록번호 {BIZ.bizNo},
            통신판매업신고 {BIZ.mailOrderNo}, 주소 {BIZ.address}, 전화 {BIZ.phone}, {BIZ.email})가 운영합니다.
          </p>
          <p>
            이 약관에서 <b>&ldquo;사장님&rdquo;</b>은 온스토리에 가입해 홈페이지를 만드시는 회원을,
            <b>&ldquo;손님&rdquo;</b>은 사장님 홈페이지를 방문해 문의를 남기는 분을 말합니다.
          </p>
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

        <Sec n="3" title="약관의 안내와 개정">
          <p>
            이 약관은 서비스 화면에 항상 올려두어 누구나 보실 수 있게 합니다.
            가입 화면에서 이 약관과 <Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>개인정보처리방침</Link>을
            확인하실 수 있으며, <b>가입하시거나 홈페이지를 만드시면 동의하신 것으로 봅니다.</b>
          </p>
          <p>
            중요한 내용은 굵은 글씨로 표시했습니다. 이해가 어려운 조항이 있으면
            {" "}{BIZ.email} 로 물어봐 주세요. 설명해 드립니다.
          </p>
        </Sec>

        <Sec n="4" title="요금과 무료 기간">
          <p>
            가입하시면 <b>{TRIAL_DAYS}일 동안 전 기능을 무료</b>로 쓰실 수 있습니다.
            이후 계속 쓰시려면 <b>정회원 {price}원</b>을 결제하시면 됩니다.
          </p>
          <p>
            무료 기간이 끝나면 <b>홈페이지가 비공개로 바뀝니다.</b> 사장님 자료는 지우지 않고 보관하며,
            결제하시면 그대로 다시 공개됩니다. 자료 보관·삭제 기준은{" "}
            <Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>개인정보처리방침</Link>에 있습니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            결제는 토스페이먼츠를 통해 이루어지며, 카드 정보는 온스토리가 보관하지 않습니다.
          </p>
        </Sec>

        <Sec n="5" title="청약철회와 환불">
          <p>
            결제하신 날부터 <b>7일 이내</b>에 청약철회(환불)를 요청하실 수 있습니다.
            요청은 <b>{BIZ.email}</b> 또는 <b>{BIZ.phone}</b> 로 하시면 됩니다.
          </p>
          <p>
            온스토리는 청약철회 의사를 받은 날부터 <b>3영업일 이내에 결제하신 금액을 돌려드립니다.</b>
            늦어지는 경우 전자상거래법이 정한 지연이자를 함께 드립니다.
            카드로 결제하신 경우에는 카드사에 취소를 요청하는 방식으로 처리되며, 카드사 사정에 따라 실제 반영까지 며칠이 걸릴 수 있습니다.
          </p>
          <p>
            <b>{TRIAL_DAYS}일 무료 기간에 모든 기능을 미리 써 보실 수 있으므로</b>, 결제는 충분히 확인하신 뒤에 하시면 됩니다.
            7일이 지난 뒤라도 온스토리의 잘못으로 서비스를 정상적으로 쓰지 못하셨다면 환불해 드립니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            이 조항은 전자상거래법이 정한 소비자의 권리를 줄이지 않습니다.
            법이 사장님께 더 유리하게 정하고 있는 경우에는 법을 따릅니다.
          </p>
        </Sec>

        <Sec n="6" title="사장님이 올리시는 것">
          <p>
            사장님이 올리신 사진 · 영상 · 글의 <b>권리는 전부 사장님 것</b>입니다.
            온스토리는 서비스를 제공하기 위해 필요한 범위(홈페이지 표시, 자막 영상 제작, 사장님이 선택한 채널로 발행)에서만 씁니다.
            <b>홍보·마케팅에 쓰려면 그때 따로 여쭙고 허락을 받겠습니다.</b>
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

        <Sec n="7" id="entrust" title="손님 개인정보의 처리위탁">
          <p>
            손님이 사장님 홈페이지에 남긴 이름 · 연락처 · 문의 내용 · 사진은 <b>손님의 개인정보</b>이고,
            이에 대한 <b>개인정보처리자는 사장님</b>입니다.
            온스토리는 사장님을 대신해 이를 보관·전달하는 <b>수탁자</b>이며,
            이 조항이 개인정보보호법 제26조에 따른 <b>위탁 문서</b>가 됩니다.
          </p>

          <p><b>① 위탁하시는 일의 목적과 범위</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            손님 문의의 접수 · 저장 · 사장님께 전달(문자·이메일 알림) · 사장님이 보실 수 있도록 문의함에 표시하는 일.
          </p>

          <p><b>② 목적 외 처리 금지</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            온스토리는 위 목적을 벗어나 손님 개인정보를 이용하지 않습니다.
            광고에 쓰거나 다른 사장님에게 보여주거나 분석 자료로 파는 일은 없습니다.
          </p>

          <p><b>③ 안전성 확보조치</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            전송 구간 암호화(HTTPS), 데이터베이스 행 단위 접근 제어, 문의 사진의 비공개 저장소 보관과 임시 주소 발급,
            접속 IP 의 복원 불가능한 값으로의 대체를 적용합니다. 자세한 내용은{" "}
            <Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>개인정보처리방침 §11</Link>에 있습니다.
          </p>

          <p><b>④ 재위탁 제한</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            온스토리는 사장님의 동의 없이 제3자에게 다시 위탁하지 않습니다.
            다만 서비스 운영에 반드시 필요한 보관·발송 업체(개인정보처리방침 §6 의 목록)에 대해서는
            사장님이 이 약관에 동의하실 때 재위탁에 동의하신 것으로 보며, 그 목록이 바뀌면 미리 알려드립니다.
          </p>

          <p><b>⑤ 접근 제한 등 관리</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            손님 문의는 <b>해당 사장님 계정과 온스토리 운영자만</b> 볼 수 있습니다.
            운영자 접근은 별도 인증을 거치며, 고장 신고 처리 등 필요한 경우로 한정합니다.
          </p>

          <p><b>⑥ 관리 현황 점검</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            사장님은 온스토리가 손님 개인정보를 이 조항대로 다루고 있는지 확인을 요구하실 수 있고,
            온스토리는 {BIZ.email} 로 요청받으면 처리 현황을 알려드립니다.
          </p>

          <p><b>⑦ 위반 시 책임</b></p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            온스토리가 이 조항을 어겨 손님이나 사장님께 손해를 끼친 경우, 온스토리가 그 손해를 배상합니다.
            반대로 사장님이 아래 제8조를 어겨 생긴 손해는 사장님이 책임지십니다.
          </p>
        </Sec>

        <Sec n="8" title="손님 정보에 대한 사장님의 의무">
          <p>
            사장님은 손님 정보를 <b>문의에 답하는 목적으로만</b> 쓰셔야 합니다.
            다른 곳에 넘기거나, 동의 없이 광고 문자를 보내는 것은 법으로 금지돼 있습니다.
          </p>
          <p>
            손님 문의는 접수일로부터 <b>1년이 지나면 온스토리가 자동으로 지웁니다.</b>
            더 오래 갖고 계셔야 한다면 따로 옮겨 보관하시고, 그 보관에 대한 책임은 사장님께 있습니다.
          </p>
        </Sec>

        <Sec n="9" title="홈페이지에 올리는 내용의 책임">
          <p>
            온스토리는 AI 로 홈페이지 문구와 사진을 만들어 드립니다.
            <b>내용이 사실과 맞는지 확인하실 책임은 사장님께 있습니다.</b> 수정 화면에서 언제든 고치실 수 있습니다.
          </p>
          <p>
            후기 · 시공 건수처럼 <b>사장님이 직접 입력하신 내용의 책임은 사장님께 있습니다.</b>
            온스토리는 사장님이 넣으신 값을 그대로 보여줄 뿐, 실적을 자동으로 만들거나 부풀리지 않습니다.
            사실과 다른 내용을 올리시면 표시광고법에 걸릴 수 있습니다.
          </p>
        </Sec>

        <Sec n="10" title="서비스가 멈출 수 있는 때">
          <p>
            점검 · 장애 · 외부 서비스(결제 · 문자 · 저장소 등) 문제로 일시적으로 멈출 수 있습니다.
            미리 알 수 있는 점검은 사전에 알려드립니다.
          </p>
          <p>
            약관을 반복해서 어기시거나 다른 이용자에게 피해를 주시는 경우, <b>사전 통지 후</b> 이용을 제한할 수 있습니다.
            급하게 막아야 하는 경우(불법 콘텐츠 등)에는 먼저 막고 <b>지체 없이 사유를 알려드리며</b>,
            사장님은 이에 대해 이의를 제기하실 수 있습니다.
          </p>
        </Sec>

        <Sec n="11" title="해지">
          <p>
            언제든 해지하실 수 있습니다. 해지하셔도 <b>홈페이지 · 영상 · 기록은 사장님 것</b>이라 내려받아 가져가실 수 있습니다.
            자료 삭제를 원하시면{" "}
            <Link href="/privacy#delete" className="underline underline-offset-2" style={{ color: "var(--forest)" }}>삭제 요청 안내</Link>를 따라 주세요.
          </p>
        </Sec>

        <Sec n="12" title="책임의 한계">
          <p>
            온스토리는 서비스가 끊기지 않도록 최선을 다하지만, 천재지변 · 외부 서비스 장애처럼
            <b>온스토리의 잘못이 아닌 사유</b>로 생긴 손해에 대해서는 책임지지 않습니다.
          </p>
          <p>
            온스토리의 책임이 인정되는 경우, 그 범위는 <b>사장님이 최근 1년간 실제로 지급하신 금액</b>을 한도로 합니다.
          </p>
          <p>
            <b>다만 온스토리의 고의 또는 중대한 과실로 손해가 생긴 경우, 그리고 사장님의 생명·신체에 손해가 생긴 경우에는
            위 한도를 적용하지 않고 법에 따라 배상합니다.</b>
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            이 조항은 소비자에게 부당하게 불리한 방식으로 해석되지 않습니다.
          </p>
        </Sec>

        <Sec n="13" title="약관이 바뀔 때">
          <p>
            바뀌면 <b>시행 7일 전</b>에(사장님에게 불리한 변경은 <b>시행 30일 전</b>에) 이 페이지와 서비스 화면에 알려드립니다.
            불리한 변경은 문자나 이메일로도 따로 알려드립니다.
          </p>
          <p>
            공지에는 <b>&ldquo;거절 의사를 알리지 않으시면 동의하신 것으로 본다&rdquo;는 뜻을 함께 적어</b> 알려드립니다.
            바뀐 약관에 동의하지 않으시면 <b>언제든 해지하실 수 있고</b>, 이 경우 남은 이용 기간에 해당하는 금액을 돌려드립니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>시행일: {UPDATED}</p>
        </Sec>

        <Sec n="14" title="분쟁">
          <p>
            문제가 생기면 먼저 {BIZ.email} 로 알려주세요. 최대한 빨리 해결해 드리겠습니다.
          </p>
          <p>
            대화로 풀리지 않을 때는 대한민국 법을 따르고, 관할 법원은 <b>민사소송법이 정하는 법원</b>으로 합니다.
            소비자이신 경우 <b>주소지 관할 법원</b>에 소송을 내실 수 있습니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            한국소비자원(국번없이 1372, www.kca.go.kr)이나 전자거래분쟁조정위원회(www.ecmc.or.kr)의 조정을 신청하실 수도 있습니다.
          </p>
        </Sec>
      </div>

      <SiteFooter />
    </main>
  );
}
