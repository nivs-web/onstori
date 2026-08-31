-- 고객 업로드 버킷 (스토리 사진·히어로 교체 등) — public read, 쓰기는 서버(service) 경유만
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true)
on conflict (id) do nothing;
