# onstori.com — 프로젝트 규칙 (CLAUDE.md)

스토리가 살아있는 소상공인 홈페이지 빌더. 상세 기획: `docs/PLAN.md` (전체 설계서 요약).

## 현재 상태

- **2026-09-05 전환 — "이야기 엔진"(기획1 `/mainplan`).** 첫 페이지·메뉴 5개(작동방식·사업이야기·자주묻는질문·리뷰·블로그)·비교 페이지를 새로 제작(`components/site/*`, 확정 히어로 "홈페이지는 텅 빈 상가입니다. 스토리에는 진짜 사람이 있습니다."). 레이아웃·섹션 순서·정보 구조는 레멘토(remento.co)를 적극 참고했고, 색상은 독자 팔레트(#005B2A/#273D3D), 아이콘·이미지·세부 UI는 유사하되 변형 — 규칙 9. **09-05 1차본은 색·세부 UI가 아직 레멘토 톤(포레스트/크림/라임)이라 규칙 9 기준으로 조정이 남아 있다(기획1 #remento 의 조정 목록).** 온보딩 5단계(`app/new/wizard.tsx`), 14일 무료→정회원 49,000원(`lib/trial.ts`, `api/billing/*`, `api/cron/expire`, `admin/members`), 60초 녹화 `/rec/{slug}?k=`(`lib/story-link.ts`, `api/story/*`). 기획실 3개: 기획1 `/mainplan` · 기획2 `/plandept` · 기획3 `/onstoriplandept`. **적용 대기: `supabase db push`(20260905090000), Vercel env(CRON_SECRET·NAVER_*·TOSS_*), 자막 워커(STEP 4)·발행 연동(STEP 6~7)은 `/mainplan` #plan 순서대로.**

- **P4 (계정·세션) 완료 — 2026-09-01 착수·종료, `main` 배포 완료.** 로그인 2종 E2E 통과(로컬·프로덕션): 이메일 OTP + **카카오는 OIDC 직결**(Supabase 프로바이더는 scope에 `account_email`이 하드코딩돼 KOE205로 막힘 — DECISIONS 2026-09-01, `lib/kakao.ts`). 소유권 차단·다른 기기 owner_id 귀속·anon claim까지 **프로덕션 실검증**, 403 거부화면 두 갈래 실화면 확인. 진행 위치의 단일 출처는 `docs/PLAN.md`.
- P7 이월: 운영자 인증 교체(ADMIN_KEY → 화이트리스트) · 운영자 로그아웃 라우트. 둘은 한 묶음이다.
- 다음: `docs/specs/2026-09-03-sprint-plan.md` 순서대로. 첫 작업은 R2-1(`docs/specs/storage-r2.md`).

## 스택

- Next.js (App Router, TS, Tailwind) 단일 앱 — 배포 1개, Vercel
- Supabase: Auth + Postgres(RLS) + Storage
- 결제: 토스페이먼츠 (빌링키 정기결제 + 1회 결제)
- AI: **Vertex AI 경유 Gemini** — 텍스트(카피·업종 분류) `gemini-3.5-flash`(폴백 2.5-flash) · 이미지 히어로 `gemini-3-pro-image` / 그 외 `gemini-3.1-flash-image`. 인증은 로컬 ADC / Vercel 서비스 계정(`lib/vertex.ts`). Seedance(히어로 무비, P6 수동 워크플로)는 미착수
  - ⚠ 설계 초안엔 "Claude API(카피)"로 적혀 있었으나 **코드에 Anthropic 의존성은 없다**(2026-09-02 확인). 의존성은 `google-auth-library` 하나

## 폴더 역할

- `app/` 페이지 + API Route Handlers. `app/[slug]/` = 고객 사이트 — 주소 체계는 경로 방식 `onstori.com/{slug}` (2026-08-31 전환, DECISIONS 참조)
- 미들웨어 없음 — 과거 서브도메인 링크는 `next.config.ts` redirects로 호환. 서브도메인은 본사 내부 전용 보류
- `config/` **제품 정책의 단일 출처** — industries.ts(업종→카테고리→템플릿 매핑), industry-picker.ts(온보딩 세부 업종→업종 id), palettes.ts(다크/화이트×8색), questions.ts(질문 은행 100), faq.ts(FAQ), completeness.ts(완성도 100점 규칙), tours.ts(가이드 투어 스텝)
- `components/site/` 본사 페이지 공용 크롬(헤더·푸터·질문 위젯·결제 모달) — 정보 구조는 레멘토 참고, 색·세부 UI는 독자(규칙 9). `content/mainplan/` 기획1(운영자 전용, `app/mainplan` 라우트)
- `components/sections/` 섹션 렌더러 컴포넌트 (에디터 미리보기와 공유)
- `lib/` schema.ts(zod), ai.ts, billing.ts, track.ts 등
- `supabase/migrations/` DB 변경의 유일한 경로
- `docs/` PLAN.md(로드맵·현재 위치) / DECISIONS.md(결정 기록) / SCHEMA.md(섹션 스키마 문서) / LICENSES.md(폰트·이미지 라이선스)

## 불변 규칙 (위반 금지)

1. **DB 변경은 마이그레이션 파일로만.** `supabase migration new <이름>` → SQL 작성(새 테이블엔 RLS 정책 동봉) → `supabase db reset`으로 로컬 검증 → 커밋. Supabase 대시보드에서 스키마 수정 금지. 대시보드에서만 가능한 설정(Auth/Storage)은 변경 시 DECISIONS.md에 한 줄 기록.
2. **섹션 스키마 변경 = 한 커밋에서 4곳 동시 수정:** lib/schema.ts(zod) + 렌더러 컴포넌트 + 에디터 폼 + docs/SCHEMA.md. 하나라도 빠지면 커밋하지 않는다.
3. **data-tour 앵커 규약:** 에디터·admin의 모든 상호작용 허브 요소에 `data-tour="식별자"`. 식별자는 config/tours.ts와 config/completeness.ts의 anchor 목록에서만 가져온다(임의 작명 금지). 조건부 렌더링으로 앵커가 사라지지 않게 한다.
4. **플랜 한도·금액 계산·슬러그 검증은 서버에서만.** 클라이언트가 보낸 금액·한도를 신뢰하지 않는다. 결제 금액은 서버의 플랜 테이블 기준으로 재계산.
5. **draft / published 분리.** 에디터는 draft만 수정, 발행 시 published로 복사 + site_versions에 스냅샷.
6. **비밀키는 `.env.local`과 Vercel 환경변수에만.** 코드·문서에 키를 쓰지 않는다.
7. **후기에 별점·평점 입력 기능을 만들지 않는다** (표시광고법 방침). 실적 카운터는 story_entries 실데이터 집계만.
8. **홈ON(homon.co.kr)의 UI·문구·디자인·템플릿을 복제하지 않는다.** 기능 개념 참고까지만. 화면·카피는 전부 독자 제작.
9. **레멘토(remento.co) 참고 방침 (2026-09-05 회장님 확정).** ①레이아웃 배치·섹션 순서·마케팅 흐름·정보 구조는 레멘토를 최대한 가깝게 따라간다(적극 벤치마킹). ②색상은 레멘토와 다르게 독자 팔레트만 쓴다 — 메인 초록 `#005B2A`, 서브 진한 초록 `#273D3D`(레멘토의 포레스트 #1E332D·크림 #F4F0E6·라임 #E1EB6E 조합은 쓰지 않는다). ③아이콘 스타일·이미지 처리·세부 UI 요소(버튼 형태·카드 모서리·목업·띠)는 뉘앙스만 비슷하게, 그대로 베낀 티가 나지 않을 만큼 변형한다. 문구·사진·콘텐츠는 전부 온스토리 것. 색·토큰의 단일 출처는 `app/globals.css`.

## 작업 방식 (karpathy-guidelines 준수)

- 가정이 생기면 명시하고, 모호하면 묻는다. 더 단순한 방법이 있으면 반박한다.
- 요청 범위 밖 코드·추측성 추상화 금지. 요청과 무관한 코드·주석을 건드리지 않는다.
- 작업은 작게: 기능 하나 = 커밋 1~3개. 검증 가능한 완료 조건을 먼저 정하고 통과시킨다.
- **ultracode 게이트:** 여러 파일에 걸쳐 정합성을 맞춰야 하는 작업(새 라우트+컴포넌트+로직이 함께 바뀌는 경우)은 먼저 **"ultracode 권장"** 이라고 제안하고 사용자 확인을 받은 뒤 진행한다. 어렵고 복잡한 추론이 필요한 작업에도 먼저 **"ultracode 권장"** 이라고 제안하고 사용자 확인을 받은 뒤 진행한다. 단일 파일 수정이나 git 작업은 제안하지 않는다.
  - 실행 방법: `claude --effort ultracode` (세션 한정 — xhigh 추론 + 워크플로 상시 적용)
- **현황 질문 처리:** '오늘 뭐 하지'·'어디까지 됐지' 같은 단순 현황 질문에는 `docs/PROGRESS.md`·`docs/PLAN.md`만 직접 읽고 답한다. 조사 워크플로(Workflow 도구)는 사용자가 명시적으로 요청했거나 문서가 실제와 크게 어긋났다고 판단될 때만 제안하고, 승인받은 뒤에 띄운다. 이미 끝난 조사 결과가 있으면 검증 단계까지 자동으로 이어가지 말고 결과부터 먼저 보고한다.
- Phase 브랜치(`phase-1-renderer` 등)에서 작업 → main은 항상 배포 가능 상태.
- **코워크(기술참모)의 파일 쓰기 경로(2026-09-05 확인):** 코워크 세션에 연결된 폴더(이 저장소)에는 코워크가 파일을 **직접 쓸 수 있다**. 그 쓰기는 git 이 아니라 파일 시스템 쓰기라 브랜치·settings.json 허용 규칙·훅을 거치지 않고, 현재 체크아웃된 브랜치의 작업 트리에 미커밋 변경으로 나타난다. 따라서 ①클코팀장은 세션 시작 시 반드시 `git status`로 미커밋 변경을 확인하고, 있으면 별도 브랜치(`feat/…`)로 옮겨 커밋한 뒤 작업한다 ②코워크는 회장님이 "써도 된다"고 그 자리에서 허락한 작업에 한해 쓰고, 어떤 파일을 썼는지 목록과 변경 전 백업 위치를 남긴다 ③쓰기 전 원본은 `fable51plandept/backup-onstori-<날짜>/` 에 복사한다.

## 명령어

- 개발 서버: `npm run dev` (서브도메인 로컬 테스트: `http://<slug>.localhost:3000`)
- 빌드 확인: `npm run build`
- 마이그레이션: `npx supabase migration new <name>` / `npx supabase db reset` / `npx supabase db push`
- 주간 루틴: `npx supabase db diff --linked` (드리프트 검사), `npx supabase db dump -f backups/$(date +%F).sql`
