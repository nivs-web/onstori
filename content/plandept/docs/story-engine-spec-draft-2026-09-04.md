# 스토리 엔진 — 주간 넛지 · AI 다듬기 · 승인 발행 (기획, 2026-09-04)

> 작성: 전략기획실(코워크). 성격: **기획·타당성 판단**. 코드는 온팀장(클로드코드)이 이 문서를 읽고 구현한다.
> 관련: `docs/specs/inquiry.md`(알림 모듈 재사용), `docs/specs/storage-r2.md`(음성 파일 저장), `config/industries.ts`(업종별 라벨).
> 한 줄 결론: **가능하고, 싸고, 온스토리의 심장이다. 단 P5 진입 3조건 뒤·시연 전에 "문자+링크" 버전(S1)만 먼저 넣고, 음성(S2)·관리 보드 고도화(S3)는 P5 뒤에 한다.**

## 0. 아이디어 요약 (사장님 원안)

매주 사장님에게 "이번 주 이야기 해주세요" 알림 → 사장님이 10~20초 음성 또는 한두 줄로 답 → AI가 다듬음 → 사장님 승인 → 홈페이지에 자동 게시. 관리자는 모든 고객의 이야기 현황을 한눈에 본다. 업종마다 이야기의 이름이 다르다(납품실적·수행실적·갤러리·치료사례·최근 시공내역). 직원 손이 가지 않게(AX) 만든다.

## 1. 타당성 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 기술 | **가능** | 스토리 테이블·작성 API(`/api/site/story`)·사진 업로드·알림 모듈(G1 `lib/notify.ts`)·Gemini 텍스트가 이미 있다. 새로 만드는 것은 ①넛지 발송 크론 ②토큰 링크 한 화면 ③AI 다듬기 프롬프트 ④관리 목록 4개뿐 |
| 비용 | **무시해도 되는 수준** | 고객 1명·월 4회 기준 문자 80원(SMS 20원×4) 또는 알림톡 32원(8원×4) + AI 다듬기 ≈ 5원. **월 49,000원 요금의 0.2~0.4%**. 음성 20초를 AI가 듣는 비용도 건당 1~2원. LMS(긴 문자)로 다 보내도 200원 |
| 운영 부담 | **AX로 해소** | 옛 계획(8/21)이 주간 포스팅을 접은 이유는 "50곳×매주 = 직원이 쓴다"였다. 이번 설계는 사장님이 쓰고 AI가 다듬고 사장님이 승인한다 — 온스토리 직원 개입 0. 예외 처리(민원·오발송)만 관리 보드에서 본다 |
| 법 | **주의 2곳** | ① 넛지 문자는 '광고'가 아니라 '서비스 이용 안내'로 보내되 **가입 시 명시 동의 + 즉시 중단 수단**을 둔다(정보통신망법 50조 광고성 정보 규제와 거리를 둔다). ② AI는 사장님이 말한 것만 다듬고 **사실·숫자·경력을 보태지 않는다**(CLAUDE.md 불변규칙 7 표시광고법). 병원 '시술 전후'는 의료광고법 심의 대상이라 v1 업종 밖으로 둔다 |
| 시점 | **P5 3조건 뒤, 시연 전** | 아래 6장 |

### 1-1. 원안에서 바꿔야 하는 것 두 가지

1. **"카톡으로 답장"은 v1에서 안 된다.** 알림톡은 회신을 받는 채널이 아니고, 카카오 채널 챗봇으로 받으려면 별도 빌더·심사가 필요하다. 문자 회신(MO)도 수신번호 서비스를 따로 사야 한다. → **답은 링크 한 화면에서 받는다.** 문자 한 통에 링크가 있고, 누르면 "이번 주 어떤 일 하셨어요?" 한 화면(글·사진·🎤)이 뜬다. 사장님 입장에선 카톡 답장과 손이 한 번 더 갈 뿐이고, 우리는 승인·사진·음성을 전부 그 한 화면에서 받을 수 있다.
2. **"매주"를 업종·반응에 따라 조절한다.** 시공·카페는 주 1회가 맞지만 용역·납품업은 격주~월 1회가 자연스럽다. 3회 연속 무응답이면 격주로, 다시 3회면 월 1회로 늦추고, 답이 오면 원래대로 돌아간다(귀찮은 문자가 되면 해지 사유가 된다).

## 2. 사장님이 겪는 흐름 (S1 기준)

```
매주 화 09:00  📱 "[온스토리] 굿목수 사장님, 이번 주 현장 이야기 한 줄 남겨주세요 → onstori.com/s/aB3kZ9  (그만 받기: 링크 하단)"
   └ 누름 →  한 화면: "이번 주 어떤 일 하셨어요?"  [글 상자] [📷 사진 4장] (S2: [🎤 20초 녹음])
                       └ "보내기" → AI가 3~5초 뒤 초안을 보여줌
                            제목: 성북구 빌라 욕실 타일 교체
                            본문: 낡은 타일을 걷어내고 … (사장님이 말한 내용만)
                            [✅ 이대로 올리기]  [✏️ 고치기]  [🗑 안 올리기]
                                 └ 올리기 → 홈페이지 스토리에 즉시 게시 + "올라갔어요 · 보러 가기"
```

- 링크는 **로그인 없이** 열린다(토큰 7일 유효, 1회 게시 후 만료). 사장님 폰에서 카톡 로그인 다시 하는 순간 이탈한다.
- 사진 없이 글만 와도 게시한다. 사진이 오면 업로드 경로는 기존 `/api/site/upload`(R2 `stories/…`).
- 게시 = 기존 `story_entries` insert(기존 작성 API와 같은 코드 경로) + `revalidatePath("/{slug}")`.
- 승인 없이 자동 게시하는 옵션("그냥 올려줘")은 **두지 않는다**. 사장님 이름으로 나가는 글이라 승인 한 번은 법적·심리적 안전장치다. 대신 승인 버튼을 화면 최상단 큰 버튼으로 둬서 3초짜리 동작으로 만든다.

## 3. 데이터 · 코드 (S1)

### 3-1. 테이블 (마이그레이션 1개)

```sql
create table story_nudges (              -- 보낸 알림 1건 = 1행
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  token text unique not null,            -- 링크용 22자 무작위. 7일 후 만료
  channel text not null check (channel in ('sms','alimtalk','email')),
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  replied_at timestamptz,
  expires_at timestamptz not null,
  status text not null default 'sent' check (status in ('sent','opened','replied','published','expired','failed')),
  error text
);
create index on story_nudges (site_id, sent_at desc);

create table story_drafts (              -- 사장님 입력 + AI 초안 + 승인 결과
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  nudge_id uuid references story_nudges(id) on delete set null,
  source text not null check (source in ('text','voice')),
  raw_text text,                         -- 사장님이 친 글(또는 음성 전사문)
  audio_key text,                        -- R2 private 'voice/{siteId}/{uuid}.m4a' (S2)
  photos jsonb not null default '[]',
  ai_title text, ai_body text, ai_model text,
  status text not null default 'draft' check (status in ('draft','published','discarded')),
  story_entry_id uuid references story_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on story_drafts (site_id, created_at desc);
-- RLS: 둘 다 enable, 정책 없음(service-role 전용). 사장님 화면은 토큰으로 API를 거친다.
```

- `sites.settings.story` (jsonb, 스키마 변경 없음): `{ optin_at, channel:'sms', weekday:2, cadence:'weekly'|'biweekly'|'monthly', paused:false, missed:0, phone? }`
- `site_progress.funnel.first_nudge_reply_at` — 첫 응답 시 기록(완성도·퍼널 지표).
- raw_text 와 ai_body 를 **둘 다 보관**한다 — "AI가 뭘 보탰나"를 언제든 대조할 수 있어야 표시광고법 방어가 된다.

### 3-2. API · 크론

| 라우트 | 누가 | 동작 |
|---|---|---|
| `GET /api/cron/story-nudge` | Vercel Cron (헤더 `CRON_SECRET` 검증) | 매일 09:00 KST 1회. `settings.story.optin_at` 있고 `paused=false` 이고 오늘이 그 사이트의 요일·주기에 맞는 사이트를 골라 토큰 생성 → `story_nudges` insert → `lib/notify.ts`에 **`notifyStoryNudge()` 추가**(SMS 우선, env 없으면 email). 3회 무응답이면 cadence 한 단계 늦춤. 한 번에 최대 200건, 실패는 status='failed'+error |
| `GET /s/[token]` (페이지) | 사장님 | 토큰 검증(만료·이미 게시면 안내 화면) → `opened_at` 기록 → 입력 화면. 상호·업종 라벨(4장) 표시 |
| `POST /api/story/draft` | 사장님(토큰) | `{token, text?, photos[]}` → Gemini 3.5 flash 로 제목·본문 초안 → `story_drafts` insert → `{draftId, title, body}` 반환. 3초 규칙·rate limit(`rate_limit_hit("nudge:"+token)`) |
| `POST /api/story/decide` | 사장님(토큰) | `{token, draftId, action:'publish'|'discard', title?, body?}` → publish면 `story_entries` insert(entry_type=업종 기본값) + nudge status='published' + revalidatePath. discard면 status='discarded' |
| `POST /api/story/optout` | 사장님(토큰) | `settings.story.paused=true` — 링크 하단 "그만 받기" 한 번에 끝. 재개는 에디터에서 |
| `GET /api/admin/stories` | 운영자 | 사이트별 마지막 이야기 경과일·최근 4주 발송/응답·상태 (5장) |

- Vercel **Hobby 크론은 하루 1회**만 된다 → 09:00 KST(00:00 UTC) 고정, 요일만 사장님이 고른다. Pro 전환 후 시간 선택 추가. 대안으로 Supabase `pg_cron`으로 매시간 호출하는 방법도 있으나 지금은 단순한 쪽.
- 알림 문구(독자 제작): `[온스토리] {상호} 사장님, 이번 주 {라벨} 한 줄 남겨주세요 → {링크}` (SMS 90바이트 안). 야간 발송 없음(09:00 고정).

### 3-3. AI 다듬기 프롬프트 (겹층 구조 — 옛 음성 데모의 global→industry→business→daily 구조를 그대로)

```
[global]   너는 사장님이 말한 내용을 홈페이지 '스토리' 글로 정리한다. 사장님이 말하지 않은 사실·숫자·기간·경력·수상·후기·품질 자랑을 절대 추가하지 않는다.
           과장 형용사("최고","완벽","숙련된")를 쓰지 않는다. 존댓말, 2~4문장, 제목 20자 이내. 출력은 JSON {title, body}.
[industry] {업종 storyPrompt} 예) 시공: 어디(동 단위까지만)·무슨 작업·어떤 상태였고 어떻게 했는지 순서로.
[business] 상호 {business_name}, 소개문 {about.body 앞 200자} — 말투 참고용. 소개문의 사실을 이번 글에 옮기지 않는다.
[this week] 사장님 입력: """{raw_text}"""  사진 {n}장.
```

- 모델: `gemini-3.5-flash`(기존 `geminiJson` 재사용, `ai_model` 기록). 후처리: 금지어 목록(`lib/generate.ts`의 날조 금지 규칙과 같은 목록) 걸리면 그 문장만 제거 후 반환.
- 사장님 입력이 10자 미만이면 AI를 부르지 않고 "조금만 더 적어주세요" 안내(토큰 낭비·빈 글 방지).

### 3-4. 업종별 라벨 — `config/industries.ts` 에 `story` 필드 추가

| 업종군 | 섹션 제목(라벨) | 한 건의 이름 | 기본 entry_type | 넛지 문구의 {라벨} | 주기 |
|---|---|---|---|---|---|
| 시공·출장 12업종 (v1 활성) | 최근 시공 내역 | 시공 | work | 현장 이야기 | weekly |
| 카페·식당 (v1 활성) | 우리 가게 소식 | 소식 | news | 가게 소식 | weekly |
| 제조·납품 (비활성, 준비만) | 납품 실적 | 납품 | work | 납품 이야기 | biweekly |
| 용역·연구·공공 (비활성) | 수행 실적 | 수행 | work | 수행 소식 | monthly |
| 사진·영상·미용 (비활성) | 작업물 | 작업 | work | 작업물 | weekly |
| 병원·시술 (비활성, **법무 후**) | 치료 사례 | 사례 | work | — | — |

- 지금 코드에서 스토리 섹션 제목이 고정돼 있으면 렌더러가 `industry.story.label`을 읽도록 바꾼다(섹션 zod 스키마는 안 바꾼다 — 라벨은 config 값).
- 병원·시술의 '전후 사진'은 의료광고법상 심의·환자 동의 대상이라 **라벨만 예약하고 활성화하지 않는다**(카테고리 4 비활성 정책과 같은 선상).

## 4. 관리자 화면 (S1 최소 → S3 고도화)

S1 — `/admin/stories` 표 하나: 상호 · 업종 · 마지막 이야기(N일 전, 30일 넘으면 빨강) · 최근 4주 발송/응답(예 4/2) · 주기 · 상태(정상/일시중지/발송실패) · [지금 보내기] [일시중지]. 정렬 기본값은 "마지막 이야기 오래된 순". 이게 있어야 "누가 죽어가는지"를 매주 5분에 본다.

S3(P5 뒤) — 응답률 추이, 업종별 비교, 무응답 고객에게 보낼 문구 A/B, 사장님 채널 전환(알림톡), 관리자가 대신 초안 넣어주기(컨시어지·유료 옵션).

## 5. 알림 채널 결정

| 채널 | 건당 | 준비물 | 판정 |
|---|---|---|---|
| **SMS(솔라피)** | ≈20원 (LMS ≈50원) | 발신번호 등록(통신사 인증, 개인도 가능). G1에서 이미 env·모듈 준비 | **S1은 이걸로 시작** |
| 알림톡 | ≈8원 | 사업자등록 → 카카오 비즈니스 채널 → 템플릿 심사(1~2주). "정보성" 템플릿이어야 함 | 사업자등록(P5 전제)과 함께 신청, 통과되면 `notify.ts`에 채널 추가 — 코드 변경 최소 |
| 친구톡 | ≈15원 | 채널 친구 추가 필요, 광고성 취급 | 안 씀 |
| 이메일(Resend) | ≈0원 | 있음 | 폴백만. 사장님이 메일을 안 본다 |

**결론: 비용은 판단 변수가 아니다.** 월 49,000원 고객에게 월 100~200원이다. 변수는 "사장님이 답하느냐"뿐이고, 그건 문구·주기·한 화면 UX가 정한다.

## 6. 시점 — 왜 지금(P4)도, P9 뒤도 아닌가

- **지금(P5 3조건 앞)에 넣지 않는 이유**: 문의 접수·미리보기·위젯은 "홈페이지가 돈이 된다"를 증명하는 것이고, 스토리 엔진은 "홈페이지가 자란다"를 증명한다. 순서는 돈이 먼저다. 그리고 지금 고객이 2곳이라 넛지를 보낼 상대가 없다.
- **P9 뒤로 미루지 않는 이유**: ① 시연 때 "매주 문자 한 통에 답하면 홈페이지가 자란다"는 홈온에 없는 유일한 문장이다 — 시연 전에 있어야 판다. ② 옛 계획의 헌법 "유료 고객 5명 전 자동화 금지"는 *직원 노동을 자동화하지 말라*는 뜻이었고, 이 설계는 처음부터 직원 노동이 없다. ③ 스토리 지속률 4주 측정(PLAN 선검증 ③)은 이 엔진 없이는 측정 자체가 안 된다.
- **넣는 자리**: 스프린트 순서 **6(위젯) 다음, 7(R2-2) 앞** — S1 두 세션. R2-2는 백필이라 언제 해도 된다.

| 단계 | 내용 | 세션 | 모델 |
|---|---|---|---|
| **S1-a** | 마이그레이션 · 크론 · `notifyStoryNudge` · `/s/[token]` 화면 · draft/decide/optout API · 업종 라벨 config | 1 (새 파일만, 스키마 무변경) | Sonnet 5 |
| **S1-b** | AI 다듬기 프롬프트+후처리 · 에디터 "스토리 알림 받기" 설정 카드(요일·중단) · `/admin/stories` 표 · 프로덕션에서 내 번호로 실발송 1건 | 1 | Sonnet 5 |
| **S2** | 🎤 20초 녹음(MediaRecorder, iOS는 audio/mp4) → R2 private → Gemini 음성 입력으로 전사+초안 한 번에 · 전사문을 raw_text로 저장 | 1 | Sonnet 5 (P5 뒤) |
| **S3** | 관리 보드 고도화 · 알림톡 채널 · 월간 "이번 달 이야기 N건" 사장님 리포트 문자 | 1~2 | Sonnet 5 (P7과 합침) |

- S2를 S1과 같이 하지 않는 이유: 음성은 UX가 아니라 *응답률* 문제다. 글 링크에도 답을 안 하는 사장님은 녹음에도 안 한다. S1로 응답률을 4주 재고 나서 음성이 그 수치를 올리는지 본다. 데모 페이지(onsecret-onstori.vercel.app)는 영업용으로 그대로 쓴다.

## 7. 완료 조건 (S1)

- `npm run build` 통과 · `lib/schema.ts` 무변경 · 기존 파일 수정은 `lib/notify.ts`(함수 추가)·`config/industries.ts`(필드 추가)·`vercel.json`(cron)·에디터 설정 카드 1곳뿐
- 프로덕션: 내 번호로 넛지 1건 수신 → 링크 → 글 2줄+사진 1장 → 초안 표시 → "이대로 올리기" → 사이트 스토리에 60초 안에 표시 → `/admin/stories`에 응답 반영
- AI 초안에 사장님 입력에 없는 숫자·경력 표현이 없음(테스트 입력 5건 육안 확인)
- "그만 받기" 누르면 다음 크론에서 제외됨

## 8. 사장님 결정 사항

1. 넛지 기본 요일·시각: **화요일 09:00** 제안(월요일은 바쁘고, 주말 현장 기억이 남아 있음)
2. 승인 없이 자동 게시 옵션 — 제안은 **없음** (2장)
3. 사업자등록 시 카카오 비즈니스 채널·알림톡 템플릿 신청을 같이 진행할지
