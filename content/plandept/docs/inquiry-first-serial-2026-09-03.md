# 견적 접수 먼저 — 단일 터미널 순차 실행판 (2026-09-03)

병렬(worktree) 없이, main 브랜치에서 터미널 하나로 G1 → db push → G2 순서로 진행한다.
에디터 v2 분해(세션 A)보다 먼저 하므로, G2는 **현재 ui.tsx(691줄) 구조 기준**으로 다시 썼다.
각 단계 끝에 "코워크에 보낼 것"이 있다 — 그걸 보내주면 검토 후 다음 단계 프롬프트를 확정한다.

---

## STEP 0 · 준비 (10분, 사람)

```powershell
cd C:\Users\ariancepc\Desktop\cowork\fable51plandept\onstori
git status          # "nothing to commit" 이어야 함. 아니면 먼저 커밋
git pull origin main
git log --oneline -3
```

Vercel → Settings → Environment Variables (Production)에 지금 추가:
- `INQUIRY_SALT` = 아무 긴 문자열 (예: 32자 랜덤)

나중에(발송 채널 열 때) 추가:
- `RESEND_API_KEY` (Resend 대시보드 → API Keys, onstori.com 도메인 인증 후)
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` (솔라피 가입 + 발신번호 등록 후)

로컬 `.env.local`에도 `INQUIRY_SALT=...` 한 줄 추가.

**코워크에 보낼 것**: `git log --oneline -3` 출력 3줄.

---

## STEP 1 · 세션 G1 — 백엔드 (클로드코드, main, 새 파일만)

```powershell
claude
```

아래를 그대로 붙여넣기:

```
브랜치 main에서 작업한다. 새 브랜치 만들지 마. push·merge·supabase db push 는 하지 마 — 내가 한다.
읽을 파일: CLAUDE.md, lib/site-owner.ts, lib/rate-limit.ts, lib/db-admin.ts, app/api/site/upload/route.ts, app/api/generate/route.ts(rate limit 호출부만), lib/score.ts(funnel 기록 방식만), docs/SCHEMA.md(QuoteForm 절만). 그 외는 읽지 마. 탐색이 필요하면 서브에이전트로 하고 본 세션엔 결론만.

목표: 손님 견적 문의를 DB에 접수하고 사장님에게 알리는 백엔드. 이번 세션은 새 파일만 만든다 — 기존 파일 수정은 .env.example 과 docs/PROGRESS.md 한 줄 외 0이어야 한다. 화면(렌더러·에디터)은 다음 세션.

1. supabase/migrations/<timestamp>_inquiries.sql — 아래 그대로. 파일만 만들고 적용하지 마.

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  kind text not null default 'quote' check (kind in ('quote','reserve','consult','contact')),
  name text not null check (char_length(name) between 1 and 40),
  phone text not null check (phone ~ '^[0-9+\-]{9,20}$'),
  message text check (char_length(message) <= 1000),
  photos jsonb not null default '[]',
  status text not null default 'new' check (status in ('new','contacted','done','spam')),
  memo text check (char_length(memo) <= 300),
  referrer_class text,
  ip_hash text,
  consent_at timestamptz not null,
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
insert into storage.buckets (id, name, public) values ('inquiry-photos','inquiry-photos', false)
  on conflict (id) do nothing;

2. lib/inquiry.ts — zod InquiryInput(name 1~40, phone /^[0-9+\-]{9,20}$/, message ≤1000 optional, consent literal "1", website 빈 문자열, t0 숫자). 사진: 최대 3장, 각 10MB 초과 거부, sharp 1600w webp(app/api/site/upload 의 방식 재사용) → service-role 로 비공개 버킷 inquiry-photos/{siteId}/{uuid}.webp 업로드. insert 전 검사: 같은 site_id+phone 10분 내 존재 → "duplicate", sites.settings.blocked_phones 에 있고 만료 전 → "blocked". ip_hash = sha256(ip + YYYY-MM-DD + process.env.INQUIRY_SALT). referrer_class 는 Referer 헤더 호스트로 direct|naver|google|instagram|kakao|other 분류.

3. lib/notify.ts — notifyInquiry({siteId, businessName, slug, inquiry:{name, phone, message?, photoCount}}). 수신처: sites.settings.notify.{phone,email} → 없으면 published JSON 의 quoteForm.phone / auth.admin.getUserById(owner_id).email. SMS = 솔라피 REST(env SOLAPI_API_KEY/SOLAPI_API_SECRET/SOLAPI_SENDER 셋 다 없으면 건너뜀), 이메일 = Resend REST fetch(env RESEND_API_KEY 없으면 건너뜀, from "온스토리 <noreply@onstori.com>"). SMS 본문: "[온스토리] {상호} 견적 문의 · {이름} {전화} · 사진 {n}장 · onstori.com/{slug}/edit?tab=inbox". 이메일 제목 "[견적 문의] {상호} — {이름}", 본문에 내용·문의함 링크(사진은 링크만, 첨부 없음). 어떤 실패도 throw 하지 않는다: console.error(JSON.stringify({evt:"notify_fail", channel, siteId, err})) 하고 sites.settings.notify_last_error 에 {channel, at, msg} 기록.

4. app/api/inquiry/route.ts — POST multipart. 순서: rate_limit_hit("inquiry:"+ip, 1h 5회, 24h 20회 — 판정 실패 시 통과) → 허니팟(website 비어있지 않음)·t0 3초 미만·consent≠"1" 이면 400 {ok:false} → slug 로 sites 조회(status in trial,active 아니면 404) → lib/inquiry 로 insert(duplicate→409, blocked→403) → void notifyInquiry(...) → site_progress.funnel.first_inquiry_at 없으면 now 기록 → 200 {ok:true, id}. export const maxDuration = 30.

5. app/api/inquiry/list/route.ts — POST {slug, anonId?, status?}. loadOwnedSite 게이트(기존 게이트 API와 동일 헬퍼). 최신 50건, photos 각각 createSignedUrl 600초. 응답 {items, newCount(status=new 개수)}.

6. app/api/inquiry/update/route.ts — POST {slug, anonId?, id, status?, memo?, read?}. 게이트 → id 가 그 site_id 소속인지 확인 → update(read=true 면 read_at=now). status="spam" 이면 sites.settings.blocked_phones 에 {phone, until: now+30d} 추가.

7. app/api/admin/notify-check/route.ts — GET, 운영자 쿠키(기존 lib/admin-auth 방식). 최근 24h 접수 수, sites.settings.notify_last_error 가 있는 사이트 수, env 채널 상태(solapi: on/off, resend: on/off).

8. .env.example 에 INQUIRY_SALT, RESEND_API_KEY, SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER 추가. docs/PROGRESS.md 맨 위 "다음 세션 시작점" 표에 "견적 접수 백엔드(G1) 완료 · 마이그레이션 미적용 · 화면(G2) 대기" 한 줄.

완료 조건:
- npm run build 통과, npx tsc --noEmit 통과
- git status 에서 수정된 기존 파일이 .env.example, docs/PROGRESS.md 뿐
- 로컬 dev 서버(npm run dev)에서 curl 로: (a) /api/inquiry 에 slug=barun-electric, name, phone, consent=1, t0=(now-5000) → 마이그레이션 미적용이라 insert 는 실패할 것이므로 그 직전까지(검증·rate limit 통과)를 로그로 증명 (b) website=abc 채운 요청 → 400 (c) 같은 IP 6번째 → 429
- 끝나면 만든 파일 목록과 커밋 메시지 초안을 보여주고 멈춰. 커밋은 내가 한다.
```

클로드코드가 멈추면:

```powershell
git add -A
git commit -m "feat(inquiry): 접수 백엔드 — 마이그레이션·API 3종·알림 모듈 (G1)"
git push origin main
```

**코워크에 보낼 것**: ① 클로드코드가 보여준 "만든 파일 목록" ② `npm run build` 마지막 20줄 ③ curl (b)(c) 결과 캡쳐.

---

## STEP 2 · 마이그레이션 적용 (사람, 5분)

```powershell
npx supabase migration list --linked     # 새 파일이 맨 아래, Remote 열이 비어 있어야 함
npx supabase db push                     # y
npx supabase migration list --linked     # Remote 에 적용 표시
```

확인(Supabase 대시보드 → SQL Editor, 조회만):
```sql
select count(*) from inquiries;                       -- 0
select id, public from storage.buckets where id='inquiry-photos';   -- false
```

**코워크에 보낼 것**: `migration list --linked` 출력 캡쳐 1장.

---

## STEP 3 · 세션 G2 — 화면 (클로드코드, main, 현재 ui.tsx 구조 기준)

```powershell
claude      # 새 세션 (/clear 상태)
```

```
브랜치 main. push 는 하지 마. lib/schema.ts 는 절대 수정하지 마 — 스키마 변경 없는 작업이다.
읽을 파일: components/sections/index.tsx(QuoteFormSec·Ctx 타입 부분), app/[slug]/page.tsx, app/[slug]/edit/ui.tsx(탭·헤더·ContentTab 의 quoteForm 폼 부분·StoryTab 만 — 전체를 다 읽지 말고 grep 으로 위치를 찾아 그 부분만), lib/inquiry.ts(타입만), config/tours.ts, config/completeness.ts(anchor 목록만). 그 외는 읽지 마.

목표 3개. 홈온 문구·UI 를 옮기지 말고 아래 문구를 그대로 쓴다.

1. components/sections/quote-form.tsx ("use client") 신설. props: { s: QuoteForm 섹션, slug: string }.
   필드: 이름(선택) / 연락처(필수, 숫자·하이픈·+ 만, 자동 하이픈) / "어떤 작업이 필요하세요? (선택)" textarea 500자 / 사진(s.allowPhotos 일 때만: input type=file multiple accept="image/*" capture="environment", 최대 3, 클라이언트에서 canvas 로 1600px 이하 JPEG 0.8 로 축소 후 전송 — 새 라이브러리 설치 금지, 썸네일·삭제) / 동의 체크(필수) "견적 안내를 위해 이름·연락처·사진을 수집하며 1년 뒤 삭제합니다. 동의합니다." / 허니팟 <input name="website" tabIndex=-1 autoComplete="off" aria-hidden> 을 position:absolute;left:-9999px 로 / hidden t0=마운트 시각.
   제출 → POST /api/inquiry (multipart: slug, name, phone, message, consent, website, t0, photos[]). 상태 idle/sending/done/error. 버튼: "견적 요청 보내기" → "보내는 중…" → done 이면 폼 자리에 "접수됐어요 — 사장님이 곧 연락드려요". done 은 sessionStorage "onstori:inq:{slug}" 에 시각 저장, 30분 내 재방문 시 done 유지. error(네트워크·429·409): "지금은 보내지 못했어요. 아래 전화로 바로 연락 주세요." 부제는 s.sub 있으면 그것, 없으면 "사진 몇 장과 연락처만 남겨주세요. 사장님이 직접 연락드려요."
   폼 아래에 기존 전화 버튼(tel:) 과 kakaoUrl 버튼을 그대로 유지. 스타일은 --s-* 변수만, 입력창 border 는 var(--s-line), 포커스 var(--s-accent). 미리보기 대비: window.parent !== window 이면 제출 버튼 disabled + "미리보기에서는 보내지지 않아요" (지금은 미리보기가 없지만 곧 생긴다).
   index.tsx: Ctx 타입에 slug: string 추가, QuoteFormSec 를 <section id="quote" ...><QuoteForm s={s} slug={ctx.slug} /></section> 로 교체. app/[slug]/page.tsx 의 ctx 에 slug 전달. (components/portfolio.tsx 등 RenderSection 을 호출하는 다른 곳이 있으면 grep 으로 찾아 slug 를 넘긴다.)

2. app/[slug]/edit/ui.tsx: 탭 타입을 "content" | "story" | "inbox" 로 확장하고 "문의함" 탭 버튼 추가(순서: 내용 수정 · 이야기 쓰기 · 문의함). 탭 버튼에 data-tour="panel-inbox" — config/tours.ts ACTIVE_ANCHORS 에 "panel-inbox" 추가하고 editorIntro 스텝 끝에 {anchor:"panel-inbox", title:"문의함", body:"손님이 보낸 견적 문의가 여기 쌓여요"} 추가. 탭 라벨 옆에 newCount 배지(0 이면 숨김). URL ?tab=inbox 면 이 탭으로 시작.
   InboxTab 은 app/[slug]/edit/inbox-tab.tsx 로 별도 파일(ui.tsx 에 더 쌓지 않는다). 진입 시 POST /api/inquiry/list. 상단 칩 필터: 새 문의 N · 연락함 · 완료 · 스팸. 카드: 상태 배지(새 문의=강조색, 연락함=회색, 완료=옅게), 시각(오늘이면 HH:mm, 아니면 M/D), 이름 · 전화, 내용 1줄, 사진 썸네일 ≤3. 카드 탭 → 아래로 펼침(사진 크게, 내용 전체, "📞 {이름}님께 전화하기" tel: 버튼, 상태 버튼 3개 [연락함으로] [완료] [스팸], 메모 입력 1줄 + 저장). 펼치면 read=true 로 update. 빈 상태: "아직 문의가 없어요. 홈페이지 주소를 카톡 프로필·명함·플레이스에 걸어두면 여기 쌓여요."

3. ui.tsx ContentTab 의 quoteForm 폼 카드(data-tour="sec-form") 안에 "문의 알림 받기" 소제목과 필드 2개: 문자 받을 번호, 이메일 → save() 가 보내는 settings 에 notify:{phone,email} 포함(기존 settings: { phone, address } 옆에). 안내 문구: "비워두면 위 전화번호와 로그인 이메일로 알려드려요."

완료 조건:
- npm run build 통과, git diff --stat 에 lib/schema.ts 없음
- 실브라우저(로컬 3000, 운영자 쿠키): /barun-electric 에서 사진 2장 포함 접수 → "접수됐어요" → 새로고침해도 유지 → Supabase inquiries 1건·inquiry-photos 2파일
- /barun-electric/edit 문의함 배지 1 → 카드 → 펼침 → 사진 2장 서명 URL 로 표시 → [연락함으로] → 배지 0
- 허니팟에 값 넣고 제출(devtools) → 400, 화면은 error 문구
- grep -rn 'data-tour=' app | grep panel-inbox 1건
- 끝나면 변경 파일 목록·커밋 메시지 보여주고 멈춰.
```

끝나면:
```powershell
git add -A
git commit -m "feat(inquiry): 손님 견적 폼 · 에디터 문의함 · 알림 설정 (G2)"
git push origin main
```

**코워크에 보낼 것**: ① 폰으로 실사이트 /barun-electric 견적 폼 캡쳐(빈 상태·사진 첨부 후·접수 완료 3장) ② 에디터 문의함 캡쳐(목록·펼침 2장) ③ `git diff --stat HEAD~1` 출력.

---

## STEP 4 · 프로덕션 확인 (사람, 10분)

1. Vercel 배포 완료 확인 → 폰에서 https://onstori.com/barun-electric 열어 실제 견적 1건(사진 1장) 접수.
2. https://onstori.com/barun-electric/edit?tab=inbox 에서 보이는지.
3. 이메일·문자: env 가 없으면 안 옴(정상). `/api/admin/notify-check` (운영자 쿠키) 열어 채널 상태 확인.
4. Supabase → inquiries 에 1건, photos 경로 확인.

**코워크에 보낼 것**: notify-check 응답 캡쳐 + 문의함 캡쳐. 여기까지 오면 "문의가 DB에 남는 홈페이지"가 됐고, 다음은 알림 채널(솔라피·Resend env) 열기 → 그 다음 에디터 v2 세션 0 으로 간다.

---

## 코워크에 보내는 방법 (효과 순)

1. 캡쳐 이미지 — 화면 상태는 캡쳐가 가장 정확. 여러 장이면 파일명에 순서(01, 02…).
2. 터미널 텍스트 — 마지막 30~50줄을 그대로 복사(캡쳐보다 텍스트가 낫다: 검색·인용 가능).
3. `git diff --stat` / `git log --oneline -5` — 무엇이 바뀌었는지 한눈에.
4. 클로드코드가 "질문"을 하면 답하기 전에 그 질문 원문을 보내도 된다 — 어떻게 답할지 같이 정한다.
5. 에러가 나면: 에러 메시지 전문 + 직전에 한 명령 + 어느 STEP 인지.
