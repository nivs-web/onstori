-- 그쪽에서 지워진 글 표시 (2026-09-12 회장님 지시 2)
--
-- ★★ 무슨 일이 있었나: 2026-09-12 첫 인스타 게시가 성공한 뒤, 회장님이 **인스타 앱에서 그 글을
--   직접 지우셨다.** 그런데 우리 DB 는 여전히 `status='published'` 이고 화면은
--   「올라갔어요 [보기]」라고 말한다. **[보기]를 누르면 없는 글로 간다.**
--   사장님이 지우는 일도 똑같이 생긴다 — 흔하지는 않지만 반드시 생긴다.
--
-- ★ 왜 새 칸인가 (다른 길을 안 쓴 이유):
--   · `status='canceled'` 로 바꾸기 → 그 값의 뜻은 **「사장님이 올리기를 취소했다」** 다.
--     지워진 것과 취소한 것은 다른 일이라, 재활용하면 기록이 다른 방식으로 거짓말한다.
--   · 화면에 「지워졌을 수 있음」이라고만 쓰기 → **추측이다.** 안 지운 사장님에게도 그 말이 뜬다.
--     우리 규칙은 「추측으로 말하지 않는다」다.
--   → 그래서 **확인한 사실만** 적는 칸을 따로 둔다. 확인 못 한 것은 아무 말도 하지 않는다.
--
-- ⚠ `status` 는 `published` 로 **그대로 둔다.** 우리가 올린 것은 사실이고,
--   메타 심사의 「성공한 호출 1회」 증거도 그 기록이다. 지웠다고 그 사실이 없어지지 않는다.
--
-- 되돌리기: alter table sns_posts drop column remote_deleted_at, drop column remote_checked_at;

alter table sns_posts add column if not exists remote_deleted_at timestamptz;
alter table sns_posts add column if not exists remote_checked_at timestamptz;

comment on column sns_posts.remote_deleted_at is
  '그쪽(인스타 등)에서 글이 사라진 것을 «확인한» 시각. null = 아직 살아 있거나 확인 못 함 (2026-09-12).';
comment on column sns_posts.remote_checked_at is
  '마지막으로 살아 있는지 물어본 시각. 같은 글을 매일 다시 묻지 않으려고 쓴다.';

-- 확인이 오래된 것부터 집는다. 이미 지워진 것으로 확인된 글은 다시 묻지 않는다.
create index if not exists sns_posts_recheck_idx
  on sns_posts (remote_checked_at)
  where status = 'published' and remote_deleted_at is null;
