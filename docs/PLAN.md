# onstori.com — 로드맵 & 현재 위치

전체 설계서(최종 기획안 v3.1)는 Claude 아티팩트 "온스토리 구축 설계서"에 있음.
이 파일은 작업 중 참조용 요약. 갱신 규칙: Phase 전환 시 이 파일의 상태를 먼저 바꾼다.

## 제품 한 줄

스토리·실적이 차곡차곡 쌓이는 소상공인 홈페이지({slug}.onstori.com) + 맞춤 제작 히어로 무비(199,000원/수정 3회).

## 핵심 구조

- 3층 모델: 업종(무한) → 카테고리 7(내부 분류) → 템플릿 5(VISIT/BOOK/QUOTE/CONSULT/BROWSE)
- v1 활성 범위: 카테고리 5(시공·출장) 12업종 + 카페·식당 2업종 / 템플릿 QUOTE·VISIT 2종
- 온보딩은 카테고리를 묻지 않음: 키워드 사전 → LLM 분류 → 저확신 시 1회 되묻기 → 에디터 교정
- 게이미피케이션: config/completeness.ts(100점 규칙) + config/tours.ts(투어) + data-tour 앵커 규약
- 요금(초안): 제작비 1회 + 월 구독(플랜 2~3종) + 무비 단건. 결제는 토스 빌링키.

## 빌드 게이트 (중요)

P0~P1은 선검증과 병행. **P2/P3 진입 전 선판매 테스트(인테리어 사장 30콜) 결과 확인** — 결제 의사 0이면 멈추고 포지셔닝 재조정. 선검증 3종: ①2주 선판매 ②컨시어지 MVP 5곳 ③스토리 지속률 4주 측정.

## Phase 체크리스트

- [x] **P0 환경 구축(완료 2026-08-31)**: 도메인 구매·Vercel 연결·와일드카드 / 저장소·스캐폴드 / CLAUDE.md·정책 3파일 / Supabase 프로젝트 / 토스 가맹 신청
- [x] **P1 완료(2026-08-31)** — 스키마 v1(zod)·렌더러 12섹션·시드 3종 라이브·코어 마이그레이션 원격 적용·DB 데이터 소스(시드 폴백)·사이트별 sitemap/robots. dbtest.onstori.com이 DB에서 렌더링됨. (완성도 점수 서버 계산은 소비처인 P3로 이동)
- [~] **P2 진행 중** — 완료: Gemini 파이프라인(분류·카피·조립), /new 무질문 위저드, 랜딩 v0, 슬러그 검사 API, image_bank 테이블·bank 버킷, 프로덕션 생성 E2E(barun-electric.onstori.com) / 남음: 이미지뱅크 실생성(Gemini 결제 대기), 저확신 되묻기 UI. 완료 추가: 어드민(뱅크·사이트·쇼케이스·서브도메인 자리)·랜딩 라이브 포트폴리오(폰 프레임 iframe+탭+어드민 관리)
- [x] **P3 완료(2026-09-01)** — /{slug}/edit 폼 에디터(섹션 12종 편집 + 추가·순서 변경)·스토리 작성(사진 업로드)·draft/발행 분리·완성도 점수 실계산·anonId+운영자 소유권. 이월: 섹션 삭제·앵커 스크롤·투어 최소 동작 (PROGRESS "이월 항목" 참조)
- [ ] P4 계정·세션 — 경로 방식 전환으로 .onstori.com 쿠키 공유는 불필요해짐. 착수 전 PROGRESS "P4 시작 시 알아야 할 것" 필독
- [ ] P5 결제(토스)+플랜 게이팅
- [ ] P6 브랜드키트+히어로 무비 파이프라인 (무료 10건 캠페인)
- [ ] P7 대시보드+통계+SEO 연동+운영자 퍼널
- [ ] P8 위젯·후기·배너·챗봇
- [ ] P9 투어 UI 폴리시·법무·Pro 전환·런칭

## P0 남은 항목

- [x] onstori.com·*.onstori.com → Vercel 프로젝트 onstori-pwk2 연결, 서브도메인 라우팅·www 리다이렉트·직접접근 가드 프로덕션 검증 완료 (2026-08-31)
- [x] GitHub: github.com/nivs-web/onstori (main 푸시됨)
- [x] Supabase 프로젝트 생성 — ref: `wpsrfjqfbhmeriscdacu` (무료 티어)
- [x] .env.local 구성 + Vercel 환경변수(URL·anon key, Production) 등록 완료
- [x] supabase link + db push 완료 (core 마이그레이션 원격 적용)
- [ ] 토스페이먼츠 가맹 신청 — 보류: 통신판매업 신고 후 진행 (P5 전까지만 완료하면 됨)

## 할일 (사장님 담당)

- [ ] Gemini API 결제 연결 (aistudio.google.com → API 키의 프로젝트에 결제 계정) — 이미지뱅크 500장 실생성의 유일한 차단 요소
- [ ] 당근마켓 비즈프로필 개설 → docs/presale.md 홍보글 게시 (보류 중, 추후 진행)
- [ ] 사업자등록·통신판매업 신고·토스 가맹 (1개월 뒤 첫 결제 시점 대비)

## 남은 정리 · 알려진 이슈

- Vercel에 같은 저장소 프로젝트 2개(onstori / onstori-pwk2). 운영은 onstori-pwk2 — 중복 프로젝트 onstori는 삭제 권장(중복 빌드 방지)
- Next는 16.1.6으로 고정 중(진단 과정의 다운그레이드). P1에서 최신 16.x 복귀 검토

- Next 16.2+ 미들웨어를 Vercel이 번들링할 때 `@swc/helpers/esm/*` 누락으로
  MIDDLEWARE_INVOCATION_FAILED 발생(vercel/next.js#93850) → `@swc/helpers`를
  직접 의존성으로 고정해 해결(커밋 31dadd2). Next 업그레이드 시 재발 여부 확인할 것.
