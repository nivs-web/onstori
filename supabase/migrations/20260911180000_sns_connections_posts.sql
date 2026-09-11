-- 2026-09-11 SNS 발행 — 연결(sns_connections) · 등록 시도(sns_posts)
-- ⚠ 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)
--    이 파일은 만들어만 뒀다. 클코가 직접 돌리지 않는다.
--
-- ★ 왜 지금 만드나: 유튜브·인스타·틱톡·페이스북 **네 곳 모두** 「먼저 만들고, 실제로 한 번
--   성공시키고, 그 화면을 증빙으로 내야」 심사가 열린다. 화면 하나로 네 심사가 동시에 열린다.
--
-- ⚠ 이 파일의 «칸 구성»은 상무님 어댑터 규격서를 못 읽은 상태에서 클코가 설계했다
--   (2026-09-11 기준 `fable51plandept/AI_Context/` 폴더가 없다). 회장님 지시문에 적힌
--   요구사항(연결·면책 동의 시각 / 대기열·중복방지·현황)만을 근거로 만들었다.
--   규격서를 받으면 **대조가 필요하다.**

-- ─────────────────────────────────────────────────────────────
-- ① sns_connections — 사장님의 SNS 계정 연결
-- ─────────────────────────────────────────────────────────────
create table if not exists sns_connections (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,

  -- ★ 서랍을 미리 파 둔다. 이번에 실제로 여는 것은 instagram·youtube 둘뿐이고
  --   나머지는 나중에 꽂기만 하면 된다(회장님 지시: 서랍 구조는 지켜라).
  provider    text not null check (provider in ('instagram','youtube','tiktok','facebook','threads','x')),

  -- 그쪽 계정을 가리키는 값. 화면에는 account_name 을 보여 준다.
  account_id   text,          -- 인스타 IG User ID / 유튜브 채널 ID
  account_name text,          -- @handle · 채널명

  -- ★★ 토큰 — **손님 브라우저에 절대 나가지 않는다.**
  --    RLS 를 켜고 정책을 하나도 안 만들어 서비스 롤(sbAdmin)만 읽는다. API 응답에도 싣지 않는다.
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scopes           text[],

  -- active=쓸 수 있음 · expired=토큰 만료(다시 연결 필요) · revoked=사장님이 끊음
  status text not null default 'active' check (status in ('active','expired','revoked')),

  -- ★ 면책 동의 시각 — 「내 계정에 온스토리가 올리는 것에 동의한다」를 누른 때.
  --   비어 있으면 올리기를 시작하지 않는다.
  disclaimer_agreed_at timestamptz,

  connected_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- 한 사이트에 같은 SNS 는 하나만
  unique (site_id, provider)
);

create index if not exists sns_connections_site_idx on sns_connections (site_id, provider);

-- ⚠ RLS 를 켜고 정책을 **하나도 만들지 않는다.**
--    anon·authenticated 는 읽지도 쓰지도 못하고 서비스 롤만 접근한다.
--    `app_settings`·billing 표와 같은 방식이다. 토큰이 들어 있으니 더욱 그렇다.
alter table sns_connections enable row level security;

-- ─────────────────────────────────────────────────────────────
-- ② sns_posts — 등록 시도 한 줄. 대기열·중복방지·현황을 이 표 하나로 본다.
-- ─────────────────────────────────────────────────────────────
create table if not exists sns_posts (
  id       uuid primary key default gen_random_uuid(),
  site_id  uuid not null references sites(id) on delete cascade,

  -- 어떤 영상인가. 영상 줄이 지워져도 시도 기록은 남긴다(불변 규칙 10 의 정신).
  entry_id uuid references story_entries(id) on delete set null,

  provider text not null check (provider in ('instagram','youtube','tiktok','facebook','threads','x')),

  -- queued      : 올리기를 눌렀다. 아직 시작 전
  -- uploading   : 파일/컨테이너를 보내는 중
  -- processing  : 그쪽이 처리 중 (인스타 컨테이너가 FINISHED 되기를 기다리는 단계)
  -- published   : 올라갔다
  -- failed      : 실패. error_kind 가 이유
  -- canceled    : 사장님이 취소
  status text not null default 'queued'
    check (status in ('queued','uploading','processing','published','failed','canceled')),

  -- ★★ 인스타 2단계를 이어 붙이는 열쇠.
  --   ①컨테이너 만들기 → ②최대 5분 확인 → ③게시. ②에서 끊겼는데 ①부터 다시 하면
  --   **같은 영상이 두 번 올라간다.** 컨테이너 id 를 여기 적어 두고, 다시 들어오면
  --   ①을 건너뛰고 ②부터 잇는다(회장님 지시 4).
  container_id text,

  remote_post_id text,   -- 올라간 뒤 그쪽 글 id
  remote_url     text,   -- 사장님에게 보여 줄 주소

  -- ★ 실패 이유는 어댑터의 **네 값**만 쓴다. 다섯 번째를 만들지 않는다(회장님 지시 2).
  error_kind text check (error_kind in ('TRANSIENT','AUTH_EXPIRED','REJECTED','QUOTA_EXCEEDED')),
  error_detail text,     -- 사람이 읽을 짧은 설명. 원문 그대로가 아니라 잘라서 넣는다
  attempts int not null default 0,

  -- ★ 인스타에 주려고 공개 창고로 복사한 그 파일의 키.
  --   나중에 치우거나 다시 쓸 때 필요하다. 원본(private)은 그대로 둔다(불변 규칙 10).
  public_key text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

-- ★★ 중복 방지 — 같은 영상을 같은 SNS 에 두 번 올리지 않는다.
--    ⚠ 실패·취소한 것은 **다시 시도할 수 있어야 하므로** 유일 제약에서 뺀다.
--      「살아 있는 시도」에만 건다.
create unique index if not exists sns_posts_live_uniq
  on sns_posts (site_id, entry_id, provider)
  where status in ('queued','uploading','processing','published');

-- 대기열을 훑는 자리 — 아직 안 끝난 것만 본다
create index if not exists sns_posts_queue_idx
  on sns_posts (status, created_at)
  where status in ('queued','uploading','processing');

-- 사장님 화면에서 「이 영상 어디까지 갔나」를 볼 때
create index if not exists sns_posts_site_idx on sns_posts (site_id, created_at desc);

-- ⚠ 같은 이유로 RLS 만 켜고 정책은 만들지 않는다.
alter table sns_posts enable row level security;

-- ─────────────────────────────────────────────────────────────
-- ③ 참고 — 유튜브 게이트는 표를 새로 만들지 않는다.
--    `app_settings` 의 key='sns:youtube' 에 {"mode":"off"|"review"|"on"} 로 둔다.
--    줄이 없으면 **off** 로 본다(기본이 off — 회장님 지시 3).
--    설정 종류가 늘어도 마이그레이션이 필요 없다는 app_settings 의 원래 목적 그대로다.
-- ─────────────────────────────────────────────────────────────
