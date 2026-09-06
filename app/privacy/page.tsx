import type { Metadata } from "next";
import { PromoBar, SiteHeader, SiteFooter, PageHero } from "@/components/site/chrome";

// ⚠ 빈칸(사업자등록번호·통신판매업신고번호·주소)이 남아 있는 동안은 검색에 노출하지 않는다.
//    푸터·sitemap 링크도 함께 빼 뒀다. 빈칸을 채우면 이 robots 줄을 지우고 링크를 되살린다. 2026-09-07
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "개인정보처리방침 — 온스토리",
  description: "온스토리가 어떤 정보를 어떻게 다루는지 정리했습니다.",
};

/**
 * 개인정보처리방침 (2026-09-06 초안 · docs/specs/legal-pages.md)
 *
 * ⚠ 2026-09-06 회장님이 채워 주신 값: 상호 이안월드 · 대표/보호책임자 권병철 ·
 *    연락 info@onstori.com · 자동 파기 3년 · 환불 기준 7일.
 * ⚠ 남은 빈칸 ⟪ ⟫ 3개(사업자등록번호 · 통신판매업신고번호 · 주소)는 아직 등록 전이라 값이 없다.
 *    이 3개가 남아 있는 동안에는 배포하지 않는다 — 심사에서 반려된다.
 * ⚠ 수집 항목·위탁처·국외 이전 표는 저장소 코드에서 직접 확인한 사실이다.
 *    새 외부 서비스를 붙이면(예: F 커밋 ③의 네이버 지도) 이 표에 반드시 한 줄 더한다.
 * ⚠ 기술참모 초안이다. 배포 전 변호사 검토를 받는다.
 */

const UPDATED = "2026-09-06";

function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-extrabold" style={{ color: "var(--forest)" }}>
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.85]" style={{ color: "var(--ink)" }}>{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
      <table className="w-full min-w-[560px] text-[14px]">
        <thead style={{ background: "var(--cream-2)" }}>
          <tr>{head.map((h) => <th key={h} className="px-3 py-2.5 text-left font-bold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
              {r.map((c, j) => <td key={j} className="px-3 py-2.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-svh" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <PromoBar />
      <SiteHeader />
      <PageHero
        kicker="개인정보처리방침"
        title={<>사장님과 손님의 정보를<br />이렇게 다룹니다.</>}
        sub={`시행일 ${UPDATED}. 바뀌면 이 페이지에 먼저 알려드립니다.`}
      />

      <div className="wrap max-w-3xl pb-24">
        <Sec n="1" title="누가 운영하나요">
          <p>
            온스토리(onstori.com)는 이안월드가 운영합니다. 대표 권병철 · 사업자등록번호 ⟪000-00-00000⟫ ·
            통신판매업신고 ⟪제0000-0000-0000호⟫ · 주소 ⟪주소⟫.
          </p>
          <p>
            개인정보 보호책임자는 권병철(대표)이며, info@onstori.com 으로 연락하실 수 있습니다.
          </p>
        </Sec>

        <Sec n="2" title="사장님에게서 받는 정보">
          <Table
            head={["항목", "언제 받나요", "왜 필요한가요"]}
            rows={[
              ["이메일", "이메일로 로그인할 때", "본인 확인·로그인"],
              ["카카오 계정 정보(식별자·이메일·별명)", "카카오로 로그인할 때", "본인 확인·로그인"],
              ["상호명 · 업종 · 한 줄 소개", "홈페이지를 만들 때", "홈페이지 문구·구조 생성"],
              ["전화번호", "홈페이지를 만들 때(필수)", "손님 문의 알림 문자, 녹화 링크 발송"],
              ["주소", "홈페이지를 만들 때", "오시는 길 표시"],
              ["로고 · 사진", "직접 올리실 때", "홈페이지에 표시"],
              ["60초 녹화 영상 · 음성", "녹화하실 때", "자막 영상·글 제작"],
              ["녹화에서 옮긴 글(자막)", "녹화를 처리할 때", "자막·글 제작"],
              ["결제 승인번호 · 주문번호 · 금액 · 결제수단", "정회원 결제 시", "결제 확인·환불 처리"],
              ["접속 IP", "서비스 이용 시", "무단 대량 요청 차단"],
            ]}
          />
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            카드번호·유효기간·CVC·생년월일은 <b>토스페이먼츠 결제창이 직접 받으며, 온스토리는 저장하지 않습니다.</b>
          </p>
        </Sec>

        <Sec n="3" title="손님이 남기는 정보 — 사장님 것입니다">
          <p>
            손님이 사장님 홈페이지에서 견적·문의를 남기면 <b>이름 · 연락처 · 문의 내용 · 사진(최대 3장)</b>이 저장됩니다.
            이 정보의 주인은 손님이고, 받는 분은 사장님이며, <b>온스토리는 사장님을 대신해 보관·전달하는 역할</b>만 합니다.
          </p>
          <p>
            중복·스팸을 막기 위해 <b>접속 IP 를 그대로 저장하지 않고, 날짜와 비밀값을 섞어 되돌릴 수 없게 만든 값</b>만 남깁니다.
          </p>
          <p>
            사장님은 손님의 정보를 문의에 답하는 목적으로만 쓰셔야 하며, 다른 곳에 넘기거나 광고 발송에 쓰실 수 없습니다.
            자세한 내용은 이용약관에 있습니다.
          </p>
        </Sec>

        <Sec n="4" title="얼마나 갖고 있나요">
          <p>
            무료 기간(14일)이 끝나도 <b>사장님 자료를 곧바로 지우지 않습니다.</b> 홈페이지를 비공개로 바꾸어 보관합니다.
            나중에 결제하시면 그대로 다시 공개됩니다.
          </p>
          <p>
            <b>삭제를 요청하시면 지체 없이 파기</b>하고 결과를 알려드립니다.
            요청이 없더라도 <b>마지막 접속일로부터 3년</b>이 지나면 자동으로 파기합니다.
          </p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            전자상거래법 등 다른 법이 더 긴 보관을 요구하는 항목(계약·결제·소비자 불만 기록 등)은 그 기간 동안 보관합니다.
          </p>
        </Sec>

        <Sec n="5" title="맡기는 곳 (처리위탁)">
          <Table
            head={["받는 곳", "맡기는 일", "위치"]}
            rows={[
              ["Supabase", "회원·사이트·문의 데이터 보관, 로그인", "국외"],
              ["Vercel", "웹사이트 호스팅·접속 로그", "국외"],
              ["Cloudflare", "사진·영상 파일 보관 (img.onstori.com)", "국외"],
              ["Google Cloud (Vertex AI)", "홈페이지 문구·이미지 생성", "국외"],
              ["Resend", "문의 알림 이메일 발송", "국외"],
              ["솔라피", "문의 알림 문자·녹화 링크 발송", "국내"],
              ["토스페이먼츠", "결제 처리", "국내"],
              ["카카오", "카카오 로그인", "국내"],
              ["네이버 · 카카오 (지역검색)", "가게 정보 불러오기", "국내"],
            ]}
          />
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            국외에 있는 곳으로 정보가 이전되며, 이전 목적·항목·시점은 위 표와 같습니다.
            원하지 않으시면 서비스 이용이 어려울 수 있습니다.
          </p>
        </Sec>

        <Sec n="6" title="파는 일은 없습니다">
          <p>
            온스토리는 사장님과 손님의 정보를 <b>제3자에게 판매하거나 광고 목적으로 제공하지 않습니다.</b>
            법에 따른 요청이 있을 때만, 그 범위 안에서 제공합니다.
          </p>
        </Sec>

        <Sec n="7" title="사장님의 권리">
          <p>언제든 열람·정정·삭제·처리정지를 요청하실 수 있습니다. 요청은 info@onstori.com로 받습니다.</p>
          <p>홈페이지 내용은 <b>수정 화면에서 직접 고치실 수</b> 있고, 계정과 자료 전체 삭제는 위 주소로 요청해 주세요.</p>
        </Sec>

        <Sec n="8" title="쿠키와 브라우저 저장">
          <p>
            로그인 상태 유지를 위해 쿠키를 씁니다. 로그인 전에 만드신 홈페이지를 나중에 계정에 연결해 드리기 위해
            브라우저에 임의의 식별자 하나를 저장합니다. 광고 추적용 쿠키는 쓰지 않습니다.
          </p>
        </Sec>

        <Sec n="9" title="안전하게 지키는 방법">
          <p>
            모든 통신은 암호화(HTTPS)하고, 데이터베이스는 행 단위 접근 제어로 다른 사장님의 자료가 보이지 않게 막습니다.
            운영자 화면은 검색엔진에서 차단하고 별도 인증을 거칩니다.
          </p>
        </Sec>

        <section id="delete" className="mt-10 rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--cream-2)" }}>
          <h2 className="text-[18px] font-extrabold" style={{ color: "var(--forest)" }}>10. 자료 삭제를 원하실 때</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-[1.85]">
            <p>계정과 홈페이지, 올리신 사진·영상까지 전부 지우고 싶으시면 아래로 알려주세요.</p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>info@onstori.com 로 <b>삭제를 원하는 홈페이지 주소(onstori.com/○○○)</b>와 함께 요청해 주세요.</li>
              <li>본인 확인을 위해 가입하신 이메일 또는 카카오 계정으로 보내주시면 빠릅니다.</li>
              <li>확인 후 <b>지체 없이 파기</b>하고, 처리 결과를 회신드립니다.</li>
            </ol>
            <p className="text-[14px]" style={{ color: "var(--muted)" }}>
              손님이 남긴 문의 정보도 함께 지워집니다. 법이 보관을 요구하는 결제·거래 기록은 그 기간 동안 남습니다.
            </p>
          </div>
        </section>

        <Sec n="11" title="바뀔 때">
          <p>내용이 바뀌면 시행 7일 전에 이 페이지에 알려드립니다. 중요한 변경은 문자나 이메일로도 알려드립니다.</p>
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>시행일: {UPDATED}</p>
        </Sec>
      </div>

      <SiteFooter />
    </main>
  );
}
