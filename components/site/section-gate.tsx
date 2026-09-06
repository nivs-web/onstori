import type { SectionId } from "@/lib/page-sections";

/**
 * 첫 페이지 섹션 하나를 감싸는 문 (2026-09-06).
 *
 * ★ 왜 인라인 `{show.x && ...}` 대신 컴포넌트인가:
 *   다음 배치에서 app/page.tsx 의 섹션 **순서를 다시 짜게** 되는데,
 *   인라인 조건은 잘라 붙이는 과정에서 쉽게 떨어져 나간다.
 *   섹션을 통째로 옮기면 이 문도 같이 따라오도록 감싸 두었다.
 *
 * ⚠ 새 섹션을 만들면 ① lib/page-sections.ts 의 SectionId·FALLBACK 에 추가하고
 *   ② 마이그레이션으로 page_sections 에 한 줄 넣고 ③ 여기로 감싼다. 세 곳이 한 벌이다.
 * ⚠ show 는 서버에서 한 번만 읽어 내려온다(sectionVisibility). 섹션마다 다시 읽지 마라.
 */
export function SectionGate({ show, id, children }: {
  show: Record<SectionId, boolean>;
  id: SectionId;
  children: React.ReactNode;
}) {
  if (!show[id]) return null;
  return <>{children}</>;
}
