# PROGRESS.md — 작업 인수인계 (2026-09-01 기준)

> 이 파일만 읽고 작업을 이어받는 사람을 위한 문서. 기준: 로컬 main — origin/main보다 앞서 있음(**미푸시**). 푸시 = 프로덕션 자동 배포이므로 푸시 전에 에디터 E2E 확인 권장.
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

## P4 시작 시 알아야 할 것 (계정·세션)

PLAN의 P4 정의는 "계정·쿠키(.onstori.com) 세션 공유"였으나, **주소 체계가 경로 방식(onstori.com/{slug})으로 전환**되어(DECISIONS 2026-08-31) 크로스 서브도메인 쿠키 공유는 더 이상 필요 없다 — 단일 오리진이라 일반 세션 쿠키면 충분. 서브도메인은 본사 내부 전용 보류 상태.

**이미 되어 있는 것 (스키마 마이그레이션 불필요):**
- `sites.owner_id uuid references auth.users` 컬럼·인덱스가 core 마이그레이션에 처음부터 존재 (`supabase/migrations/20260831120000_core.sql:17`). null = 익명 생성.
- owner 기반 RLS 정책 일습도 이미 있음: `sites_owner_all`, `stories_owner_all`, versions/progress/inquiries/events의 owner_read (같은 파일 :109~138). 단 **현재 앱은 전부 service-role(`lib/db-admin.ts`)로 접근해 RLS를 안 탄다** — RLS는 심층 방어로만 동작 중.

**만들어야 하는 것:**
1. Supabase Auth 로그인. 방식 미정(이메일 매직링크 vs 카카오 OAuth — 소상공인 타깃이면 카카오 우선 검토). Auth 설정은 대시보드에서만 가능 → 변경 시 DECISIONS.md 한 줄 기록(불변 규칙 1).
2. 세션 클라이언트: 현재 `@supabase/ssr` 미설치, 클라이언트측 Supabase 사용처 0, **미들웨어 없음**. 미들웨어 기반 토큰 리프레시 패턴은 Vercel MIDDLEWARE_INVOCATION_FAILED 전력(DECISIONS 2026-08-31, 그래서 rewrites 전환) 때문에 재도입 시 재검증 필수 — Route Handler/서버 컴포넌트에서 쿠키 갱신하는 패턴을 먼저 검토.
3. `lib/site-owner.ts` 교체: 소유 판정 anonId 매칭 → `auth.uid() == owner_id`. **운영자(ADMIN_KEY) 우회는 유지**(세션 결정 1 — 컨시어지 필수). 이 함수만 고치면 소유권 게이트 API 5곳(get/update/publish/story/upload)이 전부 따라온다. 에디터(`ui.tsx`)의 `anon()` 전송부와 거부 화면 문구("만든 기기에서 열어주세요" → 로그인 유도)도 함께 교체.
4. **anon claim 흐름**: 가입/로그인 직후 localStorage `onstori:anonId`를 서버로 보내 `sites.anon_id` 일치 사이트에 `owner_id = auth.uid` 부여. claim 후 `anon_id`를 비울지(재claim 방지) 결정하고 DECISIONS에 기록. `/api/generate`는 로그인 상태면 처음부터 `owner_id`로 저장하도록.
5. 아키텍처 결정 1건: API는 service-role + 서버 세션 검증 유지(현 구조 최소 변경 — 권장) vs anon-key 사용자 클라이언트로 전환해 RLS 실사용. 전자를 택하면 RLS는 계속 심층 방어.

**시작 전 정리하면 좋은 것:**
- 프로덕션 테스트 데이터 `dbtest`·`hanbit-test` — 계정 귀속 시작 전이 삭제 적기 (`barun-electric`은 쇼케이스라 유지).
- 로컬 잔재 브랜치 `phase-1-renderer`·`debug/full-middleware` 삭제 가능.

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

## 알려진 이슈 / TODO

- `app/api/generate/route.ts` — **rate limit 없음** (LLM 호출 API가 무방비). P9 예정이지만 공개 홍보 전에 최소한의 IP 제한 필요.
- `app/new/page.tsx` — 업종 추론 저확신 시 되묻기(설계서 4장 3단계) 미구현. 현재는 무조건 진행.
- `config/placeholder-images.ts` — Unsplash 핫링크 의존(시드·폴백 이미지). 링크 소멸 리스크 — 이미지뱅크 채워지면 의존 제거.
- `seeds/*.json` — 쇼케이스 시드 3종의 스토리 사진도 Unsplash 핫링크. 동일 리스크.
- `config/tours.ts` — 투어 스텝 3개가 현 에디터 구조와 불일치 (위 앵커 표 참조).
- 로컬 git 브랜치 `phase-1-renderer`, `debug/full-middleware` — 병합 완료된 잔재. 삭제해도 됨 (full-middleware는 미들웨어 원본 보관용이었으나 경로 방식 전환으로 무의미).
- ~~`next dev`가 이 Windows 환경에서 Ready에 도달하지 않는 현상~~ — 2026-09-01 재시도에서 정상 기동 (Ready 2.8s). 원인은 여전히 미규명이라 재발 시 `npm run build && npm run start` 폴백.
- 테스트 데이터가 프로덕션 DB에 있음: `dbtest`(DB 경로 검증용), `hanbit-test`(생성 E2E). 실사용 전 삭제 or 유지 결정 필요 (`barun-electric`은 쇼케이스로 승격되어 유지).

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
| **Gemini API 결제 인증** (최대 2일 소요 중) | 대기 — 무료 티어는 이미지 모델 일일 쿼터 0 확정 (텍스트는 무료로 동작 중) | "결제됐어" 수신 → `scripts/bank-generate.ts`로 3-pro vs 3.1-flash 벤치 10장 → `/admin/bank` 검수 → 승자 모델로 500장 웨이브 → 검수·승인하면 신규 생성 사이트에 자동 반영 |
| **통신판매업 신고 + 토스페이먼츠 가맹** | 미착수 | P5(결제) 착수 조건. 1개월 무료 종료 시점에 첫 결제가 발생하므로 지금 시작해야 타이밍 맞음 |
| **당근 비즈프로필 개설 + 홍보글 게시** | 보류 (사용자 결정) | `docs/presale.md`의 글 초안·응대 템플릿 사용. 게이트: 사진 수신 5건/2주 → P3 확정, 유료 전환 30% → P5 |
