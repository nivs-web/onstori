"use client";

import { useEffect, useState } from "react";

const KEY = "onstori-admin-theme";

/**
 * 운영자 콘솔 다크모드 토글 — 대시보드 맨 왼쪽 위 (2026-09-07 회장님).
 *
 * ★ **운영자 화면에만** 켜진다. `html` 에 `data-admin-theme="dark"` 를 붙이지만,
 *   globals.css 의 선택자가 `.admin-shell`/`.admin-side` 안쪽으로 한정돼 있어
 *   손님 첫 페이지·사장님 사이트에는 아무 영향이 없다.
 *
 * ⚠ 이 컴포넌트가 사라질 때(운영자 화면을 떠날 때) 속성을 **지운다.**
 *   안 지우면 같은 탭에서 손님 화면으로 넘어갔을 때 속성만 남아 떠돈다.
 *   지금은 스코프 때문에 해가 없지만, 나중에 누가 스코프를 넓히면 그때 사고가 난다.
 *
 * ⚠ 첫 렌더에서 잠깐 밝게 보였다가 어두워진다(localStorage 는 서버에서 못 읽는다).
 *   운영자 화면이라 그 정도는 감수한다 — 깜빡임을 없애자고 layout 에 inline script 를
 *   넣으면 손님 화면 번들까지 건드리게 된다.
 */
export function AdminThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "dark") setDark(true);
    } catch { /* 사생활 보호 모드 등 — 기본(밝게)으로 둔다 */ }
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    if (dark) el.dataset.adminTheme = "dark";
    else delete el.dataset.adminTheme;
    try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch { /* 무시 */ }
    return () => { delete el.dataset.adminTheme; };
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((v) => !v)}
      aria-pressed={dark}
      className="btn btn-secondary t-caption"
      title={dark ? "밝은 화면으로" : "어두운 화면으로"}
    >
      {dark ? "라이트모드" : "다크모드"}
    </button>
  );
}
