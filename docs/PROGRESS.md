# PROGRESS.md — 작업 인수인계 (2026-09-01 기준)

> 이 파일만 읽고 작업을 이어받는 사람을 위한 문서. 기준 커밋: `055dde8` (main = origin/main, 클린).
> 프로덕션: https://onstori.com (Vercel 프로젝트 `onstori-pwk2`, 푸시 = 자동 배포).
> 로컬 실행: `npm run build && npm run start` (dev 서버는 이 Windows 환경에서 간헐적으로 안 뜸 — start 사용).
> 비밀키: `.env.local` (git 미포함) — Supabase URL/anon/service, GEMINI_API_KEY, ADMIN_KEY.

---

## P3 (에디터) 진행 상태

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

E2E 검증됨: 운영자 로그인 → `/barun-electric/edit` 수정·발행·사진 3장 업로드·스토리 작성 → 점수 60→75 상승, 라이브 반영 (프로덕션에서 무권한 API 403 확인).

### 진행 중
- 없음 (슬라이스 1 완결 상태에서 멈춤 — 다음 슬라이스 미착수).

### 남은 항목 (다음 슬라이스)

| 항목 | 건드릴 파일 (예상) |
|---|---|
| 갤러리 편집 (사진 다중 업로드·삭제·순서) | `app/[slug]/edit/ui.tsx` `ContentTab`의 switch에 `case "gallery"` 추가 (업로드는 기존 `/api/site/upload` 재사용) |
| 메뉴판(menuPrice) 편집 (항목 추가·삭제·가격) | 같은 파일 `case "menuPrice"` 추가 |
| 후기(reviews)·배너(banner)·portfolioGallery 편집 | 같은 파일 각 case 추가 — `ui.tsx:258`의 `default: return null` 이 현재 미지원 타입을 숨기고 있음 |
| 섹션 추가 (없는 섹션 타입을 doc.sections에 삽입) | `ui.tsx`에 "섹션 추가" 패널 신설 + `lib/schema.ts`의 타입별 기본값 팩토리 함수 신설 권장 (`lib/section-defaults.ts` 등) |
| 섹션 순서 변경 (위/아래 이동, hero 고정) | `ui.tsx` 섹션 카드에 ↑↓ 버튼 → `doc.sections` 배열 재배열 (드래그는 후순위) |
| 섹션 삭제 | 동일 지점, hero·quoteForm 삭제 방지 가드 필요 |
| 앵커 스크롤("＋N점" 클릭→해당 폼으로 이동) | `ui.tsx` 점수 힌트 영역에서 `document.querySelector('[data-tour=...]')`.scrollIntoView — 앵커는 이미 붙어 있음 |

⚠ 섹션 편집을 추가할 때 CLAUDE.md 불변 규칙 2: **zod(`lib/schema.ts`) + 렌더러(`components/sections/index.tsx`) + 에디터 폼(`ui.tsx`) + `docs/SCHEMA.md` 4곳 한 커밋**.

---

## 스키마 정합성 현황

섹션 type 12종 기준 (`lib/schema.ts`의 `Section` discriminatedUnion):

| type | zod (`lib/schema.ts`) | 렌더러 (`components/sections/index.tsx`) | 에디터 폼 (`app/[slug]/edit/ui.tsx`) | SCHEMA.md 필드표 |
|---|---|---|---|---|
| hero | ✅ | ✅ :307 | ✅ :194 | ❌ |
| about | ✅ | ✅ :308 | ✅ :210 | ❌ |
| storyFeed | ✅ | ✅ :309 | ✅ :252 (제목만) | ❌ |
| gallery | ✅ | ✅ :310 | ❌ **없음** | ❌ |
| reviews | ✅ | ✅ :311 | ❌ **없음** | ❌ |
| map | ✅ | ✅ :312 | ✅ :239 | ❌ |
| banner | ✅ | ✅ :313 | ❌ **없음** | ❌ |
| portfolioGallery | ✅ | ✅ :314 | ❌ **없음** | ❌ |
| processSteps | ✅ | ✅ :315 | ✅ :217 | ❌ |
| quoteForm | ✅ | ✅ :316 | ✅ :230 | ❌ |
| hoursCard | ✅ | ✅ :317 | ✅ :246 | ❌ |
| menuPrice | ✅ | ✅ :318 | ❌ **없음** | ❌ |

- **SCHEMA.md 열이 전부 ❌인 이유**: `docs/SCHEMA.md:25`에 "확정 즉시 표를 채운다"고 써놓고 필드 정의 표를 한 번도 채우지 않았음(규칙 위반 상태). 다음 에디터 작업 커밋에서 함께 채울 것.
- 에디터 폼 5종 미지원(gallery/reviews/banner/portfolioGallery/menuPrice)은 `ui.tsx:258 default: return null`로 조용히 숨겨져 있고, `:261`에 "곧 열려요" 안내문이 노출 중.

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
| **preview** | ❌ | 에디터에 미리보기 패널 자체가 없음 (폼 에디터라) — 투어 스텝 수정 or 미리보기 도입 시 부착 |
| **panel-settings** | ❌ | 별도 설정 패널 없음 (섹션 폼에 통합됨) — tours.ts 스텝 재정의 필요 |
| **sec-story-feed** | ❌ | 고객 사이트의 스토리 섹션에 부착 예정이었으나 미부착 (`components/sections/index.tsx` StoryFeedSec) |
| **btn-activate** | ❌ | 활성화(결제) 버튼 자체가 P5 미구현 |
| **panel-brand** | ❌ | 브랜드키트 P6 미구현 |
| **panel-widgets** | ❌ | 연결 위젯 P8 미구현 |

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

- `lib/bank.ts:24` — `bump_bank_used` RPC를 호출하지만 **DB에 함수 미생성**(호출 실패 무시됨). 마이그레이션으로 `create function bump_bank_used(bank_id uuid)` 추가 필요 — 안 하면 used_count가 안 올라 이미지 배분 균등화가 동작 안 함.
- `app/[slug]/edit/ui.tsx:258` — 미지원 섹션 5종이 `default: return null`로 숨겨짐 (위 표 참조).
- `docs/SCHEMA.md:25` — 섹션 필드 정의 표 미작성 (규칙 위반 상태).
- `app/api/generate/route.ts` — **rate limit 없음** (LLM 호출 API가 무방비). P9 예정이지만 공개 홍보 전에 최소한의 IP 제한 필요.
- `app/new/page.tsx` — 업종 추론 저확신 시 되묻기(설계서 4장 3단계) 미구현. 현재는 무조건 진행.
- `config/placeholder-images.ts` — Unsplash 핫링크 의존(시드·폴백 이미지). 링크 소멸 리스크 — 이미지뱅크 채워지면 의존 제거.
- `seeds/*.json` — 쇼케이스 시드 3종의 스토리 사진도 Unsplash 핫링크. 동일 리스크.
- `config/tours.ts` — 투어 스텝 3개가 현 에디터 구조와 불일치 (위 앵커 표 참조).
- 로컬 git 브랜치 `phase-1-renderer`, `debug/full-middleware` — 병합 완료된 잔재. 삭제해도 됨 (full-middleware는 미들웨어 원본 보관용이었으나 경로 방식 전환으로 무의미).
- `next dev`가 이 Windows 환경에서 Ready에 도달하지 않는 현상 (원인 미규명) — `npm run build && npm run start`로 작업 중. dev HMR이 필요하면 조사 필요.
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
