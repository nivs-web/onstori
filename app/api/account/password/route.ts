import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sbServer } from "@/lib/supabase/server";
import { sbAdmin } from "@/lib/db-admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { PW_MIN } from "@/config/password";

/**
 * 🔴🔴 **비밀번호 바꾸기 — «지금 비밀번호»를 물어야 하는 자리.** (2026-09-17 지시 [41])
 *
 * ## 무엇이 뚫려 있었나
 *
 * `/login/new-password` 는 원래 **「비밀번호 찾기」**(메일 링크로 들어온 사람) 화면이라
 * **지금 비밀번호를 안 묻는 것이 «정상»**이었다. 그런데 [34] 에서 마이페이지의
 * **「비밀번호 바꾸기」가 그 화면을 그대로 재사용**했다(`app/my/ui.tsx`).
 *
 * ⇒ **로그인한 채 자리를 비우면, 남이 마이페이지에서 비밀번호를 바꿔 계정을 통째로 가져간다.**
 *   대표님은 여러 PC 를 쓰시고 원격으로도 접속하신다 — 실제 위험이다.
 *
 * ## 🔴 왜 «서버»에서 막는가
 *
 * 화면에서만 물으면 **개발자도구로 그 칸을 건너뛰면 그만**이다. 자물쇠는 여기 하나뿐이고,
 * 화면(`new-password/ui.tsx`)은 **그 판정을 «보여 주기만»** 한다.
 * ⇒ 바꾸는 길은 **이 라우트 하나**다. 화면이 `sb.auth.updateUser({password})` 를 직접 부르지 않는다.
 *
 * ## 「지금 비밀번호」를 안 묻는 경우가 «둘» 있다 — 둘 다 물을 «수가» 없는 경우다
 *
 * | 언제 | 왜 안 묻나 |
 * |---|---|
 * | **메일 링크로 들어온 세션**(비밀번호 찾기) | 잊어버려서 온 사람이다. 물으면 **영영 못 바꾼다** |
 * | **카카오로만 시작한 분** | 비밀번호를 **만든 적이 없다.** 물으면 무엇을 넣어도 틀린다 |
 *
 * 🔴 **그 판정을 «주소나 화면이 준 값»으로 하지 않는다.** 그러면 공격자가 그 값을 붙여
 *   물음을 건너뛴다. **세션 토큰 안의 `amr`**(이 세션이 «무엇으로» 만들어졌나)을 본다 —
 *   그건 Supabase 가 서명한 값이라 **브라우저에서 못 고친다.**
 *
 * ⚠⚠ **못 잰 것:** 메일이 실제로 안 나가는 환경이라(SMTP 미설정 · `WAITING.md` 맨 위)
 *   **진짜 복구 링크로는 한 번도 못 들어와 봤다.** `amr` 의 값이 `recovery` 라는 것은
 *   GoTrue 의 규칙을 읽고 쓴 것이지 **실측이 아니다.**
 *   ⇒ 그래서 ①**모르는 값이면 «묻는» 쪽으로** 기울이고(안전한 쪽) ②`amr` 을 로그에 남긴다.
 *     첫 진짜 복구 때 `pw_change_amr` 한 줄을 보면 답이 나온다.
 */
export const dynamic = "force-dynamic";

/**
 * 🔴🔴 **이 세션이 «메일함을 연 사람»이 만든 것인가.** — **실측해서 정했다** (2026-09-17)
 *
 * ⚠⚠ **처음에는 `"recovery"` 하나만 넣었다가 틀렸다.** GoTrue 문서를 읽고 지은 값이었다.
 *   메일을 «보내지 않고» 복구 링크만 받아(`admin/generate_link`) 그 링크와 **똑같은 확인 절차**
 *   (`/auth/v1/verify` · `type=recovery`)를 밟아 토큰을 열어 보니 —
 *
 * ```
 * 복구 세션의 amr = [{"method":"otp","timestamp":...}]      ← "recovery" 가 «아니다»
 * 비밀번호 로그인  = [{"method":"password","timestamp":...}]
 * ```
 *
 * 🔴 **그대로 냈으면 비밀번호를 «잊은» 사장님에게 「지금 비밀번호를 넣으세요」라고 물어
 *   영영 못 바꾸게 만들 뻔했다.** 지금 메일이 안 나가는 환경이라(SMTP 미설정) **아무도
 *   못 밟아 보는 길**이었다 — 그래서 더 위험했다.
 *
 * ★ `"recovery"` 도 함께 둔다(GoTrue 가 나중에 이름을 바꿔도 안 깨지게).
 * ⚠ **`"otp"` 는 심사용 로그인(`/login/review`)도 만든다** — 그 세션은 지금 비밀번호를 안 묻는다.
 *   그 계정은 심사관 전용이고, 그 길 자체가 서버 열쇠(`REVIEW_*`)로 잠겨 있어 손님 계정과는 상관없다.
 * 🔴 **손님 계정을 노리는 사람은 여기 못 온다** — `otp` 세션을 만들려면 **그 메일함을 열 수 있어야** 한다.
 */
const RECOVERY_METHODS = new Set(["recovery", "otp", "magiclink"]);

type Amr = { method?: string; timestamp?: number };

/**
 * 토큰 가운데 토막(payload)만 꺼내 `amr` 을 읽는다.
 * ⚠ **서명 검증은 여기서 하지 않는다** — 바로 위에서 `getUser(token)` 이
 *   **그 토큰 그대로** Supabase 에 물어 확인한 뒤에만 부른다.
 */
function amrOf(accessToken: string): Amr[] {
  try {
    const mid = accessToken.split(".")[1];
    if (!mid) return [];
    const json = Buffer.from(mid.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { amr?: Amr[] };
    return Array.isArray(claims.amr) ? claims.amr : [];
  } catch {
    return [];
  }
}

/** 가장 «나중에» 쓰인 방법. 없으면 빈 문자열 — 그때는 묻는 쪽으로 간다 */
function latestMethod(amr: Amr[]): string {
  let best = "";
  let when = -1;
  for (const a of amr) {
    const t = typeof a.timestamp === "number" ? a.timestamp : 0;
    if (typeof a.method === "string" && t >= when) { best = a.method; when = t; }
  }
  return best;
}

type Who = {
  userId: string;
  email: string;
  accessToken: string;
  /** 「지금 비밀번호」를 물어야 하는가 */
  needsCurrent: boolean;
  /** 왜 그렇게 판정했나 — 화면 문구와 로그에 쓴다 */
  why: "recovery" | "no-password" | "signed-in";
  method: string;
};

async function whoAmI(): Promise<Who | null> {
  const sb = await sbServer();
  const { data: s } = await sb.auth.getSession();
  const token = s.session?.access_token;
  if (!token) return null;

  /* 🔴 **그 토큰 «그대로»를 Supabase 에 물어본다.** 쿠키를 손으로 고쳐 넣어도 여기서 걸린다 */
  const { data: u, error } = await sb.auth.getUser(token);
  const user = u?.user;
  if (error || !user) return null;

  const method = latestMethod(amrOf(token));

  /* 카카오로만 시작한 분에게는 «지금 비밀번호»가 아예 없다 —
     이메일 신원(identity)이 있어야 비밀번호가 있다 */
  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");

  const why: Who["why"] = RECOVERY_METHODS.has(method) ? "recovery" : !hasPassword ? "no-password" : "signed-in";
  return {
    userId: user.id,
    email: user.email ?? "",
    accessToken: token,
    needsCurrent: why === "signed-in",
    why,
    method,
  };
}

/** 화면이 «지금 비밀번호 칸을 띄울지»를 묻는 자리. 판정은 여전히 POST 가 다시 한다 */
export async function GET() {
  const me = await whoAmI();
  if (!me) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  return NextResponse.json({ needsCurrent: me.needsCurrent, why: me.why, minLength: PW_MIN });
}

export async function POST(req: Request) {
  const me = await whoAmI();
  if (!me) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  /**
   * ⚠ **무차별 대입을 막는다.** 이 칸은 「지금 비밀번호」를 받으므로,
   *   막지 않으면 **남의 비밀번호를 여기서 찍어 볼 수 있다.**
   *   ★ 사람(userId)과 IP 를 «둘 다» 센다 — IP 를 바꿔 가며 한 계정을 노리는 것을 막는다.
   */
  const ip = clientIp(req);
  for (const scope of [`pw-change:ip:${ip}`, `pw-change:user:${me.userId}`]) {
    const rl = await checkRateLimit(scope, ip, [
      { window: 600, max: 10, label: "10m" },
      { window: 86400, max: 60, label: "24h" },
    ]);
    if (!rl.ok) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string };
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  if (next.length < PW_MIN) {
    return NextResponse.json({ error: `비밀번호는 ${PW_MIN}자 이상으로 만들어 주세요.` }, { status: 400 });
  }

  /* 🔴 판정은 «화면이 뭐라 하든» 여기서 다시 한다 */
  if (me.needsCurrent) {
    const cur = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!cur) return NextResponse.json({ error: "지금 쓰시는 비밀번호를 넣어 주세요.", needsCurrent: true }, { status: 400 });

    /* ⚠ **지금 세션을 건드리지 않고** 맞는지만 본다 —
         쿠키를 쓰지 않는 «일회용» 클라이언트로 확인한다. 틀려도 로그인이 풀리지 않는다 */
    const probe = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    const { error } = await probe.auth.signInWithPassword({ email: me.email, password: cur });
    if (error) {
      /* ⚠ 비밀번호는 **로그에도 안 남긴다**(불변 규칙 6) */
      console.warn(JSON.stringify({ evt: "pw_change_bad_current", user: me.userId }));
      return NextResponse.json({ error: "지금 비밀번호가 맞지 않아요.", needsCurrent: true }, { status: 401 });
    }
    /* 확인만 하고 그 세션은 바로 버린다 */
    await probe.auth.signOut({ scope: "local" }).catch(() => {});
  }

  /**
   * 🔴🔴 **「운영자 열쇠」가 아니라 «사장님 자신의 세션»으로 바꾼다.** (2026-09-17 실측으로 정함)
   *
   * ⚠ 처음에는 `admin.updateUserById()`(운영자 열쇠)로 짰다. **실측해 보니**
   *   그 길은 **그 사람의 세션을 «전부» 날린다** — 바꾼 «이 브라우저»까지.
   *   그다음 줄의 「다른 기기 끊기」는 **`Auth session missing!`** 로 실패했다(이미 다 끊겨서).
   *   ⇒ 사장님은 비밀번호를 바꾸자마자 **영문도 모르고 로그아웃**된다.
   *
   * ★ 사장님 자신의 세션으로 부르면 **이 기기는 살아 있고**, 아래에서 **다른 기기만** 끊는다.
   *   그것이 권반장 지시 ②(「바꾼 뒤 다른 기기의 로그인을 끊는다」)의 뜻이다.
   * ⚠ 이 호출은 **쿠키를 다시 쓴다**(토큰이 갱신된다). 라우트 핸들러라 쓸 수 있다.
   */
  const sb = await sbServer();
  const { error: upErr } = await sb.auth.updateUser({ password: next });
  if (upErr) {
    console.error(JSON.stringify({ evt: "pw_change_failed", user: me.userId, err: upErr.message.slice(0, 160) }));
    return NextResponse.json({ error: "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  /**
   * 🔴 **다른 기기의 로그인을 끊는다**(권반장 지시 [41] ②).
   *   비밀번호를 바꾸는 이유의 절반은 **「누가 내 계정을 보고 있을지도 모른다」**이다.
   *   끊지 않으면 그 사람이 **그대로 들어와 있다.**
   * ⚠ `others` 라 **지금 이 브라우저는 안 끊는다** — 바꾸자마자 로그아웃되면
   *   사장님은 「바뀐 건가?」를 알 수 없다.
   * ⚠ **바뀐 뒤의 토큰**으로 불러야 한다 — 위에서 토큰이 갱신됐다.
   * ⚠ 이것이 실패해도 **비밀번호는 이미 바뀌었다.** 실패를 삼키지 말고 화면에 사실대로 알린다.
   */
  const { data: after } = await sb.auth.getSession();
  const token = after.session?.access_token ?? me.accessToken;
  let othersOut = true;
  const { error: soErr } = await sbAdmin().auth.admin.signOut(token, "others");
  if (soErr) {
    othersOut = false;
    console.warn(JSON.stringify({ evt: "pw_change_others_signout_failed", user: me.userId, err: soErr.message.slice(0, 160) }));
  }

  /* ⚠ `amr` 을 남긴다 — 「메일 복구 세션의 방법 이름」을 우리는 **실측한 적이 없다.**
     첫 진짜 복구 때 이 한 줄이 답을 준다. **비밀번호는 한 글자도 안 남는다.** */
  console.log(JSON.stringify({ evt: "pw_change_ok", user: me.userId, why: me.why, amr: me.method, othersOut }));

  return NextResponse.json({ ok: true, othersOut, why: me.why });
}
