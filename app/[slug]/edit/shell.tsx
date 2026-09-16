"use client";

import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { AdminThemeToggle } from "@/components/admin/theme-toggle";
import { VISIBLE_EDITOR_MENUS, type EditorMenuId } from "@/config/editor-menu";

/**
 * 사장님 편집화면 **껍데기** — 상단 가로 메뉴 + 3단 배치 (2026-09-09, S2⑥).
 *
 * ★ 이 파일에는 **상태가 없다.** 배치와 껍데기만 그린다.
 *   무엇을 저장할지·어느 메뉴가 켜졌는지는 전부 `ui.tsx` 가 들고 있고 여기로 내려준다.
 *   그래야 껍데기를 갈아입혀도 기능이 딸려 나가지 않는다.
 *
 * ★ 「디자인 1(모던 & 심플)」 — 메뉴를 위에 한 줄로 눕힌다.
 *   왼쪽에 짙은 기둥을 세우면 미리보기가 좁아지고 「전산실 프로그램」처럼 보인다
 *   (docs/specs/디자인정의-어드민-편집화면-2026-09-09.md §2).
 *
 * ⚠ **미리보기 창 «안»은 사장님 테마다.** 편집 도구의 밝은/어두운이 새어 들어가면 안 된다.
 *   iframe 은 별개 문서라 CSS 변수가 상속되지 않는다 — 그래서 저절로 지켜진다.
 *   `preview` 슬롯 안에 편집 도구용 색을 직접 칠하지 마라.
 *
 * ⚠ 앵커 2개(`btn-publish` · `panel-preview`)가 여기 붙는다.
 *   `config/tours.ts` 의 ACTIVE_ANCHORS 가 이 둘을 요구한다(CLAUDE.md 규칙 3).
 *   조건부 렌더링으로 사라지게 하지 마라.
 *   ★ 2026-09-16 — 나머지 하나 `score-bar` 는 **점수·막대와 함께 왼쪽 칸(rail)으로 갔다.**
 *     `rail` 슬롯은 여기서 늘 그려지므로 「사라지지 않는다」는 조건은 그대로다.
 */

type Props = {
  businessName: string;
  menu: EditorMenuId;
  onMenu: (m: EditorMenuId) => void;
  /** 문의함 배지 — 0 이면 안 그린다 */
  newCount: number;
  /** 이야기 메뉴 옆 개수 */
  storyCount: number;
  busy: string;
  onSave: () => void;
  onPublish: () => void;
  /** 자동저장 상태 줄 */
  status: React.ReactNode;
  /** 로그아웃 버튼 — `/my` 것을 그대로 쓴다(앵커를 새로 만들지 않는다) */
  logout: React.ReactNode;
  /** 상단 바 아래 늘 보이는 알림 — 계정 연결·무료 기간 */
  banners: React.ReactNode;
  /** 왼쪽 칸 — 완성도 숫자+막대(앵커 score-bar)·점수 힌트·섹션 목록 */
  rail: React.ReactNode;
  /** 오른쪽 칸 — 미리보기 (PC 에서만) */
  preview: React.ReactNode;
  /** 껍데기 «안»에 떠 있는 것들 — 폰 아래 고정 바 · 전체화면 시트 · 토스트 · 결제 모달.
   *  ⚠ 토스트를 껍데기 밖에 두면 어두운 화면에서 글자가 안 보인다
   *    (`.toast` 는 --n-0 를 글자색으로 쓰는데 다크 다리가 그걸 어두운 면으로 바꾼다). */
  overlays: React.ReactNode;
  slug: string;
  children: React.ReactNode;
};

const COUNT: Partial<Record<EditorMenuId, "story" | "inbox">> = { story: "story", inbox: "inbox" };

/** 메뉴 버튼에 붙는 앵커 — 이름은 config/tours.ts·completeness.ts 에서만 온다(규칙 3) */
const MENU_ANCHOR: Partial<Record<EditorMenuId, string>> = { story: "story-new", inbox: "panel-inbox" };

/**
 * ★ 2026-09-16 대표님 — 탭 **순서**: [홈페이지][디자인][영상][이야기][연결][문의함].
 *   「영상」을 셋째로 올린다. 기본 설정은 전부 「홈페이지」에서 되게 한다는 방침의 첫 걸음이다.
 *
 * ⚠ **여기가 순서의 «진짜» 자리가 아니다.** 원래 순서는 `config/editor-menu.ts` 의 배열이다.
 *   이번 작업은 이 파일 하나만 고치도록 배정돼서 순서를 여기서 다시 세운다.
 *   ★ 나중에 `config/editor-menu.ts` 의 배열 자체를 이 순서로 바꾸고 **이 표는 지워라.**
 *   (두 곳에 순서가 있으면 언젠가 반드시 어긋난다)
 *
 * ★ 여기에 **없는 메뉴는 사라지지 않고 맨 뒤로 간다.** 나중에 설정에서 메뉴를 하나 켰는데
 *   이 표에 이름이 없다고 화면에서 통째로 빠지는 사고를 막는다.
 */
const MENU_ORDER: EditorMenuId[] = ["home", "design", "video", "story", "link", "inbox"];

const menuRank = (id: EditorMenuId) => {
  const i = MENU_ORDER.indexOf(id);
  return i < 0 ? MENU_ORDER.length : i;
};

/** 화면에 그릴 순서대로 세운 메뉴. sort 는 안정정렬이라 «표에 없는 것»끼리는 원래 순서를 지킨다 */
const ORDERED_MENUS = [...VISIBLE_EDITOR_MENUS].sort((a, b) => menuRank(a.id) - menuRank(b.id));

/**
 * 🔴 2026-09-16 대표님 — **폰에서 탭 줄이 잘리는 문제**를 고치는 규칙들.
 *
 * ⚠ 왜 여기(컴포넌트 안 `<style>`)에 있나 — 원래 자리는 `app/globals.css` 다.
 *   이번 작업은 **이 파일 하나만** 고치도록 배정됐다. 그래서 여기에 둔다.
 *   ★ 나중에 이 덩어리를 `globals.css` 의 `.editor-menu` 옆으로 **통째로 옮기고 여기서 지워라.**
 *
 * ★ 레이어 밖 규칙이라 `@layer components` 안의 globals.css 규칙을 **이긴다**(명시도와 무관).
 *   globals.css 1473줄 위 주석에 같은 설명이 있다 — 같은 원리다.
 *
 * ⚠ 색·간격·글자크기는 **전부 CSS 변수**다. 새 숫자를 손으로 적지 않는다.
 *   딱 하나 `calc(var(--s-6) + var(--s-1))` = 36px 은 «누르기 쉬운 최소 높이»다.
 *   변수 두 개를 더해 만든 값이라 나중에 간격 체계가 바뀌어도 같이 움직인다.
 */
const MENU_CSS = `
.editor-menu {
  /* 간격을 24px → 4px 로 줄이고, 대신 «버튼 자체»에 좌우 여백을 준다.
     ⚠ 이렇게 해야 눈에 보이는 틈은 좁아지면서 **누르는 자리는 오히려 넓어진다.** */
  gap: var(--s-1);
  padding-inline: var(--s-3);
}
.editor-menu-item {
  display: inline-flex; align-items: center;
  /* 🔴 36px 아래로 내려가지 않는다 — 손가락으로 누르는 자리다 */
  min-height: calc(var(--s-6) + var(--s-1));
  padding: var(--s-2) var(--s-2) var(--s-3);
}
/* 작은 폰(≤639px)에서는 글자를 15px → 13px 로. 360px 에서 여섯 개가 한 눈에 들어온다 */
@media (max-width: 639px) {
  .editor-menu-item { font-size: var(--t-caption); }
}
/* ★ «오른쪽에 더 있다»를 보이게 — 옅은 그라데이션.
   🔴 대표님: **잘린 줄 모르는 것이 가장 나쁘다.**
   ⚠ 메뉴가 짧아 스크롤이 없을 때는 그 자리가 어차피 빈 바탕(--surface)이라 **아무것도 안 보인다.**
     그래서 항상 켜 두어도 해가 없다. 자바스크립트를 쓰지 않는 이유다.
   ⚠ 끝까지 밀었을 때 마지막 탭이 살짝 흐려진다 — 잘린 것을 못 보는 쪽보다 낫다고 판단했다. */
.editor-menu-row { position: relative; }
.editor-menu-row::after {
  content: ""; position: absolute; inset-block: 0; right: 0; width: var(--s-5);
  background: linear-gradient(to right, transparent, var(--surface));
  pointer-events: none;
}
/* ★ [내 사이트 ↗] 가 상단 오른쪽으로 올라오면서 버튼이 다섯이 됐다.
   ⚠ 360px 에서 한 줄에 다 못 들어간다 — **접히게** 둔다. 안 접으면 화면 밖으로 잘린다. */
.editor-actions { flex-wrap: wrap; justify-content: flex-end; row-gap: var(--s-2); }
.editor-actions .editor-view-link {
  display: inline-flex; align-items: center;
  min-height: calc(var(--s-6) + var(--s-1));
  padding-inline: var(--s-2);
}
`;

export function EditorShell(p: Props) {
  return (
    <div className="editor-shell">
      {/* ── 상단 바 ── */}
      <header className="editor-bar">
        <div className="editor-bar-row">
          <span className="editor-brand">
            {/* ★ 밝은/어두운 전환은 Logo 가 스스로 한다 — 부르는 쪽은 한 줄이면 된다.
                ★ 2026-09-15 대표님 — **누르면 온스토리 홈으로 간다.**
                  ⚠ 편집 내용은 자동저장된다(상단 `status` 줄). 그래서 같은 탭으로 보낸다. */}
            <Link href="/" aria-label="온스토리 홈" className="flex items-center" style={{ minHeight: "var(--tap)" }}>
              <Logo height={20} priority={false} />
            </Link>
          </span>

          {/* ★★ 2026-09-16 대표님 — **완성도 점수는 막대와 «한 몸»이라 왼쪽 칸으로 내려갔다.**
                (숫자 + 막대는 이제 `ui.tsx` 의 ScoreMeter 하나가 함께 그린다)

              ⚠ 왜 여기 상단바에 두면 안 되나 — **폰에서 숫자가 잘린다.**
                360px 실측 셈: 좌우 여백 32px 을 빼면 328px. 로고는 639px 아래에서 숨겨지지만
                오른쪽 버튼 넷(저장·사이트 반영·밝기·로그아웃)이 260px 가까이 먹는다.
                그러면 이 칸(.editor-ident)에 **60~96px 밖에 안 남는다.**
                「완성도 65점/100점」은 13px 글자로 약 95px 이라 **말줄임표로 잘려** 정작 점수가 사라진다.
                (globals.css 의 `.editor-ident { flex: 1 1 6rem }` 주석에도 같은 실측이 적혀 있다)
                왼쪽 칸은 폰에서 **화면 전체 폭(328px)**을 쓴다 — 거기가 제자리다.

              ⚠ 앵커 `score-bar` 도 점수를 따라 왼쪽 칸으로 갔다. 규칙 3 은 그대로 지켜진다 —
                왼쪽 칸도 «껍데기»라 어느 메뉴를 보고 있든 DOM 에 늘 있다
                (lib/editor/anchors.ts 가 score-bar 를 「메뉴를 바꿀 필요가 없는 앵커」로 적어 둔 그 조건). */}
          <div className="editor-ident">
            <p className="editor-ident-name">{p.businessName}</p>
            {p.status}
          </div>

          <div className="editor-actions">
            {/* ★ 2026-09-16 대표님 — [내 사이트 ↗] 는 **헤더 오른쪽 위**가 제자리다.
                  탭 줄에 있으면 작은 폰에서 메뉴를 가린다.
                ⚠ 2026-09-09 의 교훈은 **버리지 않는다** — 「폰에서 숨긴다」는 절대 안 된다.
                  그때 이 링크를 폰에서 감췄더니, 사장님이 «사이트 반영»을 누른 뒤
                  손님 화면을 확인할 길이 통째로 사라졌다(대조 검사가 잡아냈다).
                  그래서 **모든 폭에서 보인다.** 자리가 없으면 숨기지 말고 «접어라»
                  (바로 위 MENU_CSS 의 .editor-actions flex-wrap). */}
            <a href={`/${p.slug}`} target="_blank" rel="noopener" className="t-caption editor-view-link">내 사이트 ↗</a>
            <button type="button" onClick={p.onSave} disabled={!!p.busy} className="btn btn-secondary btn-xs t-caption">
              {p.busy === "save" ? "저장 중…" : "저장"}
            </button>
            <button type="button" data-tour="btn-publish" onClick={p.onPublish} disabled={!!p.busy} className="btn btn-primary btn-xs t-caption">
              {p.busy === "publish" ? "반영 중…" : "사이트 반영"}
            </button>
            {/* ★ 2026-09-15 대표님 — 사장님도 밝기를 껐다 켤 수 있다. 기본은 **밝은 화면**.
                이 브라우저에서만 기억한다(`lib/admin-theme.ts`). */}
            <AdminThemeToggle className="btn btn-secondary btn-xs t-caption" />
            {p.logout}
          </div>
        </div>

        {/* ── 메뉴 한 줄 ── */}
        <div className="editor-menu-row">
        {/* ⚠ 위 MENU_CSS 주석 참고 — 원래 자리는 globals.css 다. 옮길 때 통째로 옮겨라 */}
        <style>{MENU_CSS}</style>
        <nav className="editor-menu" aria-label="편집 메뉴">
          {ORDERED_MENUS.map((m) => {
            const on = m.id === p.menu;
            const kind = COUNT[m.id];
            const n = kind === "inbox" ? p.newCount : kind === "story" ? p.storyCount : 0;
            return (
              <button
                key={m.id}
                type="button"
                data-tour={MENU_ANCHOR[m.id]}
                aria-current={on ? "page" : undefined}
                title={m.desc}
                onClick={() => p.onMenu(m.id)}
                className={`editor-menu-item${on ? " is-on" : ""}`}
              >
                {m.label}
                {kind === "inbox" && n > 0 && <span className="editor-badge">{n}</span>}
                {kind === "story" && <span className="editor-count">({n})</span>}
              </button>
            );
          })}
        </nav>
        {/* ⚠ 여기 있던 [내 사이트 ↗] 는 2026-09-16 에 **헤더 오른쪽 위**로 옮겼다(위 editor-actions).
            탭 줄에 있으면 작은 폰에서 메뉴를 가렸다. globals.css 의 `.editor-view-link` 주석은
            아직 옛 자리를 설명하고 있다 — 그 파일을 고칠 때 같이 고쳐라. */}
        </div>
      </header>

      {/* ── 3단 ── */}
      <div className="editor-body">
        <aside className="editor-rail">{p.rail}</aside>
        <main className="editor-main">
          {p.banners}
          {p.children}
        </main>
        <aside data-tour="panel-preview" className="editor-preview">{p.preview}</aside>
      </div>

      {p.overlays}
    </div>
  );
}
