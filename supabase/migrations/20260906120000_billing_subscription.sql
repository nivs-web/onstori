-- 정기결제(빌링키 구독) — 회장님 확정: 월 구독. 금액은 lib/trial.ts 참조
--
-- 배경: 기존 api/billing/* 은 토스페이먼츠 **일반결제(1회성)** 로 짜여 있었다(2026-09-05 `16af5cb`,
--       기술참모 배치본, 미검토). 그 계약조차 하지 않았다. 정기결제로 가맹 심사를 진행 중이며
--       심사(2~3주) 전에 만들 수 있는 것만 먼저 준비한다.
--
-- 표 두 개를 나누는 이유
--   billing  : 빌링키는 그것만으로 카드를 긁을 수 있는 자격증명이다. sites 컬럼으로 두면
--              사장님 소유 조회 API 를 타고 클라이언트로 새어 나갈 수 있다. 별도 표로 떼고
--              **RLS 정책을 하나도 만들지 않아** 서비스 롤 외에는 누구도 못 읽게 한다.
--   payments : 결제 원장. site_id 를 on delete set null 로 둔다 —
--              사이트가 자동 삭제되어도 **결제 기록은 남아야 한다**(전자상거래법상 대금결제·계약
--              기록 5년 보존). sites.payment jsonb 한 칸에 마지막 건만 덮어쓰던 방식으로는
--              매달 쌓이는 구독 결제 이력을 보존할 수 없다.

-- ── 빌링키 (서비스 롤 전용) ─────────────────────────────────
create table if not exists billing (
  site_id        uuid primary key references sites(id) on delete cascade,
  customer_key   text not null,                 -- 토스에 넘기는 고객 식별자
  billing_key    text not null,                 -- ★ 자격증명. 절대 클라이언트로 내보내지 않는다
  card_company   text,
  card_last4     text,                          -- 화면에 보여줄 마지막 4자리만
  status         text not null default 'active'
                 check (status in ('active','paused','canceled','failed')),
  next_charge_at timestamptz not null,          -- 다음 청구 예정 시각
  last_charge_at timestamptz,
  fail_count     int not null default 0,        -- 연속 실패 횟수. 임계치를 넘기면 정지로 넘긴다
  canceled_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists billing_due_idx on billing (next_charge_at) where status = 'active';

alter table billing enable row level security;
-- ⚠ 정책을 의도적으로 하나도 만들지 않는다.
--   RLS 가 켜져 있고 정책이 없으면 anon·authenticated 는 아무 행도 못 읽고 못 쓴다.
--   서비스 롤(sbAdmin)만 접근한다. 정책을 추가하려면 빌링키가 새지 않는지 먼저 확인할 것.

-- ── 결제 원장 ───────────────────────────────────────────────
create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  -- 사이트가 지워져도 기록은 남는다 (전자상거래법 5년 보존)
  site_id      uuid references sites(id) on delete set null,
  site_slug    text,                            -- 사이트가 지워진 뒤에도 무엇이었는지 알 수 있게
  order_id     text not null unique,            -- 멱등성: 같은 주문을 두 번 승인하지 않는다
  payment_key  text,
  amount       int not null check (amount >= 0),
  status       text not null
               check (status in ('paid','failed','canceled','refunded','partial_refunded')),
  method       text,
  fail_code    text,
  fail_message text,
  approved_at  timestamptz,
  refunded_at  timestamptz,
  refund_amount int not null default 0 check (refund_amount >= 0),
  raw          jsonb,                           -- 토스 응답 원문 (분쟁 대비)
  created_at   timestamptz not null default now()
);

create index if not exists payments_site_idx on payments (site_id, created_at desc);
create index if not exists payments_created_idx on payments (created_at desc);

alter table payments enable row level security;
-- ⚠ 여기도 정책을 만들지 않는다 — 결제 원장은 서비스 롤만 읽는다.
--   사장님에게 결제 내역을 보여줄 때는 서버가 소유권을 확인한 뒤 골라서 내려준다.

-- ── 갱신 시각 트리거 ────────────────────────────────────────
create or replace function touch_billing_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists billing_touch on billing;
create trigger billing_touch before update on billing
  for each row execute function touch_billing_updated_at();
