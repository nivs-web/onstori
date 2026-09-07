/**
 * 운영자 콘솔 메뉴 — **단일 출처**.
 *
 * 왼쪽 고정 메뉴 · 폰 서랍 · 현재 위치 표시가 전부 이 배열 하나를 읽는다.
 * 화면이 늘어나면 **여기 한 줄만** 더하면 된다.
 *
 * ⚠ 전에는 `app/admin/page.tsx` 안에 메뉴 배열이 박혀 있었다. 그래서 목차만 갱신되고
 *   다른 곳은 몰랐고, 실제로 라우트가 없는 카드 5장이 목차에 남아 있었다(2026-09-07 실측).
 *
 * `ready:false` 는 **아직 없는 화면**이다. 자리만 잡아 두고 회색 비활성으로 그린다 —
 * 눌러도 아무 데도 안 간다. 앞으로 무엇이 들어올지 회장님이 한눈에 보시라고 남긴다.
 */

export type AdminMenu = {
  href: string;
  label: string;
  /** 메뉴 아래 작은 설명 — 서랍에서만 보인다(사이드바는 좁다) */
  desc: string;
  ready: boolean;
};

export type AdminGroup = { group: string; items: AdminMenu[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    group: "현황",
    items: [
      { href: "/admin", label: "대시보드", desc: "오늘 밤 크론이 할 일 · 퍼널 · 결제 · AI 비용", ready: true },
      { href: "/admin/inquiries", label: "신청 접수함", desc: "당근·지인 무료 제작 신청 (P3)", ready: false },
    ],
  },
  {
    group: "회원",
    items: [
      { href: "/admin/members", label: "회원 목록", desc: "개설일 · 결제일 · 무료 남은 기간 · 연락처 · 완성도", ready: true },
      // payments 표는 이미 있다(마이그레이션 20260906120000). 화면만 없다.
      { href: "/admin/payments", label: "결제 내역", desc: "결제·실패·해지 원장", ready: false },
    ],
  },
  {
    group: "사이트",
    items: [
      { href: "/admin/sites", label: "사이트 관리", desc: "전체 고객 사이트 목록·상태", ready: true },
      { href: "/admin/showcase", label: "랜딩 포트폴리오", desc: "첫 화면에 전시할 사이트 지정·순서", ready: true },
      { href: "/admin/subdomains", label: "서브도메인", desc: "본사 내부 기능 전용 (자리만)", ready: true },
    ],
  },
  {
    group: "콘텐츠",
    items: [
      { href: "/admin/bank", label: "이미지뱅크", desc: "생성 이미지 검수·점수·삭제", ready: true },
      { href: "/admin/videos", label: "영상 관리", desc: "녹화 영상 검수·발행 (V 배치)", ready: false },
      { href: "/admin/pages", label: "온스토리 홈페이지", desc: "첫 페이지 섹션 보이기·가리기", ready: true },
      { href: "/admin/movies", label: "무비 주문", desc: "히어로 무비 제작 보드 (P6)", ready: false },
    ],
  },
  {
    group: "설정",
    items: [
      { href: "/admin/settings/brand", label: "로고·테마", desc: "본사 브랜드 자산", ready: false },
      { href: "/admin/settings", label: "예약 슬러그·운영자", desc: "쓸 수 없는 주소 · 운영자 목록", ready: false },
    ],
  },
];

/**
 * 기획실 3개 — 화면이 아니라 **문서**다. 그룹에 섞지 않고 사이드바 맨 아래 별도 묶음으로 둔다.
 * (어드민 라우트도 아니다 — /mainplan · /plandept · /onstoriplandept)
 */
export const ADMIN_DOCS: AdminMenu[] = [
  { href: "/mainplan", label: "기획1 · 이야기 엔진", desc: "온보딩 · 작업지시서 · 현황", ready: true },
  { href: "/plandept", label: "기획2 · 전략기획실", desc: "아이디어 보드 · 결정 대기", ready: true },
  { href: "/onstoriplandept", label: "기획3 · 사업 설계서", desc: "최종 기획안 · PROGRESS · DECISIONS", ready: true },
];

/**
 * 지금 어느 메뉴에 있는지.
 * ⚠ 단순 `startsWith` 로 하면 `/admin` 이 모든 화면에 걸린다. **가장 긴 것**이 이긴다.
 */
export function currentMenu(pathname: string): AdminMenu | null {
  const all = [...ADMIN_GROUPS.flatMap((g) => g.items), ...ADMIN_DOCS];
  let best: AdminMenu | null = null;
  for (const m of all) {
    if (pathname === m.href || pathname.startsWith(m.href + "/")) {
      if (!best || m.href.length > best.href.length) best = m;
    }
  }
  return best;
}
