/**
 * 운영자 메모 항목 — **서버·클라이언트 양쪽이 쓰는 순수 함수**.
 *
 * ⚠ 왜 파일을 나눴나 (2026-09-07 프로덕션 사고):
 *   처음에는 이 함수가 `app/admin/notes.tsx` 안에 있었다. 그 파일은 `"use client"` 다.
 *   서버 컴포넌트(app/admin/page.tsx)가 거기서 `parseItems` 를 import 해 **서버에서 호출**했고,
 *   **빌드는 통과했지만 런타임에 /admin 전체가 500** 이 났다
 *   ("Application error: a server-side exception has occurred").
 *   `"use client"` 모듈의 함수는 클라이언트 경계 너머에 있어 서버가 부를 수 없다.
 *   → 순수 함수는 이렇게 경계 없는 파일에 둔다. 양쪽에서 안전하게 쓴다.
 */

export type NoteItem = { id: string; text: string; at: string; doneAt?: string };

export const noteUid = () => Math.random().toString(36).slice(2, 10);

/** DB 의 body(JSON 문자열)를 항목 배열로. 깨진 값이 와도 절대 던지지 않는다 —
 *  메모 하나 때문에 운영자 화면 전체가 죽으면 안 된다. */
export function parseItems(body: string): NoteItem[] {
  try {
    const v = JSON.parse(body);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.text === "string")
      .map((x) => ({
        id: typeof x.id === "string" ? x.id : noteUid(),
        text: x.text,
        at: typeof x.at === "string" ? x.at : new Date().toISOString(),
        doneAt: typeof x.doneAt === "string" ? x.doneAt : undefined,
      }));
  } catch {
    return [];
  }
}
