-- 사업 설계도 대시보드 경로(/onstoriplandept)를 고객이 슬러그로 선점하지 못하게 예약.
-- 라우팅은 next.config.ts 의 beforeFiles rewrite 가 먼저 잡지만, 슬러그 검사도 막아둬야
-- "사용 가능한 주소예요"가 뜬 뒤 생성만 실패하는 혼란이 없다.
insert into reserved_slugs (slug) values ('onstoriplandept')
on conflict (slug) do nothing;
