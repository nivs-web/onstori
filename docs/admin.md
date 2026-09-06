# 온스토리 운영자 콘솔 — 통합 기획 (본사 어드민)

위치: `onstori.com/admin` · 최종 개정 **2026-09-06** (기술참모)
이 문서는 **어드민의 단일 출처**다. 아래 넷을 하나로 합쳤다.

| 흡수한 출처 | 있던 내용 | 처리 |
|---|---|---|
| 기획3 `docs/admin.md` (2026-09-01 판) | 권한 · 메뉴 6개 · 이미지뱅크 관리 상세 · 신청 접수함 | **이 문서로 대체** |
| 기획1 `/mainplan #membership` | `/admin/members` 9행 표 | **구현 완료** — §3 으로 흡수 |
| 기획1 `/mainplan` 작업표 7·12번 | 회원 목록 · 이미지뱅크 생성기 | §3 · §5 로 흡수 |
| 기술참모 E 스펙 (2026-09-06) | 메모 · 블랙리스트 · 탭 · 재공개 · 섹션 토글 | §3 · §4 로 흡수 |

⚠ **중복 정리:** 옛 `docs/admin.md` 의 메뉴 표에는 "대시보드 / 이미지뱅크 / 사이트 관리 / 신청 접수함 / 무비 주문 / 설정" 6개만 있었다.
그 사이에 **회원 목록 · 랜딩 포트폴리오 · 서브도메인 · 기획실 3개**가 실제로 만들어졌고, **대시보드와 설정은 아직 없다.**
아래 §1 의 표가 지금부터의 기준이다.

---

## 1. 메뉴 구조 — 실제 상태와 함께

```
/admin  운영자 콘솔
├─ 대시보드                     ✗ 미착수 (P7)   가입·생성·발행·활성 퍼널 · 오늘 신청 수 · AI 비용
├─ 회원 관리   /admin/members    △ 확장 중       목록·메모·블랙리스트·결제 실패·재공개·연장
├─ 온스토리 홈페이지 관리 /admin/pages  ✗ 신규    본사 페이지 섹션 보이기·가리기
├─ 이미지뱅크 관리 /admin/bank   ✔ 있음          검수·점수·삭제 (+ 생성기는 미착수)
├─ 사이트 관리 /admin/sites      ✔ 있음          전체 고객 사이트 목록·상태
├─ 랜딩 포트폴리오 /admin/showcase ✔ 있음         URL 등록·태그·순서·추천
├─ 서브도메인 /admin/subdomains  ✔ 자리만         본사 내부 기능 전용(후순위)
├─ 신청 접수함                   ✗ 미착수 (P3)   당근·지인 무료 제작 신청
├─ 무비 주문 관리                 ✗ 미착수 (P6)   히어로 무비 제작 보드
├─ 설정                         ✗ 미착수         예약 슬러그 · 운영자 목록
└─ 기획1·2·3                    ✔ 있음          /mainplan · /plandept · /onstoriplandept
```

`app/admin/page.tsx` 의 `menus` 배열이 이 표와 1:1이어야 한다. `ready:false` 는 회색 비활성으로 그린다(이미 그렇게 돼 있다).

---

## 2. 권한 (변경 없음 — 옛 기획 그대로)

- **지금:** `ADMIN_KEY` 환경변수 + `onstori_admin` 쿠키. `lib/admin-auth.ts` `isAdmin()`.
  `robots.ts` 가 `/admin/` 을 차단하고, 각 페이지가 `robots: { index:false, follow:false }`.
- **다음(P7 이월 · 2건 한 묶음):** Supabase Auth 로그인 + **이메일 화이트리스트**. `ADMIN_KEY` 제거.
  같은 묶음에 **운영자 로그아웃 라우트**가 있다 — 지금은 쿠키를 지우는 길이 없어,
  운영자 쿠키가 남은 브라우저에서는 소유권 차단이 전부 우회된다(검증할 때 매번 걸린다).
- **데이터 접근:** 어드민 API 라우트에서만 `service_role`(`lib/db-admin.ts` `sbAdmin()`). 클라이언트 노출 금지.

⚠ 이번 작업에서 인증 방식은 **건드리지 않는다.** P7 묶음으로 남긴다.

---

## 3. 회원 관리 `/admin/members` — 이번에 확장

### 3-1. 지금 있는 것 (2026-09-05 구현, 읽기 전용 94줄)

기획1 `#membership` 의 9행 표를 그대로 만든 것이다. 열 12개:
상호명 · 홈페이지 주소 · 상태 · 최초 개설일 · 결제일 · 무료 남은 기간 · 연락처 · 주소 · 완성도 · 이메일 · 가입방식 · 업종.

**회장님이 요구하신 7개 열 중 6개가 이미 있다.** 없는 것은 '이름'뿐이다.

### 3-2. 이번에 더하는 것

| 항목 | 내용 | 저장 위치 |
|---|---|---|
| 이름 | 사람 이름 — 가입 흐름에 받는 칸이 없어 운영자가 입력 | `member_admin.contact_name` |
| 메모 | 날짜별 메모·요청사항·참고사항. 화면 상한 20,000자(≈200줄) | `member_admin.memo` |
| 블랙리스트 | **표시만**(빨간 행 + ⚑ 배지 + 개수 요약 + 필터). **차단 기능 없음** ← 회장님 확정 | `member_admin.blacklisted` |
| 정렬 | 헤더 클릭 — 가입일·결제일·D-n·완성도·상호명 | 클라이언트 |
| 탭 | 전체 / 정회원 / 무료 / 결제 실패 | 클라이언트 |
| 검색·필터 | 이름·전화·상태 | 클라이언트 |
| CSV 내려받기 | ⚠ 개인정보가 나간다 — 메모·블랙리스트 사유는 넣지 않는다 | — |
| 마지막 로그인 | `auth.users.last_sign_in_at` (이미 받아오고 있다) | — |
| 마지막 편집일 | `sites.updated_at` | — |
| 문의 건수 | `inquiries` count | — |

### 3-3. ★ 메모·블랙리스트를 `sites` 에 넣으면 안 되는 이유

메모는 "진상 고객"이라고 적을 칸이다. **사장님이 절대 보면 안 된다.**

- `sites.settings` 에 넣으면 → `app/api/site/get/route.ts:37` 이 **`settings` 를 통째로 사장님에게 내려준다.**
- `sites` 새 컬럼에 넣으면 → RLS `sites_owner_all`(`core.sql:115`)이 주인에게 그 행을 읽게 해 준다.

→ **RLS 를 켜되 정책을 하나도 만들지 않은 별도 표** `member_admin` 에 넣는다. `service_role` 만 통과한다.

### 3-4. 결제 실패 탭 (회장님 확정: **지금부터 기록 시작**)

지금 `app/api/billing/confirm/route.ts:31~34` 는 실패를 **로그로만** 남긴다. DB 기록이 없다.
→ `payment_attempts` 표를 만들고 **성공·실패 둘 다** 기록한다(실패율을 보려면 분모가 필요하다).

⚠ 지금 결제는 **토스 1회 승인**이다. 빌링키·정기결제가 없으므로 여기 쌓이는 것은
**1회 결제 시도 실패**(카드 한도초과·유효기간 오류 등)다. 정기결제가 생기면 `kind='recurring'` 으로 같은 표에 쌓인다.
빈 목록일 때 그 사실을 화면에 한 줄 적어 둔다.

"언제부터 실패"는 **마지막 성공 이후의** 실패만 센다. 예전에 한 번 실패했다가 결제에 성공한 사람을 실패자로 올리면 안 된다.

### 3-5. ★★ 무료 회원 — 절대 삭제 금지

> ~~**회장님 확정 (2026-09-06): "14일 지나도 절대 삭제 금지(고객 정보이므로). 공개 홈페이지만 비공개 처리."**~~
> ⛔ **폐기됨 (2026-09-06 최종 확정으로 대체).** 무료 **30일** → 정지(비공개) → **정지 후 60일 영구 삭제**.
> 손님 견적 문의도 정지 후 60일 파기. 단일 출처: `lib/trial.ts`. DECISIONS 2026-09-06 참조.

**코드는 이미 이 정책대로다.** 새로 만들 것은 [다시 열기] 하나뿐이다.

| 단계 | 코드 | 상태 |
|---|---|---|
| 만료 판정 | `app/api/cron/expire/route.ts:49~55` → `update({status:'expired'})` · 매일 03:00 KST | ✔ |
| 공개 차단 | RLS `sites_public_read using (status in ('trial','active'))` (`core.sql:113`) | ✔ |
| **데이터 삭제** | **저장소에 사이트를 지우는 코드가 0건** | ✔ 정책과 일치 |
| 에디터 차단 | `app/[slug]/edit/ui.tsx:300` (문의함은 열어 둔다 — 의도) | ✔ |
| **다시 열기** | 없음 | **← 이번에 만든다** |

버튼 **2개**. 하나에 섞지 않는다.

| 버튼 | 하는 일 | 확인 |
|---|---|---|
| **[결제 확인 · 정회원으로]** | `status='active'` · `paid_at=now()` · 메모에 `2026-09-06 수동 결제 확인(운영자)` 자동 기록 | "돈을 받으셨나요?" 한 번 묻는다 |
| **[무료 n일 연장]** | `status='trial'` · `trial_ends_at = max(now, 기존) + n일` · 메모 자동 기록. n = 7·14·30 | 바로 실행 |

회장님이 예로 드신 "1달 무료 연장 오퍼"는 **[무료 30일 연장]** 이 곧 그것이다. 별도 오퍼 시스템을 만들지 않는다.

> ⚠ 2026-09-06 최종 확정 반영 필요: 무료 **30일** → 정지 → **정지 후 60일** 삭제.
> 연장 시 정지·삭제 일정이 함께 밀린다는 점을 문구에 넣어야 한다. 정책 단일 출처: `lib/trial.ts`.
연장 뒤 화면에 문자 **문구를 복사**해 준다(자동 발송하지 않는다 — 요금·오발송 위험):

```
{상호명} 사장님, 온스토리입니다. 무료 기간을 30일 더 열어 드렸어요.
onstori.com/{slug} 에서 그대로 이어서 쓰시면 됩니다.
```

⚠ **어드민에 삭제 버튼을 만들지 않는다. 어떤 화면에도, 어떤 API 에도.**
⚠ 옛 문구 "30일 뒤 사람이 어드민에서 삭제"(`cron/expire/route.ts:8` 주석)는 **주석만 고친다.**
   ~~손님에게 보이는 "14일 이후 자동 삭제" 문구 7곳은 회장님이 그대로 두라고 하셨다(결제 전환 압박용).~~
   ⛔ **폐기됨** — 그 문구는 사실과 달라 표시광고 위험이었다. 2026-09-06 전부 제거하고
   화면에는 "30일 무료 · 이후 정지(자료는 보관)"만 쓴다. 60일 삭제는 약관·방침에만 적는다.

### 3-6. API — `app/api/admin/member/route.ts` (신규 1개)

`app/api/admin/showcase/route.ts` 패턴을 그대로(첫 줄 `isAdmin()` 게이트).

| 메서드 | 하는 일 |
|---|---|
| `PATCH` | `{siteId, memo?, contactName?, blacklisted?, blacklistReason?}` → `member_admin` upsert |
| `POST` | `{siteId, action:'activate'|'extend', days?}` |

⚠ `DELETE` 를 만들지 않는다.
⚠ `action` 은 화이트리스트 둘뿐, `days` 는 7·14·30 뿐(규칙 4 — 클라이언트가 보낸 값을 신뢰하지 않는다).
⚠ 상태 변경은 **메모에 자동으로 한 줄** 남긴다. 돈이 걸린 조작은 기록이 있어야 한다.

---

## 4. 온스토리 홈페이지 관리 `/admin/pages` — 신규

회장님 확정: **온스토리 자체 사이트만.** 손님 사이트는 대상이 아니다(손님 사이트는 사장님이 에디터로 고친다).

```
첫 페이지  (/)
  ├ 02 히어로 — 홈페이지는 빈 집입니다            [보임]   (수정하기 — 준비 중)
  ├ 03 채널 띠 — 한 번 말하면 6곳                [보임]   (수정하기 — 준비 중)
  ├ …
  └ 09 스토리 페이지 들여다보기                   [가림]   (수정하기 — 준비 중)
```

- 토글 = `page_sections.visible`. 에디터의 `Toggle`(`app/[slug]/edit/widgets-panel.tsx:37`)을 그대로 재사용한다.
- **[수정하기]는 회색 비활성**으로 두고 "다음 단계에서 열립니다" 툴팁. 회장님이 그리신 자리를 비워 두지 않는다.
- 섹션 **내용 편집**(문구·카드·표를 어드민에서 고치기)은 **본사용 CMS 를 하나 더 만드는 일**이라 이번 범위 밖이다.
  기획2에 별도 항목으로 올린다.

첫 페이지가 읽는 법 — `lib/page-sections.ts`:

```ts
import { sbAdmin } from "@/lib/db-admin";
/** 본사 페이지 섹션 노출. DB 가 안 닿으면 전부 보이게 한다 — 첫 페이지가 비는 것보다 낫다. */
export async function sectionsOf(page: string): Promise<Set<string>> {
  try {
    const { data } = await sbAdmin().from("page_sections").select("key, visible").eq("page", page);
    return new Set((data ?? []).filter((r) => !r.visible).map((r) => r.key as string));
  } catch { return new Set(); }
}
```

⚠ **A 스프린트가 넣은 `const SHOW_INSIDE = false` 를 이것으로 교체한다.** 스위치 두 개가 공존하면 안 된다.
⚠ 이번엔 첫 페이지의 `inside` **하나만 실제로 배선한다.** 나머지 키는 표에 넣어 두되 화면 배선은 다음 차례
   (한 커밋에 섹션 18개를 감싸면 검증이 안 된다). 그 사실을 `/admin/pages` 화면에 한 줄 적는다.

---

## 5. 이미지뱅크 관리 `/admin/bank` — 있는 것 + 재생성

### 5-1. 이미 만들어져 있는 것 (옛 기획의 "상세 기획"은 상당 부분 구현됨)

| 옛 기획 항목 | 실제 |
|---|---|
| 썸네일 그리드 · 필터 · 일괄 작업 | `app/admin/bank/page.tsx` + `ui.tsx`(9,205 B) |
| 승인 / 거부 / 삭제 | `ui.tsx:115~127` — `quality_ok` true/false, `deleted` 소프트 삭제 |
| **점수(별점)** | `ui.tsx:119` `<select>` — `image_bank.quality_score` **0~100, 기본 50** |
| 중복 차단 | dHash 64bit, 해밍 ≤6 스킵 (`bank-generate.ts`) |
| 비용 로깅 | `image_bank.cost_krw` 컬럼 있음 · 스크립트가 누적 비용 출력 |
| AI 생성 패널(어드민에서 버튼) | **미착수** — 지금은 CLI 스크립트뿐 |
| 자동 채점 | **미착수** — 기획1 12번 "별점 자동" |

### 5-2. ★ 회장님 질문 답 — "이미지뱅크에 별점 기능이 있는지"

**있습니다.** 다만 별 5개가 아니라 **0~100점**입니다.

- `image_bank.quality_score int not null default 50 check (0~100)` (`20260831190000_bank_quality.sql`)
- 어드민 화면에 **점수를 고르는 드롭다운이 이미 있습니다** (`app/admin/bank/ui.tsx:119`).
- 사이트를 만들 때 **점수 높은 것부터, 덜 쓴 것부터** 고릅니다 —
  인덱스 `image_bank_pick_idx (industry, mood, role, quality_score desc, used_count asc) where quality_ok and not deleted`.
- **자동 채점은 아직 없습니다.** 생성 스크립트는 중복(dHash)만 거르고 점수는 전부 기본 50 으로 들어갑니다.
  기획1 작업표 12번에 "별점 자동"이 계획으로 적혀 있습니다.
- 현재 재고는 **638장 전량 수동 승인** 상태입니다(`docs/PLAN.md` P2 — 히어로 100장 2026-09-01 + 비히어로 500장 2026-09-02).

### 5-3. ★ 638장 폐기 · 전량 재생성 (회장님 확정)

**§7 에 실행 방법을 단계별로 적었다.** 여기서는 원칙만.

⚠ **"폐기"는 DB 행만 내린다. 저장소 파일은 지우지 않는다.**
   손님 사이트는 생성 시점에 **이미지 URL 을 문서 안에 복사**해 갖고 있다(`hero.image` 등).
   파일을 지우면 **이미 만들어진 사이트의 사진이 전부 깨진다.**
   옛 기획도 같은 원칙을 적어 뒀다 — "뱅크 삭제가 기존 사이트를 깨뜨리지 않음(원칙 유지)".
   → `update image_bank set deleted = true` 만 한다. 인덱스가 `where ... and not deleted` 라 새 사이트에는 안 뽑힌다.

⚠ **비율은 역할마다 다르다.**
   화면을 꽉 채워야 하는 건 **히어로뿐**이다. `about` 은 3:2 카드(`components/sections/index.tsx:101`),
   `gallery` 는 격자, `process` 는 작은 이미지다. 히어로만 **9:16**, 나머지는 지금 비율이 맞다.
   회장님이 "전부"라고 하셨으니 전부 다시 뽑되, **비율은 역할별로 다르게** 준다.

---

## 6. 나머지 메뉴 — 옛 기획 그대로 (변경 없음)

- **사이트 관리 `/admin/sites`** — 전체 고객 사이트 목록·상태. 구현됨.
- **랜딩 포트폴리오 `/admin/showcase`** — URL 등록·태그·순서·추천. 구현됨.
- **서브도메인 `/admin/subdomains`** — 본사 내부 기능 전용, 자리만.
- **신청 접수함** (P3 미착수) — 채널(당근·지인·랜딩)·업체명·연락처·사진 수신·지불의사·상태(신청→사진수신→제작중→전달→무료중→전환/해지) + 무료 만료 7일 전 알림 목록.
  ⚠ **회원 관리(§3)와 겹친다.** 무료 만료 알림은 §3-5 의 무료 탭이 이미 한다.
  → 신청 접수함은 **아직 회원이 아닌 사람**(제작 전 신청자)만 다루도록 범위를 좁힌다. 회원이 되면 §3 으로 넘어간다.
- **무비 주문 관리** (P6 미착수) — `movie_orders` 상태 보드.
- **설정** (미착수) — 예약 슬러그 관리 · 운영자 목록. P7 인증 교체와 한 묶음.
- **대시보드** (P7 미착수) — 가입·생성·발행·활성 퍼널 · 오늘 신청 수 · AI 비용 요약.
  회장님이 보내주신 아임웹 캡처(요약 카드 3개 + 통계 + 우측 만료일 D-14)가 그 모양이다.
  ⚠ 회원 관리와 **화면도 데이터도 다르다.** 이번 §3 이 끝난 뒤 별도로 만든다.

---

## 7. 실행 방법 — 순서대로

### 단계 0 · 사람이 먼저 (회장님 · 확정)

```bash
cd C:\Users\ariancepc\Desktop\cowork\onhome\onstori
npx supabase db push
```

`20260905090000_mainplan_membership.sql` 이 **아직 프로덕션에 안 올라갔다**(`paid_at` 컬럼이 그 안에 있다).
이걸 먼저 올려야 §3 의 결제일 열이 채워진다.

### 단계 1 · 어드민 회원 관리 (커밋 1)

```bash
git checkout -b feat/admin-members-2026-09-06
# handoff/2026-09-06-admin-members/supabase/migrations/20260906030000_admin_members.sql 복사
npx supabase db reset          # 로컬 검증 (규칙 1)
```

만드는 것: `member_admin` · `payment_attempts` 표 → `app/admin/members/table.tsx`(신규 `"use client"`)
→ `app/api/admin/member/route.ts`(신규) → `app/api/billing/confirm/route.ts` 2곳에 기록 추가.

검증: 사장님 계정으로 에디터를 열고 개발자도구 → 네트워크 → `/api/site/get` 응답에
**메모·블랙리스트가 없어야 한다.**

### 단계 2 · 섹션 보이기/가리기 (커밋 2)

`lib/page-sections.ts` → `app/admin/pages/page.tsx` → `app/api/admin/page-sections/route.ts`
→ `app/page.tsx` 의 `SHOW_INSIDE` 제거 → `app/admin/page.tsx` 메뉴 한 줄 추가.

검증: DB 연결을 끊고 첫 페이지를 열어 **모든 섹션이 보이는지** 확인(빈 화면이면 안 된다).

### 단계 3 · 이미지뱅크 재생성 (별도 세션 · 크레딧 사용)

**3-1. 먼저 재고를 센다** (Supabase SQL 편집기):

```sql
select role, orientation, quality_ok, count(*)
from image_bank where not deleted
group by 1,2,3 order by 1,2;
```

**3-2. 생성 스크립트에 비율을 넣는다** (`scripts/bank-generate.ts`):

```ts
generationConfig: {
  responseModalities: ["IMAGE"],
  // 히어로만 세로. about 은 3:2 카드, gallery 는 격자, process 는 작은 이미지라 지금 비율이 맞다.
  imageConfig: { aspectRatio: j.role === "hero" ? "9:16" : "4:3" },
}
```

⚠ **필드 이름을 문서만 보고 믿지 말 것.** 반드시 1장만 먼저 뽑아 확인한다:

```bash
npx tsx --env-file=.env.local scripts/bank-generate.ts \
  --model gemini-3-pro-image --roles hero --industries interior \
  --limit 1 --count 1
```

나온 이미지의 가로·세로가 실제로 9:16 인지 어드민 `/admin/bank` 에서 눈으로 본다.
비율이 안 먹으면 필드명이 다른 것이다 — 그때 `lib/vertex.ts` 로 응답을 찍어 확인한다.

**3-3. 히어로부터 뽑는다** (고품질 모델):

```bash
npx tsx --env-file=.env.local scripts/bank-generate.ts \
  --model gemini-3-pro-image --roles hero \
  --limit 400 --count 300 --sleep 7000
```

예상 비용: 400회 × $0.134 ≈ **$54 (약 8만원)**. 크레딧 40만원 안이다.

**3-4. 나머지 역할** (양이 많아 flash 로):

```bash
npx tsx --env-file=.env.local scripts/bank-generate.ts \
  --model gemini-3-pro-image --roles gallery,about,process \
  --limit 700 --count 550 --sleep 7000
```

예상 비용: 700회 × $0.134 ≈ **$94 (약 13만원)**.
⚠ 회장님이 "최대한 고품질"이라 하셨으므로 둘 다 `gemini-3-pro-image` 로 적었다.
   `gemini-3.1-flash-image`($0.039)로 하면 13만원 → 4만원이 된다. 히어로만 pro 로 하는 절충도 가능하다.

**3-5. 눈으로 검수하고 점수를 준다** — `/admin/bank?q=pending`
새로 들어온 것은 전부 `quality_ok=null`(대기) · `quality_score=50` 이다. 승인하면서 점수를 조정한다.

**3-6. 마지막에 옛 재고를 내린다** (검수가 끝난 뒤에!):

```sql
-- ⚠ 파일은 지우지 않는다. 기존 손님 사이트가 그 URL 을 직접 참조한다.
update image_bank
   set deleted = true
 where created_at < '2026-09-06'
   and not deleted;
```

⚠ **순서가 중요하다.** 새 이미지를 승인하기 전에 옛것을 내리면,
   그 사이에 만들어지는 사이트가 고를 이미지가 없어진다.

**3-7. 되돌리는 법** — 잘못됐으면 한 줄이다:

```sql
update image_bank set deleted = false where created_at < '2026-09-06';
```

### 단계 4 · 대시보드 (나중)

§6 의 대시보드는 §3 이 끝나고 실데이터가 쌓인 뒤에 만든다.

---

## 8. 데이터 — 이번에 늘어나는 표 3개

`supabase/migrations/20260906030000_admin_members.sql` (완성본은 handoff 번들에)

| 표 | RLS | 용도 |
|---|---|---|
| `member_admin` | **정책 0개** = service_role 전용 | 메모 · 이름 · 블랙리스트 |
| `payment_attempts` | **정책 0개** = service_role 전용 | 결제 성공·실패 기록 |
| `page_sections` | 읽기 공개 / 쓰기는 service_role | 본사 페이지 섹션 노출 |

⚠ `member_admin` · `payment_attempts` 에 실수로 `for select using (true)` 를 붙이면 안 된다. 그게 차단이다.

---

## 9. 이 문서를 벗어나는 것

- **운영자 인증 교체**(ADMIN_KEY → 이메일 화이트리스트) + **운영자 로그아웃 라우트** — P7 이월, 한 묶음.
- **섹션 내용 편집 CMS** — 본사용 에디터를 하나 더 만드는 일. 기획2 별도 항목.
- **정기결제(빌링키)** — §3-4 는 실패를 기록하고 보여주는 데까지다.
- **알림(SMS·이메일) 발송 이력** — `lib/notify.ts` 에 기록 자체가 없다. 별건.
- **대시보드 지표**(퍼널·오늘 신청·AI 비용) — §6.
- **이미지뱅크 자동 채점** — 기획1 12번. 재생성이 끝난 뒤 별도.
