-- 2026-09-07 운영자 대시보드 메모장 — 회장님 지시
-- ⚠ 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)
--    이 파일은 만들어만 뒀다. 클코가 직접 돌리지 않는다.
--
-- 왜 필요한가: 통신판매업 신고번호·Meta 심사 일정·토스 상점아이디처럼
-- **잊으면 곤란한 사실**이 대화에만 남아 있었다. 운영자가 늘 보는 화면에 둔다.
--
-- 줄 하나짜리 표다. id='main' 한 줄만 쓴다 — 메모장이 여러 개 필요해지면 그때 id 를 늘린다.

create table if not exists admin_notes (
  id         text primary key,
  body       text not null default '',
  updated_at timestamptz not null default now()
);

-- ⚠ RLS 를 켜고 정책을 **하나도 만들지 않는다.**
--    그러면 anon·authenticated 는 읽지도 쓰지도 못하고, 서비스 롤(sbAdmin)만 접근한다.
--    운영자 메모에는 상점아이디·일정 같은 내부 정보가 들어가므로 공개 읽기가 있으면 안 된다.
--    billing 표와 같은 방식이다.
alter table admin_notes enable row level security;
