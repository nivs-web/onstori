import { createClient } from "@supabase/supabase-js";

/**
 * 본사 첫 페이지의 섹션 보이기/가리기 (docs/admin.md §7 단계 2).
 * 지금까지 app/page.tsx 에 `SHOW_INSIDE = false` 로 박혀 있던 스위치를 DB(page_sections)로 옮긴다.
 *
 * ★ 안전 기본값은 **보이기(true)** 다.
 *   DB 를 못 읽었을 때(연결 끊김·표 없음·마이그레이션 전) 첫 페이지가 텅 비면 안 된다.
 *   단계 2 검증 조건이 "DB 연결을 끊고도 모든 섹션이 보이는지" 인 이유가 이것이다.
 *   ⚠ 예외: 'inside' 는 회장님이 2026-09-06 에 끄라고 하신 섹션이라 **기본값이 false** 다.
 *     이것만은 DB 를 못 읽어도 꺼진 채로 둔다 — 켜진 채로 나가면 안 되는 화면이기 때문.
 */

export type SectionId = "inside" | "portfolio" | "channels" | "pricing" | "faq";

/** DB 를 못 읽었을 때 쓰는 값 */
const FALLBACK: Record<SectionId, boolean> = {
  inside: false,   // ⚠ 유일하게 기본 꺼짐 (회장님 지시)
  portfolio: true,
  channels: true,
  pricing: true,
  faq: true,
};

export type SectionRow = { id: string; label: string; visible: boolean; sort: number };

/**
 * 공개 페이지가 부른다 — anon 클라이언트로 읽는다(page_sections 는 읽기 공개).
 * 어떤 이유로든 실패하면 FALLBACK 을 준다. 절대 던지지 않는다.
 */
export async function sectionVisibility(): Promise<Record<SectionId, boolean>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ...FALLBACK };
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await sb.from("page_sections").select("id, visible");
    if (error || !data?.length) return { ...FALLBACK };
    const out = { ...FALLBACK };
    for (const r of data) if (r.id in out) out[r.id as SectionId] = !!r.visible;
    return out;
  } catch {
    return { ...FALLBACK };
  }
}

/** 어드민 화면용 — 라벨·순서까지 필요하다 */
export async function sectionRows(sb: { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: SectionRow[] | null }> } } }): Promise<SectionRow[]> {
  const { data } = await sb.from("page_sections").select("id, label, visible, sort").order("sort", { ascending: true });
  return data ?? [];
}
