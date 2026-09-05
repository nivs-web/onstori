import type { SiteDocT, WidgetT } from "@/lib/schema";
import { contactOf } from "./index";

/**
 * 플로팅 연결 위젯 (2026-09-05) — 스크롤 어디서나 전화·카톡이 눌린다.
 *
 * ⚠ "use client" 를 붙이지 않는다. 순수 <a> 뿐이라 JS 가 필요 없고, 미리보기 셸
 *   (app/[slug]/preview/preview-client.tsx)이 이 모듈을 끌어가므로 fs·path·supabase·
 *   process.env 를 여기서 import 하지 않는다.
 * ⚠ 값은 위젯이 갖지 않는다 — contactOf(doc) 로 quoteForm 섹션에서 파생한다.
 * ⚠ 색은 테마 변수만 쓴다. 흰색을 하드코딩하면 premium 팔레트(bg #12151B · onAccent #12151B)에서
 *   글자가 배경에 묻힌다. 아래 두 조합만 팔레트 4종 전부에서 대비가 성립한다.
 */

const ICON: Record<WidgetT["kind"], React.ReactElement> = {
  call: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M6.6 10.8a15.3 15.3 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.15.38 2.36.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  ),
  kakao: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M12 3.6c-4.7 0-8.5 2.86-8.5 6.4 0 2.28 1.58 4.28 3.97 5.47l-.79 3.03a.4.4 0 0 0 .6.44l3.58-2.28c.37.04.74.06 1.14.06 4.7 0 8.5-2.86 8.5-6.4S16.7 3.6 12 3.6z" />
    </svg>
  ),
};

/** 버튼 이름은 사장님이 바꿀 수 있으므로, 읽어주는 문구는 행동으로 고정한다. */
const ARIA: Record<WidgetT["kind"], string> = {
  call: "전화 걸기",
  kakao: "카카오톡으로 문의하기",
};

export function ConnectWidget({ doc }: { doc: SiteDocT }) {
  const { tel, kakaoUrl } = contactOf(doc);

  // 값이 없는 종류는 아예 그리지 않는다(죽은 링크 금지).
  // 같은 kind 가 두 번 들어와도 첫 항목만 그린다 — 스키마에 refine 을 넣지 않았다.
  const seen = new Set<WidgetT["kind"]>();
  const items = (doc.widgets ?? []).flatMap((w) => {
    if (seen.has(w.kind)) return [];
    seen.add(w.kind);
    const href = w.kind === "call" ? (tel ? `tel:${tel}` : "") : kakaoUrl;
    return href ? [{ kind: w.kind, label: w.label, href }] : [];
  });
  if (items.length === 0) return null;

  return (
    <>
      {/* 모바일 고정 바가 footer·#quote 하단을 가리지 않도록 자리를 먼저 비운다 */}
      <div aria-hidden className="h-20 sm:hidden" />
      <nav
        aria-label="연결 버튼"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-5 sm:left-auto sm:right-5 sm:flex-col sm:p-0"
      >
        {items.map((w) => (
          <a
            key={w.kind}
            href={w.href}
            aria-label={ARIA[w.kind]}
            {...(w.kind === "kakao" ? { target: "_blank", rel: "noreferrer" } : {})}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold shadow-lg sm:min-w-[128px] sm:flex-none"
            style={
              w.kind === "call"
                ? { background: "var(--s-accent)", color: "var(--s-on-accent)" }
                : { background: "var(--s-bg)", border: "1px solid var(--s-accent)", color: "var(--s-accent)" }
            }
          >
            {ICON[w.kind]}
            {w.label}
          </a>
        ))}
      </nav>
    </>
  );
}
