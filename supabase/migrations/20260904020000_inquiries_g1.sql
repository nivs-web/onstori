-- 견적 문의 접수 (G1) — docs/specs/inquiry.md 2장
--
-- ⚠ 스펙 2장은 `create table inquiries (...)` 로 쓰여 있으나, 이 테이블은
--   core 마이그레이션(20260831120000_core.sql)에 **이미 있다**. 그래서 실제로 필요한 것은
--   빠진 컬럼·제약·인덱스·정책을 더하는 ALTER 다. 아래는 그 차집합.
--
-- 기존(core): id, site_id, name, phone, message(not null default ''), photos, status, created_at
--             + index(site_id, created_at desc) + RLS + owner select 정책 + **anon insert 정책**
--
-- 적용 전 확인: 2026-09-04 기준 inquiries 행 0건 — not null·check 추가가 안전하다.

alter table inquiries
  add column if not exists kind           text not null default 'quote',
  add column if not exists memo           text,
  add column if not exists referrer_class text,          -- direct|naver|google|instagram|kakao|other
  add column if not exists ip_hash        text,          -- sha256(ip + YYYY-MM-DD + INQUIRY_SALT). 원 IP 저장 안 함
  add column if not exists consent_at     timestamptz,   -- 개인정보 수집 동의 시각
  add column if not exists read_at        timestamptz;

-- 접수 API가 항상 채운다. 기존 행이 0건이라 not null 로 올릴 수 있다.
alter table inquiries alter column consent_at set not null;

alter table inquiries
  add constraint inquiries_kind_chk    check (kind in ('quote','reserve','consult','contact')),
  add constraint inquiries_name_chk    check (char_length(name) between 1 and 40),
  add constraint inquiries_phone_chk   check (phone ~ '^[0-9+\-]{9,20}$'),
  add constraint inquiries_message_chk check (char_length(message) <= 1000),
  add constraint inquiries_memo_chk    check (memo is null or char_length(memo) <= 300);

create index if not exists inquiries_site_status_idx on inquiries (site_id, status);

-- 소유자 수정 정책 — core 에는 select 정책만 있었다(문의함의 상태·메모 변경에 필요).
drop policy if exists "inquiries_owner_update" on inquiries;
create policy "inquiries_owner_update" on inquiries for update
  using (exists (select 1 from sites s where s.id = inquiries.site_id and s.owner_id = auth.uid()));

-- ⚠ 익명 insert 정책 제거 — 스펙 2장 "손님 insert 는 service-role API 에서만(anon 정책 없음)".
--   core 의 `inquiries_public_insert` 는 `with check (true)` 라 누구나 아무 사이트에
--   문의를 무제한 insert 할 수 있고, 레이트리밋·허니팟·동의 검증을 전부 우회한다.
--   접수는 /api/inquiry 가 service-role 로 처리하므로 이 정책은 필요 없다.
drop policy if exists "inquiries_public_insert" on inquiries;
