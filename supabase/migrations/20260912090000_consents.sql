-- 가입 동의 기록 (2026-09-12 회장님 지시 2 · 상무님 지적)
--
-- ★★ 왜 «새 표»인가.
--   `sites.settings`(jsonb) 에 넣으면 안 된다. 사장님이 홈페이지를 한 번 저장할 때마다
--   settings 가 **얕은 병합(shallow merge)** 으로 통째로 덮인다. 그러면 동의했다는 «증거»가
--   조용히 사라진다. 동의 기록은 분쟁이 났을 때 우리를 지켜 주는 유일한 물증이라
--   사장님의 다른 조작에 절대 휘말리면 안 된다.
--
-- ★ 무엇이 어긋나 있었나: 손님(견적 문의)은 동의 체크박스로 보호받는데 **사장님 가입에는
--   그것이 하나도 없었다.** 게다가 이용약관 제3조가 「가입 화면에서 확인하실 수 있으며」라고
--   적어 두었는데 그 링크가 없었다 — 약속과 화면이 갈라져 있었다.
--
-- 되돌리기: drop table public.consents;  (사장님 자료 손실 없음 — 기록 전용 표다)

create table if not exists consents (
  id      uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,

  -- terms     : 이용약관 (필수)
  -- privacy   : 개인정보 수집·이용 (필수)
  -- marketing : 알림(문자·카카오톡) 수신 (선택) — ★ 필수와 반드시 분리한다.
  --             선택 동의를 필수처럼 묶으면 그 자체가 법 위반이다.
  kind text not null check (kind in ('terms', 'privacy', 'marketing')),

  agreed boolean not null,

  -- ★ 「언제」가 핵심이다. 동의한 시각과 철회한 시각을 둘 다 남긴다.
  agreed_at  timestamptz,
  revoked_at timestamptz,

  -- ★ 「무엇에」 동의했는가. 약관이 개정되면 이 값으로 어느 판본에 동의했는지 가린다.
  --   값의 출처는 화면의 UPDATED 상수(app/terms/page.tsx · app/privacy/page.tsx).
  doc_version text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 한 사이트에 같은 종류는 한 줄. 다시 누르면 그 줄을 고친다.
  unique (site_id, kind)
);

create index if not exists consents_site_idx on consents (site_id);

-- ★ RLS 를 켜고 정책을 **하나도 만들지 않는다** → 서비스 롤(sbAdmin)만 닿는다.
--   sns_connections 와 같은 방식이다. 동의 기록은 손님 브라우저에 나갈 이유가 없다.
alter table consents enable row level security;

comment on table consents is
  '가입 동의 기록. sites.settings 는 얕은 병합으로 덮이므로 증거를 여기에 따로 둔다 (2026-09-12).';
