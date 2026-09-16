import { isAdmin } from "@/lib/admin-auth";
import { AdminLogin } from "../ui";
import { IDEAS, IDEA_STATUS, IDEA_STATUS_ORDER, countByStatus, nextIdeaCode } from "@/config/ideas";
import { IdeaBoard } from "./ui";

export const metadata = { title: "아이디어 뱅크", robots: { index: false, follow: false } };

/**
 * ★★★ **아이디어 뱅크** — 기능 아이디어를 설명하고·검토하고·기획하는 자리. (2026-09-16 대표님 지시)
 *
 * 대표님 말씀: 「이곳은 ai.onstori.com 의 「기능 목록」 항목처럼, 아이디어가 생기면 그 기능에 대해
 *   설명하고 검토하고 기획하는 공간이야. … **토큰비가 얼마 소모되는지도** 올리고,
 *   그 기능의 **구체적인 계획**을 올리는 거야.」
 *
 * ★ **DB 가 없다.** 글은 config/ideas.ts 배열에 있다 — 마이그레이션도 RLS 도 없다.
 *   이 화면은 그 배열을 «보기 좋게 그리는 일»만 한다.
 *
 * ⚠ `dynamic = "force-dynamic"` 을 **일부러 붙이지 않았다.** 읽는 데이터가 파일 안에 박혀 있어
 *   매번 새로 만들 이유가 없다. 아이디어를 고치면 배포와 함께 반영된다.
 *   (다른 어드민 화면은 DB 를 읽어서 붙인 것이다 — 흉내 내지 마라)
 */
export default async function IdeasAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;

  const counts = countByStatus(IDEAS);

  return (
    <main className="mx-auto w-full max-w-4xl min-w-0 px-6 py-10">
      <h1 className="mt-1 t-h3 font-bold">아이디어 뱅크</h1>
      <p className="mt-1 t-small text-[var(--text-soft)]">
        기능 아이디어를 <b>설명하고 · 검토하고 · 기획하는</b> 자리입니다. 카드마다{" "}
        <b>예상 토큰비</b>와 <b>구체적인 계획</b>이 함께 적혀 있습니다.
      </p>

      {/* ── 상태 5종 숫자 — 대표님 지시: 「상단에는 각 5가지 상태에 몇 개인지 숫자」 ──
          ⚠ 이 숫자는 **검색·필터와 상관없이** 언제나 전체를 말한다. 현황판이기 때문이다. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {IDEA_STATUS_ORDER.map((s) => {
          const m = IDEA_STATUS[s];
          return (
            <div key={s} className="card px-4 py-3">
              <p className="flex items-center gap-1.5 t-caption text-[var(--text-soft)]">
                {/* 🔴 점 옆에 «언제나» 글자가 있다 — 색만으로 뜻을 나르지 않는다 */}
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} aria-hidden />
                {m.label}
              </p>
              <p className="mt-1 t-h2 font-bold">{counts[s]}</p>
              <p className="mt-0.5 t-caption leading-snug text-[var(--text-soft)]">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {/* 검색 · 필터 · 카드 목록 — 글자를 치는 그 순간 줄어야 해서 클라이언트에서 그린다 */}
      <IdeaBoard />

      <p className="mt-8 t-caption text-[var(--text-soft)]">
        {/* ★ 다음 번호를 화면에 띄워 둔다 — 새 아이디어를 올릴 때 번호를 세지 않아도 되게.
            🔴 번호는 한 번 붙으면 바꾸지 않고, 폐기된 번호도 되쓰지 않는다. */}
        새 아이디어에 붙일 다음 번호: <b>{nextIdeaCode(IDEAS)}</b> · 아이디어를 더하거나 상태를
        바꾸는 곳은 <b>config/ideas.ts</b> 한 파일입니다.
      </p>
    </main>
  );
}
