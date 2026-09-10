import { type EditorMenuId } from "@/config/editor-menu";

/**
 * 편집화면 앵커 — **정의는 여기 한 곳뿐이다** (2026-09-09, S2⑥).
 *
 * ⚠ 전에는 같은 코드가 **사본 둘**이었다 — `ui.tsx` 의 `goToAnchor` 와
 *   `widgets-panel.tsx` 의 `scrollToAnchor`. 한쪽만 고치면 다른 쪽이 조용히
 *   옛 동작으로 남는다. 껍데기를 새로 짜면서 하나로 합쳤다.
 *
 * ★ 앵커 이름은 `config/tours.ts` · `config/completeness.ts` 에서만 온다
 *   (CLAUDE.md 불변 규칙 3 — 임의 작명 금지). 여기서는 **그 앵커가 어느 메뉴에 사는지**만 적는다.
 *
 * ★ 왜 이 표가 필요한가: 상단 메뉴로 화면을 나누면 지금 열려 있지 않은 메뉴의 앵커는
 *   **DOM 에 아예 없다.** 「＋10점 연결 버튼 켜기」를 눌렀는데 아무 일도 안 일어나면
 *   버튼이 고장난 것처럼 보인다. 그래서 먼저 메뉴를 바꾸고 나서 찾는다.
 */

/**
 * 앵커 → **그 앵커를 눌렀을 때 열려야 하는 메뉴.**
 *
 * 여기 없는 앵커는 **껍데기(상단바·왼쪽 칸·미리보기)에 늘 떠 있는 것**이라
 * 메뉴를 바꿀 필요가 없다: `score-bar` · `btn-publish` · `panel-preview`.
 *
 * ⚠ **`story-new`·`panel-inbox` 는 앵커가 «메뉴 버튼» 위에 붙어 있다**(shell.tsx 의 MENU_ANCHOR).
 *   즉 어느 메뉴를 보고 있든 DOM 에서 늘 찾힌다. 그래서 `goToAnchor` 는 **찾기 전에**
 *   이 표부터 본다 — 순서를 뒤집으면 메뉴 버튼만 반짝이고 화면은 안 바뀐다.
 *   2026-09-09 반증 검사가 잡아냈다(배점 최고 15점 「첫 스토리 작성」 힌트가 먹통이었다).
 */
export const ANCHOR_MENU: Record<string, EditorMenuId> = {
  "panel-sections": "home",
  "sec-hero": "home",
  "panel-photos": "home",
  "sec-form": "home",
  "set-contact": "home",
  "set-hours": "home",
  "panel-brand": "design",
  "panel-widgets": "link",
  "panel-inbox": "inbox",
  "story-new": "story",
};

/** 이 앵커를 보려면 어느 메뉴로 가야 하나. 껍데기에 늘 있는 앵커면 null */
export const menuOfAnchor = (anchor: string): EditorMenuId | null => ANCHOR_MENU[anchor] ?? null;

/** 강조 링을 붙였다 떼는 시간(ms). `docs/MOTION.md` 허용 목록 안 */
const RING_MS = 1800;
const RING = ["ring-2", "ring-green-600", "ring-offset-2", "rounded-xl"];

/**
 * 앵커 자리로 스크롤하고 잠깐 강조한다. **찾았으면 true.**
 *
 * ⚠ `prefers-reduced-motion` 을 존중한다 — 부드러운 스크롤이 어지러운 사람이 있다.
 */
export function highlightAnchor(anchor: string): boolean {
  return highlightEl(document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`));
}

/**
 * 앵커가 아닌 자리로도 데려간다 — 왼쪽 칸의 «섹션 목록»이 쓴다.
 *
 * ⚠ 섹션 카드 12종 중 앵커가 있는 건 넷뿐이다(sec-hero·sec-form·set-contact·set-hours).
 *   나머지는 `config/tours.ts` 에 이름이 없어서 앵커를 새로 지으면 규칙 3 위반이다.
 *   그래서 앵커가 아니라 **평범한 id** 로 찾는다.
 */
export const highlightId = (id: string): boolean => highlightEl(document.getElementById(id));

function highlightEl(el: HTMLElement | null): boolean {
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.classList.add(...RING);
  window.setTimeout(() => el.classList.remove(...RING), RING_MS);
  return true;
}
