# Supabase Auth 설정 체크리스트 (대시보드 전용 — 운영자 담당)

P4 로그인(카카오 OAuth + 이메일 인증번호)이 동작하려면 아래 대시보드 설정이 필요하다.
코드는 이미 들어가 있고, 이 설정 전까지 `/login`은 "메일 발송 실패 / 카카오 시작 실패"로 동작하지 않는다.
완료하면 각 항목 체크 + DECISIONS.md에 한 줄 기록(불변 규칙 1).

Supabase 프로젝트: https://supabase.com/dashboard/project/wpsrfjqfbhmeriscdacu

## 1. 카카오 개발자 앱 (https://developers.kakao.com)

> **이 절은 2026-09-01에 방식이 바뀌었다.** Supabase의 카카오 프로바이더 경로(`/auth/v1/authorize`)는 쓰지 않는다 —
> scope에 `account_email`이 하드코딩돼 있고 요청 scope는 덧붙기만 되어서(실측), 이메일 동의항목을 못 켜는 개인 앱은
> **KOE205**로 막힌다. 대신 앱이 카카오 authorize를 직접 열고(`/auth/kakao`) 콜백에서 id_token으로 세션을 만든다(`lib/kakao.ts`).
>
> ⚠ **그래도 Supabase의 카카오 프로바이더는 켠 채로 둘 것** — `signInWithIdToken`이 id_token의 `aud`를
> 프로바이더에 설정된 Client ID와 대조한다. 끄거나 Client ID를 바꾸면 카카오 로그인이 통째로 죽는다.

- [x] 애플리케이션 생성 (앱 이름: 온스토리)
- [x] 앱 키 → **REST API 키** = `KAKAO_REST_API_KEY` (Supabase 프로바이더의 Client ID와 같은 값)
- [x] 보안 탭 → **Client Secret** 생성·활성화
- [x] 제품 설정 → 카카오 로그인 **활성화(ON)**
- [x] 제품 설정 → 카카오 로그인 → **OpenID Connect 활성화(ON)** ← **새로 필요.** 없으면 `scope=openid`가 거부돼 id_token이 안 나온다
- [x] Redirect URI **추가** ← **새로 필요.** 이제 카카오가 우리 도메인으로 직접 돌려보낸다
  - `https://onstori.com/auth/callback`
  - `http://localhost:3000/auth/callback` (로컬 테스트용)
  - 기존 `https://wpsrfjqfbhmeriscdacu.supabase.co/auth/v1/callback`은 지우지 않아도 무해
- [x] 동의항목: **닉네임(profile_nickname) 선택 동의 ON**. 이메일은 요청하지 않으므로 비즈 앱 전환 불필요
- ⚠ 카카오는 redirect_uri·scope 오류를 **로그인 화면 다음에** 낸다(2026-09-01 실측: 등록도 안 한 URI로도 로그인 화면까지는 뜬다). 즉 설정 누락은 **실제 로그인 시도로만** 확인된다

## 2. 환경변수 (`.env.local` + Vercel Production)

| 변수 | 값 | 비고 |
|---|---|---|
| `KAKAO_REST_API_KEY` | 카카오 앱 키 → REST API 키 | authorize URL에 그대로 실려나가는 공개 식별자 |
| `KAKAO_CLIENT_SECRET` | 카카오 보안 탭 → Client Secret | 콘솔에서 시크릿을 "사용함"으로 켜뒀다면 **토큰 교환에 필수** |

- [x] `.env.local` — `KAKAO_REST_API_KEY` 기입
- [x] `.env.local` — `KAKAO_CLIENT_SECRET` 기입
- [x] **Vercel** Production에 두 변수 등록 (없으면 프로덕션에서 카카오 버튼이 `/login?error=auth`로 되돌아온다)

## 3. Supabase — Site URL / Redirect URL

- [x] Authentication → URL Configuration → Site URL: `https://onstori.com` (2026-09-01 실측 확인)
- [ ] Redirect URLs: `https://onstori.com/auth/callback`, `http://localhost:3000/auth/callback`
  - 카카오는 이제 이 목록을 타지 않는다(우리가 직접 콜백을 받는다). 이메일 링크 등 다른 흐름을 위해 남겨두는 값

## 4. Supabase — 이메일 인증번호(OTP) 템플릿

앱은 매직링크가 아니라 **숫자 인증번호**(`verifyOtp type: 'email'`)를 쓴다.

⚠ **자릿수는 고정이 아니다.** Authentication → Providers → Email의 **Email OTP Length**로 6~10자리를 정한다. 이 프로젝트는 현재 **8자리**(2026-09-01 실측). 그래서 `app/login/ui.tsx`는 자릿수를 하드코딩하지 않고 6~10자리를 받는다 — 대시보드 설정만 바꿔도 로그인이 막히는 걸 피하려는 것.

**메일 종류를 가르는 건 템플릿 내용이다** — 템플릿에 `{{ .ConfirmationURL }}`이 있으면 **링크**가, `{{ .Token }}`이 있으면 **인증번호**가 나간다. 기본 템플릿은 전부 링크형이라 교체해야 한다.

⚠ **템플릿 2개를 모두 고쳐야 한다.** Supabase는 상황에 따라 다른 템플릿을 쓴다:

| 상황 | 쓰이는 템플릿 |
|---|---|
| **처음 보는 이메일** (신규 가입 — `shouldCreateUser: true`라 계정이 새로 만들어짐) | **Confirm sign up** |
| 이미 가입된 이메일로 로그인 | **Magic Link** |

초기에는 **모든 사용자가 신규**라 Confirm sign up만 타게 된다. 이것만 빠뜨리면 "Confirm your email address" 링크 메일이 가고, 앱은 인증번호를 기다리므로 로그인이 불가능하다. (2026-09-01 실제로 이 증상 발생)

- [ ] Authentication → Emails → **Confirm sign up** 템플릿 교체 ← **가장 중요**
- [ ] Authentication → Emails → **Magic Link** 템플릿 교체 (재로그인용)
- 두 템플릿 모두 아래 내용으로:
  - 제목: `온스토리 인증번호: {{ .Token }}`
  - 본문:
    ```html
    <h2>온스토리 로그인 인증번호</h2>
    <p>아래 인증번호를 로그인 화면에 입력해주세요.</p>
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

- [x] **처음 쓰는 이메일**로 `/login` → 인증번호 메일이 오는지 (링크 메일이 오면 Confirm sign up 템플릿 미교체) — 2026-09-01 통과
- [x] **같은 이메일로 다시** `/login` → 이번에도 인증번호인지 (Magic Link 템플릿 확인) — 2026-09-01 통과
- [ ] 시크릿 창에서 `/login` → 이메일 코드 로그인 → 남의 사이트 `/barun-electric/edit` 접근이 "수정 권한이 없어요"인지 (차단 확인)
- [ ] 로그인 상태로 `/new` 생성 → 다른 브라우저에서 같은 계정 로그인 → 그 사이트 편집 가능한지 (owner_id 귀속)
- [ ] 로그아웃 상태로 생성 → 같은 브라우저에서 `/login` 로그인 → 그 사이트가 계정에 귀속되는지 (anon claim)
- [x] 카카오 버튼 → `/auth/kakao` → 동의(닉네임만) → `/auth/callback` 복귀 → 로그인 완료 — 2026-09-01 통과(`iss=kauth.kakao.com`, 중복 계정 없음, claim 정상)
  - 실패 시 `/login?error=auth`로 되돌아온다. 원인은 **Vercel 함수 로그의 `[kakao]` 줄**을 볼 것 (KOE205=OpenID Connect 미활성/동의항목, KOE006=Redirect URI 미등록, `invalid_client`=시크릿 불일치)
