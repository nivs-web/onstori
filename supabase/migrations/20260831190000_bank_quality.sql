-- 이미지뱅크 품질·중복방지 확장 (설계서 5장 + docs/admin.md)
-- quality_score: 우선순위(0~100, 어드민 채점) — 매칭 시 score desc, used_count asc
-- phash: 지각 해시(dHash 64bit hex) — 해밍 거리로 중복 차단
-- prompt/model: 재현·반복 개선용 (어드민에서 프롬프트 보고 수정→재생성 워크플로)

alter table image_bank
  add column if not exists prompt text,
  add column if not exists model text,
  add column if not exists quality_score int not null default 50 check (quality_score between 0 and 100),
  add column if not exists phash text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists batch_id text;

create index if not exists image_bank_pick_idx
  on image_bank (industry, mood, role, quality_score desc, used_count asc)
  where quality_ok and not deleted;
create index if not exists image_bank_phash_idx on image_bank (phash) where not deleted;
