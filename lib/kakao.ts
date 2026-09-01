/**
 * 카카오 OIDC 직결 로그인 — Supabase의 카카오 프로바이더(`/auth/v1/authorize`)를 쓰지 않는다.
 *
 * 이유: 그 경로는 scope에 `account_email`이 하드코딩돼 있고 요청 scope는 덧붙기만 된다(실측).
 * 이메일 동의항목은 비즈 앱 전환 없이는 못 켜서 카카오가 KOE205로 막는다.
 * 그래서 authorize URL을 직접 만들어 `openid`+닉네임만 요청하고, 받은 id_token으로
 * `signInWithIdToken`(Supabase가 카카오 id_token을 정식 지원)으로 세션을 만든다.
 */

/** state(CSRF) + 로그인 후 복귀 경로를 담는 httpOnly 쿠키 */
export const KAKAO_COOKIE = "onstori_kakao";

/** 이메일은 요청하지 않는다. openid = id_token 발급 조건 */
export const KAKAO_SCOPE = "openid profile_nickname";

const AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
const TOKEN = "https://kauth.kakao.com/oauth/token";

/** 카카오 콘솔에 등록한 Redirect URI와 문자열이 정확히 같아야 한다 — 그래서 쿼리를 붙이지 않는다(next는 쿠키로 나른다) */
function redirectUri(origin: string) {
  return `${origin}/auth/callback`;
}

/** 동의 화면 URL. 키가 없으면 null */
export function kakaoAuthorizeUrl(origin: string, state: string): string | null {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    console.error("[kakao] KAKAO_REST_API_KEY 없음");
    return null;
  }
  const u = new URL(AUTHORIZE);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri(origin));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", KAKAO_SCOPE);
  u.searchParams.set("state", state);
  return u.toString();
}

/** code → id_token 교환. 실패 원인은 서버 로그로만 남긴다(사용자에겐 일반 메시지) */
export async function kakaoIdToken(
  code: string,
  origin: string,
): Promise<{ idToken: string; accessToken?: string } | null> {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) return null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    code,
  });
  // 콘솔에서 Client Secret을 활성화했으면 필수, 아니면 보내지 않는다
  const secret = process.env.KAKAO_CLIENT_SECRET;
  if (secret) body.set("client_secret", secret);

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const json = (await res.json().catch(() => null)) as
    | { id_token?: string; access_token?: string; error?: string; error_description?: string }
    | null;

  if (!res.ok || !json?.id_token) {
    console.error("[kakao] token 교환 실패", res.status, json?.error, json?.error_description);
    return null;
  }
  return { idToken: json.id_token, accessToken: json.access_token };
}
