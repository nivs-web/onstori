/**
 * 사장님 편집화면 메뉴 — **단일 출처** (2026-09-09, S2⑥).
 *
 * 상단 가로 메뉴·메뉴별 화면·앵커 표가 전부 이 배열 하나를 읽는다.
 * `config/admin-menu.ts` 와 같은 규약이다 — 화면이 늘면 여기 한 줄만 더한다.
 *
 * ★ 배치는 「디자인 1(모던 & 심플)」 — 상단 가로 메뉴 한 줄.
 *   왼쪽 세로 기둥을 세우지 않는 이유는 미리보기 폭을 뺏기고 「전산실 프로그램」처럼
 *   보이기 때문이다(docs/specs/디자인정의-어드민-편집화면-2026-09-09.md §2).
 *
 * ⚠ `ready:false` 는 **아직 없는 화면**이다. 운영자 콘솔과 달리 **그리지 않는다.**
 *   운영자는 앞으로 뭐가 올지 보고 싶어 하지만, 사장님에게 안 눌리는 메뉴는
 *   「고장났나?」로만 읽힌다. 자리는 여기 남겨 두고 화면에는 안 내보낸다.
 *
 * ⚠ 시안의 메뉴 이름 「콘텐츠」는 **「이야기」**다(2026-09-09 회장님 확정).
 *   ★ 바뀐 것은 **화면에 보이는 말뿐**이다 — 아래 `id` 나 코드·DB 칼럼은 그대로 둔다.
 *
 * ⚠ 시안에 없던 **「문의함」을 넣었다.** 시안은 문의함이 생기기 전에 그린 그림이다.
 *   알림 문자가 심는 링크가 `?tab=inbox` 라(lib/notify.ts) 이 자리가 없으면
 *   사장님이 문자를 받고도 열 곳이 없다.
 */

export type EditorMenuId =
  | "home" | "design" | "story" | "link" | "inbox"
  | "photo" | "video" | "settings";

export type EditorMenu = {
  id: EditorMenuId;
  /** 사장님이 보는 이름. 어려운 말을 쓰지 않는다 */
  label: string;
  /** 메뉴 아래·도움말에 쓰는 한 줄 */
  desc: string;
  /** false = 아직 없는 화면. 화면에 그리지 않는다 */
  ready: boolean;
};

export const EDITOR_MENUS: EditorMenu[] = [
  { id: "home",     label: "홈페이지", desc: "첫 화면·소개·문의 같은 칸을 고쳐요", ready: true },
  { id: "design",   label: "디자인",   desc: "분위기와 색을 골라요",               ready: true },
  { id: "story",    label: "이야기",   desc: "오늘 있었던 일을 올려요",            ready: true },
  { id: "link",     label: "연결",     desc: "전화·카카오톡 버튼을 켜요",          ready: true },
  { id: "inbox",    label: "문의함",   desc: "손님이 남긴 문의를 봐요",            ready: true },
  // ── 아래는 아직 없는 화면 (S3~S5). 자리만 잡아 둔다 ──
  { id: "photo",    label: "사진",     desc: "사진을 모아서 관리해요",             ready: false },
  { id: "video",    label: "영상",     desc: "찍은 영상을 홈페이지에 걸어요",       ready: true },
  { id: "settings", label: "설정",     desc: "알림 받을 곳·계정",                  ready: false },
];

/** 화면에 실제로 그리는 메뉴 — `ready:false` 는 빠진다 */
export const VISIBLE_EDITOR_MENUS = EDITOR_MENUS.filter((m) => m.ready);

export const DEFAULT_EDITOR_MENU: EditorMenuId = "home";

/** 주소창 `?tab=` 값이나 저장된 값이 진짜 메뉴인지 — 모르는 값은 첫 메뉴로 떨어뜨린다 */
export function isEditorMenu(v: unknown): v is EditorMenuId {
  return typeof v === "string" && VISIBLE_EDITOR_MENUS.some((m) => m.id === v);
}

export const editorMenu = (id: EditorMenuId): EditorMenu =>
  EDITOR_MENUS.find((m) => m.id === id) ?? EDITOR_MENUS[0];
