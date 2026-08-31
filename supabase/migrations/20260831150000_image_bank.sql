-- 이미지 뱅크 카탈로그 (설계서 5장 · docs/admin.md)
-- 접근: 서버 전용(service_role) — 공개 RLS 정책 없음. 이미지 파일은 bank 버킷(public read).

create table image_bank (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  mood text not null check (mood in ('clean','warm','premium','lively')),
  role text not null check (role in ('hero','about','gallery','process')),
  orientation text not null default 'landscape' check (orientation in ('landscape','portrait','square')),
  url text not null,              -- 최종 서빙 URL (Storage public URL 또는 외부 스톡)
  storage_path text,              -- bank 버킷 경로 (외부 스톡이면 null)
  source text not null,           -- 'ai:gemini-3-pro-image' | 'stock:unsplash' 등 (라이선스 추적)
  tags text[] not null default '{}',
  quality_ok boolean,             -- null=검수 대기, true=승인, false=거부
  used_count int not null default 0,
  deleted boolean not null default false,
  cost_krw numeric,               -- 생성 비용 로깅
  created_at timestamptz not null default now()
);
create index image_bank_match_idx on image_bank (industry, mood, role) where quality_ok and not deleted;

alter table image_bank enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. 어드민·생성 API는 service_role로 접근.

-- 이미지 파일 버킷 (public read)
insert into storage.buckets (id, name, public) values ('bank', 'bank', true)
on conflict (id) do nothing;
