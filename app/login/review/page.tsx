import { notFound } from "next/navigation";
import { ReviewLoginUi } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "심사용 로그인", robots: { index: false, follow: false } };

/**
 * 심사관 전용 로그인 화면. (2026-09-12)
 *
 * ★★ **열쇠가 없으면 이 주소는 아예 없다**(404). 「숨겨 둔 화면」이 아니라 «존재하지 않는 화면»이다.
 *   그래서 일반 사장님이 주소를 우연히 눌러도 볼 것이 없다.
 * ★ 로그인 화면(/login)에서 이 길로 가는 링크를 **두지 않는다.** 심사관에게만 주소를 직접 알려 준다.
 */
export default function ReviewLoginPage() {
  if (!process.env.REVIEW_ID?.trim() || !process.env.REVIEW_PASSWORD?.trim()) notFound();
  return <ReviewLoginUi />;
}
