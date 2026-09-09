-- 2026-09-09 테마 엔진 — 운영자 설정 저장소 (S2)
-- ⚠ 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)
--    이 파일은 만들어만 뒀다. 클코가 직접 돌리지 않는다.
--
-- 무엇을 담나: 화면별 디자인 설정 3벌.
--   key='design:site'   → onstori.com 손님 화면
--   key='design:admin'  → onstori.com/admin 운영자 화면
--   key='design:editor' → onstori.com/{상호}/edit 사장님 편집 화면
--   value = {"style":"basic","mode":"light","color":"#005B2A"}
--
-- 왜 `admin_notes` 에 얹지 않았나: 그 표는 의미가 '메모'이고 body 가 text 다.
--   API 도 id 를 {main,todo,done} 화이트리스트로 잠가 뒀다. 거기 디자인을 넣으면
--   메모 API 가 디자인을 다루게 된다. jsonb 면 zod 로 검증하고 바로 읽는다.
--
-- 왜 표 하나에 key-value 인가: 설정 종류가 늘어도 마이그레이션이 필요 없다.
--   지금은 3줄이지만 나중에 다른 운영자 설정도 여기 담는다.

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ⚠ RLS 를 켜고 정책을 **하나도 만들지 않는다.**
--    anon·authenticated 는 읽지도 쓰지도 못하고 서비스 롤(sbAdmin)만 접근한다.
--    `admin_notes` · billing 표와 같은 방식이다.
--
--    ★ 그런데 이 값은 **손님 화면에도 쓰인다**(루트 레이아웃이 site 설정을 읽는다).
--      그 읽기는 서버 컴포넌트에서 서비스 롤로 하므로 공개 정책이 필요 없다.
--      공개 읽기를 열면 운영자 설정 전체가 밖에서 보인다 — 열지 않는다.
alter table app_settings enable row level security;
