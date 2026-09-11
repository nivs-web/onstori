import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-auth";
import { EditUi } from "./ui";
import { themeAttrs, themeVars } from "@/lib/design-tokens";
import { readDesignAll } from "@/lib/design-settings";

export const metadata: Metadata = { title: "홈페이지 수정", robots: { index: false, follow: false } };

/**
 * 사장님 편집화면.
 *
 * ★ 테마 엔진 주입 지점 (2026-09-09, S2⑥) — 운영자 콘솔(`app/admin/layout.tsx`)과 같은 방식이다.
 *   `<html>` 은 **온스토리 홈** 설정을 심는다. 편집화면은 그 위에 자기 설정을 덮는다.
 *
 * ★ 이 상자는 `display: contents` 라 **자리를 차지하지 않는다.** 배치는 그대로 두고
 *   CSS 값만 아래로 흘려보낸다.
 *   ⚠ 그래서 이 상자는 **배경을 칠하지 못한다.** 실제로 칠하는 상자는 `.editor-shell` 이다
 *     (`shell.tsx` · globals.css).
 *
 * ★ 바깥(`<html>`)이 무엇을 쓰는지 `themeVars` 에 **알려 준다.** 안 알려 주면
 *   편집화면이 「기본과 같다」며 아무것도 안 심고 **홈 설정에 끌려간다**
 *   (2026-09-09 조사가 잡아낸 결함 — 홈을 조용한 분위기로 바꾸면 편집화면까지 조용해진다).
 *
 * ⚠ `readDesignAll` 은 **절대 던지지 않는다.** 표가 없거나 DB 가 흔들려도 기본값으로 떨어진다.
 *
 * ⚠ 미리보기 iframe(`/{slug}/preview`)은 **별개 문서**라 이 값이 상속되지 않는다.
 *   손님 화면은 사장님이 고른 팔레트 그대로 보인다 — 그게 맞다(디자인 정의 §6).
 */
export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  /* ★★ 2026-09-12 회장님 확정(B안) — **편집화면은 로그인해야 들어온다.**
     만들기는 지금처럼 로그인 없이 둔다. 막는 자리는 여기 하나다.
     ⚠ 왜 «만들기»가 아니라 «들어오기»를 막나: 만들기 앞에서 막으면 로그인 왕복 중
       입력한 것을 잃는다. 여기서 막으면 **홈페이지는 이미 만들어져 있고**, 로그인만 하면
       `/api/auth/claim` 이 그 홈페이지를 계정에 붙여 준다. 아무것도 안 잃는다.
     ⚠ 익명으로 만든 사장님도 여기서 한 번 로그인하면 그때 계정에 귀속된다.
       그래서 이 차단이 «빼앗는 것»이 아니라 «지켜 주는 것»이 된다.
     ★ 운영자는 통과한다 — 무료 컨시어지 운영에 필요하다(lib/site-owner 와 같은 판단). */
  const [user, admin] = await Promise.all([getSessionUser(), isAdmin()]);
  if (!user && !admin) redirect(`/login?next=${encodeURIComponent(`/${slug}/edit`)}`);

  const all = await readDesignAll();
  return (
    <div
      {...themeAttrs(all.editor, "editor")}
      style={{ display: "contents", ...themeVars(all.editor, all.site) } as React.CSSProperties}
    >
      <EditUi slug={slug} />
    </div>
  );
}
