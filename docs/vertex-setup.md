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

## 3. 서비스 계정 키(JSON) 발급 — 운영자 직접

키 발급은 **장기 자격증명을 새로 만드는 작업**이라(콘솔도 "위험한 서비스 계정 기능"으로 분류) 본인이 진행.

- [ ] https://console.cloud.google.com/iam-admin/serviceaccounts?project=project-e8a34e87-a445-4701-af4
- [ ] `onstori-gemini-sa` 클릭 > **키** 탭 > **키 추가** > 새 키 만들기 > **JSON** > 만들기
- [ ] 내려받은 파일은 **저장소 밖에 보관** (Downloads 등). 다 쓰면 삭제

## 4. `.env.local` 주입 — 스크립트 1줄

```bash
npx tsx scripts/set-sa-env.ts "C:\Users\ariancepc\Downloads\받은키.json"
```

`GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` / `GOOGLE_SERVICE_ACCOUNT_JSON`(base64) 3개를
자동으로 넣거나 교체한다. **키 내용은 화면에 출력하지 않는다.**

기존 `GEMINI_API_KEY`는 이제 안 쓴다 — 지워도 되고, 롤백 대비로 남겨둬도 무방.

## 5. Vercel 환경변수 (Production)

- [ ] `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_SERVICE_ACCOUNT_JSON` 3개 등록
- [ ] 빼먹으면 프로덕션 `/api/generate`(사이트 생성)가 죽는다 — 배포 전 필수

## 6. 검증

```bash
npx tsx --env-file=.env.local scripts/vertex-preflight.ts
```

`[1] env` → `[2] 토큰` → `[3] 텍스트 1콜` 순으로 통과해야 한다. 텍스트까지 되면:

```bash
npx tsx --env-file=.env.local scripts/vertex-preflight.ts --image
```

이미지 모델 후보 3종을 1장씩 실제 생성해 **Vertex에서 실제로 되는 모델 ID**를 가려낸다(장당 ~$0.04). 통과한 모델로:

```bash
npx tsx --env-file=.env.local scripts/bank-generate.ts --model <승자> --limit 1 --count 1
```

## 7. 크레딧 소진 확인 (중요)

첫 호출 후 몇 시간~24시간 뒤 [비용 보고서](https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports)에서 **Vertex AI 사용분에 크레딧이 적용됐는지** 확인할 것. 무료 체험판 크레딧은 "특정 사용량에 적용"이라 적용 범위에 제한이 있을 수 있다 — 크레딧이 안 붙고 카드로 청구되면 500장 웨이브 전에 방침을 다시 정한다.

- [ ] **예산 및 알림** 설정 (체험판 보호막이 사라졌으므로) — https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/budgets
