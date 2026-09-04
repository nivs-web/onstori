# 견적 접수 스펙 (inquiry) — 2026-09-03

목표: 손님이 30초 안에 사진 3장과 전화번호를 남기고, 사장님 폰에 60초 안에 알림이 도착하고, 에디터에 "문의 N건"이 보인다.
현재: `components/sections/index.tsx`의 `QuoteFormSec`는 `tel:` 링크 카드라 문의가 DB에 남지 않는다.

## 1. 흐름

- 손님: 히어로 "견적 문의" → `#quote` → 폼(이름 선택 · 연락처 필수 · 내용 선택 · 사진 ≤3 · 개인정보 동의 필수) → "견적 요청 보내기" → "접수됐어요 — 사장님이 곧 연락드려요" + 전화 버튼 유지
- 사장님: 문자(솔라피) + 이메일(Resend) 즉시 알림 → 에디터 문의함 탭(`/{slug}/edit?tab=inbox`) → 상세(사진·내용·전화하기·상태·메모)
- 운영자: `/api/admin/notify-check`로 접수 수·알림 실패·채널 상태

## 2. 데이터

```sql
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  kind text not null default 'quote' check (kind in ('quote','reserve','consult','contact')),
  name text not null check (char_length(name) between 1 and 40),
  phone text not null check (phone ~ '^[0-9+\-]{9,20}$'),
  message text check (char_length(message) <= 1000),
  photos jsonb not null default '[]',            -- ["inquiries/<site_id>/<uuid>.webp"] R2 private 키, 최대 3
  status text not null default 'new' check (status in ('new','contacted','done','spam')),
  memo text check (char_length(memo) <= 300),
  referrer_class text,                            -- direct|naver|google|instagram|kakao|other
  ip_hash text,                                   -- sha256(ip + YYYY-MM-DD + INQUIRY_SALT). 원 IP 저장 안 함
  consent_at timestamptz not null,                -- 개인정보 수집 동의 시각
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on inquiries (site_id, created_at desc);
create index on inquiries (site_id, status);
alter table inquiries enable row level security;
create policy "owner reads own inquiries" on inquiries for select
  using (exists (select 1 from sites s where s.id = inquiries.site_id and s.owner_id = auth.uid()));
create policy "owner updates own inquiries" on inquiries for update
  using (exists (select 1 from sites s where s.id = inquiries.site_id and s.owner_id = auth.uid()));
```

- 첨부 사진은 `lib/storage.ts`(R2-1) 의 `put("private", "inquiries/{siteId}/{uuid}.webp")` 로 저장, 조회는 `signedGetUrl(key, 600)`. Supabase 버킷을 새로 만들지 않는다(env 없을 때만 폴백).
- 손님 insert는 service-role API에서만(anon 정책 없음). 익명 사이트(owner_id null)의 문의함은 `loadOwnedSite`(anonId 폴백)로 판정하고 service-role로 읽는다 — 기존 게이트 API 5곳과 같은 방식.
- `sites.settings`(jsonb)에 추가하는 키: `notify:{phone,email}`, `notify_last_error:{channel,at,msg}`, `blocked_phones:[{phone,until}]`. 스키마 변경 없음.
- `site_progress.funnel.first_inquiry_at` — 첫 접수 시 기록.
- 섹션 스키마 `QuoteForm`(zod)은 **변경하지 않는다**. `allowPhotos`로 사진 칸, `phone`으로 전화 버튼, `kakaoUrl`로 카톡 버튼.

## 3. API

| 라우트 | 누가 | 입력 | 동작 |
|---|---|---|---|
| `POST /api/inquiry` | 손님 | multipart: slug, name?, phone, message?, consent="1", website(허니팟, 빈 값), t0(폼 마운트 시각 ms), photos[] ≤3 (각 ≤10MB) | ① `rate_limit_hit("inquiry:"+ip)` 1h 5 / 24h 20 (판정 실패 시 통과 — 기존 방침) ② website 채워짐·t0 3초 미만·consent≠"1" → 400 `{ok:false}` ③ slug로 sites(status trial|active) 조회, 없으면 404 ④ 같은 site_id+phone 10분 내 → 409, blocked_phones 미만료 → 403 ⑤ 사진 sharp 1600w WebP → `storage.put("private", "inquiries/{site_id}/{uuid}.webp")` ⑥ insert ⑦ `void notifyInquiry(...)` ⑧ funnel.first_inquiry_at 없으면 기록 ⑨ 200 `{ok:true,id}`. `maxDuration=30` |
| `POST /api/inquiry/list` | 사장님·운영자 | {slug, anonId?, status?} | 게이트 → 최신 50건, photos는 `storage.signedGetUrl(key, 600)` → `{items, newCount}` |
| `POST /api/inquiry/update` | 사장님·운영자 | {slug, anonId?, id, status?, memo?, read?} | 게이트 → 해당 site_id 소속 확인 → update(read→read_at). status=spam이면 blocked_phones에 {phone, until:+30d} |
| `GET /api/admin/notify-check` | 운영자 쿠키 | — | 24h 접수 수, notify_last_error 있는 사이트 수, 채널 env 상태 |

## 4. 알림 — `lib/notify.ts`

```
notifyInquiry({ siteId, businessName, slug, inquiry: { name, phone, message?, photoCount } })
수신처: settings.notify.{phone,email} → 없으면 published.quoteForm.phone / auth.users(owner_id).email
SMS   : 솔라피 REST — env SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER (하나라도 없으면 채널 건너뜀)
        본문 "[온스토리] {상호} 견적 문의 · {이름} {전화} · 사진 {n}장 · onstori.com/{slug}/edit?tab=inbox"
Email : Resend REST — env RESEND_API_KEY (없으면 건너뜀), from "온스토리 <noreply@onstori.com>"
        제목 "[견적 문의] {상호} — {이름}", 본문 내용 + 문의함 링크 (사진 첨부 없음)
실패  : throw 금지. console.error(JSON {evt:"notify_fail",channel,siteId,err}) + settings.notify_last_error 기록
카카오 알림톡: P5 이후 같은 함수에 채널 추가
```

env 추가: `INQUIRY_SALT`, `RESEND_API_KEY`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` (.env.example에 이름만).

## 5. 화면

### 손님 폼 — `components/sections/quote-form.tsx` ("use client")
- props `{ s: QuoteForm 섹션, slug }`. `index.tsx`의 `QuoteFormSec`는 `<section id="quote"><QuoteForm s={s} slug={ctx.slug}/></section>`로 축소. `Ctx`에 `slug` 추가, `app/[slug]/page.tsx`(및 RenderSection 호출처)에서 전달.
- 필드: 이름(선택) / 연락처(필수, 숫자·하이픈·+, 자동 하이픈) / "어떤 작업이 필요하세요? (선택)" 500자 / 사진(`s.allowPhotos`일 때만; `multiple accept="image/*" capture="environment"`; 최대 3; 클라이언트 canvas로 1600px·JPEG 0.8 축소 — 새 라이브러리 없음; 썸네일·삭제) / 동의 체크(필수) / 허니팟 `website`(화면 밖) / hidden `t0`
- 상태: idle → sending("보내는 중…") → done(폼 자리에 성공 문구, sessionStorage `onstori:inq:{slug}` 30분 유지) / error
- 폼 아래 전화(`tel:`)·카톡(`kakaoUrl`) 버튼 유지. 스타일은 `--s-*` 변수만.
- 미리보기 대비: `window.parent !== window`면 제출 버튼 disabled + "미리보기에서는 보내지지 않아요"
- VISIT 템플릿(카페)은 같은 컴포넌트, `allowPhotos:false`, kind="contact"

### 문의함 — `app/[slug]/edit/inbox-tab.tsx` (별도 파일)
- `ui.tsx` 탭 `"content" | "story" | "inbox"`, 버튼 "문의함" + newCount 배지, `data-tour="panel-inbox"`(tours.ts ACTIVE_ANCHORS·editorIntro에 등록), `?tab=inbox`로 진입 시 기본
- 칩 필터: 새 문의 N · 연락함 · 완료 · 스팸. 카드: 상태 배지·시각·이름·전화·내용 1줄·썸네일 ≤3. 탭 → 펼침: 사진 크게, 내용, "📞 {이름}님께 전화하기", [연락함으로] [완료] [스팸], 메모 1줄. 펼치면 read=true.

### 알림 설정 — `ui.tsx` ContentTab의 quoteForm 카드(`data-tour="sec-form"`) 안
- "문의 알림 받기": 문자 받을 번호 · 이메일 → `save()`의 settings에 `notify:{phone,email}` 포함. 안내 "비워두면 위 전화번호와 로그인 이메일로 알려드려요."

## 6. 문구 (독자 제작)

```
부제(sub 없을 때) : 사진 몇 장과 연락처만 남겨주세요. 사장님이 직접 연락드려요.
연락처 오류       : 연락받을 번호를 다시 확인해 주세요
동의             : 견적 안내를 위해 이름·연락처·사진을 수집하며 1년 뒤 삭제합니다. 동의합니다.
버튼             : 견적 요청 보내기 / 보내는 중… / 접수됐어요 — 사장님이 곧 연락드려요
실패             : 지금은 보내지 못했어요. 아래 전화로 바로 연락 주세요.
미리보기          : 미리보기에서는 보내지지 않아요
문의함 빈 상태     : 아직 문의가 없어요. 홈페이지 주소를 카톡 프로필·명함·플레이스에 걸어두면 여기 쌓여요.
```

## 7. 보안·개인정보

- 스팸: IP rate limit · 허니팟 · 3초 규칙 · 10분 중복 · 스팸 표시 시 30일 차단
- 사진은 비공개 버킷 + signed URL(10분)만. IP는 일 단위 salt 해시만.
- 동의 문구·`consent_at` 필수. 1년 후 삭제/마스킹 cron은 다음 스프린트(정책 문구만 먼저).
- 온스토리 개인정보처리방침에 "고객 문의 대행 처리" 항목 — P9 법무.

## 8. 완료 조건

- G1: build·tsc 통과, 기존 파일 수정은 .env.example·PROGRESS.md 한 줄뿐, curl로 허니팟 400·6번째 429 확인
- G2: build 통과, `lib/schema.ts` 무변경, 실브라우저에서 사진 2장 접수 → 문의함 배지 1 → 펼침에서 signed URL 사진 표시 → 연락함 전환 → 배지 0, `grep panel-inbox` 1건
- 프로덕션: 폰에서 실접수 1건 → inquiries 1행 · inquiry-photos 파일 · 문의함 표시 · notify-check 채널 상태
