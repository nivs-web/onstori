-- bump_bank_used: 이미지뱅크 사용 카운터 증가 (lib/bank.ts pickImage가 RPC로 호출)
-- used_count가 올라야 매칭 정렬(quality_score desc, used_count asc)로 배분이 균등해진다.
-- 접근: 서버 전용(service_role) — image_bank와 동일하게 anon/authenticated 실행 차단.

create or replace function public.bump_bank_used(bank_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.image_bank set used_count = used_count + 1 where id = bank_id;
$$;

revoke execute on function public.bump_bank_used(uuid) from public, anon, authenticated;
grant execute on function public.bump_bank_used(uuid) to service_role;
