import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { sbAdmin } from "@/lib/db-admin";
import { sbServer } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * 심사관 전용 로그인 — **아이디+비밀번호 한 계정만.** (2026-09-12)
 *
 * ★★ 왜 필요한가: 유튜브·메타 심사관은 **카카오 계정이 없고 이메일 OTP 도 못 받는다.**
 *   지금 구조로는 심사관이 로그인 자체를 못 해 **제출이 불가능하다.**
 *
 * ★★ 안전하게 만든 방법 — 세 겹으로 잠근다.
 *   ① **열쇠가 없으면 이 길이 아예 없다.** `REVIEW_ID`·`REVIEW_PASSWORD` 가 비면 404 다.
 *      「기능을 꺼 둔다」가 아니라 「존재하지 않는다」로 만든다.
 *   ② **그 아이디 하나만 통과한다.** 남의 이메일을 넣어도 거부한다 —
 *      이 라우트가 «아무 계정이나 비밀번호를 시험해 보는 창구»가 되면 안 된다.
 *   ③ **Supabase 비밀번호를 쓰지 않는다.** 우리 환경변수만 맞으면, 관리자 권한으로
 *      그 계정의 일회용 링크를 만들어 세션을 연다. 그래서 Supabase 쪽 비밀번호 로그인을
 *      켜 둘 필요가 없다(켜 두면 **모든 계정**이 비밀번호 공격에 노출된다).
 *
 * ⚠ 비교는 **시간이 일정한 방식**으로 한다. 한 글자씩 비교하면 응답 시간 차이로
 *   비밀번호를 한 글자씩 알아낼 수 있다.
 * ⚠ 비밀번호를 로그에 남기지 않는다. 실패도 «맞았는지 틀렸는지»만 남긴다.
 */

/** 길이가 달라도 안전하게 — 먼저 해시로 길이를 맞춘 뒤 비교한다 */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const id = process.env.REVIEW_ID?.trim();
  const pw = process.env.REVIEW_PASSWORD?.trim();
  const email = process.env.REVIEW_EMAIL?.trim() || id;
  /* ① 열쇠가 없으면 이 길은 «없는 것»이다 */
  if (!id || !pw || !email) return NextResponse.json({ error: "not found" }, { status: 404 });

  /* 무차별 대입 방어 — 이미 있는 장치를 쓴다 */
  const rl = await checkRateLimit("review-login", clientIp(req), [
    { window: 600, max: 5, label: "10m" },
    { window: 86400, max: 30, label: "24h" },
  ]);
  if (!rl.ok) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  const okId = sameSecret(String(body.id ?? ""), id);
  const okPw = sameSecret(String(body.password ?? ""), pw);
  if (!okId || !okPw) {
    console.warn(JSON.stringify({ evt: "review_login_bad", ok_id: okId }));
    /* 어느 쪽이 틀렸는지 알려주지 않는다 */
    return NextResponse.json({ error: "아이디 또는 비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const admin = sbAdmin();
  try {
    /* 계정이 없으면 만든다 — 심사 때마다 사람이 손으로 만들 일을 없앤다 */
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    let hashed = link?.properties?.hashed_token;

    if (error || !hashed) {
      const msg = error?.message ?? "";
      if (/not found|user.*does not exist/i.test(msg)) {
        await admin.auth.admin.createUser({ email, email_confirm: true });
        const retry = await admin.auth.admin.generateLink({ type: "magiclink", email });
        hashed = retry.data?.properties?.hashed_token;
      }
      if (!hashed) {
        console.error(JSON.stringify({ evt: "review_login_link_failed", err: msg.slice(0, 160) }));
        return NextResponse.json({ error: "심사용 계정을 열지 못했어요." }, { status: 500 });
      }
    }

    /* ③ 그 일회용 토큰으로 **이 브라우저에** 세션을 연다 */
    const sb = await sbServer();
    const { error: vErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
    if (vErr) {
      console.error(JSON.stringify({ evt: "review_login_verify_failed", err: vErr.message.slice(0, 160) }));
      return NextResponse.json({ error: "로그인을 마치지 못했어요." }, { status: 500 });
    }

    /**
     * ★★★ **심사관에게 «볼 것»을 쥐여 준다.** (2026-09-13)
     *
     * ⚠ 여기까지 오면 세션은 열린다. 그런데 그 계정이 **가진 사이트가 하나도 없으면**
     *   심사관은 로그인하자마자 «빈 화면»을 본다 — 연결도 업로드도 해 볼 수가 없다.
     *   심사는 「이 앱이 정말 그 일을 하는가」를 보는 것이라, 빈 화면은 곧 반려다.
     *
     * ★ 그래서 심사용 사이트 하나를 이 계정에 붙인다. 조건을 좁게 건다:
     *   ① `REVIEW_SITE` 가 **있어야** 한다 — 없으면 아무 일도 안 한다(열쇠 없으면 그 길도 없다)
     *   ② 그 사이트의 주인이 **아직 없을 때만** 붙인다 — 남의 사이트를 빼앗지 않는다
     *   ③ 이미 이 계정 것이면 그냥 둔다
     *
     * ⚠ 붙이기에 실패해도 **로그인은 막지 않는다.** 심사관이 못 들어오는 것이 더 나쁘다.
     */
    try {
      const wanted = process.env.REVIEW_SITE?.trim();
      const { data: who } = await sb.auth.getUser();
      const uid = who?.user?.id;
      if (wanted && uid) {
        const { data: site } = await admin.from("sites")
          .select("id, owner_id").eq("slug", wanted).maybeSingle();
        if (site && !site.owner_id) {
          const { error: claimErr } = await admin.from("sites")
            .update({ owner_id: uid }).eq("id", site.id).is("owner_id", null);
          console.log(JSON.stringify({
            evt: claimErr ? "review_site_claim_failed" : "review_site_claimed",
            slug: wanted, err: claimErr?.message?.slice(0, 120),
          }));
        }
      }
    } catch (e) {
      console.warn(JSON.stringify({ evt: "review_site_claim_error", err: String(e).slice(0, 160) }));
    }

    console.log(JSON.stringify({ evt: "review_login_ok" }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(JSON.stringify({ evt: "review_login_error", err: String(e).slice(0, 160) }));
    return NextResponse.json({ error: "로그인에 실패했어요." }, { status: 500 });
  }
}
