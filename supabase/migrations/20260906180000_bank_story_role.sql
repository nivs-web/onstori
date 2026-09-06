-- 이미지뱅크에 story 역할 추가 + 휴지통 기록 — 2026-09-06 회장님 확정
--
-- 배경: 히어로를 **가로 1장**으로 확정했다(PC·폰이 같은 사진). 폰에서는 100svh 로 채워
--   가로의 가운데 26% 만 남으므로 구도가 그에 맞아야 한다.
--   그동안 만든 **세로(9:16) 히어로는 히어로로 쓰지 않는다.** 다만 지우지 않고
--   SNS·이야기 페이지 재고로 남긴다 → role='story' 로 옮긴다.
--   기존 check 제약이 hero/about/gallery/process 넷만 허용해 그대로는 못 옮긴다.

alter table image_bank drop constraint if exists image_bank_role_check;
alter table image_bank add constraint image_bank_role_check
  check (role in ('hero', 'about', 'gallery', 'process', 'story'));

comment on column image_bank.role is
  'hero=가로 16:9 첫 화면 / about·gallery·process=본문 / story=세로 9:16, SNS·이야기 페이지용(히어로로 쓰지 않는다)';

-- ── 휴지통 ──────────────────────────────────────────────────
-- ★ 삭제는 **되돌릴 수 있는 표시 변경**으로만 한다. 원본 파일(R2)은 지우지 않는다.
--   기존에도 deleted 플래그는 있었지만 언제·왜 내렸는지가 남지 않아 복구 판단이 어려웠다.
alter table image_bank add column if not exists deleted_at timestamptz;
alter table image_bank add column if not exists deleted_reason text;

comment on column image_bank.deleted_at is
  '휴지통으로 내린 시각. deleted=true 와 짝. 파일은 지우지 않으므로 언제든 복구할 수 있다.';

create index if not exists image_bank_trash_idx on image_bank (deleted_at desc) where deleted;

-- 이미 내려가 있던 행에 시각을 채워 둔다(정확한 시각을 모르므로 생성 시각으로 갈음)
update image_bank set deleted_at = created_at where deleted and deleted_at is null;

-- ── 히어로 표시 위치 (준비만) ───────────────────────────────
-- 가로 1장을 폰에서 object-fit:cover 로 채울 때, 사진마다 어디를 중심으로 자를지 다르다.
-- 지금은 저장 자리만 만들어 둔다 — 화면 적용은 회장님 지시 뒤에 (2026-09-06 "준비만 해라").
-- CSS object-position 값을 그대로 담는다. 예: '50% 50%'(기본) · '50% 35%'(위쪽을 더 보이게)
alter table image_bank add column if not exists focal_point text;

comment on column image_bank.focal_point is
  'CSS object-position 값. 폰에서 가운데 26%만 남을 때 어디를 중심으로 자를지. 비어 있으면 50% 50%.';
