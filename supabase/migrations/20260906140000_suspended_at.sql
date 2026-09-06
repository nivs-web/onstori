-- 정지 시각 기록 — 2026-09-06 회장님 확정(무료 30일 → 정지 → 정지 후 60일 삭제)
--
-- 왜 컬럼이 필요한가: 삭제 기준이 **가입일이 아니라 정지일**이다.
--   지금까지는 삭제 시각을 trial_ends_at 에서 파생해 계산했는데, 그러면
--   결제 실패로 정지된 사장님(가입은 한참 전, 정지는 오늘)이 **정지되자마자 삭제 대상**이 된다.
--   정지된 순간을 따로 남겨야 60일을 정확히 셀 수 있다.
--
-- 되돌리기: alter table sites drop column suspended_at;  (데이터 손실 없음 — 파생값 계산에만 쓴다)

alter table sites add column if not exists suspended_at timestamptz;

comment on column sites.suspended_at is
  '홈페이지가 정지(비공개)된 시각. 삭제 예정일 = 이 값 + lib/trial.ts DELETE_AFTER_SUSPEND_DAYS. 결제로 되살아나면 null 로 되돌린다.';

-- 삭제 대상 조회가 매일 도는 크론의 첫 질의라 인덱스를 건다
create index if not exists sites_suspended_idx on sites (suspended_at) where suspended_at is not null;

-- 이미 정지돼 있던 사이트(status='expired')에 정지 시각을 채워 준다.
-- 정확한 정지 시각을 알 수 없으므로 무료 종료 시각으로 갈음한다 — 사장님에게 불리하지 않다
-- (실제 정지는 그 이후였을 것이므로 삭제일이 앞당겨지지 않고, 오히려 여유가 생긴다).
update sites set suspended_at = trial_ends_at
  where status = 'expired' and suspended_at is null and trial_ends_at is not null;
