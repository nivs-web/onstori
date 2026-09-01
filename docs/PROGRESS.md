# PROGRESS.md — 작업 인수인계 (2026-09-01 기준)

> 이 파일만 읽고 작업을 이어받는 사람을 위한 문서. 기준: 브랜치 `phase-4-auth`(P4 진행 중) — main은 origin/main보다 앞서 있음(**미푸시**). 푸시 = 프로덕션 자동 배포이므로 푸시 전에 에디터 E2E 확인 권장.
> 프로덕션: https://onstori.com (Vercel 프로젝트 `onstori-pwk2`, 푸시 = 자동 배포).
> 로컬 실행: `npm run dev` (2026-09-01 정상 기동 확인 — 안 뜨면 `npm run build && npm run start` 폴백).
> 비밀키: `.env.local` (git 미포함) — Supabase URL/anon/service, GEMINI_API_KEY, ADMIN_KEY.

---

## P3 (에디터) — 완료 (2026-09-01)

섹션 삭제·앵커 스크롤·투어 최소 동작은 P3 범위에서 이월(아래 표). 그 외 전부 완료.

### 완료

| 무엇 | 어디 |
|---|---|
| 폼 기반 에디터 v1 (섹션별 텍스트 편집·분위기 팔레트·히어로 사진 업로드) | `app/[slug]/edit/page.tsx`(서버 셸), `app/[slug]/edit/ui.tsx`(전체 UI) |
| 이야기 쓰기 탭 (유형 4종·사진 ≤4장 업로드·즉시 공개) | `app/[slug]/edit/ui.tsx` 의 `StoryTab` |
| draft 저장 ↔ 사이트 반영(발행) 분리 + 발행 시 이전본 스냅샷 | `app/api/site/update/route.ts`, `app/api/site/publish/route.ts` (스냅샷 → `site_versions`) |
| 스토리 저장 API | `app/api/site/story/route.ts` |
| 사진 업로드 (sharp→WebP 1600w→`uploads` 버킷) | `app/api/site/upload/route.ts` |
| 에디터 초기 데이터 로드 | `app/api/site/get/route.ts` |
| 소유권 게이트(임시): 브라우저 anonId ↔ `sites.anon_id` 매칭 + 운영자(ADMIN_KEY 쿠키)는 전체 사이트 우회 | `lib/site-owner.ts` |
| 완성도 점수 실계산 + `site_progress` 캐시 + funnel 이정표(first_edit/first_story/published) | `lib/score.ts` (규칙표는 `config/completeness.ts`) |
| 나머지 섹션 폼 5종: 갤러리(다중 업로드·삭제·순서)·후기·배너·시공사례·메뉴판 → 섹션 12종 전부 편집 가능 | `app/[slug]/edit/ui.tsx` `ContentTab` switch (업로드는 `/api/site/upload` 재사용) |
| 섹션 추가 패널 (없는 타입만 맨 아래 삽입, gallery·portfolioGallery는 zod min(1) 때문에 첫 사진 업로드와 함께 삽입) + 타입별 기본값 팩토리. 사실 정보(주소·전화·영업시간)는 날조 대신 "입력해 주세요" 안내 문구 | `ui.tsx` `ContentTab` 하단 패널, `lib/section-defaults.ts` (신설) |
| 섹션 순서 변경: 카드 우상단 ↑↓ 버튼, hero 맨 위 고정(hero 위로 이동 불가·hero엔 버튼 없음) | `ui.tsx` `ContentTab` — 카드가 wrapper div로 감싸짐, `moveSection` |
| ContentTab switch의 `default: return null` → 보이는 폴백 카드("알 수 없는 섹션")로 교체. 모르는 타입을 숨기면 저장 실패(zod) 원인을 찾을 수 없어서 | `ui.tsx` `ContentTab` switch default |

E2E 검증됨: 운영자 로그인 → `/barun-electric/edit` 수정·발행·사진 3장 업로드·스토리 작성 → 점수 60→75 상승, 라이브 반영 (프로덕션에서 무권한 API 403 확인).

섹션 추가·순서 변경(2026-09-01) 검증 수준: `npm run build` 통과 + 기본값 11종 전부 `Section` zod 통과(임시 스크립트로 확인 후 삭제). **에디터 실사용 E2E는 미실시** — 프로덕션 푸시 전에 `/barun-electric/edit`에서 추가→이동→저장→발행 한 번 돌려볼 것.

### P3에서 이월한 항목 (미구현 — P4 차단 아님)

| 항목 | 건드릴 파일 (예상) |
|---|---|
| 섹션 삭제 | `ui.tsx` 카드 wrapper의 ↑↓ 버튼 옆, hero·quoteForm 삭제 방지 가드 필요 |
| 앵커 스크롤("＋N점" 클릭→해당 폼으로 이동) | `ui.tsx` 점수 힌트 영역에서 `document.querySelector('[data-tour=...]')`.scrollIntoView — 앵커는 이미 붙어 있음 |
| 투어 최소 동작 | `config/tours.ts` 스텝 3개가 현 에디터 구조와 불일치(아래 앵커 표) — 투어 UI 전에 스텝 재정의 필요. P9 투어 폴리시와 묶어도 됨 |

⚠ 섹션 편집을 추가할 때 CLAUDE.md 불변 규칙 2: **zod(`lib/schema.ts`) + 렌더러(`components/sections/index.tsx`) + 에디터 폼(`ui.tsx`) + `docs/SCHEMA.md` 4곳 한 커밋**.

---

## P4 (계정·세션) — 진행 중 (2026-09-01 착수, 브랜치 `phase-4-auth`)

방식 확정: **카카오 OAuth + 이메일 6자리 OTP**. 아키텍처는 service-role + 서버 세션 검증 유지(RLS는 심층 방어), 미들웨어 재도입 없음 — 결정 이유 3건은 DECISIONS 2026-09-01 참조. 스키마 변경 없음(`sites.owner_id`·owner RLS는 core 마이그레이션에 이미 존재).

### 완료 (코드)

| 무엇 | 어디 |
|---|---|
| `@supabase/ssr` 세션 클라이언트 — 서버(쿠키 갱신 포함, Route Handler 전용 갱신)·브라우저(로그인 UI 전용) | `lib/supabase/server.ts`, `lib/supabase/browser.ts` |
| 로그인 페이지: 카카오 버튼 + 이메일 OTP 2단계(주소 → 6자리 코드). 성공 시 claim 후 `?next=`로 이동 | `app/login/page.tsx`, `app/login/ui.tsx` |
| 카카오 OAuth 콜백 (code→세션 교환 → `/login` 복귀, claim은 로그인 페이지가 마무리) | `app/auth/callback/route.ts` |
| anon claim: 로그인 직후 anonId 일치·무주인 사이트에 `owner_id` 부여 + `anon_id` 소거 | `app/api/auth/claim/route.ts` |
| 소유 판정 교체: owner_id 있으면 세션 일치 필수, 무주인만 anonId 폴백, 운영자(ADMIN_KEY) 우회 유지 | `lib/site-owner.ts` (게이트 API 5곳 자동 적용) |
| 로그인 상태 생성 시 처음부터 `owner_id` 저장 (anon_id는 null) | `app/api/generate/route.ts` |
| 에디터 거부 화면 → 로그인 유도 버튼(`/login?next=/{slug}/edit`) | `app/[slug]/edit/ui.tsx` |
| dev 서버 기동 실패 원인이던 CSS `@import` 순서 수정 | `app/globals.css` |

검증(2026-09-01 로컬): `npm run build` 통과 · `/login` 렌더 확인 · 무세션/오류 anonId → `/api/site/get` 403 · 무세션 claim 401 · 운영자 쿠키 우회 정상. **로그인 실동작 E2E는 대시보드 설정 후에만 가능.**

### 이메일 OTP E2E — ✅ 통과 (2026-09-01)

Resend SMTP + 템플릿 2종 교체 후 실측. **신규·기존 두 경로 모두 인증번호 발송 → `verifyOtp` → 세션 발급까지 확인.**

| 경로 | 템플릿 | 결과 |
|---|---|---|
| 처음 보는 이메일 (`+otp1` 플러스 주소) | Confirm sign up | 인증번호 메일 ✅ → 검증 ✅ 세션 발급, `email_confirmed_at` 기록 |
| 이미 가입된 이메일 | Magic Link | 인증번호 메일 ✅ → 검증 ✅ 세션 발급 |

**이 과정에서 잡은 버그: OTP가 8자리인데 앱은 6자리만 받고 있었다.** Supabase의 `Email OTP Length`(Authentication → Providers → Email)는 6~10자리 설정값이고 이 프로젝트는 8자리. `app/login/ui.tsx`가 입력을 6자로 자르고 `length !== 6`으로 제출을 막아 **실제로는 로그인이 불가능한 상태**였다. 자릿수를 하드코딩하지 않고 `OTP_MIN 6 ~ OTP_MAX 10`으로 받도록 수정 — 대시보드 설정이 바뀌어도 안 깨진다.

테스트 사용자·일회성 스크립트는 정리 완료. 남은 검증은 소유권 차단·claim·카카오(auth-setup 5절).

### 차단 — Supabase 대시보드 설정 (운영자 담당, `docs/auth-setup.md` 체크리스트)

카카오 개발자 앱(REST 키·시크릿·Redirect URI) + Supabase 프로바이더 활성화 + Redirect URL 등록 + OTP 이메일 템플릿(`{{ .Token }}`) 교체. 이 설정 전까지 `/login`은 "메일 발송 실패 / 카카오 시작 실패"가 정상이다.

### P4 남은 코드 작업

1. 대시보드 설정 후 로그인 E2E (auth-setup.md 5절 시나리오 4종)
2. 에디터 내 로그인 유도 배너: anonId로만 접근 중인 사용자에게 "로그인하면 다른 기기에서도 수정할 수 있어요" — claim 유입 경로가 `/login`뿐이라 필요. `/api/site/get` 응답에 소유 상태 추가 필요
3. 운영자 인증 교체 검토: ADMIN_KEY → Supabase Auth 이메일 화이트리스트(docs/admin.md) — P4에서 할지 P7로 이월할지 결정
4. 로그아웃 UI (현재 없음 — `/login`에 로그인 상태 표시 + 로그아웃 버튼이 최소형)

### 시작 전 정리

- ~~프로덕션 테스트 데이터 `dbtest`·`hanbit-test`~~ — **삭제 완료(2026-09-01, 사용자 승인·실행)**: sites cascade + storage(파일 없었음) + showcase(등록 없었음), `barun-electric` 유지 검증됨. 일회성 스크립트는 실행 후 제거.
- 로컬 잔재 브랜치 `phase-1-renderer`·`debug/full-middleware` 삭제 가능 (미처리).

---

## 이미지뱅크 관리 시스템 (2026-09-01)

검수·매칭에 4가지 추가. **마이그레이션 없음** — `tags text[]`는 core 마이그레이션에 처음부터 있었다.

| 무엇 | 어디 |
|---|---|
| **일괄 승인** — 전체 선택 / 검수 대기만 선택 / 선택 N장 승인. 거부·삭제는 오판 위험이 커서 개별 유지 | `app/admin/bank/ui.tsx` `BankGrid`, `POST /api/admin/bank` (최대 200장) |
| **자유 태그** — 카드마다 태그 입력(Enter/blur 추가, 클릭 삭제). 태그당 20자·최대 12개로 서버에서 정규화 | 같은 파일 `TagEditor`, `PATCH /api/admin/bank`의 `tags` |
| **태그 가중치** — 업체명+소개 문장에 태그가 포함되면 그 이미지 우선. 적중분이 있으면 그 그룹에서만, 없으면 기존대로 상위 5장 랜덤 | `lib/bank.ts` `pickImage(.., { text })`, 호출부 `lib/generate.ts` |
| **"사용 중" 공용 판정** — 발행본 섹션을 훑어 URL→사용처. draft 제외, 누적이 아닌 현재 상태 | `lib/image-usage.ts` (신설) — 어드민 배지와 pickImage가 **같은 함수 재사용** |
| **히어로 중복 방지** — 지금 어딘가에서 hero로 쓰이는 이미지는 후보에서 제외. 히어로를 교체·발행하면 자동으로 다시 후보 | `lib/bank.ts` role==='hero' 분기. gallery 등은 기존 used_count 가중치 유지(제외 안 함) |
| **재고 부족 안전장치** — 미사용 hero < 5면 에러 없이 used_count 낮은 순 폴백 + `hero_stock_low` 경고 로그. 어드민 상단에 (업종·분위기)별 부족 배지 | `lib/bank.ts` `HERO_STOCK_MIN`·`heroStock()`, `app/admin/bank/page.tsx` |

검증(실데이터): 사용 판정이 시드 히어로를 3개 사이트 공유로 정확히 집계 · 태그 "브런치" 적중 시 6/6 선택, 불일치 텍스트에서도 정상 폴백 · 재고 부족 시 경고 로그 발생 후 진행 · 일괄승인/태그 PATCH 무권한 401 · `tsc`·`build` 통과. 검증 스크립트는 실행 후 삭제.
`BankCardActions`(구 카드 액션)는 `BankGrid`로 대체되어 제거.

---

## Gemini 크레딧 — 현 상태 (2026-09-01 진단)

이미지 생성이 **크레딧 소진으로 차단**. 코드·환경변수 문제가 아님을 확인했다.

- 환경변수 이름 일치: `.env.local`의 `GEMINI_API_KEY` ↔ 코드 3곳(`lib/gemini.ts:15`, `scripts/bank-generate.ts`, `scripts/bench-image.mjs`). 값 형식도 정상(따옴표·공백·개행 잔재 없음).
- 키 자체는 유효: `models.list` 200, 이미지 모델 6종 노출.
- 그러나 모든 생성 호출이 429 — 텍스트는 `prepayment credits are depleted`(선불 크레딧 소진), 이미지는 `FreeTier limit: 0`(크레딧 소진 후 무료 티어로 강등된 결과).
### [근본 원인 확정] Google Cloud 무료 체험판 계정

키의 프로젝트 `project-e8a34e87-a445-4701-af4`("My First Project")는 **`jachung18@gmail.com`** 소속이 맞다(`info@nivs.com` 아님 — 그 계정에선 검색 결과 없음). AI Studio 키 목록에 안 보였던 건 **AI Studio로 "가져오기" 하지 않은 프로젝트**라서.

진행 경과 (같은 날 순차 확인):

| 단계 | 상태 |
|---|---|
| 계정 정리 — `jachung18@gmail.com` 단독 로그인 | ✅ 완료 |
| GCP 결제 계정 무료 체험판 → **유료 계정** 업그레이드 | ✅ 완료 (배너 소멸, "유료 계정" 표시) |
| AI Studio가 결제 계정 인식 (`유료 1 · US$250 등급 한도`) | ✅ 완료 |
| **선불 결제 수단 설정 + 크레딧 충전** | ❌ **미완 — 현재 차단 지점** |
| Gemini API 결제에 프로젝트 연결 | ❌ 미완 (`프로젝트 0개`) |

원래 상태였던 무료 체험판(크레딧 ₩435,523 / 종료 2026-12-01 / 청구액 ₩0)은 업그레이드로 해소됨. 단, **GCP 유료 전환만으로는 Gemini API가 열리지 않는다** — 이 지역은 Gemini API가 별도 **선불(prepay) 크레딧** 모델이라 AI Studio에서 결제 수단 등록 + 충전이 따로 필요.

**핵심: GCP 무료 체험판 크레딧은 Gemini API(`generativelanguage.googleapis.com`) 유료 등급에 쓸 수 없다.** 콘솔 안내문 그대로 "유료 Cloud Billing 계정으로 업그레이드하지 않는 한 요금이 청구되지 않는다" = 유료 호출 자체가 불가. 그래서 API는 선불 잔액 0으로 보고 `prepayment credits are depleted`를 반환한다. 크레딧이 "소진"된 게 아니라 **애초에 Gemini API용 잔액이 0**인 것.

**→ 이 경로는 폐기.** 선불 충전 대신 **Vertex AI로 이관**해 보유 크레딧을 쓰기로 결정 (아래).

---

## Vertex AI 이관 (2026-09-01) — 코드 완료, 콘솔 설정 대기

Gemini API의 선불 크레딧을 사서 쓰는 대신, GCP 크레딧 **₩435,523**(업그레이드 후에도 이월 확인, **2026-12-01 만료**)을 쓰기 위해 접근 경로를 Vertex AI로 교체. 결정 이유·리스크는 DECISIONS 2026-09-01.

**코드 (완료)**

| 무엇 | 어디 |
|---|---|
| Vertex 전송 계층 — 서비스 계정 토큰(캐시) + generateContent + 텍스트/이미지 파트 추출 | `lib/vertex.ts` (신설) |
| 텍스트 호출 이관 — `geminiJson()` **시그니처·폴백·zod 계약 그대로**, 전송만 Vertex | `lib/gemini.ts` (`lib/generate.ts`는 무수정) |
| 이미지 배치 생성 이관 (안전장치 3종 유지) | `scripts/bank-generate.ts` |
| 이미지 벤치 — mjs→ts 이관 (Vertex 사용 위해) | `scripts/bench-image.ts` (`bench-image.mjs` 삭제) |
| 프리플라이트 교체 — env→토큰→텍스트 순 확인, `--image`로 **실제 되는 이미지 모델 ID 판별** | `scripts/vertex-preflight.ts` (`gemini-preflight.ts` 삭제) |
| 서비스 계정 키 커밋 방지 패턴 + `bench-out/` | `.gitignore` |

검증: `npm run build` + `tsc --noEmit` 통과, 프리플라이트·`--dry` 실행 정상(env 미설정을 정확히 보고). **실호출 검증은 콘솔 설정 후.**

**설정·검증 — ✅ 완료 (2026-09-01)**

| 단계 | 상태 |
|---|---|
| Vertex AI API(`aiplatform.googleapis.com`, 콘솔 표기 "Agent Platform API") 사용 설정 | ✅ |
| `onstori-gemini-sa`에 **Agent Platform 사용자**(=`roles/aiplatform.user`) 부여 — 그 전엔 역할 0개 | ✅ |
| 로컬 인증 = **ADC**(`gcloud auth application-default login`) — 서비스 계정 키 파일 미생성 | ✅ |
| 프리플라이트: 텍스트 `gemini-3.5-flash` 200 | ✅ |
| 이미지 모델 실측 — **3종 모두 가능**: `gemini-3.1-flash-image` / `gemini-3-pro-image` / `gemini-2.5-flash-image` | ✅ |
| 파이프라인 E2E 1장 (생성→dHash→WebP→bank 버킷→`image_bank` 등록) | ✅ `construction/warm/gallery` 1200x896, 공개 URL 200 image/webp 188KB |

**남은 것**
1. **⚠ 크레딧 적용 확인 (최우선)** — 비용 리포트에서 Vertex 사용분에 ₩435,523 크레딧이 실제로 붙는지. 반영에 몇 시간~24시간. 체험판 크레딧은 "특정 사용량에 적용"이라 범위 제한 가능성 — 카드로 청구되면 500장 웨이브 전에 방침 재검토. https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports
2. **Vercel 환경변수** — ADC는 로컬 전용. 프로덕션 `/api/generate`를 살리려면 서비스 계정 키 JSON을 발급해 `GOOGLE_SERVICE_ACCOUNT_JSON`+`GOOGLE_CLOUD_PROJECT`로 등록해야 함. **미완 — 배포 전 필수** (이미지 웨이브는 로컬 실행이라 이것 없이 진행 가능)
3. 예산 및 알림 설정 (체험판 보호막 소멸)
4. 500장 웨이브를 **역할별로 분리 실행** — `--roles hero`는 `gemini-3-pro-image`, 나머지 역할은 `gemini-3.1-flash-image`. `--limit`을 20→50→나머지로 단계적으로. 이후 `/admin/bank` 검수

**모델 벤치 1차 (2026-09-01, 총 12장 · 약 $1.04)**

`bank-generate --limit 5`로 각 5장(같은 업종·역할·무드 범위) + `bench-image.ts`로 **동일 프롬프트 1:1** 각 1장.

| 모델 | 장당 | 500장 실비 | 추론 토큰 |
|---|---|---|---|
| `gemini-3.1-flash-image` | $0.039 | ≈$19.5 | 없음 |
| `gemini-3-pro-image` | $0.134 | ≈$67.0 | 358 |

1차(갤러리) 결론: Flash가 피사체를 분명히 잡음(장갑 낀 손·렌치·비계 클램프), Pro는 먼지 덮개가 화면을 지배해 주제 흐림.

**모델 벤치 2차 — 히어로 한정 (2026-09-01, 20장 · $1.73). 누적 32장 · 약 $2.77**

`--seed 42`로 셔플을 고정해 두 모델에 같은 프롬프트를 먹임. 각 10장 중 **프롬프트 완전일치 5쌍**을 비교.

**→ 확정: 히어로=Pro, 그 외=Flash** (DECISIONS 2026-09-01 참조)
- Pro는 **화면 한쪽을 비우는 구도**를 반복 생성 — 히어로엔 상호명·헤드라인이 얹히므로 여백이 실용성이 됨 (카페 쌍에서 왼쪽 벽면을 통째로 비운 것이 대표적)
- Flash는 **프롬프트 이행이 정확**("매입 천장등"에서 조명 그리드를 주인공으로)하고 프레임을 꽉 채움 → 갤러리·시공사례에 적합

리포트(이미지 포함): https://claude.ai/code/artifact/3cbb3ccb-fe41-4ce2-8fc3-7b48e1313c09

**벤치 중 고친 것 2건 (`scripts/`)**
1. `bench-image.ts` — mjs→ts 이관 시 남은 top-level await가 CJS에서 깨짐 → `main()` 래핑
2. `bank-generate.ts` — **429에서 해당 조합을 재시도 없이 건너뛰던 버그**. 모델 A/B에서 두 실행의 조합 순서가 어긋나는 원인이었음(10장 중 5장만 일치). 같은 조합 재시도로 수정. 함께 `--seed` 추가(결정적 셔플) + 셔플을 편향된 `sort(()=>Math.random()-0.5)`에서 Fisher-Yates로 교체.

**비용 감각**: 500장 웨이브 실비는 flash 기준 ~$20, pro 기준 ~$67. 크레딧 아끼려고 스택을 바꿀 규모가 아니다.
**Vertex AI 전환은 보류**: GCP 크레딧(₩435,523)을 이미지 생성에 쓸 가능성은 있으나 엔드포인트·인증(서비스 계정)·모델명이 모두 달라 코드 변경 필요. 사장님이 만든 `onstori-gemini-sa`는 이 경로용으로 보인다. 비용이 실제로 커지면(월 수십 달러) 그때 검토.

**충전 후 순서**: `.env.local`(+ Vercel Production) 키 확인 → `scripts/gemini-preflight.ts` 통과 → `bank-generate --limit 1` → `--limit 5` → 벤치 → 500장.
**업그레이드 직후 `예산 및 알림` 설정 권장** — 체험판 보호막이 사라지므로.

참고: Gemini API 키는 서비스 계정에 바인딩되는 자격증명이 아니다(서비스 계정은 Vertex AI의 OAuth/JSON 방식). `?key=` 방식은 프로젝트 귀속 API 키다 — 키 발급 위치를 다시 확인할 것.

---

## 스키마 정합성 현황

섹션 type 12종 기준 (`lib/schema.ts`의 `Section` discriminatedUnion):

| type | zod (`lib/schema.ts`) | 렌더러 (`components/sections/index.tsx`) | 에디터 폼 (`app/[slug]/edit/ui.tsx`) | SCHEMA.md 필드표 |
|---|---|---|---|---|
| hero | ✅ | ✅ :307 | ✅ :214 | ✅ |
| about | ✅ | ✅ :308 | ✅ :230 | ✅ |
| storyFeed | ✅ | ✅ :309 | ✅ :272 (제목만) | ✅ |
| gallery | ✅ | ✅ :310 | ✅ :278 | ✅ |
| reviews | ✅ | ✅ :311 | ✅ :312 | ✅ |
| map | ✅ | ✅ :312 | ✅ :259 | ✅ |
| banner | ✅ | ✅ :313 | ✅ :336 | ✅ |
| portfolioGallery | ✅ | ✅ :314 | ✅ :344 | ✅ |
| processSteps | ✅ | ✅ :315 | ✅ :237 | ✅ |
| quoteForm | ✅ | ✅ :316 | ✅ :250 | ✅ |
| hoursCard | ✅ | ✅ :317 | ✅ :266 | ✅ |
| menuPrice | ✅ | ✅ :318 | ✅ :382 | ✅ |

- **SCHEMA.md 필드표**: 2026-09-01 `lib/schema.ts` zod 기준으로 12종 전부 작성 완료 (기존 예시 JSON의 zod 불일치 — `portfolioGallery.fromStory` 미존재 필드, `processSteps.steps` 문자열 배열, `quoteForm.phone` 누락 — 도 함께 수정).
- 에디터 폼 12종 전부 지원 (2026-09-01, 폼 5종 추가로 완료). 항목 삭제는 zod min(1)에 맞춰 마지막 1개에서 버튼 비활성화. `banner.link`는 빈 입력 시 `undefined`로 변환(zod url 검증 통과용). 스키마 자체는 변경 없음 — 불변 규칙 2(4곳 동시 수정) 미발동.

---

## data-tour 앵커 현황

정의 출처: `config/tours.ts`(투어 스텝) + `config/completeness.ts`(규칙 anchor). DOM 부착 검증은 `grep -rn 'data-tour=' app components`.

| 앵커 | DOM 부착 | 위치 / 비고 |
|---|---|---|
| score-bar | ✅ | edit/ui.tsx 헤더 |
| btn-publish | ✅ | edit/ui.tsx |
| story-new | ✅ | edit/ui.tsx (이야기 탭 버튼) |
| panel-sections | ✅ | edit/ui.tsx ContentTab 래퍼 |
| sec-hero, panel-photos, sec-form, set-contact, set-hours | ✅ | edit/ui.tsx 각 섹션 폼 |
| **preview** | ✅ | 에디터에 미리보기 패널 자체가 없음 (폼 에디터라) — 투어 스텝 수정 or 미리보기 도입 시 부착 |
| **panel-settings** | ✅ | 별도 설정 패널 없음 (섹션 폼에 통합됨) — tours.ts 스텝 재정의 필요 |
| **sec-story-feed** | ✅ | 고객 사이트의 스토리 섹션에 부착 예정이었으나 미부착 (`components/sections/index.tsx` StoryFeedSec) |
| **btn-activate** | ✅ | 활성화(결제) 버튼 자체가 P5 미구현 |
| **panel-brand** | ✅ | 브랜드키트 P6 미구현 |
| **panel-widgets** | ✅ | 연결 위젯 P8 미구현 |

→ 미부착 6종 중 3종(preview·panel-settings·sec-story-feed)은 **tours.ts와 화면의 어긋남**이므로, 투어 UI 만들기 전에 `config/tours.ts` 스텝을 현 에디터 구조에 맞게 손봐야 함.

---

## 이 세션에서 내린 결정 (설계서 v3.2에 없음)

1. **소유권 임시 체계**: 인증(P4) 전까지 `sites.anon_id` ↔ localStorage `onstori:anonId` 매칭. **운영자(ADMIN_KEY 쿠키)는 모든 사이트 수정 가능** — 무료 제작 대행(컨시어지)에 필수라 P4 이후에도 유지 예정. (`lib/site-owner.ts`)
2. **스토리는 발행 개념 밖**: draft/published와 무관하게 작성 즉시 공개(append 자산이므로). 삭제 대신 `visible=false` 설계 유지.
3. **생성 시 draft=published 동시 저장** (`app/api/generate/route.ts`) — 위저드 직후 바로 공개 상태로 시작.
4. **랜딩 `force-dynamic`**: ISR(revalidate 300)이 쇼케이스 등록을 늦게 반영해서 폐기. 어드민 등록 → 즉시 랜딩 노출. 트래픽 커지면 재검토.
5. **브랜드 디자인 시스템**(설계서엔 없음): 페이퍼 `#FBFAF7` + 잉크 `#17191d` + 딥틸 `#0e7365`(accent), Pretendard Variable 전역. 토큰은 `app/globals.css` :root. 본사 페이지 전부 이 토큰 사용, 고객 사이트는 자체 `--s-*` 팔레트로 분리.
6. **포트폴리오 = 폰 프레임 + 라이브 iframe**: 스크린샷이 아니라 실제 사이트를 375px 렌더 후 축소(`components/phone-frame.tsx`). 활성 탭만 마운트 + lazy로 성능 방어. 히어로에도 ★추천 1개 노출.
7. **완성도 규칙 v1 판정 단순화** (`lib/score.ts`): photo_real=스토리 사진 3장 이상, hero_text=헤드라인 8자 이상, logo/widget_1은 기능 미구현으로 항상 false(최대 획득 75~85점).
8. **visit 템플릿 생성 시 menuPrice·hoursCard·reviews·stats 미생성** — 사실 정보 날조 금지 원칙 (`lib/generate.ts` 주석 참조). 에디터에서 직접 입력하는 흐름.
9. **Next 16.1.6 고정**: Vercel 이슈 진단 중 다운그레이드(진짜 원인은 프레임워크 프리셋이었음). 업그레이드는 별도 검증 후. `tsconfig.json`에서 `scripts/` 제외(BigInt 타깃 충돌).
10. **showcase는 시드 슬러그(seeds/*.json)도 허용** — DB에 없는 전시용 사이트 등록 가능 (`app/api/admin/showcase/route.ts`가 `getSiteBySlug`로 검증).
11. **어드민 색·본사 액센트 blue→teal 전면 치환** (sed 일괄, `blue-*` 잔재 0).

---

## `/new` "Unexpected token 'A'" 진단 (2026-09-01)

증상: 위저드에서 `Unexpected token 'A', "An error o"... is not valid JSON`.

- **발생 지점**: `app/new/page.tsx`의 `/api/generate` 호출. `r.json()`을 `r.ok` 검사보다 **먼저** 불러서, 응답이 JSON이 아니면 파싱 예외가 그대로 catch로 가고 `setErrMsg(e.message)`로 화면에 노출됐다. (슬러그 검사 쪽도 같은 패턴이지만 catch가 조용히 무시해서 안 보였음)
- **비-JSON 본문의 정체**: `An error occurred with this application.` — Vercel의 **플랫폼 레벨 에러 페이지**다. 라우트의 try/catch가 돌기 전에 함수가 죽거나 타임아웃하면 이게 나간다. 라우트 자체는 정상이면 JSON을 준다(실측: slug-check 200 JSON, generate 409 JSON).
- **왜 죽는가**: 프로덕션 생성 1회 실측이 **20.9초**. `maxDuration = 60`인데 LLM 재시도(모델 2종 × 재시도 1회)가 겹치면 한도를 넘을 수 있다. 간헐적으로만 터지는 이유.
- **수정**: `readJson()` 헬퍼 추가 — content-type이 JSON일 때만 파싱하고, 아니면 상태코드에 맞는 한국어 문구로 바꾼다. 원문은 `non_json_response` 로그로 남긴다. 평문 500을 흉내내 검증: 화면에 "만드는 데 시간이 너무 오래 걸렸어요"가 뜨는 것 확인.
- ⚠ **이 수정은 아직 프로덕션에 없다** — `origin/main`이 `f2d5a91`이라 **P4·Vertex·뱅크 작업 전부 미푸시**. 프로덕션은 여전히 구 Gemini API 경로로 돌고 있고, Vercel의 `GEMINI_API_KEY`는 로컬 `.env.local`의 죽은 키와 **다른 키**다(생성이 실제로 성공함).
- 근본 해소는 생성 시간 단축 or 타임아웃 상향. 진단용으로 만든 `zz-diag-1` 사이트는 삭제 완료.

---

## 알려진 이슈 / TODO

- `app/api/generate/route.ts` — **rate limit 없음** (LLM 호출 API가 무방비). P9 예정이지만 공개 홍보 전에 최소한의 IP 제한 필요.
- `app/new/page.tsx` — 업종 추론 저확신 시 되묻기(설계서 4장 3단계) 미구현. 현재는 무조건 진행.
- `config/placeholder-images.ts` — Unsplash 핫링크 의존(시드·폴백 이미지). 링크 소멸 리스크 — 이미지뱅크 채워지면 의존 제거.
- `seeds/*.json` — 쇼케이스 시드 3종의 스토리 사진도 Unsplash 핫링크. 동일 리스크.
- `config/tours.ts` — 투어 스텝 3개가 현 에디터 구조와 불일치 (위 앵커 표 참조).
- 로컬 git 브랜치 `phase-1-renderer`, `debug/full-middleware` — 병합 완료된 잔재. 삭제해도 됨 (full-middleware는 미들웨어 원본 보관용이었으나 경로 방식 전환으로 무의미).
- ~~`next dev`가 이 Windows 환경에서 Ready에 도달하지 않는 현상~~ — 2026-09-01 재시도에서 정상 기동 (Ready 2.8s). 원인은 여전히 미규명이라 재발 시 `npm run build && npm run start` 폴백.

---

## 이어받을 때 먼저 읽어야 할 파일

1. **`CLAUDE.md`** — 불변 규칙 8개(마이그레이션·스키마 4곳 동시 수정·앵커 규약·서버 검증)와 명령어. 모든 작업의 전제.
2. **`docs/PLAN.md`** — Phase 로드맵과 현재 위치(P2~P3 진행 중), 빌드 게이트, 사장님 담당 할일. "지금 어디까지 왔나"의 단일 출처.
3. **`lib/schema.ts`** — 제품의 심장인 섹션 JSON 약속. 여기 바뀌면 4곳이 같이 바뀌어야 함.
4. **`app/[slug]/edit/ui.tsx`** — P3의 나머지 작업이 전부 이 파일에서 일어남 (남은 항목 표 참조).
5. **`docs/DECISIONS.md`** — 왜 경로 방식인지, 왜 Gemini 단일화인지 등 뒤집으면 안 되는 결정들의 이유.

---

## 코딩 외 대기 항목 (사장님 담당)

| 항목 | 상태 | 풀리면 할 일 |
|---|---|---|
| **Vertex AI 콘솔 설정** | **차단 — 코드는 이관 완료, 설정 대기.** GCP 유료 업그레이드·크레딧 이월(₩435,523)까지 확인됨. `docs/vertex-setup.md` 6단계 | API 사용 설정 → SA 역할 → JSON 키 → `.env.local`+Vercel → `scripts/vertex-preflight.ts` → `--image`로 모델 판별 → `bank-generate --limit 1` → 벤치 → `/admin/bank` 검수 → 500장 웨이브 |
| **통신판매업 신고 + 토스페이먼츠 가맹** | 미착수 | P5(결제) 착수 조건. 1개월 무료 종료 시점에 첫 결제가 발생하므로 지금 시작해야 타이밍 맞음 |
| **당근 비즈프로필 개설 + 홍보글 게시** | 보류 (사용자 결정) | `docs/presale.md`의 글 초안·응대 템플릿 사용. 게이트: 사진 수신 5건/2주 → P3 확정, 유료 전환 30% → P5 |
