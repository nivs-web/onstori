-- 어드민 회원 관리 (docs/admin.md §3·§7 단계 1~2) — 2026-09-06
--
-- ★ 이 파일의 두 표는 **RLS 를 켜되 정책을 하나도 만들지 않는다.**
--   그것이 곧 차단이다. service_role(sbAdmin) 만 통과한다.
--   실수로 `for select using (true)` 를 붙이면 사장님이 자기 메모를 읽게 된다.
--
-- 왜 sites 에 넣으면 안 되는가 (docs/admin.md §3-3)
--   · sites.settings 에 넣으면 app/api/site/get 이 settings 를 **통째로** 사장님에게 내려준다
--   · sites 새 컬럼에 넣으면 RLS sites_owner_all 이 주인에게 그 행을 읽게 해 준다
--   메모 칸에는 "진상 고객" 같은 말이 적힌다. 사장님이 절대 보면 안 된다.

-- ── 운영자 전용 회원 메모 ───────────────────────────────────
create table if not exists member_admin (
  site_id          uuid primary key references sites(id) on delete cascade,
  contact_name     text,                                  -- 사람 이름 (가입 흐름에 받는 칸이 없다)
  memo             text not null default '',              -- 날짜별 메모. 화면 상한 20,000자
  blacklisted      boolean not null default false,        -- ★ 표시만 한다. 차단 기능 없음(회장님 확정)
  blacklist_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table member_admin enable row level security;
-- ⚠ 정책 없음 = anon·authenticated 전면 차단. 이 줄 아래에 policy 를 추가하지 말 것.

create index if not exists member_admin_black_idx on member_admin (blacklisted) where blacklisted;

-- ── 결제 시도 기록 ──────────────────────────────────────────
-- ⚠ 스펙(§3-4)은 payment_attempts 라는 새 표를 말하지만, **같은 일을 하는 payments 표가
--   이미 있다**(20260906120000, 오늘 적용됨). 성공·실패를 둘 다 status 로 기록하고
--   fail_code·fail_message 까지 갖고 있다. 표를 둘로 나누면 실패율의 분모가 두 곳에
--   흩어져 또 갈라진다 — 그래서 **payments 에 kind 한 칸만 더한다.**
--   1회 결제(oneshot)와 정기결제(recurring)를 여기서 가른다.
alter table payments add column if not exists kind text not null default 'oneshot';
alter table payments drop constraint if exists payments_kind_chk;
alter table payments add constraint payments_kind_chk check (kind in ('oneshot', 'recurring'));

comment on column payments.kind is
  'oneshot=토스 일반결제 1회 승인 / recurring=빌링키 정기결제. 어드민 "결제 실패" 탭이 이 값으로 나눠 센다.';

create index if not exists payments_failed_idx on payments (site_id, created_at desc) where status = 'failed';

-- ── 본사 페이지 섹션 노출 토글 (§7 단계 2) ──────────────────
-- 읽기는 공개(첫 페이지가 anon 으로 읽는다), 쓰기는 service_role 만.
create table if not exists page_sections (
  id         text primary key,                    -- 'inside' 같은 섹션 식별자
  label      text not null,                       -- 어드민 화면에 보일 이름
  visible    boolean not null default true,
  sort       int not null default 100,
  updated_at timestamptz not null default now()
);

alter table page_sections enable row level security;

drop policy if exists page_sections_public_read on page_sections;
create policy page_sections_public_read on page_sections for select using (true);
-- 쓰기 정책은 만들지 않는다 → service_role 만 수정할 수 있다.

-- 지금 코드에 하드코딩돼 있는 스위치를 표로 옮긴다.
-- ⚠ 기본값은 반드시 visible=true 다. DB 를 못 읽었을 때 화면이 비면 안 된다
--   (§7 단계 2 검증: DB 연결을 끊고도 모든 섹션이 보여야 한다).
insert into page_sections (id, label, visible, sort) values
  ('inside',    '스토리 페이지 들여다보기', false, 10),
  ('portfolio', '완성 예시 (포트폴리오)',   true,  20),
  ('channels',  '채널 띠',                  true,  30),
  ('pricing',   '가격',                     true,  40),
  ('faq',       '자주묻는질문 미리보기',    true,  50)
on conflict (id) do nothing;
