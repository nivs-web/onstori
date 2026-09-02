-- IP 기반 요청 제한 — /api/generate 처럼 LLM 비용이 드는 라우트 보호.
--
-- 왜 DB인가: Vercel 서버리스는 요청마다 다른 인스턴스일 수 있어 인메모리 카운터가
-- 사실상 무의미하다. 공유 저장소가 필요하고 이미 있는 것은 Postgres뿐이다.
--
-- 왜 함수인가: 읽고-더하고-쓰기를 앱에서 하면 동시 요청에서 새어나간다.
-- upsert 한 번으로 증가와 판정을 원자적으로 끝낸다.

create table rate_limits (
  key           text        not null,   -- 예: 'gen:1.2.3.4'
  window_start  timestamptz not null,   -- 창의 시작 시각 (버킷)
  count         int         not null default 0,
  primary key (key, window_start)
);

-- 오래된 버킷 정리를 싸게 하기 위한 인덱스
create index rate_limits_window_idx on rate_limits (window_start);

alter table rate_limits enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. 서버(service_role)만 쓴다.

/**
 * 한 번 호출 = 한 번 사용으로 기록하고, 한도 내면 true.
 * 고정 창(fixed window) 방식 — 슬라이딩보다 단순하고 이 용도엔 충분하다.
 * 한도를 넘으면 카운트를 올리지 않는다(넘은 뒤 계속 두드려도 창이 밀리지 않게).
 */
create or replace function rate_limit_hit(
  p_key     text,
  p_window  int,   -- 창 길이(초)
  p_max     int    -- 창당 허용 횟수
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_count  int;
begin
  -- 창 시작으로 내림 — 같은 창의 요청은 같은 행을 공유한다
  v_bucket := to_timestamp(floor(extract(epoch from now()) / p_window) * p_window);

  insert into rate_limits (key, window_start, count)
  values (p_key, v_bucket, 1)
  on conflict (key, window_start)
    do update set count = rate_limits.count + 1
    where rate_limits.count < p_max          -- 한도 초과면 갱신하지 않는다
  returning count into v_count;

  -- v_count 가 null = where 절에 막힘 = 이미 한도 도달
  return v_count is not null;
end;
$$;

revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;

/** 지난 창 정리 — 주간 루틴에서 호출하거나 방치해도 무방(행이 작다) */
create or replace function rate_limits_gc(p_keep_hours int default 48)
returns int
language sql
security definer
set search_path = public
as $$
  with d as (
    delete from rate_limits
    where window_start < now() - make_interval(hours => p_keep_hours)
    returning 1
  ) select count(*)::int from d;
$$;

revoke all on function rate_limits_gc(int) from public, anon, authenticated;
