-- 영상 «지우기» — 되돌릴 수 있게 표시만 바꾼다 (2026-09-12 회장님 지시 D2)
--
-- ★★ **불변 규칙 10을 그대로 지킨다.** 원본 파일을 지우지 않는다.
--   이유는 규칙에 적힌 그대로다 — 이미 발행된 손님 사이트가 그 주소를 문서에 갖고 있어서,
--   파일을 지우면 **남의 홈페이지 영상이 깨진다.**
--   그래서 목록에서 빼기만 하고, R2 원본과 sns_posts 기록은 그대로 둔다.
--
-- ⚠ `visible` 과 **절대 겸하게 하지 마라.** `visible` 은 **완성도 점수를 세는 칸**이다
--   (lib/score.ts 의 storyCount·photos 가 `visible = true` 만 센다). 그 칸으로 「숨기기」를 만들면
--   사장님이 숨긴 순간 **점수가 조용히 내려간다** — 불변 규칙 12 위반이다.
--   지금 화면에는 「숨기기」가 없다. 홈페이지 노출은 [홈페이지에 걸기]·[내리기]가 맡는다.
--
-- ⚠ SNS 에 이미 올라간 것은 이 칸과 **아무 상관이 없다.** 그쪽은 그쪽에서 지워야 한다 —
--   화면이 지우기 확인창에서 그 사실을 그대로 말한다(lib/sns/copy.ts SNS_DELETE_SCOPE).
--
-- 되돌리기: update story_entries set deleted_at = null where id = '...';
--           alter table story_entries drop column deleted_at, drop column deleted_reason;

alter table story_entries add column if not exists deleted_at    timestamptz;
alter table story_entries add column if not exists deleted_reason text;

-- 목록은 «안 지워진 것»만 읽는다. 그 조회가 빨라야 한다
create index if not exists story_entries_alive_idx
  on story_entries (site_id, deleted_at, created_at desc);

comment on column story_entries.deleted_at is
  '사장님이 목록에서 지운 시각. 원본 파일과 SNS 기록은 그대로 둔다 (불변 규칙 10 · 2026-09-12).';
