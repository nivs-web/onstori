# Supabase Auth 설정 체크리스트 (대시보드 전용 — 운영자 담당)

P4 로그인(카카오 OAuth + 이메일 6자리 인증번호)이 동작하려면 아래 대시보드 설정이 필요하다.
코드는 이미 들어가 있고, 이 설정 전까지 `/login`은 "메일 발송 실패 / 카카오 시작 실패"로 동작하지 않는다.
완료하면 각 항목 체크 + DECISIONS.md에 한 줄 기록(불변 규칙 1).

Supabase 프로젝트: https://supabase.com/dashboard/project/wpsrfjqfbhmeriscdacu

## 1. 카카오 개발자 앱 (https://developers.kakao.com)

- [ ] 애플리케이션 생성 (앱 이름: 온스토리)
- [ ] 앱 키 → **REST API 키** 복사 (= Supabase의 Client ID)
- [ ] 보안 탭 → **Client Secret** 생성·활성화 후 복사
- [ ] 제품 설정 → 카카오 로그인 **활성화(ON)**
- [ ] Redirect URI 등록: `https://wpsrfjqfbhmeriscdacu.supabase.co/auth/v1/callback`
- [ ] 동의항목: 닉네임(선택 동의). **이메일 수집은 비즈 앱 전환 필요** — 없어도 로그인은 동작(계정 식별은 카카오 ID)

## 2. Supabase — 카카오 프로바이더

- [ ] Authentication → Sign In / Providers → **Kakao 활성화**
- [ ] Client ID = REST API 키, Client Secret = 위에서 만든 시크릿

## 3. Supabase — Redirect URL

- [ ] Authentication → URL Configuration
  - Site URL: `https://onstori.com`
  - Redirect URLs 추가: `https://onstori.com/auth/callback`, `http://localhost:3000/auth/callback`

## 4. Supabase — 이메일 인증번호(OTP) 템플릿

앱은 매직링크가 아니라 **6자리 코드**(`verifyOtp type: 'email'`)를 쓴다.

**메일 종류를 가르는 건 템플릿 내용이다** — 템플릿에 `{{ .ConfirmationURL }}`이 있으면 **링크**가, `{{ .Token }}`이 있으면 **6자리 코드**가 나간다. 기본 템플릿은 전부 링크형이라 교체해야 한다.

⚠ **템플릿 2개를 모두 고쳐야 한다.** Supabase는 상황에 따라 다른 템플릿을 쓴다:

| 상황 | 쓰이는 템플릿 |
|---|---|
| **처음 보는 이메일** (신규 가입 — `shouldCreateUser: true`라 계정이 새로 만들어짐) | **Confirm sign up** |
| 이미 가입된 이메일로 로그인 | **Magic Link** |

초기에는 **모든 사용자가 신규**라 Confirm sign up만 타게 된다. 이것만 빠뜨리면 "Confirm your email address" 링크 메일이 가고, 앱은 6자리 코드를 기다리므로 로그인이 불가능하다. (2026-09-01 실제로 이 증상 발생)

- [ ] Authentication → Emails → **Confirm sign up** 템플릿 교체 ← **가장 중요**
- [ ] Authentication → Emails → **Magic Link** 템플릿 교체 (재로그인용)
- 두 템플릿 모두 아래 내용으로:
  - 제목: `온스토리 인증번호: {{ .Token }}`
  - 본문:
    ```html
    <h2>온스토리 로그인 인증번호</h2>
    <p>아래 6자리 숫자를 로그인 화면에 입력해주세요.</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
    <p>본인이 요청하지 않았다면 이 메일은 무시해도 됩니다.</p>
    ```
  - **`{{ .ConfirmationURL }}`은 반드시 지울 것** — 남아 있으면 코드 대신 링크가 나간다
- 참고: `verifyOtp`의 `type`은 신규·기존 모두 `'email'`이 맞다. 가입/로그인에 따라 바꿀 필요 없음
- ⚠ **템플릿 편집 화면은 커스텀 SMTP를 붙여야 열린다.** 아래 4-1을 먼저 할 것.

## 4-1. 커스텀 SMTP = Resend (무료 티어)

기본(내장) SMTP는 **시간당 2통**이라 테스트도 안 되고 템플릿 편집도 잠긴다. Resend 무료 티어(월 3,000통 / 일 100통 / 도메인 3개)면 초기 규모에 충분하다.

**① Resend 가입 + 도메인 인증**
- [ ] https://resend.com 가입
- [ ] Domains → Add Domain → `onstori.com`
- [ ] 화면에 뜨는 DNS 레코드(SPF TXT · DKIM TXT · MX)를 **onstori.com의 DNS에 추가**
  - 도메인이 Vercel에 붙어 있으니 네임서버가 어디인지부터 확인(Vercel DNS인지 등록기관인지)
  - 전파에 보통 몇 분~1시간. Resend 화면이 **Verified**로 바뀌어야 다음 단계
- 루트 도메인(`onstori.com`)으로 인증하면 발신 주소가 `noreply@onstori.com`이 되어 신뢰도가 높다. 나중에 이 도메인에 Google Workspace 등 메일을 붙이면 **SPF 레코드를 병합**해야 한다(TXT 2개 두면 안 됨)

**② API 키 발급**
- [ ] API Keys → Create API Key → 권한 **Sending access**
- [ ] `re_`로 시작하는 키 복사 — 이게 SMTP 비밀번호다. **저장소·문서에 쓰지 말 것**(불변 규칙 6), Supabase 대시보드에만 입력

**③ Supabase SMTP 설정** — https://supabase.com/dashboard/project/wpsrfjqfbhmeriscdacu/auth/smtp

| 항목 | 값 |
|---|---|
| Enable Custom SMTP | 켜기 |
| Sender email | `noreply@onstori.com` (인증한 도메인이어야 함) |
| Sender name | `온스토리` |
| Host | `smtp.resend.com` |
| Port | `465` (암호화 즉시 연결). STARTTLS를 쓰려면 `587` |
| Username | `resend` ← 계정 이메일이 아니라 이 리터럴 문자열 |
| Password | 위 `re_...` API 키 |

**④ 발송 한도 올리기 (놓치기 쉬움)**
- [ ] 커스텀 SMTP를 붙이면 Supabase가 평판 보호용으로 **시간당 30통**으로 묶는다
- [ ] Authentication → Rate Limits에서 필요한 값으로 상향. 초기엔 30통도 충분하지만 당근 홍보로 가입이 몰리면 막힌다

**⑤ 확인**
- [ ] SMTP 저장 후 `/login`에서 본인 이메일로 인증번호 받아보기
- [ ] 위 4의 템플릿 편집 화면이 열리는지 (SMTP 연결 후 잠금 해제)
- [ ] 메일이 스팸함으로 가면 DKIM·SPF 인증 상태부터 재확인

## 5. 완료 후 검증 시나리오 (E2E)

- [ ] **처음 쓰는 이메일**로 `/login` → 6자리 코드 메일이 오는지 (링크 메일이 오면 Confirm sign up 템플릿 미교체)
- [ ] **같은 이메일로 다시** `/login` → 이번에도 6자리 코드인지 (Magic Link 템플릿 확인)
- [ ] 시크릿 창에서 `/login` → 이메일 코드 로그인 → 남의 사이트 `/barun-electric/edit` 접근이 "수정 권한이 없어요"인지 (차단 확인)
- [ ] 로그인 상태로 `/new` 생성 → 다른 브라우저에서 같은 계정 로그인 → 그 사이트 편집 가능한지 (owner_id 귀속)
- [ ] 로그아웃 상태로 생성 → 같은 브라우저에서 `/login` 로그인 → 그 사이트가 계정에 귀속되는지 (anon claim)
- [ ] 카카오 버튼 → 동의 → `/auth/callback` 복귀 → 로그인 완료되는지
