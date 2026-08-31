-- 랜딩 포트폴리오(쇼케이스) — 어드민이 URL로 등록·태그 지정·순서·노출 관리
create table showcase (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,          -- onstori.com/{slug} (DB 사이트·시드 모두 허용)
  tag text not null,                  -- 인테리어 | 시공·건설 | 서비스·출장 | 카페·식당
  sort int not null default 100,      -- 낮을수록 앞
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index showcase_order_idx on showcase (featured desc, sort asc, created_at desc);

alter table showcase enable row level security;
-- 랜딩(익명)에서 읽기 허용, 쓰기는 서버(service)만
create policy "showcase_public_read" on showcase for select using (true);
