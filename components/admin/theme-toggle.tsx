"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_THEME_KEY, DESIGN_APPLIED, readOverride, writeOverride, type Mode } from "@/lib/admin-theme";

/**
 * 운영자 콘솔 밝기 토글 — 대시보드 맨 왼쪽 위 (2026-09-07 회장님).
 *
 * ★ **2026-09-09 회장님 개정 — 우선순위가 뒤집혔다.**
 *   · 기본값은 「디자인 설정」(`/admin/settings/brand`)이다. 서버가 심어 준다.
 *   · 이 버튼은 **그 브라우저에서만** 임시로 뒤집는다.
 *   · 설정을 새로 [적용하기] 하면 임시값이 버려지고 새 설정으로 돌아간다
 *     (`lib/admin-theme.ts` 의 지문 대조 — 다른 브라우저까지 저절로 따라온다).
 *   ⚠ 전에는 localStorage 가 **항상** 이겨서 설정 화면이 무력했다. 되돌리지 마라.
 *
 * ★ **운영자 화면에만** 켜진다. 어드민 상자의 `data-mode` 만 바꾸고,
 *   globals.css 의 선택자가 `.admin-shell`/`.admin-side`/`.editor-shell` 안쪽으로
 *   한정돼 있어 손님 첫 페이지·사장님 사이트에는 아무 영향이 없다.
 *
 * ⚠ 첫 렌더에서는 **서버가 준 값 그대로** 보인다(깜빡임 없음). 임시값이 있으면
 *   그 뒤에 한 번 바뀐다 — 임시로 뒤집어 둔 사람만 겪는 일이라 감수한다.
 */
export function AdminThemeToggle() {
  /** null = 아직 안 읽음. 읽기 전에는 서버가 심은 값이 그대로 보인다 */
  const [dark, setDark] = useState<boolean | null>(null);

  /** 지금 화면이 어떤 상태인지 DOM 에서 읽는다. 서버가 심은 값이 기준이다 */
  const sync = useCallback(() => {
    const el = document.querySelector<HTMLElement>("[data-admin-root]");
    if (!el) return;
    const serverMode: Mode = el.dataset.mode === "dark" ? "dark" : "light";
    /* ★ 서버값이 기본이다. 임시값은 **지문이 맞을 때만** 이긴다.
       안 맞으면 readOverride 가 그 자리에서 지운다. */
    const mode = readOverride(el.dataset.designRev ?? "") ?? serverMode;
    if (mode !== serverMode) el.dataset.mode = mode;
    setDark(mode === "dark");
  }, []);

  useEffect(() => {
    /* ⚠ 이펙트 «본문»에서 곧바로 setState 하지 않는다 — 렌더가 연쇄로 돈다.
         한 틱 뒤에 읽는다. 그동안 화면은 서버가 심은 값 그대로라 깜빡임이 없다. */
    const t = window.setTimeout(sync, 0);
    /* 「디자인 설정」에서 [적용하기] 를 누르면 임시값이 지워진다 — 버튼 글자도 따라간다 */
    window.addEventListener(DESIGN_APPLIED, sync);
    return () => { window.clearTimeout(t); window.removeEventListener(DESIGN_APPLIED, sync); };
  }, [sync]);

  /** 사람이 누른 그 순간에만 저장한다 — 마운트만으로 임시값을 만들지 않는다 */
  function flip() {
    const el = document.querySelector<HTMLElement>("[data-admin-root]");
    if (!el) return;
    const next: Mode = dark ? "light" : "dark";
    el.dataset.mode = next;
    writeOverride(el.dataset.designRev ?? "", next);
    setDark(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-pressed={!!dark}
      className="btn btn-secondary t-caption"
      title={dark ? "밝은 화면으로 (이 브라우저에서만)" : "어두운 화면으로 (이 브라우저에서만)"}
      data-storage-key={ADMIN_THEME_KEY}
    >
      {dark ? "라이트모드" : "다크모드"}
    </button>
  );
}
