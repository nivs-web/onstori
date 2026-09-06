# TASK — 디자인 v5 남은 화면 (무인 루프)

브랜치 `feat/design-system-v1` · 되돌리기 `git reset --hard design-before-v5`
진행 기록은 [STATUS.md](./STATUS.md). **항목마다 커밋**한다.

## 매 항목 완료 조건 (스스로 검사하고 통과할 때까지 고친다)

- `npm run build` 통과 · lint 신규 경고 0
- `globals.css` 밖에 하드코딩 색·자간·그림자·모서리·전환·애니메이션 0건
- `Noto Serif` 참조 0건
- MOTION.md 금지 목록 0건
- 390·768·1440: 가로 넘침 0 · 터치 48 미만 0(폰만) · 본문 16 미만 0 · 주 버튼 뷰포트당 2개 이상 0
- **모바일 전용 요소가 PC 에 노출 0** (햄버거·하단 고정 바·플로팅·바텀시트)
- **대비**: 본문 4.5:1 · 큰 제목 3:1 (DESIGN.md §2-1)
- SectionGate 살아 있음 · 손님 사이트 탭 3번 안에 견적 제출
- 호버 규칙(카드 300 · 사진 400 · 테두리 제거) 적용

검사 도구 (scratchpad):
- `verify.js <url…>` — 390/768/1440 반응형·터치·넘침·PC 노출
- `contrast.js <url…>` — 대비 실측 (⚠ 지연 로딩 페이지는 오검출 있음, DOM 으로 재확인)

---

## 체크리스트

### 1. 반응형 전수 점검 (A-1 과 같은 실수 찾기)
- [ ] 1-1 `backdrop-filter` 가 `position:fixed` 자식의 기준 상자가 되는 곳 전수 grep — 바텀시트·모달·드롭다운·플로팅
- [ ] 1-2 모바일 전용 요소가 PC 에 나오는 곳 전수 (햄버거·하단바·플로팅·바텀시트·모바일 카드 배치)
- [ ] 1-3 PC 전용 요소가 폰에 나오는 곳

### 2. 남은 화면 토큰 이식 + 반응형
- [ ] 2-1 메뉴 6페이지 (how-it-works · our-story · faq · reviews · blog · compare)
- [ ] 2-2 위저드 `/new`
- [ ] 2-3 녹화 `/rec/[slug]`
- [ ] 2-4 에디터 `/[slug]/edit` (저장됨 토스트 2초 · 빈 문의함 다음 행동 한 줄)
- [ ] 2-5 어드민 전체 (bank · members · dashboard · pages · showcase · sites · subdomains)
- [ ] 2-6 지도·챗봇 섹션
- [ ] 2-7 로그인 · 마이페이지 · 결제 · 법무(terms·privacy)

### 3. 속도
- [ ] 3-1 First Load JS 231KB 항목별 분해 — 무엇이 큰지 적는다
- [ ] 3-2 지도·챗봇·PayModal·토스 SDK `next/dynamic`
- [ ] 3-3 히어로 preload·AVIF·sizes 재확인
- [ ] 3-4 목표(LCP·170KB) 달성 여부 + 못 넘으면 이유와 남은 수단

### 4. 마무리
- [ ] 4-1 화면마다 390·768·1440 캡처
- [ ] 4-2 Lighthouse 최종 + First Load JS
- [ ] 4-3 PROGRESS.md 인수인계 · 커밋 · push

**글꼴 451KB 는 한글 커버리지 실제 값 — 더 줄이지 않는다 (회장님 확정).**
