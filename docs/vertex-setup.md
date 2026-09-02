# Vertex AI 설정 체크리스트 (콘솔 작업 — 운영자 담당)

코드는 Vertex AI로 이관 완료. 아래 콘솔 설정을 마치면 GCP 크레딧(₩435,523, **2026-12-01 만료**)으로 이미지·텍스트 생성이 돌아간다.

- 계정: `jachung18@gmail.com`
- 프로젝트: `project-e8a34e87-a445-4701-af4` ("My First Project")
- 결제 계정: 유료 계정 (무료 체험판에서 업그레이드 완료)

## 1. Vertex AI API 사용 설정 — ✅ 완료 (2026-09-01 확인)

콘솔 표기는 **"Agent Platform API"**지만 `서비스 이름: aiplatform.googleapis.com` = Vertex AI. "API 사용 설정됨" 확인.

## 2. 서비스 계정 역할 부여 — ✅ 완료 (2026-09-01)

`onstori-gemini-sa@project-e8a34e87-a445-4701-af4.iam.gserviceaccount.com` 에
**Agent Platform 사용자**(= `roles/aiplatform.user`, 콘솔 표기가 리브랜딩됨) 부여. 최소 권한.

## 3. 로컬 인증 = ADC — ✅ 완료 (2026-09-01)

`gcloud auth application-default login` 으로 해결. **서비스 계정 키 파일을 만들지 않는다** — 장기 자격증명이 안 생기는 게 보안상 낫다.

- ADC 파일: `%APPDATA%\gcloud\application_default_credentials.json` (type `authorized_user`, quota_project 지정됨)
- `.env.local`에 Google 관련 변수 **불필요** — 프로젝트는 ADC에서 추론
- ⚠ `gcloud` 바이너리가 PATH에 없어도 동작한다(라이브러리가 ADC 파일을 직접 읽음). 다만 `getProjectId()`가 실패하므로 `lib/vertex.ts`가 ADC 파일의 `quota_project_id`를 폴백으로 읽는다
- 기존 `GEMINI_API_KEY`는 이제 안 쓴다 — 지워도 되고, 롤백 대비로 남겨둬도 무방

## 4. Vercel 환경변수 (Production) — ✅ 완료 (2026-09-01)

**ADC는 로컬 전용이라 Vercel에서는 동작하지 않는다.** 프로덕션 `/api/generate`(사이트 생성 시 카피 생성)를 살리려면 서비스 계정 키가 필요하다.

- [x] 서비스 계정 키 발급: [서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=project-e8a34e87-a445-4701-af4) > `onstori-gemini-sa` > 키 탭 > 키 추가 > JSON. CLI가 더 빠르다 — `gcloud iam service-accounts keys create <파일> --iam-account=onstori-gemini-sa@...`
- [x] Vercel Production에 `GOOGLE_SERVICE_ACCOUNT_JSON`(JSON 원문 또는 base64) + `GOOGLE_CLOUD_PROJECT` 등록. 붙여넣을 base64는 `npx tsx scripts/sa-key-to-clipboard.ts "<키파일 경로>"`가 클립보드로 넘겨준다(키 내용 미출력)
- ⛔ **로컬 `.env.local`에는 넣지 않는다** — 로컬 인증은 ADC(3절). 장기 키는 Vercel Production에만 둔다 (DECISIONS 2026-09-01, 키 유출이 `.env.local`을 읽다 났다)
- 이미지 웨이브(500장)는 **로컬 스크립트**로 도니 이 단계 없이도 진행 가능

## 5. 검증 — ✅ 통과 (2026-09-01)

```bash
npx tsx --env-file=.env.local scripts/vertex-preflight.ts          # 인증→토큰→텍스트
npx tsx --env-file=.env.local scripts/vertex-preflight.ts --image  # 이미지 모델 실측
```

결과: ADC 모드 / project `project-e8a34e87-a445-4701-af4` / `gemini-3.5-flash` 텍스트 200,
이미지 **3종 모두 사용 가능** — `gemini-3.1-flash-image`(1274KB) · `gemini-3-pro-image`(1192KB) · `gemini-2.5-flash-image`(913KB).

파이프라인 E2E 1장도 통과:
```bash
npx tsx --env-file=.env.local scripts/bank-generate.ts --model gemini-3.1-flash-image --limit 1 --count 1
```
→ `construction/warm/gallery` 1200x896 등록, bank 버킷 공개 URL `200 image/webp 188KB`, `image_bank` 행 생성 확인.

## 6-1. WIF (Workload Identity Federation) — ✅ 동작 (2026-09-02)

장기 SA 키 없이 Vercel OIDC → GCP STS → 서비스 계정 가장으로 인증한다.

- [x] WIF 풀 `vercel` · OIDC 프로바이더 `vercel` (issuer `https://oidc.vercel.com/ianworld`, audience `https://vercel.com/ianworld`, `google.subject=assertion.sub`)
- [x] `onstori-gemini-sa` 에 `roles/iam.workloadIdentityUser` — principal 은 subject 정확 일치
- [x] **`iamcredentials.googleapis.com` 사용 설정** ← 빠뜨리기 쉬운 곳. 없으면 STS 는 통과해도 가장 단계에서 실패한다
- [x] Vercel: 발급자 모드 **Team** + `GCP_PROJECT_NUMBER`·`GCP_SERVICE_ACCOUNT_EMAIL`·`GCP_WORKLOAD_IDENTITY_POOL_ID`·`GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` (Production)
- [x] **①** Vercel `GOOGLE_SERVICE_ACCOUNT_JSON` 제거 → 재배포 (2026-09-02). 제거 후에도 `실제경로: wif` 5회 연속·생성 200 — **WIF 단독 동작 증명됨**
- [ ] **②** SA 키 `520195620d…` 삭제 · **③** `iam.disableServiceAccountKeyCreation` 예외 해제 — 며칠 관찰 후 (PROGRESS "마무리 3단계" 참조). ③은 새 키 발급을 막으므로 되돌릴 문이 닫히는 지점

진단: `GET /api/admin/auth-check`(운영자 쿠키) — 선언 모드/실제 경로/OIDC 헤더 유무/토큰 클레임.
`?probe=wif` 를 붙이면 폴백 캐시와 무관하게 WIF 를 새로 시도해 실패 사유를 그대로 준다.

## 7. 크레딧 소진 확인 — ✅ 완료 (2026-09-01)

[비용 보고서](https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports) 실확인: **₩435,523 중 ₩25,243.93 사용, 잔액 ₩410,279.** Vertex AI 사용분에 크레딧이 정상 적용된다 — 카드 청구가 아니다. 적용 범위 밖일 수 있다는 리스크는 해소됐고, 남은 이미지 웨이브를 진행해도 된다. 만료 **2026-12-01**.

- [x] **예산 및 알림** 설정 (체험판 보호막이 사라졌으므로) — https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/budgets
  - `gemini_onstori_예산` (결제 계정 전체, 50/90/100%, ₩100,000) · `onstori-gemini-예산` (Vertex AI 서비스 한정, 50/80/100%, ₩100,000)
