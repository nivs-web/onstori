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

앱은 매직링크가 아니라 **6자리 코드**(`verifyOtp type: 'email'`)를 쓴다. 기본 Magic Link 템플릿은 링크만 보내므로 코드가 보이게 교체해야 한다.

- [ ] Authentication → Emails → **Magic Link** 템플릿 교체
  - 제목 예: `온스토리 인증번호: {{ .Token }}`
  - 본문 예:
    ```html
    <h2>온스토리 로그인 인증번호</h2>
    <p>아래 6자리 숫자를 로그인 화면에 입력해주세요.</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
    <p>본인이 요청하지 않았다면 이 메일은 무시해도 됩니다.</p>
    ```
  - `{{ .ConfirmationURL }}` 링크는 필요 없음
- [ ] 참고: 기본(내장) SMTP는 시간당 발송 제한이 매우 낮아 테스트용. **실사용 전 커스텀 SMTP(Resend 등) 연결 검토** — 공개 홍보 전 결정

## 5. 완료 후 검증 시나리오 (E2E)

- [ ] 시크릿 창에서 `/login` → 이메일 코드 로그인 → 남의 사이트 `/barun-electric/edit` 접근이 "수정 권한이 없어요"인지 (차단 확인)
- [ ] 로그인 상태로 `/new` 생성 → 다른 브라우저에서 같은 계정 로그인 → 그 사이트 편집 가능한지 (owner_id 귀속)
- [ ] 로그아웃 상태로 생성 → 같은 브라우저에서 `/login` 로그인 → 그 사이트가 계정에 귀속되는지 (anon claim)
- [ ] 카카오 버튼 → 동의 → `/auth/callback` 복귀 → 로그인 완료되는지
