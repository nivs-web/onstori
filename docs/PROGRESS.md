# PROGRESS.md — 작업 인수인계 (2026-09-01 기준)

> 이 파일만 읽고 작업을 이어받는 사람을 위한 문서.
> 작업 브랜치: **`phase-4-auth`** (P4 진행 중). 프로덕션: https://onstori.com (Vercel `onstori-pwk2`, 푸시 = 자동 배포).
> 로컬 실행: `npm run dev` (안 뜨면 `npm run build && npm run start` 폴백).
> 비밀키: `.env.local` (git 미포함) — Supabase URL/anon/service, ADMIN_KEY. **AI 인증은 이제 키가 아니라 ADC**(아래 Vertex 절).

## ⚠ 배포 상태 — 프로덕션이 21커밋 뒤처져 있다

`origin/main` = `f2d5a91`(P3 완료 시점). **오늘 한 작업 전부가 미푸시**다.

- 프로덕션은 아직 **구 Gemini API(`?key=`) 경로**로 돈다. Vercel의 `GEMINI_API_KEY`는 로컬에서 죽은 키와 **다른 키**라 생성은 실제로 동작 중(실측 20.9초 성공).
- 즉 오늘 고친 것들(생성 시간 5.8초, `/new` 에러 문구, OTP 자릿수, 뱅크 기능)은 **아직 손님에게 반영 안 됨**.
- **푸시 전 필수 선행 작업**: Vercel Production에 `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_CLOUD_PROJECT` 등록. ADC는 로컬 전용이라, 이게 없으면 배포 즉시 프로덕션 `/api/generate`가 죽는다. 서비스 계정 키 발급 → `scripts/set-sa-env.ts` 참고(`docs/vertex-setup.md` 4절).
- 푸시 순서 제안: ① Vercel 환경변수 등록 → ② 푸시 → ③ `/new`에서 실제 생성 1건 확인.

---

## 오늘(2026-09-01) 한 일 요약

| 영역 | 결과 |
|---|---|
| 이미지뱅크 관리 4종 | 일괄승인 · 자유태그(+매칭 가중치) · "사용 중" 배지 · 히어로 재고 경고 |
| AI 접근 경로 | Gemini API → **Vertex AI(ADC)** 이관 완료, 실호출 검증 통과 |
| 이미지 모델 확정 | **히어로=`gemini-3-pro-image`, 그 외=`gemini-3.1-flash-image`** (동일 프롬프트 실측 근거) |
| 히어로 웨이브 | **100장 등록**(실패·중복 0, $13.40). 검수 대기 상태 |
| P4 인증 | 카카오 OAuth + 이메일 OTP 코드 완료, **이메일 로그인 E2E 통과** |
| 버그 수정 4건 | OTP 자릿수 · `/new` JSON 파싱 · 429 조합 건너뛰기 · bench top-level await |
| 성능 | 생성 20.9초 → **평균 5.8초** (thinking 토큰 병목 제거) |

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

### 대시보드 설정 현황 (`docs/auth-setup.md` 체크리스트)

| 항목 | 상태 |
|---|---|
| Resend 커스텀 SMTP (무료 티어: 월 3,000 / 일 100) | ✅ 완료 — 내장 SMTP는 시간당 2통이라 테스트도 템플릿 편집도 불가였다 |
| 이메일 템플릿 **2종** 교체 (`{{ .Token }}`) | ✅ 완료 |
| 이메일 OTP 로그인 | ✅ E2E 통과 (위) |
| **카카오** 개발자 앱 + Supabase 프로바이더 + Redirect URL | ❌ **미완 — 카카오 버튼은 아직 동작 안 함** |

⚠ **템플릿은 반드시 2종을 모두 고쳐야 한다** — 오늘 실제로 이걸로 막혔다.

메일 종류를 가르는 건 코드가 아니라 **템플릿 내용**이다: `{{ .ConfirmationURL }}`이 있으면 링크가, `{{ .Token }}`이 있으면 인증번호가 나간다. 그리고 Supabase는 상황에 따라 다른 템플릿을 쓴다.

| 상황 | 템플릿 |
|---|---|
| **처음 보는 이메일** (신규 가입 — `shouldCreateUser: true`) | **Confirm sign up** |
| 이미 가입된 이메일 | **Magic Link** |

초기에는 전원이 신규라 사실상 **Confirm sign up만 탄다.** 처음에 Magic Link만 고쳐서 "Confirm your email address" 링크 메일이 갔고, 앱은 인증번호를 기다리니 로그인이 불가능했다. 참고: `verifyOtp`의 `type`은 신규·기존 모두 `'email'`이 맞다(가입 여부로 바꿀 필요 없음).

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

**현재 뱅크 재고**: 전체 131장(hero 124) · 검수 대기 56장 · hero 승인 68장. 히어로 100장 웨이브 결과는 아래 "AI 스택" 절 참조.

---

## AI 스택 — Gemini API → Vertex AI 이관 (2026-09-01)

### 왜 옮겼나

Gemini API(`?key=`)가 이 지역에서 **GCP 결제와 별개인 선불(prepay) 크레딧**을 요구한다. 보유한 GCP 크레딧 **₩435,523**(2026-12-01 만료)이 놀게 되므로, 일반 GCP 결제를 쓰는 **Vertex AI**로 전송·인증 계층만 교체했다. 벤더는 그대로 Gemini 모델. 결정 이유·리스크는 DECISIONS 2026-09-01.

경위(참고): 무료 체험판 계정 → 유료 업그레이드까지 했으나 그것만으로는 Gemini API가 열리지 않았고, AI Studio에서 선불 결제 수단을 따로 등록해야 하는 구조였다. 그 경로는 폐기.

### 코드

| 무엇 | 어디 |
|---|---|
| Vertex 전송 계층 — 토큰(캐시)·generateContent·텍스트/이미지 파트 추출 | `lib/vertex.ts` (신설) |
| 텍스트 호출 — `geminiJson()` 시그니처·폴백·zod 계약 **그대로**, 전송만 교체 | `lib/gemini.ts` (`lib/generate.ts` 무수정) |
| 이미지 배치 생성 (안전장치 3종 유지) | `scripts/bank-generate.ts` |
| 프리플라이트 — 인증→토큰→텍스트, `--image`로 실제 되는 모델 ID 판별 | `scripts/vertex-preflight.ts` |
| 동일 프롬프트 모델 A/B (파일 저장) | `scripts/bench-image.ts` |
| 서비스 계정 키 JSON → `.env.local` 주입(내용 미출력) | `scripts/set-sa-env.ts` |

### 인증 = ADC (로컬)

`gcloud auth application-default login`으로 해결. **서비스 계정 키 파일을 만들지 않았다** — 장기 자격증명이 안 생기는 게 안전하다.

- `gcloud` 바이너리가 PATH에 없어도 동작(라이브러리가 ADC 파일을 직접 읽음). 단 `getProjectId()`는 실패하므로 `lib/vertex.ts`가 ADC 파일의 `quota_project_id`를 폴백으로 읽는다.
- `.env.local`에 Google 관련 변수 불필요.
- ⚠ **Vercel은 ADC를 못 쓴다** → 배포 시 서비스 계정 키 필요(맨 위 "배포 상태" 참조).

콘솔 설정 완료분: Vertex AI API(콘솔 표기 "Agent Platform API") 사용 설정 · `onstori-gemini-sa`에 `roles/aiplatform.user`(콘솔 표기 "Agent Platform 사용자") 부여.

### 모델 확정 — 히어로=Pro, 그 외=Flash

`--seed`로 셔플을 고정해 **완전히 같은 프롬프트**를 두 모델에 먹여 비교(1차 갤러리 1쌍 + 2차 히어로 5쌍).

| 모델 | 장당 | 강점 | 약점 | 배치 |
|---|---|---|---|---|
| `gemini-3.1-flash-image` | $0.039 | 프롬프트 이행 정확, 피사체 선명 | 여백 없이 꽉 참 | 갤러리·시공사례·about·process |
| `gemini-3-pro-image` | $0.134 | **한쪽을 비우는 구도**, 빛 처리 | 지시보다 분위기 우선 | **히어로** |

히어로엔 상호명·헤드라인이 얹히므로 Pro의 여백이 곧 실용성이다. 반대로 "매입 천장등" 같은 지시 이행은 Flash가 정확했다. 설계서 2026-08-31 원안과 같은 배치이나 이번엔 근거가 있다.
리포트(이미지 포함): https://claude.ai/code/artifact/3cbb3ccb-fe41-4ce2-8fc3-7b48e1313c09

### 히어로 100장 웨이브 — ✅ 완료 (batch `202609010247`)

```
model gemini-3-pro-image · created 100 · dups 0 · fails 0 · apiCalls 100 · estCostUsd 13.4
```

- 등록 100/100 (DB 확인), 공개 URL 정상(`200 image/webp`, 1376x768)
- 분포: cafe 15 / interior 13 / wallpaper 12 / electric 10 … · premium 34 / warm 25 / clean 21 / lively 20
- **429가 91회 났지만 한 장도 안 잃었다** — 아래 "429 조합 건너뛰기" 버그를 미리 고쳐둔 덕. 대신 30초 대기가 겹쳐 실행이 길어졌다.
- 뱅크 현황: 전체 131장(hero 124) · **검수 대기 56장** · hero 승인 68장

**다음**: `/admin/bank`에서 "검수 대기만 선택 → 일괄 승인"으로 검수. 그 뒤 재고를 보고 빈 조합만 좁혀서 보충(현재 hero 승인이 36개 조합에 걸쳐 있고 그중 **33개 조합이 5장 미만**, 전체 조합은 14업종×4무드=56).

### 벤치 중 고친 것

1. `bank-generate.ts` — **429에서 해당 조합을 재시도 없이 건너뛰던 버그**. 모델 A/B의 조합 순서가 어긋나는 원인이었다(10장 중 5장만 일치). 같은 조합 재시도로 수정 + `--seed`(결정적 셔플) 추가 + 편향된 `sort(()=>Math.random()-0.5)`를 Fisher-Yates로 교체.
2. `bench-image.ts` — mjs→ts 이관 때 남은 top-level await가 CJS에서 깨짐 → `main()` 래핑.

### ⚠ 아직 확인 안 된 것 — 크레딧이 실제로 붙는가

오늘 누적 사용 **약 $16**. 이게 ₩435,523 크레딧에서 차감되는지, 카드로 청구되는지 **아직 모른다.** 체험판 크레딧은 "특정 사용량에 적용"이라 Vertex가 범위 밖일 가능성이 남아 있다. 반영에 최대 24시간.
→ [비용 리포트](https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports) 확인. **카드로 청구된다면 나머지 웨이브 전에 방침 재검토.**
→ 체험판의 "청구 없음" 보호막이 사라졌으므로 **예산 및 알림 설정**도 아직 미완.

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
- ⚠ **이 수정은 아직 프로덕션에 없다** (맨 위 "배포 상태" 참조).
- 진단용으로 만든 `zz-diag-1` 사이트는 삭제 완료.

### 생성 시간 단축 — 20.9초 → 평균 5.8초 (2026-09-01)

구간별 실측으로 병목을 특정: **thinking 토큰**이었다. 카피·분류는 정해진 JSON 스키마를 채우는 작업인데 응답당 **1,400~1,600 thinking 토큰**을 쓰고 있었다.

| 구간 | 측정 |
|---|---|
| 카피 생성 (thinking 기본) | 11.2~14.2초 · thinking 1,399~1,603 |
| 카피 생성 (`thinkingBudget: 0`) | **4.6초** · thinking 0 |
| LLM 분류 1콜(키워드 매칭 실패 시) | 10.4초 |
| `pickImage` hero / gallery | 344ms / 63ms — **병목 아님** |

**수정**: `lib/gemini.ts`의 generationConfig에 `thinkingConfig: { thinkingBudget: 0 }` 추가. 주 모델·폴백 모델(`gemini-2.5-flash`) 모두 이 옵션을 받는 것 확인.

**E2E 재측정** (`generateSite` 3케이스): 7.3s / 5.3s / 4.7s → **평균 5.8초, 최대 7.3초.** 헤드라인 품질·사실 날조 금지 준수도 육안 확인. 60초 한도에 여유가 크게 생겨 타임아웃 상향은 불필요.

⚠ 폴백 모델(2.5-flash)은 budget 0에서 "오랜 경험과 기술력으로" 같은 **근거 없는 경력 표현**을 쓰는 경향이 관찰됨(주 모델은 깨끗). 폴백이 실제로 쓰이는 경우 검수 대상.
- 추가 최적화(분류+카피 1콜 병합)는 **하지 않음** — 5.8초면 충분하고, 프롬프트가 복잡해져 얻는 것보다 잃는 게 크다.

---

## 알려진 이슈 / TODO

### 🔴 표시광고법 리스크 — 폴백 모델의 근거 없는 경력 표현

`thinkingBudget: 0` 적용 후 폴백 모델 `gemini-2.5-flash`가 **"오랜 경험과 기술력으로"** 같은 문구를 생성하는 것을 관찰했다(주 모델 `gemini-3.5-flash`는 깨끗했다). 입력에 없는 경력을 만들어낸 것으로, **CLAUDE.md 불변 규칙(사실 날조 금지) + 표시광고법 위반**이다.

- 폴백은 주 모델 실패 시에만 쓰이므로 빈도는 낮지만, **터지면 법적 리스크**다.
- 표본 1건이라 경향 확정은 아니다. thinking을 끈 것이 원인인지, 원래 2.5-flash의 성향인지 미확인.
- **할 일**: ① 폴백 경로로 생성된 사이트를 식별할 방법 마련(현재 `inferred`에 모델명이 안 남는다) ② 카피 프롬프트의 날조 금지 규칙을 폴백에서도 지켜지는지 별도 검증 ③ 안 되면 폴백 모델 교체 or 폴백 시 경력 표현 후처리 필터.

### 🔴 v1 범위 밖 업종 입력 시 온보딩 처리 — 방식 확인 필요

v1 활성 범위는 **시공·출장 12업종 + 카페·식당 2업종 = 14종**(DECISIONS 2026-08-31)인데, 범위 밖 업종이 들어와도 **그냥 진행된다.**

- 실측: "몽 필라테스 / 1:1 맞춤 자세교정 수업" → LLM 분류가 **`repair`(수리)** 로 매핑. 필라테스에 맞는 칸이 없어서 가장 가까운 걸 고른 것.
- 코드 확인 결과 **`confidence`는 계산·저장만 되고 분기에 전혀 안 쓰인다**(`lib/generate.ts:43`, `inferred`에 담겨 DB로 갈 뿐). 저확신 되묻기(설계서 4장 3단계)는 미구현.
- 게다가 LLM이 목록에 없는 id를 뱉으면 `?? INDUSTRIES[0]`으로 **조용히 첫 업종으로 떨어진다**(`lib/generate.ts:42`).
- 결과적으로 엉뚱한 템플릿·이미지·진행단계가 붙은 사이트가 만들어질 수 있다. 당근 홍보로 불특정 업종이 들어오기 시작하면 바로 드러날 문제.
- **결정이 필요한 지점**: (a) 저확신·범위 밖이면 되묻기 UI를 띄울지 (b) "아직 지원하지 않는 업종입니다" 안내로 막을지 (c) 범용 템플릿으로 받아줄지. **사장님 판단 필요 — 사업 범위 문제라 코드로 정할 수 없다.**

### 백로그 — P5(결제) 진입 전 검토: 장기 키 대신 WIF로 전환 (예상 2~3시간)

Vercel→Vertex 인증을 **서비스 계정 키(장기 자격증명)에서 Workload Identity Federation으로** 옮긴다.

**왜**: 조직 정책 `iam.disableServiceAccountKeyCreation`이 상위 조직에서 상속·적용 중인데, 지금은 **프로젝트 단위 예외로 그 정책을 끄고** 키를 만들어 쓰는 상태다. 정책의 취지(장기 키 금지)를 우회한 것이라 부채로 남는다. WIF는 키를 아예 만들지 않는다.

**방식**: Vercel OIDC → GCP STS → **기존 `onstori-gemini-sa` 가장(impersonation)**. 키 파일 불필요, 정책 예외도 되돌릴 수 있다. 오늘 부여한 `roles/aiplatform.user`를 그대로 재사용한다. Vercel에 넣는 값은 전부 비밀이 아니다(프로젝트 번호·SA 이메일·풀/프로바이더 ID).

**코드**: `lib/vertex.ts`의 `auth()`를 `getAuthClient(): Promise<AuthClient>`로 바꾸고 분기 3개(WIF → SA JSON → 로컬 ADC). `ExternalAccountClient.fromJSON({ ..., subject_token_supplier: { getSubjectToken: getVercelOidcToken } })` — **`google-auth-library`가 이미 지원**하므로 새 인증 라이브러리 불필요. 추가 의존성은 `@vercel/oidc` 하나. 약 40줄. 로컬 ADC 흐름은 그대로.

**시간**: GCP 콘솔 30~45분 + Vercel 설정 10~15분 + 코드 30~45분 + 배포·디버깅 30~60분 = **2~3시간**. 난이도 중 — 코드는 쉽고 공식 예제가 있으나 STS 오류 메시지가 불친절하고 로컬 재현이 어려워 프리뷰 배포로 반복해야 한다. subject 문자열이 `owner:ianworld:project:onstori-pwk2:environment:production`으로 정확히 맞아야 한다.

**착수 전 확인**: 조직에 `iam.workloadIdentityPoolProviders`(허용 발급자 제한) 정책이 걸려 있는지. 걸려 있으면 Vercel 발급자를 허용 목록에 넣어야 한다.

**전환 완료 시 되돌릴 것**: ① 프로젝트의 `iam.disableServiceAccountKeyCreation` 예외 해제 ② 발급했던 SA 키 삭제 ③ Vercel의 `GOOGLE_SERVICE_ACCOUNT_JSON` 제거.

참고: [Vercel OIDC](https://vercel.com/docs/oidc) · [Vercel→GCP(Vertex 예제 포함)](https://vercel.com/docs/oidc/gcp)

### 그 외

- `app/api/generate/route.ts` — **rate limit 없음** (LLM 호출 API가 무방비). P9 예정이지만 공개 홍보 전에 최소한의 IP 제한 필요.
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
5. **`docs/DECISIONS.md`** — 왜 경로 방식인지, 왜 Vertex AI인지 등 뒤집으면 안 되는 결정들의 이유.
6. **`docs/vertex-setup.md`** / **`docs/auth-setup.md`** — 대시보드에서만 되는 설정의 체크리스트. 배포·로그인이 안 되면 여기부터.

---

## 코딩 외 대기 항목 (사장님 담당)

| 항목 | 상태 | 풀리면 할 일 |
|---|---|---|
| **크레딧 적용 확인** | ⚠ **최우선 · 미확인.** 오늘 약 $16 사용분이 크레딧 차감인지 카드 청구인지 | [비용 리포트](https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports) 확인 → 카드 청구면 나머지 웨이브 전에 방침 재검토 |
| **예산 및 알림 설정** | 미착수 (체험판 "청구 없음" 보호막 소멸됨) | Cloud Console 예산 알림 등록 |
| **Vercel 환경변수 등록** | 미착수 — **푸시 전 필수** | 서비스 계정 키 발급 → `GOOGLE_SERVICE_ACCOUNT_JSON`+`GOOGLE_CLOUD_PROJECT` 등록 (`docs/vertex-setup.md` 4절) |
| **카카오 로그인 설정** | 미착수 (이메일 OTP는 완료) | `docs/auth-setup.md` 1~3절 — 개발자 앱·프로바이더·Redirect URL |
| **이미지뱅크 검수** | 대기 56장 | `/admin/bank` → "검수 대기만 선택" → 일괄 승인. 이후 빈 조합 보충 |
| **v1 범위 밖 업종 정책 결정** | 미결정 | 위 TODO 참조 — 되묻기 / 차단 / 범용 수용 중 택1 |
| ~~Vertex AI 콘솔 설정~~ | ✅ 완료 (API 사용 설정 · SA 역할 · ADC) | — |
| **통신판매업 신고 + 토스페이먼츠 가맹** | 미착수 | P5(결제) 착수 조건. 1개월 무료 종료 시점에 첫 결제가 발생하므로 지금 시작해야 타이밍 맞음 |
| **당근 비즈프로필 개설 + 홍보글 게시** | 보류 (사용자 결정) | `docs/presale.md`의 글 초안·응대 템플릿 사용. 게이트: 사진 수신 5건/2주 → P3 확정, 유료 전환 30% → P5 |
