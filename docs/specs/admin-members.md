# E — 어드민 회원사 관리 (`/admin/members` 확장)

> **이 문서는 구현 스펙이다. 어드민 전체의 단일 출처는 `docs/admin.md`**(2026-09-06 통합판)**이다.**
> 기획3의 옛 `docs/admin.md` · 기획1 `#membership` · 이 스펙을 하나로 합쳐 두었다.

작성 2026-09-06 (기술참모) · 마이그레이션 **1개** · 새 라우트 3개 · 기존 화면 확장
전제: 회장님 지시 "**새로 짓지 말고 오늘 만들어진 것 위에 확장**"

---

## 0. 먼저 확인한 것 — 회장님 지시대로

### 기획2(`/plandept`)에 admin 회원 관리 기획이 있나 → **없다**

기획2의 78개 항목을 전부 훑었다. 어드민 관련은 `bank-admin`(이미지뱅크 생성기) · `plandept`(기획실 자체) ·
`stats`(사장님용 통계, 회원 관리 아님) 뿐이다. **회원사 관리 기획은 기획2에 없다.**

### 기획1(`/mainplan`)에는 있다 → **그 위에 얹는다**

`content/mainplan/data.js` 의 `#membership` 항목에 "운영자 회원 목록 (/admin/members)" 9행 표가 있다.
오늘 만들어진 `app/admin/members/page.tsx`(94줄)는 **그 표를 그대로 구현한 것**이다.

### 오늘 만들어진 것 (사실)

`app/admin/members/page.tsx` — **읽기 전용 서버 컴포넌트**. 94줄. 폼도, 정렬도, 버튼도 없다.

| 있는 열 (12개) | 출처 |
|---|---|
| 상호명 | `sites.business_name` |
| 홈페이지 주소 | `sites.slug` (+ `/edit` 링크) |
| 상태 | `sites.status` → 정회원/만료/무료 배지 |
| 최초 개설일 | `sites.created_at` |
| 결제일 | `sites.paid_at` |
| 무료 남은 기간 | `trialInfo()` → `D-n` |
| 연락처 | `settings.phone` |
| 주소 | `settings.address` |
| 완성도 | `site_progress.score` |
| 이메일 | `auth.users`(service role) |
| 가입(로그인 방식) | `auth.users.app_metadata.provider` |
| 업종 | `settings.industryLabel ?? sites.industry` |

**즉 E-1 이 요구하는 7개 열 중 6개가 이미 있다.** 없는 것은 **이름(사람 이름)** 하나뿐이고,
그 밖에 **메모칸 · 블랙리스트 · 정렬 · 결제 실패 · 재공개 · 이벤트 오퍼**가 없다.

→ **새 화면을 짓지 않는다.** 이 파일을 서버(데이터 조회) + 클라이언트(표·폼) 두 조각으로 나누고 열을 더한다.

---

## 1. 회장님 결정 4건 — **전부 확정 (2026-09-06)**

| # | 물었던 것 | **확정** |
|---|---|---|
| E-1 | 결제 실패 리스트를 지금 만들 데이터가 없다 | **지금부터 기록 시작.** `payment_attempts` 표를 만들고 토스 승인 성공·실패를 둘 다 남긴다 |
| E-2 | 섹션 관리 범위 | **온스토리 자체 사이트만.** 손님 사이트는 대상이 아니다. 이번엔 **보이기/가리기 토글만**, 내용 편집은 별건 |
| E-3 | 블랙리스트가 하는 일 | **차단 기능 없음. 진상 고객 표시(빨간색)만.** |
| E-4 | `db push` 순서 | **사람이 직접 실행.** `20260905090000` 이 아직 미적용이니 E 배포 전에 회장님이 한 번 돌린다 |

### 확정 ①의 구체 — 결제 실패 기록

지금 `app/api/billing/confirm/route.ts:31~34` 는 실패를 `console.error` 로만 남긴다. DB 기록이 없다.
→ 성공·실패를 둘 다 `payment_attempts` 에 남긴다(실패율을 보려면 분모가 필요하다).

⚠ 지금 결제는 **토스 1회 승인**이다(빌링키·정기결제 코드 없음, `lib/trial.ts:6` `MEMBERSHIP_PRICE` 1회 49,000원).
   여기 쌓이는 것은 **1회 결제 시도 실패**(카드 한도초과·유효기간 오류 등)다.
   정기결제가 생기면 `kind='recurring'` 으로 같은 표에 쌓인다.
   **빈 목록일 때 화면에 그 사실을 한 줄 적는다** — 나중에 "왜 비어 있지?" 를 막는다.

### 확정 ②의 구체 — 섹션 관리는 온스토리 자체 사이트만

`page_sections.page` 는 `'/'` · `'/how-it-works'` · `'/our-story'` 처럼 **본사 경로만** 넣는다.
손님 사이트(`/[slug]`)는 **넣지 않는다** — 손님 사이트는 사장님이 에디터로 직접 고친다.

### 확정 ③의 구체 — 블랙리스트는 표시만

빨간 행 + `⚑` 배지 + 요약 개수 + [블랙리스트만] 필터. **사장님 화면에는 아무 변화가 없다.**
`status='suspended'` 로 사이트를 끄는 기능은 **만들지 않는다**(스키마에는 있지만 쓰지 않는다).

### 확정 ④의 구체 — 배포 순서

```bash
# 회장님(사람)이 먼저 — 규칙 1
cd C:\Users\ariancepc\Desktop\cowork\onhome\onstori
npx supabase db push
```

`20260905090000_mainplan_membership.sql`(paid_at·payment 컬럼)이 아직 프로덕션에 없다.
그래서 지금 `app/admin/members/page.tsx:26` 이 `select("*")` 를 쓰고 91줄에 안내가 붙어 있다.
이번 마이그레이션과 함께 순서대로 올라간다(파일명이 순서를 보장한다).

## 2. 데이터 설계 — 어디에 저장하나

### ★ `sites.settings` 에도, `sites` 새 컬럼에도 넣으면 안 된다

메모·블랙리스트는 **사장님이 절대 보면 안 되는** 운영자 기록이다("진상 고객"이라고 적을 칸이다).

- `sites.settings` 에 넣으면 → `app/api/site/get/route.ts:37` 이 **`settings` 를 통째로 사장님에게 내려준다.**
  에디터를 열고 개발자도구 네트워크 탭만 봐도 읽힌다.
- `sites` 에 새 컬럼으로 넣으면 → RLS `sites_owner_all for all using (owner_id = auth.uid())`(`core.sql:115`)가
  **주인에게 그 행 전체를 읽을 권한을 준다.** 브라우저 클라이언트로 `sites` 를 직접 조회하면 새 컬럼이 따라 나온다.

### → **RLS 정책이 하나도 없는 별도 표**를 만든다

RLS 를 켜고 정책을 **아무것도 만들지 않으면** 일반 키로는 아무도 못 읽는다.
`service_role`(서버의 `sbAdmin()`, `lib/db-admin.ts`)만 RLS 를 우회한다. 이게 가장 확실하다.

---

## 3. 마이그레이션 (한 파일)

`supabase/migrations/20260906030000_admin_members.sql` — **이 번들에 완성본이 들어 있다.**

```sql
-- 2026-09-06 어드민 회원사 관리 (E)
-- 적용: 사람이 main 에서 `npx supabase db push` (CLAUDE.md 불변 규칙 1)
-- ⚠ 20260905090000_mainplan_membership.sql 이 아직 미적용이면 그것부터 함께 올라간다.

-- ── 운영자 전용 회원 메모 ─────────────────────────────────────
-- ⚠ sites.settings 나 sites 새 컬럼에 넣지 않는다 —
--   settings 는 /api/site/get 이 사장님에게 통째로 내려주고(route.ts:37),
--   sites 행은 RLS sites_owner_all 로 주인이 읽을 수 있다(core.sql:115).
--   이 표는 RLS 를 켜되 정책을 하나도 만들지 않는다 → service_role 만 읽고 쓴다.
create table member_admin (
  site_id uuid primary key references sites(id) on delete cascade,
  memo text not null default '',              -- 날짜별 메모·요청사항·참고사항 (긴 글)
  contact_name text,                          -- 사장님 이름 (settings 에 없는 값)
  blacklisted boolean not null default false, -- 진상 고객 표시 (표시 전용 — 차단 아님)
  blacklist_reason text,
  updated_at timestamptz not null default now()
);
alter table member_admin enable row level security;
-- 정책 없음 = 일반 키로는 전면 차단. 의도된 것이다.

-- ── 결제 시도 기록 (성공·실패 모두) ──────────────────────────
-- 지금은 토스 1회 결제뿐이다. 정기결제(빌링키)가 생겨도 같은 표에 쌓인다.
create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  order_id text,
  amount int,
  ok boolean not null,
  code text,                                  -- 토스 오류 코드
  message text,                               -- 사람이 읽을 실패 사유
  kind text not null default 'once'
    check (kind in ('once','recurring')),     -- 정기결제 도입 시 'recurring'
  created_at timestamptz not null default now()
);
create index payment_attempts_site_idx on payment_attempts (site_id, created_at desc);
create index payment_attempts_fail_idx on payment_attempts (created_at desc) where ok = false;
alter table payment_attempts enable row level security;
-- 정책 없음 = service_role 전용.

-- ── 온스토리 자체 페이지의 섹션 노출 (E-4-부속 ①) ────────────
-- 온스토리 본사 페이지의 섹션을 어드민에서 켜고 끈다. 내용 편집은 이번 범위가 아니다.
create table page_sections (
  page text not null,                         -- '/' · '/how-it-works' · '/our-story' …
  key text not null,                          -- 'inside' · 'pricing' …
  label text not null,                        -- 어드민에 보일 이름
  visible boolean not null default true,
  sort smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (page, key)
);
alter table page_sections enable row level security;
create policy "page_sections_public_read" on page_sections for select using (true);
-- 읽기는 공개(첫 페이지가 서버에서 읽는다). 쓰기는 service_role 만 — insert/update 정책을 만들지 않는다.

-- 첫 페이지 섹션 목록 (A 스프린트의 SHOW_INSIDE 상수를 대체한다)
insert into page_sections (page, key, label, visible, sort) values
  ('/', 'hero',      '히어로 — 홈페이지는 빈 집입니다',        true,  10),
  ('/', 'channels',  '채널 띠 — 한 번 말하면 6곳',             true,  20),
  ('/', 'promises',  '약속 4개',                               true,  30),
  ('/', 'what',      '온스토리란',                             true,  40),
  ('/', 'how',       '작동방식 4단계',                         true,  50),
  ('/', 'portfolio', '완성 예시 (쇼케이스)',                   true,  60),
  ('/', 'letter',    '창업자 편지',                            true,  70),
  ('/', 'inside',    '스토리 페이지 들여다보기',               false, 80),
  ('/', 'pricing',   '정회원 카드 + 전부 사장님 것',           true,  90),
  ('/', 'steps',     '3단계',                                  true, 100),
  ('/', 'demo',      '60초 녹화 데모',                         true, 110)
on conflict (page, key) do nothing;
```

⚠ `page_sections` 는 **읽기 공개**다 — 첫 페이지가 서버 렌더 때 읽어야 하고, 섹션 이름은 비밀이 아니다.
⚠ `member_admin` · `payment_attempts` 는 **정책 0개**다. 실수로 `for select using (true)` 를 붙이면 안 된다.

---

## 4. E-1 · 회원 리스트 (공통)

### 열 구성

| 회장님 요구 | 지금 | 조치 |
|---|---|---|
| 이름 | ✕ | `member_admin.contact_name` 신규. 어드민에서 직접 입력(가입 흐름에 사람 이름을 받는 칸이 없다) |
| 전화번호 | ✓ `settings.phone` | 그대로 |
| 주소 | ✓ `settings.address` | 그대로 |
| URL | ✓ `slug` | 그대로 |
| 업체명 | ✓ `business_name` | 그대로 |
| 업종 | ✓ `settings.industryLabel` | 그대로 |
| 가입일(클릭 정렬) | ✓ 값은 있음 / **정렬 없음** | **정렬 추가** |
| 메모칸 (긴 글) | ✕ | `member_admin.memo` 신규 |
| 블랙리스트 (빨강) | ✕ | `member_admin.blacklisted` 신규 |

### 정렬 — 서버 컴포넌트를 쪼갠다

지금 `page.tsx` 는 서버 컴포넌트라 클릭을 못 받는다. 최소 변경으로:

```
app/admin/members/page.tsx   (서버) — 데이터만 모아서 넘긴다. isAdmin 게이트 유지.
app/admin/members/table.tsx  (신규 "use client") — 표 · 정렬 · 메모 · 배지 · 버튼
```

정렬은 **클라이언트 정렬**로 한다. `limit(500)`(page.tsx:26)이라 500행 이하고, 서버 왕복이 필요 없다.
정렬 가능 열: 가입일 · 결제일 · 무료 남은 기간 · 완성도 · 상호명. 헤더 클릭 시 ▲▼ 표시.

⚠ 500행을 넘기면 정렬이 "보이는 500개 안에서만" 이루어져 거짓말이 된다.
   행 수가 500 이면 표 위에 **"최근 500개만 보고 있습니다"** 를 띄운다.

### 메모칸

회장님: "**100~200줄 입력 가능한 긴 텍스트 칸**(날짜별 메모·요청사항·참고사항 자유 기재)".

- 표 안에 큰 칸을 넣으면 행이 무너진다 → **행을 클릭하면 아래로 펼쳐지는 상세 줄**(`<tr>` 하나 더)로 한다.
- 그 안에 `<textarea rows={14}>` + [저장] 버튼. `maxLength` 는 **20,000자**(200줄 × 100자 여유).
- 자동 저장하지 않는다 — 운영자 메모는 실수로 지워지면 복구가 안 된다. **명시적 [저장]** 만.
- 저장 성공 시 "저장됨 · 방금" 을 3초 보여준다.

### 블랙리스트

- 상세 줄 안에 체크박스 + 사유 한 줄(`blacklist_reason`, 60자).
- 켜지면 그 행 전체가 `bg-red-50` 이고 상호명 앞에 `⚑` 빨간 배지.
- 표 위 요약에 "**블랙리스트 n**" 을 더한다(지금 `전체 · 무료 · 정회원 · 만료` 옆).
- 필터 칩에 [블랙리스트만] 추가.
- **사장님 화면에는 아무 영향이 없다**(확정 ③ — 표시만, 차단 없음).

---

## 5. E-2 · 정회원 결제 실패 리스트

**회장님 확정 ①에 따라 만든다.**

### 기록 시작 — `app/api/billing/confirm/route.ts`

지금 실패 처리(31~34줄)는 로그만 남긴다. 여기에 **한 줄**을 더한다:

```ts
if (!res.ok) {
  console.error(JSON.stringify({ evt: "toss_confirm_fail", slug, status: res.status, code: pay.code, msg: pay.message }));
  // 어드민 결제 실패 목록의 유일한 출처 (E-2). 기록 실패가 사용자 응답을 막지 않게 await 하되 에러는 삼킨다.
  await sb.from("payment_attempts").insert({
    site_id: site.id, order_id: orderId, amount: MEMBERSHIP_PRICE,
    ok: false, code: String(pay.code ?? ""), message: String(pay.message ?? ""), kind: "once",
  }).then(undefined, () => {});
  return NextResponse.json({ error: String(pay.message ?? "결제 승인에 실패했어요") }, { status: 402 });
}
```

성공도 같은 방식으로 `ok: true` 한 줄 기록한다(39줄 뒤). 실패율을 보려면 분모가 필요하다.

### 화면 — `/admin/members` 안의 탭

새 라우트를 만들지 않는다. `/admin/members` 상단에 탭 4개:

```
[전체]  [정회원]  [무료]  [결제 실패]
```

**결제 실패 탭** 열: 상호명 · 홈페이지 · **첫 실패일(언제부터)** · **마지막 실패일** · **실패 횟수** · **마지막 사유** · 연락처 · [메모]

"언제부터 실패"는 `min(created_at) where ok=false` — **마지막 성공 이후의** 실패만 센다
(예전에 한 번 실패했다가 결제에 성공한 사람을 실패자로 올리면 안 된다).

빈 목록일 때: "아직 결제 실패가 없습니다. (정기결제는 아직 도입 전이라, 여기 쌓이는 것은 1회 결제 시도 실패입니다.)"

---

## 6. E-3 · 정회원 리스트

**[정회원] 탭** = `status = 'active'`.

열: 상호명 · 홈페이지 · **결제일(`paid_at`)** · 결제 금액 · 완성도 · 연락처 · 이메일 · [메모]

⚠ `paid_at` 은 **09-05 마이그레이션이 올라간 뒤에야 채워진다**(확정 ④).
   그 전 결제 건은 `settings.last_payment`(confirm route 38줄)에 있으니, **`paid_at ?? settings.last_payment.approvedAt`** 로 읽는다.

---

## 7. E-4 · 무료회원 리스트 — ★ 절대 삭제 금지

**[무료] 탭** = `status in ('trial','expired')`.

열: 상호명 · 홈페이지 · **D-14 카운트다운** · 만료일 · 완성도 · 연락처 · [연장] · [다시 공개] · [메모]

### D-14 카운트다운

`lib/trial.ts` 의 `trialInfo()` 를 그대로 쓴다(이미 `page.tsx:66` 에서 쓰고 있다).
`D-3` 이하 빨강 · `D-1` 이하 굵은 빨강 · 만료는 회색 "만료 n일 경과".

### ★★ 정책 — 회장님 확정 (2026-09-06)

> ⛔ **폐기됨 (2026-09-06 최종 확정: 정지 후 60일 삭제).** 아래는 옛 지시다.
> ~~**"14일 지나도 절대 삭제 금지(고객 정보이므로). 공개 홈페이지만 비공개 처리.
> 전화·문자로 연락해서 결제하면 admin에서 수동으로 다시 열어줄 수 있어야 함."**

**코드는 이미 이 정책대로다.** 새로 만들 것은 "다시 열기" 하나뿐이다.

| 단계 | 지금 코드 | 상태 |
|---|---|---|
| 만료 판정 | `app/api/cron/expire/route.ts:49~55` → `update({status:'expired'})` | ✓ 매일 03:00 KST |
| 공개 차단 | RLS `sites_public_read using (status in ('trial','active'))` (`core.sql:113`) | ✓ |
| 데이터 삭제 | **어디에도 없다** — `delete` 하는 코드가 저장소에 0건 | ✓ 정책과 일치 |
| 에디터 차단 | `app/[slug]/edit/ui.tsx:300` | ✓ (문의함은 열려 있다 — 의도된 것) |
| **다시 열기** | **없다** | **← 이번에 만든다** |

⚠ **어드민에 "삭제" 버튼을 만들지 않는다.** 어떤 형태로도. 이 문장을 커밋 메시지에도 남긴다.

### [다시 공개] 버튼

```
status='expired' → 'active'  +  paid_at = now()  (수동 결제 확인)
```
또는
```
status='expired' → 'trial'   +  trial_ends_at = now + n일   (무료 연장)
```

두 가지를 한 버튼에 섞지 않는다. **버튼 2개**:

| 버튼 | 하는 일 | 확인 |
|---|---|---|
| **[결제 확인 · 정회원으로]** | `status='active'`, `paid_at=now()`. 메모에 `2026-09-06 수동 결제 확인 (운영자)` 자동 추가 | "돈을 받으셨나요?" 한 번 묻는다 |
| **[무료 n일 연장]** | `status='trial'`, `trial_ends_at = max(now, 기존) + n일`. 메모에 자동 기록. n 은 7·14·30 중 선택 | 바로 실행 |

### 이벤트 오퍼 (E-4)

회장님 예시: "1달 무료로 연장해드릴 테니 정회원 전환해주세요".

**[무료 30일 연장]** 이 곧 그 기능이다. 별도 오퍼 시스템을 만들지 않는다.

> ⚠ 2026-09-06 **최종** 확정(월 49,000원 구독 · **30일 무료** · 정지 · **정지 후 60일 삭제**)에 맞춰 재검토 필요. 정책 단일 출처: `lib/trial.ts`.
연장 뒤 화면에 "문자 보내기" 링크를 띄워 준다 — 눌러도 자동 발송하지 않고
**문구를 복사**해 준다(운영자가 직접 보낸다. 자동 문자는 요금과 오발송 위험이 있다):

```
{상호명} 사장님, 온스토리입니다. 무료 기간을 30일 더 열어 드렸어요.
onstori.com/{slug} 에서 그대로 이어서 쓰시면 됩니다.
```

### 새 API — `app/api/admin/member/route.ts` (신규 1개)

기존 `app/api/admin/showcase/route.ts` 패턴을 그대로 따른다(맨 첫 줄 `isAdmin()` 게이트).

| 메서드 | 하는 일 | 본문 |
|---|---|---|
| `PATCH` | 메모·이름·블랙리스트 저장 | `{ siteId, memo?, contactName?, blacklisted?, blacklistReason? }` → `member_admin` upsert |
| `POST` | 상태 변경 | `{ siteId, action: 'activate' \| 'extend', days? }` |

⚠ `DELETE` 를 **만들지 않는다.**
⚠ `action` 은 서버에서 화이트리스트로만 받는다(규칙 4). 클라이언트가 보낸 `status` 문자열을 그대로 쓰지 않는다.
⚠ `extend` 의 `days` 는 **7·14·30 만** 허용. 임의 숫자를 받지 않는다.
⚠ 상태 변경은 **메모에 자동으로 한 줄 남긴다.** 돈이 걸린 조작은 기록이 있어야 한다.

---

## 8. E-4-부속 · 온스토리 홈페이지 섹션 관리

**회장님 확정 ② — 온스토리 자체 사이트만, 토글만.**

### 새 화면 — `app/admin/pages/page.tsx` (신규)

`/admin` 콘솔(`app/admin/page.tsx:10~21` `menus` 배열)에 한 줄 추가:

```ts
{ href: "/admin/pages", title: "온스토리 홈페이지 관리", desc: "페이지별 섹션 보이기·가리기", ready: true },
```

화면 구조 (회장님이 그리신 그대로):

```
첫 페이지  (/)
  ├ 히어로 — 홈페이지는 빈 집입니다              [보임]  (수정하기 — 준비 중)
  ├ 채널 띠 — 한 번 말하면 6곳                   [보임]  (수정하기 — 준비 중)
  ├ …
  └ 스토리 페이지 들여다보기                     [가림]  (수정하기 — 준비 중)
```

- `[보임/가림]` 토글 = `page_sections.visible` — `app/[slug]/edit/widgets-panel.tsx:37` 의 `Toggle` 을 그대로 재사용한다(같은 모양).
- **[수정하기] 버튼은 회색 비활성**으로 두고 툴팁 "다음 단계에서 열립니다". 회장님이 그림에 그리신 자리를 비워 두지 않는다.

### 첫 페이지가 이 값을 읽는 법

`app/page.tsx` 는 이미 `export const dynamic = "force-dynamic"`(9줄)이라 요청마다 서버에서 돈다. DB 한 번 더 읽어도 된다.

```ts
// lib/page-sections.ts (신규)
import { sbAdmin } from "@/lib/db-admin";
/** 온스토리 본사 페이지의 섹션 노출. DB 가 안 닿으면 전부 보이게 한다 — 화면이 비는 것보다 낫다. */
export async function sectionsOf(page: string): Promise<Set<string>> {
  try {
    const { data } = await sbAdmin().from("page_sections").select("key, visible").eq("page", page);
    return new Set((data ?? []).filter((r) => !r.visible).map((r) => r.key as string));
  } catch { return new Set(); }
}
```

`app/page.tsx` 에서:

```ts
const hidden = await sectionsOf("/");
…
{!hidden.has("inside") && ( <section id="inside"> … </section> )}
```

⚠ **A 스프린트에서 넣은 `const SHOW_INSIDE = false` 를 이걸로 교체한다.** 두 스위치가 공존하면 안 된다.
⚠ 실패 시 `Set()` 을 돌려 **전부 보이게** 한다. DB 장애로 첫 페이지가 텅 비면 더 큰 사고다.
⚠ 이번엔 **첫 페이지(`/`)만** 배선한다. 나머지 페이지는 `page_sections` 에 행을 넣어 두되 화면 배선은 다음 차례
   (한 커밋에 6개 페이지를 다 건드리면 검증이 안 된다).

---

## 9. E-5 · 회장님이 "참고만" 하라신 제안 — 기술참모 판정

| 제안 | 지금 가능? | 판정 |
|---|---|---|
| 회원별 **마지막 로그인** | `auth.users.last_sign_in_at` 에 있다 — `listUsers()`(page.tsx:34)가 이미 받아 온다 | **넣자.** 열 하나. 공짜다 |
| 회원별 **마지막 편집일** | `sites.updated_at` 에 있다 | **넣자.** 열 하나. 공짜다 |
| **완성도 점수** | 이미 있다 | 이미 됨 |
| 회원별 **받은 문의 건수** | `inquiries` 표 있음 (`20260904020000_inquiries_g1.sql`) — `count group by site_id` 한 번 | **넣자.** 쿼리 한 줄 |
| **알림 발송 이력·실패** | `lib/notify.ts` 가 **DB 에 남기지 않는다.** 기록부터 만들어야 한다 | **미룬다.** E-2 와 같은 성격의 별건 |
| **이름/전화/상태 빠른 검색·필터** | 데이터 다 있음 | **넣자.** 클라이언트 필터, 반나절 |
| **엑셀 다운로드** | 라이브러리 없이 CSV 로 충분 | **넣자.** 단 ⚠ **아래 경고** |

⚠ **엑셀/CSV 다운로드 경고:** 이 파일에는 **고객 이름·전화번호·주소가 들어간다.**
   내려받는 순간 개인정보가 회장님 PC 로 나간다(분실·유출 시 책임이 회사에 남는다).
   → 파일명에 날짜를 박고(`onstori-회원_2026-09-06.csv`), 다운로드 버튼 옆에 한 줄 경고를 붙인다.
   → **블랙리스트 사유·메모는 CSV 에 넣지 않는다.** 그건 화면에서만 본다.

**옛 기획서의 "대시보드 — 가입·생성·발행·활성 퍼널, 오늘 신청 수, AI 비용 요약"**:
회장님이 보내주신 아임웹 대시보드 캡처(요약 카드 3개 + 통계 + 우측 만료일 D-14)가 그 모양이다.
**이번 E 에 넣지 않는다** — 회원 관리와 지표 대시보드는 화면도 데이터도 다르다.
E 가 끝나고 `/admin` 첫 화면을 그 모양으로 만드는 별도 작업으로 다룬다.

---

## 10. 파일 목록

| 파일 | 신규/수정 | 내용 |
|---|---|---|
| `supabase/migrations/20260906030000_admin_members.sql` | 신규 | 표 3개 (번들에 완성본 있음) |
| `app/admin/members/page.tsx` | 수정 | 데이터 조회만 남기고 표를 `table.tsx` 로 넘긴다 |
| `app/admin/members/table.tsx` | 신규 | `"use client"` — 탭·정렬·필터·메모·블랙리스트·버튼 |
| `app/api/admin/member/route.ts` | 신규 | `PATCH`(메모) · `POST`(activate·extend). **DELETE 없음** |
| `app/api/billing/confirm/route.ts` | 수정 | 성공·실패를 `payment_attempts` 에 기록 (2곳) |
| `app/admin/pages/page.tsx` | 신규 | 섹션 보이기/가리기 |
| `app/api/admin/page-sections/route.ts` | 신규 | `PATCH` — `visible` 토글 |
| `lib/page-sections.ts` | 신규 | `sectionsOf(page)` |
| `app/page.tsx` | 수정 | `SHOW_INSIDE` 상수 → `sectionsOf("/")` |
| `app/admin/page.tsx` | 수정 | 메뉴에 "온스토리 홈페이지 관리" 한 줄 |

---

## 11. 완료 조건

1. `npm run build` 성공 · ESLint 경고 0.
2. `npx supabase db reset` 로컬 검증 통과 (규칙 1).
3. `/admin/members` 에 탭 4개(전체·정회원·무료·결제 실패)가 있다.
4. 가입일 헤더를 누르면 정렬이 바뀌고 ▲▼ 가 뒤집힌다.
5. 행을 누르면 상세가 펼쳐지고, 메모 20,000자를 넣고 [저장] 하면 새로고침 후에도 남아 있다.
6. 블랙리스트를 켜면 그 행이 빨갛고, 위 요약에 개수가 뜨고, [블랙리스트만] 필터가 동작한다.
7. **무료 탭에 삭제 버튼이 없다.** `grep -rn "delete" app/admin app/api/admin/member` 에 사이트 삭제가 **0건**.
8. 만료된 사이트에 [무료 30일 연장]을 누르면 → `status='trial'`, D-30 으로 바뀌고 **공개 사이트가 다시 열린다**(RLS 확인).
9. [결제 확인 · 정회원으로]를 누르면 `status='active'`, `paid_at` 이 채워지고 **메모에 자동 기록**이 남는다.
10. 사장님 계정으로 에디터를 열고 개발자도구 네트워크 탭을 봐도 **메모·블랙리스트가 어디에도 없다**(`/api/site/get` 응답 확인).
11. `/admin/pages` 에서 "스토리 페이지 들여다보기"를 [보임]으로 켜면 첫 페이지에 그 섹션이 다시 나온다.
12. `app/page.tsx` 에 `SHOW_INSIDE` 가 **남아 있지 않다.**
13. DB 를 끊고 첫 페이지를 열면 **모든 섹션이 보인다**(빈 화면이 아니다).
14. 운영자 인증 없이 `/api/admin/member` 에 `POST` 하면 **401**.

---

## 12. 이번 범위 밖

- **섹션 [수정하기] — 내용 편집 CMS**. 별도 스프린트(기획2에 항목으로 올린다).
- **정기결제(빌링키)** 구현. E-2 는 "실패를 기록하고 보여주는" 것까지다.
- **알림(SMS·이메일) 발송 이력** — `lib/notify.ts` 에 기록 자체가 없다. 별건.
- **`/admin` 첫 화면 지표 대시보드**(퍼널·오늘 신청 수·AI 비용). 별건.
- **운영자 인증 교체**(ADMIN_KEY → 화이트리스트) — P7 이월 항목이다. 이번에 건드리지 않는다.
- **블랙리스트로 사이트 차단** — 확정 ③ 에 따라 만들지 않는다. 표시만.
- `data-tour` 앵커 추가 — 어드민 화면에는 지금도 앵커가 하나도 없고 어드민 투어가 없다. 새로 만들지 않는다.

---

## 13. 커밋 — 2개로 나눈다

한 커밋에 넣기엔 크다. 검증 단위로 자른다.

```
feat: 어드민 회원 관리 — 메모·블랙리스트·정렬·탭·수동 재공개

- member_admin·payment_attempts 표 (RLS 정책 0개 = service_role 전용).
  메모는 sites.settings 에 넣지 않는다 — /api/site/get 이 사장님에게 통째로 내려준다
- /admin/members 를 서버(조회)+클라이언트(표)로 분리, 탭 4개·정렬·필터·CSV
- [무료 n일 연장] · [결제 확인 · 정회원으로] — 상태 변경은 메모에 자동 기록
- ~~★ 삭제 버튼은 만들지 않는다. 14일이 지나도 고객 자료는 지우지 않는다~~ ⛔ **폐기됨** — 2026-09-06 최종 확정으로 **정지 후 60일에 자동 삭제**한다(예고 2회 필수). DECISIONS 참조
- 토스 결제 성공·실패를 payment_attempts 에 기록

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

```
feat: 온스토리 홈페이지 섹션 보이기·가리기 (/admin/pages)

- page_sections 표 + lib/page-sections.ts (DB 실패 시 전부 보임)
- 첫 페이지의 SHOW_INSIDE 상수를 DB 토글로 교체
- '스토리 페이지 들여다보기' 기본 가림

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
