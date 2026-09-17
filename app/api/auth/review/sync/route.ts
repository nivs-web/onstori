import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 🔴🔴 **심사용 계정이 «일반 로그인 화면»으로도 들어가지게 한다.** (2026-09-17 지시 [30])
 *
 * ★★ **왜 필요한가 — 대표님이 직접 겪으신 일:**
 *   「로그아웃 뒤 `onstori.com/login` 에서 review 계정으로 **수십 번 시도했는데 안 된다.**
 *    이런 기본적인 거 못 고치면 심사 통과 못한다.」
 *
 * ★★ **진짜 원인 (2026-09-17 실측):**
 *   권반장은 「`review@onstori.com` 이 Supabase 명부에 아예 없다」고 보셨지만 **있습니다.**
 *   방식 `email` · 메일 확인됨 · 두 샘플 사이트(`sample-toss`·`sample-interior`)의 **주인이기도** 합니다.
 *   ⇒ 없는 게 아니라 **«비밀번호»가 심겨 있지 않습니다.**
 *     그 계정은 `/api/auth/review` 가 **일회용 링크(magiclink)** 로 열어 온 계정이라,
 *     이메일 신분만 있고 **비밀번호가 없습니다.** `signInWithPassword` 는 영원히 실패합니다.
 *
 * ★★ **왜 사람이 손으로 안 넣고 이 길을 만들었나 — 두 가지 때문입니다.**
 *   ① 🔴 **불변 규칙 6 — 비밀키는 `.env.local` 과 Vercel 환경변수에만.**
 *      비밀번호를 코드·문서·채팅에 옮겨 적는 순간 그 규칙이 깨집니다.
 *      여기서는 **Vercel 이 이미 갖고 있는 `REVIEW_PASSWORD` 를 서버가 직접 읽어** 심습니다 —
 *      값이 사람 손을 **한 번도 안 거칩니다.**
 *   ② **옮겨 적으면 틀립니다.** 한 글자만 어긋나도 `/login`(Supabase 비밀번호)과
 *      `/login/review`(환경변수 비교)가 **서로 다른 비밀번호**를 갖게 됩니다.
 *      환경변수에서 읽으면 **둘이 어긋날 수가 없습니다.**
 *
 * 🔴 **안전장치 넷:**
 *   ① **운영자만** 부를 수 있습니다(`isAdmin`). 열쇠가 없으면 401.
 *   ② **열쇠(`REVIEW_EMAIL`·`REVIEW_PASSWORD`)가 없으면 404** — 「존재하지 않는 길」이 됩니다.
 *   ③ 🔴 **계정을 «만들지» 않습니다.** 없으면 404 로 알려만 줍니다 —
 *      새로 만들면 **주인이 바뀌어 두 샘플 사이트가 떨어져 나갑니다**(권반장 지시).
 *   ④ **비밀번호를 응답·로그에 한 글자도 안 씁니다.** 「됐다/안 됐다」만 말합니다.
 *
 * ⚠ **`/login/review` 는 이 변경과 무관합니다.** 그 길은 환경변수를 직접 비교하므로
 *   Supabase 비밀번호를 심어도 **한 글자도 안 바뀝니다.** 유튜브·인스타 심사에 낸 주소가 그대로 삽니다.
 */
export const dynamic = "force-dynamic";

type Report = {
  계정: string;
  계정이있나: boolean;
  메일확인됨?: boolean;
  가진홈페이지?: string[];
  비밀번호를심었나?: boolean;
  일반로그인이되나?: boolean;
  할일?: string;
};

/** 열쇠 넷을 모은다. 값은 돌려주지 않는다 */
function keys() {
  const email = process.env.REVIEW_EMAIL?.trim() || process.env.REVIEW_ID?.trim();
  const pw = process.env.REVIEW_PASSWORD?.trim();
  return { email, pw };
}

async function look(email: string): Promise<Report> {
  const sb = sbAdmin();
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!user) return { 계정: email, 계정이있나: false, 할일: "이 메일로 된 계정이 없습니다. 만들지 않았습니다 — 새로 만들면 두 샘플 사이트의 주인이 바뀝니다." };

  const { data: sites } = await sb.from("sites").select("slug").eq("owner_id", user.id);
  return {
    계정: email,
    계정이있나: true,
    메일확인됨: !!user.email_confirmed_at,
    가진홈페이지: (sites ?? []).map((s) => String(s.slug)),
  };
}

/** GET — **읽기만 한다.** 지금 어떤 상태인지 본다 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { email, pw } = keys();
  if (!email || !pw) {
    return NextResponse.json({ error: "REVIEW_EMAIL·REVIEW_PASSWORD 가 이 환경에 없습니다. (운영에는 있습니다)" }, { status: 404 });
  }
  return NextResponse.json(await look(email));
}

/** POST — **비밀번호를 심는다.** 값은 환경변수에서 읽고, 어디에도 안 남긴다 */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { email, pw } = keys();
  if (!email || !pw) {
    return NextResponse.json({ error: "REVIEW_EMAIL·REVIEW_PASSWORD 가 이 환경에 없습니다. (운영에는 있습니다)" }, { status: 404 });
  }

  const before = await look(email);
  if (!before.계정이있나) return NextResponse.json(before, { status: 404 });

  const sb = sbAdmin();
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())!;

  /* 🔴 이미 있는 계정에 **비밀번호만** 심는다. 사이트·주인·다른 값은 건드리지 않는다 */
  const { error } = await sb.auth.admin.updateUserById(user.id, { password: pw, email_confirm: true });
  if (error) {
    console.error(JSON.stringify({ evt: "review_pw_sync_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ ...before, 비밀번호를심었나: false, 할일: `심지 못했습니다: ${error.message.slice(0, 120)}` }, { status: 500 });
  }

  /**
   * ★ **심었다고 말하기 전에 «실제로 들어가 본다».**
   *   「저장했습니다」만 하고 안 되는 것이 대표님이 겪으신 바로 그 일이다.
   * ⚠ 손님 열쇠(anon)로 «진짜 로그인»을 해 본다. 성공하면 바로 세션을 버린다.
   */
  let ok = false;
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await anon.auth.signInWithPassword({ email, password: pw });
    ok = !!r.data?.session && !r.error;
    if (r.data?.session) await anon.auth.signOut();
  } catch { ok = false; }

  /* ⚠ 비밀번호는 로그에도 안 남긴다 — 「됐다/안 됐다」만 */
  console.log(JSON.stringify({ evt: "review_pw_synced", ok, sites: before.가진홈페이지?.length ?? 0 }));

  const after = await look(email);
  return NextResponse.json({
    ...after,
    비밀번호를심었나: true,
    일반로그인이되나: ok,
    할일: ok
      ? "끝났습니다. onstori.com/login 에서 그 메일과 비밀번호로 들어가집니다."
      : "심기는 했는데 로그인 확인에 실패했습니다. Supabase 대시보드에서 «이메일 비밀번호 로그인»이 켜져 있는지 봐 주세요.",
  });
}
