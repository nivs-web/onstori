-- 2026-09-05 기획1(/mainplan) · 정회원(14일) · 이야기 엔진 1차
-- 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)

-- 1) 새 정적 라우트를 고객이 슬러그로 선점하지 못하게 예약 (plandept·onstoriplandept 와 같은 방식)
insert into reserved_slugs (slug) values
  ('mainplan'),('how-it-works'),('our-story'),('compare'),('rec'),('record'),('members'),('cron'),('billing'),('story-link')
on conflict (slug) do nothing;

-- 2) 정회원 — 결제일·결제 원장. status='active' 전환은 서버(토스 confirm)에서만.
alter table sites
  add column if not exists paid_at timestamptz,
  add column if not exists payment jsonb;

-- 3) 이야기 엔진 — 60초 녹화 원본·가공 결과. photos/body 는 기존 컬럼 그대로 쓴다.
--    media_status: none(글만) → uploaded(원본 R2) → processing → ready(자막 영상 완성) → failed
alter table story_entries
  add column if not exists question text,
  add column if not exists video_key text,
  add column if not exists video_out_key text,
  add column if not exists transcript text,
  add column if not exists media_status text not null default 'none'
    check (media_status in ('none','uploaded','processing','ready','failed'));
create index if not exists story_entries_media_idx on story_entries (media_status) where media_status in ('uploaded','processing');
