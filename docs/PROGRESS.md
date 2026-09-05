# PROGRESS.md — 작업 인수인계 (2026-09-01 기준)

> 이 파일만 읽고 작업을 이어받는 사람을 위한 문서.
> 브랜치: **`main`** (`phase-4-auth`를 fast-forward 머지 후 푸시 완료). 프로덕션: https://onstori.com (Vercel `onstori-pwk2`, 푸시 = 자동 배포).
> 로컬 실행: `npm run dev` (안 뜨면 `npm run build && npm run start` 폴백).
> 비밀키: `.env.local` (git 미포함) — Supabase URL/anon/service, ADMIN_KEY, **`KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET`**(카카오 OIDC 직결). **`GOOGLE_SERVICE_ACCOUNT_JSON`은 로컬에 두지 않는다** — 로컬 Vertex 인증은 ADC(아래 Vertex 절), 장기 키는 Vercel Production에만 존재한다.

## 배포 상태 — ✅ 2026-09-01 배포 완료

`origin/main` = **`4276bbb`**. 오늘 작업이 전부 프로덕션에 반영됐다 — 오전 23커밋(이미지뱅크·Vertex 이관·성능) + 오후 10커밋(P4 인증 마무리) + **밤 2커밋**(서비스 계정 키 교체 `f99ec35` · P4 E2E 기록 `4276bbb`).

오후 10커밋 요약: 카카오 OIDC 직결 전환(`61c7666`) → 프로덕션 E2E 통과 → 마이페이지·로그아웃(`cdc5ef9`) → 에디터 로그인 유도 배너 + `ownership` 필드(`9410470`) → 거부 화면 루프 수정(`5138c4a`). **Vercel 환경변수에 `KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET` 추가됨**(Production). 환경변수는 배포 시점에 주입되므로 값만 저장하고 재배포하지 않으면 반영되지 않는다 — 오늘 실제로 걸렸다.

밤 2커밋 요약: 로그 노출된 서비스 계정 키 **교체·구 키 영구 삭제**(`f99ec35`) → P4 남은 로그인 E2E 3종 **프로덕션 통과**(`4276bbb`). 이로써 **P4 종료** — 마지막까지 남았던 운영자 인증 교체는 P7로 이월(2026-09-01 사용자 결정).

- 프로덕션 검증: `/login` 200(신규 경로) · **사이트 생성 200 / 7.67초** (이관 전 20.9초). Vercel이 서비스 계정으로 Vertex를 호출하는 경로가 실제로 도는 것을 확인.
- Vercel 환경변수: `GOOGLE_CLOUD_PROJECT`(Config) + `GOOGLE_SERVICE_ACCOUNT_JSON`(Secret), 둘 다 Production. 현재 값은 **2026-09-01 교체한 새 키 `520195620d…`** (구 키 `a29494b9…`는 삭제됨).
- `GEMINI_API_KEY`는 **지우지 말 것** — 이제 코드가 안 읽지만, 문제 발생 시 이전 배포로 롤백하면 구 코드가 이 키를 쓴다.
- 롤백: Vercel 대시보드에서 이전 배포로 되돌리거나 `git reset --hard f2d5a91` 후 강제 푸시. ⚠ **되돌린 뒤 반드시 Redeploy** — 환경변수는 배포 시점에 주입되므로 오늘 이전 배포는 **삭제된 구 서비스 계정 키**를 들고 있어 그대로 두면 Vertex 호출이 전부 실패한다.

---

## 오늘(2026-09-01) 한 일 요약

| 영역 | 결과 |
|---|---|
| 이미지뱅크 관리 4종 | 일괄승인 · 자유태그(+매칭 가중치) · "사용 중" 배지 · 히어로 재고 경고 |
| AI 접근 경로 | Gemini API → **Vertex AI(ADC)** 이관 완료, 실호출 검증 통과 |
| 이미지 모델 확정 | **히어로=`gemini-3-pro-image`, 그 외=`gemini-3.1-flash-image`** (동일 프롬프트 실측 근거) |
| 히어로 웨이브 | **100장 등록**(실패·중복 0, $13.40) → **39장 일괄 승인 완료** |
| P4 인증 | 이메일 OTP **E2E 통과** · 카카오는 KOE205로 막혀 **OIDC 직결로 전환** → **카카오 로그인 E2E 통과** |
| 버그 수정 4건 | OTP 자릿수 · `/new` JSON 파싱 · 429 조합 건너뛰기 · bench top-level await |
| 성능 | 생성 20.9초 → 로컬 평균 5.8초 · **프로덕션 실측 7.67초** (thinking 토큰 병목 제거) |
| 배포 | ✅ `main` 푸시 완료, 프로덕션 생성 E2E 통과 |
| 서비스 계정 키 | 로그 노출 → **교체·구 키 삭제 완료**. 로컬은 ADC로 전환(`.env.local`에서 제거) |
| P4 로그인 E2E | 남은 3종(소유권 차단·다른 기기 귀속·anon claim) **프로덕션 통과** + 403 두 갈래 실화면 |
| **P4 종료** | 코드 작업 6건 중 4건 완료·2건(운영자 인증 교체·운영자 로그아웃) **P7 이월**. 다음은 P5 |

---

## 오늘(2026-09-03) 한 일 요약

| 영역 | 결과 |
|---|---|
| 아침 점검 | `rate_limits` 마이그레이션 프로덕션 적용 확인(`migration list --linked` + RPC 실호출 200/`true`) · WIF 감사 로그 1회 조회(① 이후 유기적 성공 2건 추가·실패 0, 표본은 아직 하루 미만) · **DB 백업 실패** — 작업 머신에 Docker·`pg_dump` 모두 없어 `supabase db dump --linked` 불가(P1 이후 `backups/`가 비어 있음, 미해결) |
| 표시광고법 — 발행 사이트 3곳 문구 수정 | whitedobae·mong-filates·testtesttest의 진행 과정 카피에 있던 근거 없는 경력 표현("오랜 노하우를 바탕으로"·"숙련된 전문가들이"·"숙련된 기술로") 제거. draft+published 동시 반영, 이전 published는 `site_versions`에 스냅샷. 프로덕션 `curl`로 반영 실측 확인 |
| 표시광고법 — 생성 파이프라인 재발 방지 | 카피 프롬프트의 날조 금지 규칙을 숫자 없는 경력·숙련도 암시 표현까지 확대 · `geminiJson`이 사용 모델을 함께 반환하도록 해 `inferred.copyModel`로 향후 생성물의 폴백 여부 식별 가능(`lib/generate.ts`, `lib/gemini.ts`) — 아래 "표시광고법 리스크" 항목 참조 |
| 쇼케이스 정리 | 랜딩 포트폴리오에서 니브인테리어·클린하우스·카페크로프트(가짜 경력·후기·시공사례가 담긴 데모 시드) 3건 제외, 테스트 사이트 goodmoksu·whitedobae 2건만 유지. `showcase` 테이블 행만 삭제, `seeds/*.json` 콘텐츠 파일은 보존(재등록 가능). 랜딩 실측 확인 |
| 커밋 | `51b9d1f`·`761924a`(CLAUDE.md 현황질문 규칙)·`70c1dc4`, 전부 push 완료 |

---

## 오늘(2026-09-05) 한 일 요약

`origin/main` = **`536b54f`**. 세 브랜치를 병합·푸시했고 자동 배포 3회 전부 Ready.

| 영역 | 결과 |
|---|---|
| 프로덕션 재검증(배포 7단계) | 발행 5곳(goodmoksu·whitedobae·barun-electric·mong-filates·testtesttest) 정상 렌더 · 콘솔 에러 0 · 5xx 0 · 깨진 이미지 0. 첫 페이지·온보딩 STEP 1~4·만료 차단 화면 확인(STEP 5는 실사이트가 생겨 미실행). **만료 상태에서도 문의함이 열린다** — 차단 화면의 [받아둔 문의 보기]와 `?tab=inbox` 콜드 로드 둘 다 통과 |
| interior2 만료 테스트·원복 | `trial_ends_at`을 잠시 과거로 돌려 차단 화면을 확인하고 **원복 완료**. 24개 컬럼 전량 diff 결과 트리거가 만지는 `updated_at` 외 차이 없음. 검증 중 생성된 사이트·문의 0건 |
| ~~⚠ 만료 규칙의 구멍(미해결)~~ → **2026-09-06 해결** | 만료 판정은 날짜 기반이라 에디터는 즉시 잠기는데, 공개 차단은 크론이 `status='expired'`로 바꿔야 RLS가 끊는다. **`CRON_SECRET` 미등록으로 크론이 401이라 만료돼도 손님에게는 사이트가 그대로 보인다** — 차단 화면의 "지금 비공개 상태입니다" 문구가 현재는 사실이 아니다. 크론이 돌아도 최대 24시간 시차는 남는 구조 |
| 온보딩 플레이스 불러오기 복구 | 버튼이 늘 0건이던 원인은 키가 아니라 **주소**였다. 검색 API는 2026-07-30 개발자센터 신규 신청이 닫히고 **NAVER API HUB**(네이버클라우드)로 이관 — 구 `openapi.naver.com`은 유예 사용자 전용이라 HUB 키로 부르면 401(errorCode 024)이고 라우트가 `if (!r.ok) return []`로 삼켜 조용히 빈 목록이 됐다. 엔드포인트·헤더 2줄만 전환(응답 스키마는 구·신 동일 → 파싱 무수정). 프로덕션 실측 5건 수신 |
| 카카오 로컬 채널(이월) | `KAKAO_REST_API_KEY`로 로컬 API를 부르면 `403 NotAuthorizedError — App(Onstori) disabled OPEN_MAP_AND_LOCAL service`. 로그인 스코프와 **별개 설정**이라 로그인이 멀쩡해도 이것만 막힌다. 켜는 것은 대시보드 작업이라 사장님께 이월(DECISIONS 기록, 확인법 포함) |
| 전화번호 판정 단일화 | 기준이 네 지점에서 제각각이었고 서버(`z.string().min(9)`)가 **글자 수**만 봐서 클라이언트보다 약했다. `lib/phone.ts` 신설(숫자 9자리) — 온보딩·생성 서버·렌더러·완성도가 같은 기준을 쓴다. 온보딩 전화번호 필수화 + 연초록 안내 박스, 죽은 `tel:` 링크 제거. **부작용: 번호가 안내 문구인 사이트는 contact 10점이 빠진다** — 현재 해당 사이트 0곳이라 실피해는 없다 |
| 권한 규칙 정리 | vercel 명령을 `allow`로 옮기고, 되돌리기 어려운 `vercel rm`·`vercel env rm`만 `ask`로 남김 |
| 환경변수 | Vercel Production에 **`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET` 등록됨**(NAVER API HUB = NCP 키, ID 10자·Secret 40자 형식). 여전히 미등록: `TOSS_*`(결제 모달 "준비 중"). ~~`CRON_SECRET`~~ 은 2026-09-06 등록됨 |
| 커밋 | `24ee261`·`de9c85e`(전화번호) · `8bfd614`·`1382467`(플레이스) · `7c4d804`·`1dca6fe`·`1ecada4`(권한), 병합 3건 `ed876ae`·`936e65c`·`536b54f` |

---

## 오늘(2026-09-06) 한 일 요약

`origin/main` = **`a10c499`** 기준. 코드 변경 없음 — 환경변수 1개 등록과 그 검증.

| 영역 | 결과 |
|---|---|
| `CRON_SECRET` 등록 | 64자(48바이트 엔트로피) 생성 → `.env.local` + **Vercel Production** 등록 → Redeploy(`jv1g6jzex`). 값은 파일에서 곧장 파이프로 넘겨 명령줄·로그·대화 어디에도 남기지 않았다 |
| 크론 인증 게이트 | 무인증 401 · 틀린 시크릿 401 · 올바른 시크릿 `200 {"nudged":0,"expired":0}` |
| **만료 → 공개 차단 실증** | 테스트 사이트 `interior2` 로 체인 전체 확인: `trial_ends_at` 과거 → 크론 `{"expired":1}` → DB `status='expired'` → **공개 `/interior2` 가 200 → 404** → 에디터 `/interior2/edit` 는 200 유지(사장님은 차단 화면·문의함을 봐야 하므로 정상). 끝난 뒤 `status`·`trial_ends_at` 둘 다 원복, 다른 8개 사이트 status 무변경 확인 |
| 차단 원리 | `lib/sites.ts` 가 **anon 클라이언트**로 읽고 RLS `sites_public_read` 가 `status in ('trial','active')` 만 허용한다 — 서비스 롤 우회가 아니라 정상 경로로 막힌다 |
| ⚠ 남은 구멍 | **`seeds/*.json` 에 같은 slug 가 있으면 만료로 못 막는다**(DB가 안 줘도 파일 폴백으로 렌더). 현재 해당: cafecroft·cleanhaus·niv 3종. 실고객 사이트는 해당 없음 |
| ⚠ 이제부터 실제로 나가는 것 | 크론이 매일 03:00 KST(`vercel.json` `0 18 * * *`)에 돌면서 **D-3·D-1 안내 문자를 솔라피로 실제 발송**한다. 문구는 `app/api/cron/expire/route.ts` 의 `nudgeText`. 실측 렌더 결과 **155바이트 안팎으로 전부 LMS(장문)** 구간이라 단문 대비 요금이 3배가량이다 — 문구를 90바이트 이하로 줄이면 SMS 로 떨어진다. 현재 9개 사이트 전부 `settings.phone` 이 있어 발송 대상이다 |

---

## 다음 세션 시작점 (2026-09-03 기준)

P5 진입 조건이 2026-09-03 바뀌었다 — 선판매 게이트 대신 **문의 접수(DB+알림)·에디터 라이브 미리보기·플로팅 연결 위젯** 3개를 프로덕션에서 동작시키고 실제 사장님에게 시연한 뒤 P5(결제)에 들어간다. 근거·상세: `docs/specs/2026-09-03-sprint-plan.md`(PLAN.md "P5 진입 조건" 절도 참조). 한 세션 = 한 작업, 단일 터미널 순차 진행(worktree 병렬 없음).

| 순서 | 작업 | 스펙 |
|---|---|---|
| ① | 이미지 저장소 R2-1 — 저장 계층 추상화(`lib/storage.ts`) + 신규 업로드 전부 R2 | `docs/specs/storage-r2.md` 3장 |
| ② | 견적 접수 백엔드 G1 — 테이블·API 3종·알림 모듈 | `docs/specs/inquiry.md` 2~4장 |
| ③ | 마이그레이션 적용 — 사람이 main에서 `supabase db push` | — |
| ④ | 견적 접수 화면 G2 — 손님 폼·에디터 문의함 탭·알림 설정 | `docs/specs/inquiry.md` 5장 |
| ⑤ | 프로덕션 확인 — 폰에서 실접수 1건 | — |
| ⑥ | 에디터 라이브 미리보기 | `docs/specs/editor-v2.md`(작성 예정) |
| ⑦ | 플로팅 연결 위젯 — `SiteDoc.widgets[]`(스키마 변경, ultracode) | `docs/specs/editor-v2.md`(작성 예정) |
| ⑧ | R2-2 — 기존 뱅크 638장·업로드 사진 백필 | `docs/specs/storage-r2.md` 4장 |
| ⑨ | 실사용자 시연 → P5(결제) 착수 | — |

커밋·push·`supabase db push`는 사람이 한다. 완료 조건을 통과하면 커밋 메시지 초안을 보여주고 멈춘다.

④ G2 완료(2026-09-04, `feat/g2-inbox`) — 에디터 문의함 탭(`app/[slug]/edit/inbox-tab.tsx`) + quoteForm 카드 안 알림 설정. 로컬 실검증: 사진 2장 접수 → 배지 1 → `?tab=inbox` 진입 → R2 private signed URL 사진 표시 → 연락함 전환 → 배지 0 → 메모 저장. 솔라피·Resend 키가 없는 환경에서도 문의함은 정상 동작하고 알림 카드는 "준비 중"으로 표시된다. 남은 것은 ⑤ 프로덕션 실접수.

⑤ 프로덕션 확인 완료(2026-09-04) — **P5 진입 조건 1 달성.** 실접수 1건이 접수 200 → R2 private 저장 → inquiries 1행 → 문자 발송(솔라피 statusCode 4000) → 사장님 폰 도착 → 문의함 배지 1·signed URL 사진까지 전 구간 통과. 알림 키 4개를 Vercel Production 에 등록·재배포했다(env 는 재배포해야 함수에 반영). 이 과정에서 알림이 프로덕션에서 한 번도 동작한 적 없었음이 드러나 둘을 고쳤다 — (1) `void notifyInquiry(...)` 가 서버리스 응답 반환 시 함께 사라지던 문제를 `after()` 로 수정(`7bd5b80`), (2) 솔라피 API 키의 허용 IP 제한을 0.0.0.0/0 으로 해제(Vercel 송출 IP 가 매번 바뀌어 개별 등록으로는 못 푼다 — 다시 좁히면 문자가 조용히 끊긴다). 교훈: `notify_last_error` 가 비어 있다고 성공이 아니다, 코드가 아예 안 돌았을 수 있다.

### 병행·대기 (사장님 결정 대기 — 위 순서와 별개로 진행)

| 항목 | 성격 | 막고 있는 것 |
|---|---|---|
| **통신판매업 신고 → 토스페이먼츠 가맹** | 사장님 | **P5 전체.** 1개월 무료 종료 시점에 첫 결제가 발생하므로 지금 시작해야 타이밍이 맞는다 |
| **v1 범위 밖 업종 처리 방침 결정** (되묻기 / 차단 / 범용 수용) | 사장님 | P2 잔여 + 당근 홍보. 불특정 업종이 들어오면 바로 드러난다 |
| **WIF 마무리 ②③**(구 키 삭제 · 정책 예외 해제) | 코드 | 없음. ①(Vercel env 제거)만 완료한 채 며칠 관찰 후 진행하기로 함(DECISIONS 2026-09-02) |
| **`*.onstori.com` 와일드카드 DNS 누락** | 인프라 | 없음. Cloudflare 이전 후 레코드가 없어진 것으로 보임(권위 NS 조회에서 임의 서브도메인·기존 슬러그 모두 NXDOMAIN) — 옛 서브도메인 링크(명함·카톡 프로필 등)가 뿌려져 있으면 깨져 있을 수 있다. `next.config.ts`의 서브도메인→경로 301 이 DNS 단계에서 죽는다. **별도 확인 필요, R2-1과 무관** (2026-09-03 R2-1 작업 중 발견) |

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

## P4 (계정·세션) — ✅ 완료 (2026-09-01 착수·종료, `phase-4-auth` → `main`)

방식 확정: **카카오 OAuth + 이메일 6자리 OTP**. 아키텍처는 service-role + 서버 세션 검증 유지(RLS는 심층 방어), 미들웨어 재도입 없음 — 결정 이유 3건은 DECISIONS 2026-09-01 참조. 스키마 변경 없음(`sites.owner_id`·owner RLS는 core 마이그레이션에 이미 존재).

### 완료 (코드)

| 무엇 | 어디 |
|---|---|
| `@supabase/ssr` 세션 클라이언트 — 서버(쿠키 갱신 포함, Route Handler 전용 갱신)·브라우저(로그인 UI 전용) | `lib/supabase/server.ts`, `lib/supabase/browser.ts` |
| 로그인 페이지: 카카오 버튼 + 이메일 OTP 2단계(주소 → 6자리 코드). 성공 시 claim 후 `?next=`로 이동 | `app/login/page.tsx`, `app/login/ui.tsx` |
| **카카오 OIDC 직결** — Supabase 프로바이더 우회(account_email 하드코딩 → KOE205). authorize URL 직접 생성 + code→id_token 교환 | `lib/kakao.ts`, `app/auth/kakao/route.ts` |
| 카카오 콜백 (state 검증 → id_token → `signInWithIdToken` → `/login` 복귀, claim은 로그인 페이지가 마무리) | `app/auth/callback/route.ts` |
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
| **카카오** 개발자 앱 + Supabase 프로바이더 | ✅ 완료 (2026-09-01 실측: authorize 302 정상, Client ID 실림) |
| **카카오** OpenID Connect 활성화 + Redirect URI(`/auth/callback`) + 닉네임 동의항목 | ✅ 완료 |
| **카카오** 환경변수 `KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET` (`.env.local` + Vercel Production) | ✅ 완료 |
| **카카오 로그인 E2E** | ✅ 통과 (2026-09-01 로컬 실로그인) |

⚠ **템플릿은 반드시 2종을 모두 고쳐야 한다** — 오늘 실제로 이걸로 막혔다.

메일 종류를 가르는 건 코드가 아니라 **템플릿 내용**이다: `{{ .ConfirmationURL }}`이 있으면 링크가, `{{ .Token }}`이 있으면 인증번호가 나간다. 그리고 Supabase는 상황에 따라 다른 템플릿을 쓴다.

| 상황 | 템플릿 |
|---|---|
| **처음 보는 이메일** (신규 가입 — `shouldCreateUser: true`) | **Confirm sign up** |
| 이미 가입된 이메일 | **Magic Link** |

초기에는 전원이 신규라 사실상 **Confirm sign up만 탄다.** 처음에 Magic Link만 고쳐서 "Confirm your email address" 링크 메일이 갔고, 앱은 인증번호를 기다리니 로그인이 불가능했다. 참고: `verifyOtp`의 `type`은 신규·기존 모두 `'email'`이 맞다(가입 여부로 바꿀 필요 없음).

### 카카오 로그인 — OIDC 직결로 전환 (2026-09-01)

카카오 버튼이 KOE205(설정하지 않은 동의항목)로 막혔다. 원인은 **Supabase 카카오 프로바이더가 scope에 `account_email`을 하드코딩**해두고 요청 scope를 덧붙이기만 하는 것 — 실측으로 확인했고(`scopes=profile_nickname` → `account_email profile_image profile_nickname profile_nickname`) 빼는 방법이 없다. 이메일 동의항목은 비즈 앱 전환 없이는 못 켠다.

그래서 카카오 authorize를 **직접** 열고(`openid profile_nickname`만 요청) 받은 code를 카카오에서 id_token으로 바꿔 `signInWithIdToken({ provider: 'kakao' })`로 세션을 만든다. 흐름: `/login` → `/auth/kakao`(state 쿠키 발급) → 카카오 동의 → `/auth/callback`(state 검증 → 토큰 교환 → 세션) → `/login`(claim → next).

**Supabase 카카오 프로바이더는 계속 켜둬야 한다** — id_token의 `aud`를 프로바이더 Client ID와 대조한다.

**E2E 통과 (2026-09-01) — 로컬·프로덕션 모두.**

프로덕션(onstori.com) 실로그인: 도착지 `/`(error 없음) · `last_sign_in_at` 갱신 · `iss=kauth.kakao.com` · 중복 계정 없음 · `/login?next=/{slug}/edit` → 에디터 진입 성공. 이 성공 한 번이 Redirect URI 등록·`KAKAO_CLIENT_SECRET` 주입·OIDC 활성화 3가지를 동시에 증명한다(각각 실패하면 KOE006 / KOE010 / scope 거부).

재확인(2026-09-01 07:50Z, 카카오 콘솔에 `https://onstori.com/auth/callback` 저장 확정 후): `/login?next=%2Fmy` → 카카오 → 동의 재요청 없이 `/my` 착지 · `sb-*` 쿠키 2개 · `last_sign_in_at` 갱신 · `iss=kauth.kakao.com` · 사용자 3명 그대로(중복 없음). **프로덕션 Redirect URI 등록이 실증됐다** — 미등록이면 콜백에서 KOE006으로 끊긴다. 참고: 카카오는 redirect_uri·scope 오류를 로그인 화면 *다음*에 내므로 등록 여부는 프로브가 아니라 실로그인으로만 확인된다.

배포 중 겪은 것: 푸시 직후 프로덕션 `/auth/kakao`가 `?error=auth`로 되돌아왔다 — **Vercel 환경변수는 배포 시점에 주입**되므로 변수만 저장하고 재배포하지 않으면 반영되지 않는다. Redeploy 후 해결.

로컬 실로그인 상세:

| 확인 | 결과 |
|---|---|
| `/auth/callback?code=…&state=…` | 307 정상, `[kakao]` 실패 로그 없음 |
| `POST /api/auth/claim` | 200 |
| `iss` 클레임 | `kauth.kakao.com` — OIDC 경로로 들어온 증거(구 프로바이더 경로는 `kapi.kakao.com`) |
| 중복 계정 | 안 생김. 같은 `sub`이라 기존 사용자에 연결, `last_sign_in`만 갱신 |
| claim | 익명 사이트 4건에 `owner_id` 부여 + `anon_id` 소거 |
| 소유 게이트 | 로그인 세션으로 `/{slug}/edit` 정상 진입 |

그 전 단계 검증: `npm run build` 통과 · `/auth/kakao` → `scope=openid+profile_nickname`으로 302(이메일 빠진 것 확인) · state 불일치·토큰 교환 실패 시 `/login?error=auth` 복귀.

**함정 하나 기록:** 카카오 콘솔 설정 후 구경로(프로덕션)로 로그인하면 이메일까지 받아지며 성공한다 — 하지만 카카오는 **앱이 개발 중이거나 동의항목이 검수 전이면 관리자·팀원만** 통과시킨다. 관리자 계정의 성공은 고객의 성공을 뜻하지 않는다. OIDC 경로는 검수가 필요 없는 `openid`+닉네임만 쓰므로 이 문제에서 자유롭다 — 구경로로 되돌리지 말 것.

**남은 부작용:** 관리자 계정은 구경로로 먼저 로그인한 이력이 있어 `user_metadata`에 이메일이 남아 있다(metadata는 병합됨). 신규 고객은 이메일 없이 생성되므로 계정 식별·복구 수단이 카카오뿐이다 — 마이페이지 이메일 선택 입력은 P4 이후 검토.

### 마이페이지 · 로그아웃 — 완료 (2026-09-01)

| 무엇 | 어디 |
|---|---|
| 랜딩 헤더 우측: 로그인 시 "마이페이지", 비로그인 시 "로그인"(→ `/login?next=/my`) | `app/page.tsx` (서버 컴포넌트라 `getSessionUser()`로 바로 분기) |
| `/my` — 세션 없으면 `/login?next=/my` 리다이렉트, 있으면 `owner_id`로 내 사이트 목록 + 사이트 보기/수정하기 링크 | `app/my/page.tsx` |
| 로그아웃 버튼 | `app/my/ui.tsx` |

**로그아웃에 API 라우트를 만들지 않았다.** `@supabase/ssr`는 세션 쿠키를 httpOnly 없이 심으므로(`DEFAULT_COOKIE_OPTIONS.httpOnly === false` — 브라우저 클라이언트가 읽어야 하니까) `sbBrowser().auth.signOut()`으로 지워진다. 이후 `router.refresh()`로 헤더(서버 컴포넌트)를 다시 그린다.

E2E 검증(로컬 실동작): 비로그인 헤더=로그인 버튼 → `/login?next=%2Fmy` → 로그인 후 `/my` 착지 → 소유 사이트 4건 목록·편집 링크 정상 → 헤더가 "마이페이지"로 전환 → 로그아웃 시 `/`로 이동 + `sb-*` 쿠키 삭제 + 헤더 복귀 → 비로그인 `/my` 직접 접근은 서버에서 리다이렉트. 사이트 0건 빈 상태는 코드에만 있고 미확인(테스트 계정이 4건 보유).

프로덕션 검증(2026-09-01 배포 후): 비로그인 `/my` → `307 /login?next=%2Fmy` · 비로그인 홈 헤더에 로그인 버튼 · 카카오 로그인 → `/my` 목록 4건 · 홈 헤더가 `link "마이페이지" href="/my"`로 전환. 관찰(미해결): 프로덕션 `/login`에서 콘솔에 `403`이 한 번 찍혔다 — 네트워크 기록에서 요청을 특정하지 못했고 페이지·로그인은 정상 동작. 세션 없는 상태의 Supabase 사용자 조회로 추정하나 확인 못 함. 반복되면 그때 확인할 것.

### 에디터 로그인 유도 배너 — 완료 (2026-09-01)

익명(anonId)으로만 편집 중인 사장님을 계정으로 끌어오는 유입구. 이전에는 `/login`·`/my`를 스스로 찾아가야만 귀속됐다.

| 무엇 | 어디 |
|---|---|
| 응답에 **서버 판정 소유 상태** `ownership: "admin" \| "account" \| "anon" \| "anon-signedin"` 추가 | `app/api/site/get/route.ts` |
| sticky 헤더 아래 배너 — `anon`/`anon-signedin`에만 노출 | `app/[slug]/edit/ui.tsx` |

**판정 근거:** `owner_id`가 null인데 `loadOwnedSite`를 통과했다면 anonId 폴백 말고는 경로가 없다 → 그때만 세션을 1회 조회해 `anon`(비로그인)과 `anon-signedin`(로그인했지만 claim 전)을 가른다. `lib/site-owner.ts`는 무수정 — 고쳤다면 update·publish·story·upload 4개 라우트의 익명 저장 경로마다 Auth 왕복이 1회씩 붙는다.

**문구가 상황과 어긋나지 않게:** `anon`은 "지금은 이 기기에서만 수정할 수 있어요" + [로그인하기], `anon-signedin`은 "아직 계정에 연결되지 않았어요" + [내 계정에 연결하기](기존 `/api/auth/claim` 호출, 로그인 왕복 없음). 이미 로그인한 사람에게 로그인하라고 하지 않는다.

**data-tour는 붙이지 않았다** — 투어 앵커 목록에 없는 식별자를 새로 짓는 건 규칙 3 위반이고, claim되면 영구히 사라지는 조건부 요소라 "앵커가 사라지지 않게 한다"는 규칙 3 후단과도 충돌한다.

**검증에서 잡아 고친 것 4건** (에이전트 7개 워크플로 — 정찰 3 → 구현 1 → 적대적 검증 3):

| 심각도 | 문제 | 조치 |
|---|---|---|
| **major** | 배너 [로그인하기]가 `<a>` 전체 이동이라 **저장 안 한 편집분이 소실**됐다. "다른 기기에서도 이어서 고치세요"라는 배너가 그 수정본을 날리는 모양 | `publish()`와 같은 `if (dirty && !(await save())) return;` 가드 후 `router.push` |
| minor | claim 401(세션 만료·다른 탭 로그아웃)에 "잠시 후 다시 시도" — 재시도로는 안 풀리는 막다른 길 | 401이면 `ownership`을 `anon`으로 되돌려 배너가 로그인 유도로 바뀌게 |
| minor | 문구는 "이 홈페이지" 단수인데 claim은 **브라우저 anonId 단위**라 무주인 사이트가 전부 귀속됨 | 응답의 `claimed[]` 길이가 2 이상이면 "홈페이지 N개를 연결했어요"로 |
| minor | 익명 편집 경로가 Supabase anon 환경변수에 새로 의존 — 변수 누락 시 정당한 주인에게 "권한 없음" 오진 | `getSessionUser().catch(() => null)` |

검증(로컬): `npm run build` 통과 · lint 4건(error 2, warning 2)으로 **기준선과 동일** · 운영자 쿠키로 `/api/site/get` → `ownership: "admin"` · 엉뚱한 anonId → 403.
**브라우저 E2E — ✅ 통과 (2026-09-01).** 익명으로 `banner-test` 사이트를 만들어 4상태를 전부 실화면으로 확인하고 사이트는 삭제했다.

| 상태 | 화면 | 결과 |
|---|---|---|
| `anon` (비로그인·anonId 일치) | "지금은 이 기기에서만 수정할 수 있어요" + [로그인하기] | ✅ |
| `anon-signedin` (로그인·미claim) | "이 홈페이지가 아직 계정에 연결되지 않았어요" + [내 계정에 연결하기] | ✅ |
| 연결 버튼 클릭 | 배너 소멸 + DB에 `owner_id` 부여·`anon_id` 소거 | ✅ |
| `admin` (운영자 쿠키) | 배너 미노출 | ✅ |

**이 검증에서 배운 함정 2개:**

1. **브라우저에 남은 운영자 쿠키가 소유 판정을 통째로 가린다.** 처음에 배너가 안 떠서 버그인 줄 알았는데, 작업용 브라우저에 예전 `onstori_admin` 쿠키가 남아 `ownership: "admin"`이 나오고 있었다(즉 admin 분기는 정상 동작). 앞으로 소유 관련 검증을 할 땐 **운영자 쿠키부터 확인**할 것.
2. **그 쿠키는 httpOnly라 JS로 못 지우고, 앱에 운영자 로그아웃이 없다.** 이번엔 ①쿠키가 없는 `127.0.0.1:3000`으로 접속(쿠키는 호스트 단위) ②`.env.local`의 `ADMIN_KEY` 줄을 잠시 주석 처리(값은 그대로, `#`만 붙였다 뗌)로 우회했다. 아래 남은 작업 6번 참조.

### 남은 로그인 E2E — ✅ 통과 (2026-09-01, 프로덕션)

auth-setup 5절의 미확인 3건을 **onstori.com 실서비스**에서 확인했다. 테스트 계정 1개·테스트 사이트 2개를 만들고 **전부 삭제**했다(사이트 6건·계정 4명으로 원복 확인).

**환경**: 운영자 쿠키가 없는 별도 브라우저. 작업용 브라우저의 `onstori_admin`이 소유 판정을 통째로 admin으로 덮는 문제(아래 6번)를 쿠키가 분리된 브라우저로 우회했다 — 로그아웃 라우트를 만들지 않고도 검증이 가능하다.
**로그인 수단**: 메일함 없이 Supabase Admin `generate_link`로 OTP를 받아 실제 `/login` 화면에 입력했다. 메일 *발송*은 이미 위에서 통과했고 여기서 검증할 대상은 소유권 로직이라 배달 여부에 의존하지 않는다. 발송 단계(`signInWithOtp`)는 실제로 태웠다.

| 시나리오 | 방법 | 결과 |
|---|---|---|
| **소유권 차단** | 로그인 상태로 남의 사이트 3종 접근 | 전부 `403 {"error":"forbidden","signedIn":true}` ✅ |
| **다른 기기 owner_id 귀속** | 로그인 생성 → 로그아웃 → 재로그인 + **새 anonId** → 편집 | `200 ownership:"account"` · 에디터 정상 렌더 ✅ |
| **anon claim** | 로그아웃 생성 → 같은 브라우저 로그인 | `owner_id` 부여 + `anon_id` 소거 ✅ |

**차단은 세 갈래를 모두 탔다** — `loadOwnedSite`의 거부 분기가 전부 덮였다:

| 대상 | 조건 | 타는 분기 |
|---|---|---|
| `toktak` | 다른 계정이 `owner_id` 보유 | `user?.id === site.owner_id` 불일치 |
| `barun-electric` | `owner_id`·`anon_id` 둘 다 null | anon 폴백에서 `site.anon_id`가 없음 |
| `whitedobae` | 다른 anonId의 익명 사이트 | anonId 불일치 |

**귀속이 계정 때문임을 분리 증명했다**: 사이트 생성 시 anonId(`109716a1…`)와 접근 시 anonId(`b1f0ad3d…`)를 다르게 하고 세션도 로그아웃→재로그인으로 새로 만든 뒤 200이 났다. `anon_id`가 null이라 폴백 경로 자체가 없으므로 통과 근거는 `owner_id`뿐이다. 로그아웃하면 같은 사이트가 `403 signedIn:false`로 막히는 것도 확인(음성 대조).

**claim 범위 확인**: claim 후 `anon_id`가 null로 소거돼 재claim이 막히고, **다른 anonId의 익명 사이트 `whitedobae`는 영향받지 않았다**(쿼리가 `.eq("anon_id", …).is("owner_id", null)`로 좁혀져 있음).

**부수 확인**: `/my` 목록·로그아웃(쿠키 삭제·헤더 복귀)·로그인 상태 생성 시 `owner_id` 직접 저장(`anon_id` null)도 같은 흐름에서 확인됐다.

### P4 코드 작업 — 전부 종결 (4건 완료 · 2건 P7 이월)

1. ~~남은 로그인 E2E 시나리오 (auth-setup.md 5절): 소유권 차단·다른 기기 owner_id 귀속~~ — ✅ 완료 (2026-09-01, 위 절)
2. ~~에디터 내 로그인 유도 배너~~ — ✅ 완료 (아래)
3. **[P7 이월]** 운영자 인증 교체: ADMIN_KEY → Supabase Auth 이메일 화이트리스트(`docs/admin.md`). **2026-09-01 사용자 결정으로 P7 이월** — 아래 6번(운영자 로그아웃 라우트)과 같은 묶음이라 그때 함께 처리한다. 그때까지 운영자 인증은 ADMIN_KEY 쿠키 그대로다.
4. ~~로그아웃 UI~~ — ✅ 완료 (위)
5. ~~403 거부화면 문구 루프~~ — ✅ 완료 (2026-09-01). **루프의 정체**: 로그인한 사람에게 "로그인하세요"라고 하면 `/login`이 세션을 발견해 곧장 `next`로 되돌려보내 같은 거부 화면으로 돌아온다. 문은 두 개였다 — `/api/site/get`이 거부 응답에 **요청자 본인의 세션 유무** `signedIn`을 주고(403일 때만 세션 조회), 클라이언트가 응답의 `error`까지 읽어 세 갈래로 가른다: ①**not-found/bad-slug/네트워크 오류** → "홈페이지를 찾지 못했어요" + `/my` (로그인 CTA 없음 — 권한 문제가 아니다) ②**403 + 로그인** → "이 계정에 연결돼 있지 않아요" + 연결 경로 안내 + `/my` ③**403 + 비로그인** → 기존 로그인 유도. 검증(로컬): 403/404/bad-slug 응답 본문 실측 + 404 화면 실렌더 확인.
   - ⚠ **로그인 403은 두 경우를 구분하지 못한다**(미claim 사이트 vs 이미 다른 계정 소유). 후자에선 안내하는 `[내 계정에 연결하기]` 버튼이 `owner_id`가 있어 **어느 기기에서도 렌더되지 않으므로**, 문구를 양쪽에서 참인 표현으로 낮추고 계정 전환 경로(`/my` → 로그아웃 → 원래 로그인 수단)를 함께 안내하는 것으로 처리했다. 정확히 가르려면 403 본문에 `claimed: !!owner_id` 같은 사유 코드가 필요하다 — 필요해지면 그때.
   - 이 두 가지(404 문 미차단·403 두 경우 뭉갬)는 **적대적 검증 워크플로가 잡았다.** 처음 구현은 403 문 하나만 닫고 완료로 적었었다.
   - ✅ **`403 + signedIn:true` 실화면 확인 완료 (2026-09-01, 프로덕션)** — P7 이월이었으나 6번을 기다리지 않고 끝냈다. 운영자 쿠키가 **없는 별도 브라우저**를 쓰면 로그아웃 라우트 없이도 재현된다. 로그인 상태로 남의 사이트 `/toktak/edit` → `403 {"error":"forbidden","signedIn":true}` + "이 홈페이지는 지금 로그인한 계정에 연결돼 있지 않아요" + `[내 홈페이지 보기]`(로그인 CTA 없음). 비로그인 변형(`signedIn:false` → "주인이라면 로그인 후 수정할 수 있어요" + `[로그인하기]`)도 같은 흐름에서 확인해 **두 갈래가 모두 실화면으로 증명됐다.**
6. **[P7 이월]** **운영자 로그아웃 라우트 부재**: `onstori_admin`은 httpOnly + `secure`로 심기는데(`app/api/admin/login/route.ts`) 지우는 경로가 어디에도 없다. `/admin`에도 로그아웃 UI가 없어 한 번 인증하면 30일간 그 브라우저의 모든 소유 판정이 admin으로 고정된다 — 검증할 때마다 사람을 헷갈리게 하고(2026-09-01 실제로 겪음), 공용 PC에서는 권한이 남는 문제이기도 하다. 최소 수정: `POST /api/admin/logout`이 `res.cookies.delete("onstori_admin")` 하고 `/admin`에 버튼 하나. **운영자 인증 교체(P7)와 함께 처리하기로 결정(2026-09-01, 사용자 지시).** 그때까지는 검증 시 운영자 쿠키를 먼저 확인할 것. ~~이 항목이 5번의 마지막 검증을 막고 있다~~ — **더 이상 아니다**: 쿠키가 분리된 별도 브라우저로 2026-09-01에 그 검증을 끝냈다. 다만 **공용 PC 권한 잔존**이라는 본래 문제는 그대로 남아 있고, 앞으로도 소유 관련 검증마다 브라우저를 갈아야 하는 번거로움이 있다.

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

**뱅크 재고 (2026-09-02 비히어로 웨이브 후)**: 전체 638장 **전량 승인** — hero 124 · gallery 183 · about 167 · process 164. **네 역할 모두 생성 파이프라인에 배선 완료**(hero=1장, gallery=최대 6장, about=1장, processSteps=스텝당 1장).

⚠ **셀당 재고가 얇다**: (업종×무드) 55셀 기준 평균 3장, 최소 1장. 그래서 진행 과정처럼 칸 수가 정해진 자리는 정확한 무드만으로는 대개 못 채운다(4스텝 기준 38/55셀 미달). `pickImages`의 `widenMood`가 같은 업종의 다른 무드에서 보충하고(업종 단위로는 최소 8장), 그래도 모자라면 **아예 안 붙인다** — 사진 있는 카드와 없는 카드가 섞이면 고장난 것처럼 보인다. 웨이브 결과는 아래 "AI 스택" 절 참조.

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
| 서비스 계정 키 JSON → Vercel용 base64를 클립보드로(내용 미출력) | `scripts/sa-key-to-clipboard.ts` |
| 웨이브 러너 — (역할×업종) 셀 단위로 `bank-generate`를 나눠 호출, 진행·종료 로그 | `scripts/bank-wave.ts` (신설 2026-09-02) |

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

### 비히어로 500장 웨이브 — ✅ 완료 (2026-09-02)

gallery·about·process 3역할 × 14업종 = 42셀에 12장씩. `scripts/bank-wave.ts`로 셀을 나눠 돌렸다 —
`bank-generate`를 그냥 돌리면 업종별 scene 수 차이(interior 5, rental 1) 때문에 interior가 5배 뽑힌다.

```
created 500 · dups 0 · fails 0 · apiCalls 500 · estCostUsd 19.50 · 499분 · 셀 42/42
```

**시공사례 역할은 만들지 않았다** — `ROLE_DIRECTION`도 DB 체크 제약도 `hero|about|gallery|process` 4종뿐이라
새로 만들려면 마이그레이션이 필요하다. gallery의 "하나의 명확한 피사체 디테일 샷"이 그 용도를 겸한다(사용자 결정).

**병목은 쿼터였다.** Vertex 이미지 생성은 **프로젝트당 분당 2회**가 상한이다(global·region 동일,
`gcloud quotas info describe GenContentImageGenRequestsPerMinutePerProjectPerBaseModelGlobal`). sleep 7초로
시작했다가 429 폭풍을 맞고 중단 직전까지 갔다. sleep 25초로 재실행 — 그래도 429가 나지만 매번 다음 호출이
성공해 3연속에 도달한 적은 **한 번도 없다**(429 총 348회, 전부 1/3). 실효 분당 1장 = 8시간. 상향 신청은 가능하다(eligible).

**검수**: 510장을 전부 내려받아 표준편차·엔트로피·용량·해상도·비율을 측정했다. 표준편차 최저 22.8(단색이면 0 근처),
엔트로피 최저 6.18, 해상도는 1200x896·1200x805·1024x1024 세 종류뿐 — **기계적으로 거부할 장이 0건**이었다.
12장 컨택트시트로 육안 확인(문구 삽입·워터마크·왜곡 없음) 후 **전량 승인**. 표준편차 최저군은 타일 클로즈업 같은
단색 피사체라 실패가 아니다.

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

### ✅ 확인 완료 — 크레딧이 실제로 붙는다 (2026-09-01)

[비용 리포트](https://console.cloud.google.com/billing/014ED8-17111F-A31CCD/reports) 실확인: **₩435,523 중 ₩25,243.93 사용, 잔액 ₩410,279.** Vertex AI 사용분이 체험판 크레딧에서 정상 차감된다 — 카드 청구가 아니다.

**Vertex 이관 결정(DECISIONS 2026-09-01)의 유일한 미검증 전제가 해소됐다.** 체험판 크레딧은 "특정 사용량에 적용"이라 Vertex가 적용 범위 밖일 수 있다는 게 리스크였는데, 범위 안이다.

**남은 이미지 웨이브를 막던 조건이 풀렸다.** 오늘 히어로 100장 생성 + 온종일 텍스트 생성에 ₩25,244를 썼고, 남은 ₩410,279는 그 **약 16배**다. 크레딧 만료는 **2026-12-01** — 쓰지 않으면 사라지므로 웨이브를 미룰 이유가 오히려 없다.

예산 알림 2종은 설정 완료(아래 "코딩 외 대기 항목 → 완료" 표). 체험판의 "청구 없음" 보호막이 없으므로 알림은 계속 유효하다.

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

### 🟡 표시광고법 리스크 — 근거 없는 경력 표현 (2026-09-03 부분 대응)

`thinkingBudget: 0` 적용 후 폴백 모델 `gemini-2.5-flash`가 **"오랜 경험과 기술력으로"** 같은 문구를 생성하는 것을 관찰했다(주 모델 `gemini-3.5-flash`는 깨끗했다). 입력에 없는 경력을 만들어낸 것으로, **CLAUDE.md 불변 규칙(사실 날조 금지) + 표시광고법 위반**이다.

- ~~표본 1건이라 경향 확정은 아니다.~~ → **2026-09-03 실사이트 감사에서 3건 추가 발견**: whitedobae("오랜 노하우를 바탕으로")·mong-filates("숙련된 전문가들이")·testtesttest("숙련된 기술로") — 전부 처리 과정 카피에서. 어느 모델이 생성했는지는 `copyModel` 기록이 그때 없어서 불명. 3건 모두 draft+published 수정 완료(이전본은 `site_versions` 스냅샷), 프로덕션 반영 확인.
- **할 일 진행 상황**(2026-09-03): ① **완료** — `geminiJson`이 사용 모델을 반환하도록 해 `inferred.copyModel`에 기록(`lib/gemini.ts`, `lib/generate.ts`). 단 소급 적용은 안 되므로 위 3건의 원인 모델은 여전히 모른다. ② **부분 완료** — 폴백 전용 별도 검증은 아직 안 했지만, 카피 프롬프트의 날조 금지 규칙을 "숫자 없는 경력·숙련도 암시 표현"까지 확대했고 이 프롬프트는 주 모델·폴백 모델에 동일하게 적용된다(`lib/gemini.ts`가 모델만 바꿔가며 같은 프롬프트로 재시도). ③ **미착수** — 후처리 필터는 없음. 프롬프트만으로 100% 차단된다는 보장은 없으므로 남겨둔다.
- **남은 것**: 확대된 프롬프트가 실제로 유사 표현을 막는지 신규 생성 몇 건으로 표본 확인 · ③ 후처리 필터 여부 결정.

### 🔴 v1 범위 밖 업종 입력 시 온보딩 처리 — 방식 확인 필요

v1 활성 범위는 **시공·출장 12업종 + 카페·식당 2업종 = 14종**(DECISIONS 2026-08-31)인데, 범위 밖 업종이 들어와도 **그냥 진행된다.**

- 실측: "몽 필라테스 / 1:1 맞춤 자세교정 수업" → LLM 분류가 **`repair`(수리)** 로 매핑. 필라테스에 맞는 칸이 없어서 가장 가까운 걸 고른 것.
- 코드 확인 결과 **`confidence`는 계산·저장만 되고 분기에 전혀 안 쓰인다**(`lib/generate.ts:43`, `inferred`에 담겨 DB로 갈 뿐). 저확신 되묻기(설계서 4장 3단계)는 미구현.
- 게다가 LLM이 목록에 없는 id를 뱉으면 `?? INDUSTRIES[0]`으로 **조용히 첫 업종으로 떨어진다**(`lib/generate.ts:42`).
- 결과적으로 엉뚱한 템플릿·이미지·진행단계가 붙은 사이트가 만들어질 수 있다. 당근 홍보로 불특정 업종이 들어오기 시작하면 바로 드러날 문제.
- **결정이 필요한 지점**: (a) 저확신·범위 밖이면 되묻기 UI를 띄울지 (b) "아직 지원하지 않는 업종입니다" 안내로 막을지 (c) 범용 템플릿으로 받아줄지. **사장님 판단 필요 — 사업 범위 문제라 코드로 정할 수 없다.**

### ✅ WIF 전환 — 동작 확인 (2026-09-02) · 남은 것은 SA 키 폐기뿐

Vercel→Vertex 인증을 **서비스 계정 키(장기 자격증명)에서 Workload Identity Federation으로** 옮겼다. **Vercel 에는 더 이상 장기 키가 없다** — 요청마다 발급되는 단기 토큰으로만 인증한다.

**왜 했나**: 조직 정책 `iam.disableServiceAccountKeyCreation`이 상위 조직에서 상속·적용 중인데, 이를 **프로젝트 단위 예외로 끄고** 키를 만들어 쓰고 있었다. 정책의 취지(장기 키 금지)를 우회한 것이라 부채였다. WIF는 키를 아예 만들지 않는다.

⚠ **현재 상태 정정**: 키를 *쓰는* 상태는 끝났다(2026-09-02 ①). 다만 **정책 예외는 아직 열려 있고 키도 GCP 안에 남아 있다** — 관찰 기간의 복구 수단으로 일부러 둔 것이다. 아래 "마무리 3단계" 참조.

**방식**: Vercel OIDC → GCP STS → **기존 `onstori-gemini-sa` 가장(impersonation)**. 키 파일 불필요, 정책 예외도 되돌릴 수 있다. 기존에 부여한 `roles/aiplatform.user`(2026-09-01)를 그대로 재사용한다. Vercel에 넣는 값은 전부 비밀이 아니다(프로젝트 번호·SA 이메일·풀/프로바이더 ID).

**코드(실제 구현)**: `lib/vertex.ts`의 `auth()`를 `authClient(): Promise<AuthClient>`로 바꿔 분기 3개(WIF → SA JSON → 로컬 ADC)를 하나의 `AuthClient`로 수렴시켰다. `ExternalAccountClient.fromJSON({ ..., subject_token_supplier: { getSubjectToken: getVercelOidcToken } })` — **`google-auth-library`가 이미 지원**하므로 새 인증 라이브러리 불필요. 추가 의존성은 `@vercel/oidc` 하나. 로컬 ADC 흐름은 그대로.

계획에 없었으나 필요해서 추가한 것 둘:
- **폴백** — WIF 는 토큰을 한 번 받아보고 성공해야 채택하고, 실패하면 SA/ADC 로 넘어간다. 처음엔 폴백이 없어 WIF 가 어긋나는 순간 프로덕션 생성이 통째로 500이 났다(실제 발생).
- **진단 엔드포인트** `GET /api/admin/auth-check` — 폴백은 서비스를 살리지만 실패를 가린다. "지금 진짜 어느 경로인가"를 볼 창구가 없으면 전환 완료 여부를 판단할 수 없다. `?probe=wif` 로 캐시를 무시한 재시도와 실패 사유 원문도 받는다.

**실제 소요**: 약 1.5시간(예상 2~3시간). GCP 는 콘솔 대신 gcloud 로 해서 빨랐고, 대신 예상에 없던 `iamcredentials` 함정과 프로덕션 500 복구·진단 엔드포인트 제작에 시간이 갔다.

**예상이 맞았던 것**: "STS 오류 메시지가 불친절하고 로컬 재현이 어렵다." 실제로 GCP 감사 로그에는 STS 호출 자체가 안 남아 원인을 좁힐 수 없었고, 토큰 클레임을 디코드해 대조하고 나서야 잡혔다. subject 문자열 `owner:ianworld:project:onstori-pwk2:environment:production` 은 정확히 맞아야 한다는 것도 그대로였다(실측 일치).

**착수 전 확인 — ✅ 통과**: 조직 정책 `iam.workloadIdentityPoolProviders`의 유효값이 `allValues: ALLOW`라 발급자 제한이 없다(gcloud 확인).

**끝난 것 (2026-09-02)**

| 무엇 | 값 |
|---|---|
| WIF 풀 | `vercel` (global) |
| OIDC 프로바이더 | `vercel` · issuer `https://oidc.vercel.com/ianworld` · audience `https://vercel.com/ianworld` · `google.subject=assertion.sub` |
| SA 가장 권한 | `onstori-gemini-sa` 에 `roles/iam.workloadIdentityUser`, principal 은 subject 정확 일치 |
| 코드 | `lib/vertex.ts` 인증 3분기(WIF → SA JSON → ADC) + `@vercel/oidc` 의존성 |

audience 는 문서의 두 방식 중 **Allowed audiences**를 골랐다 — 코드에서 audience 를 넘길 필요가 없어 env 변수가 하나 줄고 어긋날 자리도 준다.

**Vercel 설정 완료** (사장님, 2026-09-02): 발급자 모드 Team + 아래 4개를 Production 에 등록 후 재배포. 전부 비밀이 아니다.

⚠ **함정 — `iamcredentials.googleapis.com` 을 켜야 한다.** 환경변수를 넣고 재배포한 직후
`/api/generate` 가 500이 났다. 클레임은 전부 정확히 맞았고(iss·aud·sub) 원인은 프로젝트에
**IAM Service Account Credentials API 가 사용 설정되어 있지 않은 것**이었다. WIF 는 서비스 계정
가장에 이 API 를 쓰는데, SA 키 방식은 쓰지 않으므로 켤 일이 없었다. `gcloud services enable
iamcredentials.googleapis.com` 한 줄로 해결. 이 함정은 GCP 콘솔 마법사를 따라가면 안 드러난다.


```
GCP_PROJECT_NUMBER=724604972722
GCP_SERVICE_ACCOUNT_EMAIL=onstori-gemini-sa@project-e8a34e87-a445-4701-af4.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
```

⚠ Vercel 의 OIDC **issuer mode 가 `Team`**이어야 한다(Settings → Security/OIDC). `Global`이면 issuer 가 `https://oidc.vercel.com`이 되어 위 프로바이더와 어긋난다 — 그때는 프로바이더의 issuer-uri 를 바꾸면 된다.

**검증 결과 (2026-09-02)**: `GET /api/admin/auth-check`(운영자 전용) 로 확인 —
`실제경로: wif` 4회 연속, 사이트 생성 200/8.6초. 토큰 클레임도 대조했다:
`iss=https://oidc.vercel.com/ianworld` · `aud=https://vercel.com/ianworld` ·
`sub=owner:ianworld:project:onstori-pwk2:environment:production` — 셋 다 GCP 설정과 일치.

⚠ **아직 SA 키가 살아 있다.** 200이 나온다고 WIF 라는 증거는 아니다(폴백이 가린다) — 그래서
`auth-check` 의 `실제경로`를 봐야 한다. 마지막 증명은 `GOOGLE_SERVICE_ACCOUNT_JSON` 을
Vercel 에서 **지우고** 재배포한 뒤에도 생성이 200인지 보는 것이다.

### 🕒 마무리 3단계 — ①만 하고 **며칠 관찰 중** (2026-09-02 결정)

되돌릴 수 있는 정도가 단계마다 다르다. 뭉뚱그리면 안 된다.

| 단계 | 내용 | 되돌리기 |
|---|---|---|
| ① | Vercel `GOOGLE_SERVICE_ACCOUNT_JSON` 제거 → Redeploy | ⚠ 값이 사라진다(로컬에도 없음). **새 키 발급으로만** 복구 |
| ② | SA 키 `520195620d…` 삭제 | ❌ 영구. 단 새 키 발급은 가능 |
| ③ | `iam.disableServiceAccountKeyCreation` 예외 해제 | ⚠ **이걸 하면 새 키 발급 자체가 막힌다** — 진짜 되돌릴 수 없는 지점 |

**① 완료 (2026-09-02) — WIF 단독 동작이 증명됐다.** Vercel 에서 `GOOGLE_SERVICE_ACCOUNT_JSON` 을
제거·재배포한 뒤 `auth-check` 가 `SA키 env: null` · `실제경로: wif` · 토큰 ok 를 **20초 간격 5회 연속**
보고했고, 사이트 생성 200/8.4초에 카피·뱅크 이미지 4장까지 정상. 폴백할 곳이 없는 상태에서 성공한
것이므로 이제 200은 WIF 의 증거다.

**관찰 시작: 2026-09-02.** ②③은 며칠 뒤.

**지금 상태: ①만 진행, ②③은 며칠 관찰 후.** ②③을 미뤄도 손해가 거의 없다 — 남은 키는
Vercel 에서 이미 빠져 어디서도 안 쓰이고, 위험은 GCP 안에 잠자는 것뿐이다. 반대로 ③을 먼저
하면 WIF 가 어긋났을 때 되돌릴 문이 닫힌다.

**관찰 방법**: `GET /api/admin/auth-check`(운영자 쿠키)의 `실제경로`가 계속 `wif` 인지.
인증 판정은 람다당 한 번만 하고 캐시하므로 **한 번 보고 판단하지 말 것** — 몇 분 간격으로
여러 번, 콜드스타트를 섞어 봐야 한다.

**실패 시 복구(5분)**: 정책이 아직 열려 있으므로 새 키를 발급해 되돌린다.

```bash
gcloud iam service-accounts keys create <저장소 밖 경로> \
  --iam-account=onstori-gemini-sa@project-e8a34e87-a445-4701-af4.iam.gserviceaccount.com
npx tsx scripts/sa-key-to-clipboard.ts "<그 경로>"   # base64 를 클립보드로
# Vercel Production 에 GOOGLE_SERVICE_ACCOUNT_JSON 로 붙여넣고 Redeploy
```

**영향 범위**(인증이 죽었을 때): `/api/generate` 신규 생성만 500. 기존 발행 사이트·에디터·
로그인·대시보드는 무관하다. 가게가 멈추는 게 아니라 신규 접수가 멈춘다.

**②③ 진행 조건**: 며칠간 `실제경로: wif` 가 유지되고 생성 실패가 없을 것.

**전환 완료 시 되돌릴 것**: ① 프로젝트의 `iam.disableServiceAccountKeyCreation` 예외 해제 ② SA 키 `520195620d…` 삭제(현재 유일한 사용자 관리 키) ③ Vercel의 `GOOGLE_SERVICE_ACCOUNT_JSON` 제거.

참고: [Vercel OIDC](https://vercel.com/docs/oidc) · [Vercel→GCP(Vertex 예제 포함)](https://vercel.com/docs/oidc/gcp)

### 백로그 — 네이버 플레이스 자동 불러오기 (P4 이후 검토)

가게 이름/주소만 받아 **네이버 플레이스의 영업시간·주소·전화·사진 등을 자동으로 끌어와** 온보딩 입력을 줄이는 안. 사장님이 타이핑할 게 4개→1~2개로 줄어 위저드 이탈이 크게 낮아질 수 있다.

**착수 전 반드시 해소할 것 2가지**
1. **약관 그레이존** — 스크래핑은 네이버 이용약관 위반 소지가 있다. 소상공인 대상 상용 서비스라 리스크를 감수할 수 없다.
2. **공식 API 조사 필요** — 네이버 지역/검색 계열 공식 API로 필요한 필드(영업시간·사진 등)를 합법적으로 얻을 수 있는지 확인. 얻을 수 없으면 이 기능은 **불채택**이 기본값이다.

**주의**: 불러온 정보는 사실 정보(주소·전화·영업시간)라 **틀리면 그대로 고객 피해**가 된다. CLAUDE.md 불변 규칙(사실 날조 금지)과 같은 선상에서, 자동 입력하더라도 사장님 확인 단계를 반드시 거치게 설계할 것.

**검토 시점**: P4 마무리 후. P5(결제)보다 뒤여도 무방하다 — 있으면 좋은 기능이지 차단 요소는 아니다.

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
| **카카오 로그인 설정** | ✅ 완료 (OIDC 직결, E2E 통과) | `docs/auth-setup.md` 1~3절 |
| **v1 범위 밖 업종 정책 결정** | 미결정 | 위 TODO 참조 — 되묻기 / 차단 / 범용 수용 중 택1 |
| **통신판매업 신고 + 토스페이먼츠 가맹** | 미착수 | P5(결제) 착수 조건. 1개월 무료 종료 시점에 첫 결제가 발생하므로 지금 시작해야 타이밍 맞음 |
| **당근 비즈프로필 개설 + 홍보글 게시** | 보류 (사용자 결정) | `docs/presale.md`의 글 초안·응대 템플릿 사용. 게이트: 사진 수신 5건/2주 → P3 확정, 유료 전환 30% → P5 |

### 완료 (2026-09-01)

| 항목 | 결과 |
|---|---|
| Vertex AI 콘솔 설정 | ✅ API 사용 설정 · `onstori-gemini-sa`에 `roles/aiplatform.user` · 로컬 ADC |
| 서비스 계정 키 (임시) | ✅ 조직 정책 예외로 발급 → 로그 노출로 **같은 날 교체 완료** (신 `520195620d…` 활성 / 구 `a29494b9…` 영구 삭제). 로컬엔 두지 않고 Vercel Production에만. WIF 전환 시 폐기 (DECISIONS 2026-09-01) |
| Vercel 환경변수 | ✅ `GOOGLE_CLOUD_PROJECT`(Config) + `GOOGLE_SERVICE_ACCOUNT_JSON`(Secret), 둘 다 Production |
| 프로덕션 배포 | ✅ `main` fast-forward 푸시 → 배포 반영 → **생성 E2E 200/7.67초** 확인 |
| **예산 및 알림** | ✅ **2개 설정** — `gemini_onstori_예산`(결제 계정 전체, 50/90/100%, ₩100,000) · `onstori-gemini-예산`(My First Project → Vertex AI 서비스 한정, 50/80/100%, ₩100,000) |
| **크레딧 적용 확인** | ✅ **정상 상쇄 확인** — ₩435,523 중 ₩25,243.93 사용, 잔액 ₩410,279(만료 2026-12-01). Vertex 이관 결정의 미검증 전제 해소, 남은 이미지 웨이브 진행 가능 |
| **이미지뱅크 검수** | ✅ **638장 전량 승인** — 히어로 124 · gallery 183 · about 167 · process 164 (2026-09-01 히어로분 + 2026-09-02 비히어로 500장). 신규 사이트의 히어로·갤러리가 뱅크에서 붙는다 |
