"use client";

import { Logo } from "@/components/site/logo";
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
 * ⚠ 앵커 3개(`score-bar` · `btn-publish` · `panel-preview`)가 여기 붙는다.
 *   `config/tours.ts` 의 ACTIVE_ANCHORS 가 이 셋을 요구한다(CLAUDE.md 규칙 3).
 *   조건부 렌더링으로 사라지게 하지 마라.
 */

type Props = {
  businessName: string;
  score: number;
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
  /** 왼쪽 칸 — 완성도·점수 힌트·섹션 목록 */
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

export function EditorShell(p: Props) {
  return (
    <div className="editor-shell">
      {/* ── 상단 바 ── */}
      <header className="editor-bar">
        <div className="editor-bar-row">
          <span className="editor-brand">
            <span className="logo-light"><Logo height={20} priority={false} /></span>
            <span className="logo-dark"><Logo variant="white" height={20} priority={false} /></span>
          </span>

          <div data-tour="score-bar" className="editor-ident">
            <p className="editor-ident-name">{p.businessName}</p>
            <p className="t-caption editor-ident-score">
              완성도 <b style={{ color: "var(--brand-ink)" }}>{p.score}점</b> / 100
            </p>
            {p.status}
          </div>

          <div className="editor-actions">
            <button type="button" onClick={p.onSave} disabled={!!p.busy} className="btn btn-secondary btn-xs t-caption">
              {p.busy === "save" ? "저장 중…" : "저장"}
            </button>
            <button type="button" data-tour="btn-publish" onClick={p.onPublish} disabled={!!p.busy} className="btn btn-primary btn-xs t-caption">
              {p.busy === "publish" ? "반영 중…" : "사이트 반영"}
            </button>
            {p.logout}
          </div>
        </div>

        {/* ── 메뉴 한 줄 ── */}
        <div className="editor-menu-row">
        <nav className="editor-menu" aria-label="편집 메뉴">
          {VISIBLE_EDITOR_MENUS.map((m) => {
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
        {/* ★ [내 사이트 ↗] 는 **옛 탭 줄 오른쪽 끝**이 제자리다(2026-09-09 대조가 잡아냈다).
            상단 바에 뒀더니 폰에서 자리가 없어 숨겨졌고, 사장님이 «반영»한 뒤 손님 화면을
            확인할 길이 통째로 사라졌다. 여기는 메뉴가 넘쳐도 밀려나지 않는다(스크롤 밖). */}
        <a href={`/${p.slug}`} target="_blank" rel="noopener" className="t-caption editor-view-link">내 사이트 ↗</a>
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
