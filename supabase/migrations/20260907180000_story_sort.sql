-- 2026-09-07 이야기(영상) 순서 — 회장님 결정 [L]-3
-- ⚠ 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)
--    이 파일은 만들어만 뒀다. 클코가 직접 돌리지 않는다.
--
-- 왜 새 표가 아니라 칸 하나인가 (docs/specs/video-섹션-조사-2026-09-07.md §3):
--   story_entries 는 이미 「한 줄 = 영상 한 편」이다. 설명(body)·발행본(video_out_key)·
--   숨김(visible)이 전부 있다. 진짜로 없는 건 명시적 순서 하나뿐이었다.
--   새 표를 만들면 RLS 정책 2개(stories_public_read·stories_owner_all)와
--   완성도 점수(config/completeness.ts)·실적 카운터(workCount)를 전부 복제하게 된다.

alter table story_entries
  add column if not exists sort int not null default 0;

-- 정렬은 `order by sort asc, entry_date desc` 로 읽는다.
-- ★ 기존 줄은 전부 sort=0 이라 **지금 순서가 그대로 유지된다.** 데이터는 건드리지 않는다.
-- 되돌리려면 이 칸을 안 읽으면 그만이다(칸을 지울 필요도 없다 — 불변 규칙 10 정신).
create index if not exists story_entries_order_idx
  on story_entries (site_id, sort, entry_date desc);
