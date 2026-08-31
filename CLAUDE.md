# onstori.com — 프로젝트 규칙 (CLAUDE.md)

스토리가 살아있는 소상공인 홈페이지 빌더. 상세 기획: `docs/PLAN.md` (전체 설계서 요약).

## 현재 상태

- **P4 (계정·세션) 진행 중 — 2026-09-01 착수, 브랜치 `phase-4-auth`.** 로그인(카카오+이메일 OTP)·claim·소유 게이트 코드 완료, Supabase 대시보드 설정 대기(`docs/auth-setup.md`). 진행 위치의 단일 출처는 `docs/PLAN.md`.
- 다음: 대시보드 설정 → 로그인 E2E → P4 잔여(`docs/PROGRESS.md` "P4 남은 코드 작업").

## 스택

- Next.js (App Router, TS, Tailwind) 단일 앱 — 배포 1개, Vercel
- Supabase: Auth + Postgres(RLS) + Storage
- 결제: 토스페이먼츠 (빌링키 정기결제 + 1회 결제)
- AI: Claude API(카피·챗봇·업종 분류), 나노바나나(이미지), Seedance(히어로 무비, 수동 워크플로)

## 폴더 역할

- `app/` 페이지 + API Route Handlers. `app/[slug]/` = 고객 사이트 — 주소 체계는 경로 방식 `onstori.com/{slug}` (2026-08-31 전환, DECISIONS 참조)
- 미들웨어 없음 — 과거 서브도메인 링크는 `next.config.ts` redirects로 호환. 서브도메인은 본사 내부 전용 보류
- `config/` **제품 정책의 단일 출처** — industries.ts(업종→카테고리→템플릿 매핑), completeness.ts(완성도 100점 규칙), tours.ts(가이드 투어 스텝)
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

## 작업 방식 (karpathy-guidelines 준수)

- 가정이 생기면 명시하고, 모호하면 묻는다. 더 단순한 방법이 있으면 반박한다.
- 요청 범위 밖 코드·추측성 추상화 금지. 요청과 무관한 코드·주석을 건드리지 않는다.
- 작업은 작게: 기능 하나 = 커밋 1~3개. 검증 가능한 완료 조건을 먼저 정하고 통과시킨다.
- Phase 브랜치(`phase-1-renderer` 등)에서 작업 → main은 항상 배포 가능 상태.

## 명령어

- 개발 서버: `npm run dev` (서브도메인 로컬 테스트: `http://<slug>.localhost:3000`)
- 빌드 확인: `npm run build`
- 마이그레이션: `npx supabase migration new <name>` / `npx supabase db reset` / `npx supabase db push`
- 주간 루틴: `npx supabase db diff --linked` (드리프트 검사), `npx supabase db dump -f backups/$(date +%F).sql`
