-- 영상 «글»을 사장님이 고쳐 두는 칸 (2026-09-12 회장님 지시 C2)
--
-- ★★ 왜 필요한가: 지금은 SNS 캡션이 **질문 문장 그대로** 올라간다.
--   「오늘 가장 기억에 남는 일은 무엇이었나요?」가 인스타 글로 올라가는 것이다.
--   검토 화면에서 고쳐도 **저장할 자리가 없어** 다음에 열면 다시 질문 문장으로 돌아간다.
--   그래서 이 칸 하나가 있어야 «고친 것이 남는다».
--
-- ⚠ `title`·`question` 과 다르다:
--     · `question` — 녹화 때 사장님이 고른 질문. 영상의 «제목»으로는 쓸 만하다
--     · `caption`  — SNS 에 나가는 **본문**. 질문문이 본문이면 이상하다
--   그래서 칸을 나눈다. 합치면 한쪽을 고칠 때 다른 쪽이 같이 망가진다.
--
-- ⚠ 해시태그는 이 글 **안에** 글자로 들어간다(별도 칸을 만들지 않는다).
--   사장님이 SNS 앱에서 글을 고칠 때 태그도 같이 보여야 하기 때문이다.
--   고정 해시태그(가게 설정)만 `sites.settings.hashtags` 에 따로 둔다.
--
-- 되돌리기: alter table story_entries drop column caption;

alter table story_entries add column if not exists caption text;

comment on column story_entries.caption is
  '사장님이 검토 화면에서 고친 SNS 글 본문. 비어 있으면 question/title 로 폴백 (2026-09-12).';
