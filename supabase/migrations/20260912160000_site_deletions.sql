-- 운영자가 지운 사이트의 기록 (2026-09-12 회장님 지시 E2)
--
-- ★★ **지우는 일에는 반드시 기록이 남아야 한다.**
--   사이트를 지우면 `sites` 행이 사라지고, 딸린 표도 `on delete cascade` 로 함께 사라진다.
--   그러면 «무엇이 있었는지»를 아무도 모른다. 나중에 「그 사이트 왜 없어졌지」를 물을 때
--   답할 수 있어야 한다.
--
-- ★ 그래서 지우기 **직전에** 세어 둔 숫자를 여기 남긴다. 자료 자체가 아니라 «흔적»이다
--   (개인정보를 여기 옮겨 담지 않는다 — 그러면 파기가 파기가 아니게 된다).
--
-- ⚠ `sites` 를 참조하지 않는다. 참조하면 그 행이 사라질 때 이 기록도 함께 사라진다.
--   slug 와 상호를 **글자로** 적어 둔다.
--
-- 되돌리기: drop table public.site_deletions;

create table if not exists site_deletions (
  id uuid primary key default gen_random_uuid(),

  slug          text not null,
  business_name text not null,
  site_id       uuid not null,          -- 참조가 아니라 «값». 행이 사라져도 남는다

  -- 지우기 직전에 센 것들. 「비어 있었나 아니었나」를 나중에 답할 수 있게
  counts jsonb not null default '{}'::jsonb,
  -- 사이트의 상태(trial/active/expired…)와 결제 이력 유무
  status  text,
  had_payment boolean not null default false,

  reason     text,                      -- 왜 지웠나 (운영자가 적는다)
  deleted_by text not null default 'admin',
  deleted_at timestamptz not null default now()
);

create index if not exists site_deletions_at_idx on site_deletions (deleted_at desc);

-- ★ RLS 를 켜고 정책을 하나도 만들지 않는다 → 서비스 롤만 닿는다.
alter table site_deletions enable row level security;

comment on table site_deletions is
  '운영자가 사이트를 지운 기록. 자료가 아니라 흔적만 남긴다 (2026-09-12).';
