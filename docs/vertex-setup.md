# Vertex AI 설정 체크리스트 (콘솔 작업 — 운영자 담당)

코드는 Vertex AI로 이관 완료. 아래 콘솔 설정을 마치면 GCP 크레딧(₩435,523, **2026-12-01 만료**)으로 이미지·텍스트 생성이 돌아간다.

- 계정: `jachung18@gmail.com`
- 프로젝트: `project-e8a34e87-a445-4701-af4` ("My First Project")
- 결제 계정: 유료 계정 (무료 체험판에서 업그레이드 완료)

## 1. Vertex AI API 사용 설정

- [ ] https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=project-e8a34e87-a445-4701-af4
- [ ] **사용** 버튼 클릭 (이용약관 동의 포함이라 본인이 눌러야 함)

## 2. 서비스 계정 역할 부여

- [ ] https://console.cloud.google.com/iam-admin/iam?project=project-e8a34e87-a445-4701-af4
- [ ] `onstori-gemini-sa` 에 **Vertex AI 사용자**(`roles/aiplatform.user`) 역할 추가
  - 서비스 계정이 없으면 IAM > 서비스 계정에서 새로 만들 것

## 3. 서비스 계정 키(JSON) 발급

- [ ] IAM > 서비스 계정 > `onstori-gemini-sa` > **키** 탭 > 키 추가 > 새 키 만들기 > **JSON**
- [ ] 내려받은 파일은 **저장소 안에 두지 말 것** (`.gitignore`에 패턴은 넣어뒀지만 원칙적으로 밖에 보관)

## 4. `.env.local` 에 추가

```
GOOGLE_CLOUD_PROJECT=project-e8a34e87-a445-4701-af4
GOOGLE_CLOUD_LOCATION=global
GOOGLE_SERVICE_ACCOUNT_JSON=<아래 명령의 출력값>
```

JSON을 한 줄로 넣기 어려우니 **base64 권장** (코드가 원문·base64 둘 다 인식):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\경로\키파일.json"))
```

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
