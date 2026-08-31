-- 온스토리 코어 스키마 v1 (설계서 9장 데이터 모델)
-- 적용: npx supabase db push (link 후) / 로컬 테스트: npx supabase db reset
-- 규칙: 모든 스키마 변경은 마이그레이션 파일로만 (CLAUDE.md 불변 규칙 1)

-- ── 예약 슬러그 ──────────────────────────────────────────────
create table reserved_slugs (
  slug text primary key
);
insert into reserved_slugs (slug) values
  ('www'),('api'),('app'),('mail'),('admin'),('edit'),('my'),('new'),('story'),
  ('pay'),('cdn'),('static'),('m'),('dev'),('test'),('staging'),('blog'),('help'),
  ('support'),('docs'),('status'),('onstori'),('official');

-- ── 사이트 ──────────────────────────────────────────────────
create table sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null, -- null = 익명 생성(anon claim은 P4)
  anon_id text,                          -- 비회원 생성 시 브라우저 식별자
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,30}$'),
  business_name text not null,
  industry text not null,
  category smallint not null check (category between 1 and 7),
  template text not null check (template in ('visit','book','quote','consult','browse')),
  cta_type text not null default 'call',
  inferred jsonb not null default '{}'::jsonb,   -- 업종 추론 결과·confidence·교정 이력
  mood text not null default 'clean',
  status text not null default 'trial' check (status in ('trial','active','expired','suspended')),
  trial_ends_at timestamptz,
  plan text check (plan in ('light','pro','business')),
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  draft jsonb,                            -- 에디터가 수정하는 문서
  published jsonb,                        -- 공개 렌더러가 읽는 문서
  published_at timestamptz,
  hero_movie jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_owner_idx on sites (owner_id);
create index sites_anon_idx on sites (anon_id);

-- ── 발행 스냅샷 (자동 백업·롤백) ─────────────────────────────
create table site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index site_versions_site_idx on site_versions (site_id, created_at desc);

-- ── 스토리 엔트리 (온스토리의 심장) ──────────────────────────
create table story_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  entry_type text not null check (entry_type in ('work','news','milestone','guest')),
  title text not null,
  body text not null default '',
  photos jsonb not null default '[]'::jsonb,
  entry_date date not null default current_date,
  visible boolean not null default true,  -- 삭제 대신 숨김 (실적 카운터 신뢰성)
  created_at timestamptz not null default now()
);
create index story_entries_site_idx on story_entries (site_id, entry_date desc);

-- ── 게이미피케이션 진행 상태 ─────────────────────────────────
create table site_progress (
  site_id uuid primary key references sites(id) on delete cascade,
  score int not null default 0,
  rules_done jsonb not null default '[]'::jsonb,
  tours_seen jsonb not null default '{}'::jsonb,
  funnel jsonb not null default '{}'::jsonb, -- created/first_edit/first_story/published/activated
  updated_at timestamptz not null default now()
);

-- ── 문의(견적) ───────────────────────────────────────────────
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  phone text not null,
  message text not null default '',
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','done','spam')),
  created_at timestamptz not null default now()
);
create index inquiries_site_idx on inquiries (site_id, created_at desc);

-- ── 방문·클릭 이벤트 ─────────────────────────────────────────
create table events (
  id bigint generated always as identity primary key,
  site_id uuid not null references sites(id) on delete cascade,
  type text not null check (type in ('visit','call_click','sms','map','qr','inquiry','story_view','quote_submit')),
  referrer_class text not null default 'direct',
  session_hash text,
  created_at timestamptz not null default now()
);
create index events_site_idx on events (site_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────
alter table reserved_slugs enable row level security;
alter table sites enable row level security;
alter table site_versions enable row level security;
alter table story_entries enable row level security;
alter table site_progress enable row level security;
alter table inquiries enable row level security;
alter table events enable row level security;

-- 예약 슬러그: 누구나 조회(중복 검사용), 수정 불가
create policy "reserved_slugs_read" on reserved_slugs for select using (true);

-- 사이트: 공개 렌더링은 published만 노출되면 되지만 select는 행 단위 →
--   공개 조회는 서비스 키를 쓰지 않는 서버 렌더러가 slug로 조회 (published·비정지 조건)
create policy "sites_public_read" on sites for select
  using (status in ('trial','active'));
create policy "sites_owner_all" on sites for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 스토리: 공개는 visible만, 쓰기는 소유자
create policy "stories_public_read" on story_entries for select
  using (visible and exists (select 1 from sites s where s.id = site_id and s.status in ('trial','active')));
create policy "stories_owner_all" on story_entries for all
  using (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()));

-- 버전·진행상태·문의: 소유자만
create policy "versions_owner_read" on site_versions for select
  using (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()));
create policy "progress_owner_read" on site_progress for select
  using (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()));
create policy "inquiries_owner_read" on inquiries for select
  using (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()));
-- 문의 작성은 방문자(익명) 허용
create policy "inquiries_public_insert" on inquiries for insert with check (true);

-- 이벤트: 수집은 익명 insert 허용, 조회는 소유자
create policy "events_public_insert" on events for insert with check (true);
create policy "events_owner_read" on events for select
  using (exists (select 1 from sites s where s.id = site_id and s.owner_id = auth.uid()));

-- updated_at 자동 갱신
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger sites_updated_at before update on sites
  for each row execute function set_updated_at();
