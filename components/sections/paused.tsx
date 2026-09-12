import Link from "next/link";
import { Logo } from "@/components/site/logo";

/**
 * 쉬고 있는 홈페이지 안내 (2026-09-12 회장님 지시 5 · 상무님 안 B)
 *
 * ★★ **손님에게 사장님 사정을 말하지 않는다.**
 *   「요금 미납」·「체험 기간 종료」·「정지」는 **한 글자도 쓰지 않는다.**
 *   그 말은 사장님이 돈이 없다는 사실을 손님에게 알리는 것이고, 그게 이 화면이 저지를 수 있는
 *   가장 큰 잘못이다. 손님에게는 「지금은 볼 수 없다」까지만 말한다.
 *
 * ★ 왜 404 대신 이 화면인가: 이 주소는 사장님이 **명함·네이버 플레이스에 적어 둔 주소**다.
 *   죽은 링크가 되면 우리가 판 물건이 손님 앞에서 부서진다.
 *
 * ★ 사장님 안내는 **아래쪽에 작게** 둔다. 손님 눈에 먼저 들어오면 안 된다.
 *   사장님은 이 화면을 보러 온 사람이 아니라 «어떻게 되살리나»를 찾는 사람이다.
 */
export function PausedSite({ businessName }: { businessName: string }) {
  const name = businessName.trim();
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center text-center"
      style={{ background: "var(--cream)", color: "var(--ink)", paddingInline: "var(--gutter)" }}
    >
      <h1 className="font-display t-h2 leading-snug">
        {name ? `${name} 홈페이지는` : "이 홈페이지는"}
        <br />
        지금은 볼 수 없어요
      </h1>
      <p className="t-body" style={{ marginTop: "var(--s-3)", color: "var(--muted)", maxWidth: "32rem" }}>
        잠시 쉬고 있는 홈페이지예요. 급하시면 가게에 직접 연락해 주세요.
      </p>

      {/* ── 여기부터는 사장님용. 작게, 아래에. ── */}
      <div
        className="w-full"
        style={{ marginTop: "var(--s-8)", paddingTop: "var(--s-5)", borderTop: "1px solid var(--line)", maxWidth: "32rem" }}
      >
        <p className="t-caption" style={{ color: "var(--muted)" }}>
          이 홈페이지의 사장님이신가요?{" "}
          <Link href="/my" className="underline underline-offset-2 font-bold" style={{ color: "var(--green-700)" }}>
            다시 시작하기
          </Link>
        </p>
        <Link
          href="/"
          aria-label="온스토리 홈"
          className="inline-flex items-center"
          style={{ marginTop: "var(--s-4)", minHeight: "var(--tap)" }}
        >
          <Logo height={18} />
        </Link>
      </div>
    </main>
  );
}
