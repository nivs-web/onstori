import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";

/**
 * 「이 이메일은 **어떻게** 들어오는 계정인가」 — 로그인이 **실패한 뒤에만** 묻는다. (2026-09-17 지시 [25])
 *
 * ★★ **왜 필요한가 — 권반장 지시 6번:**
 *   「카카오로 가입한 이메일로 비밀번호 로그인을 시도하면 → 『이 이메일은 **카카오로 시작하셨어요**』로
 *   안내하십시오. 그냥 『틀렸다』고 하면 사장님이 **영영 못 들어옵니다.**」
 *
 *   카카오로 시작한 분에게는 **비밀번호가 아예 없습니다.** 그분이 비밀번호 칸에 무엇을 넣어도
 *   영원히 틀립니다. 「비밀번호를 잊으셨나요?」를 눌러도 소용없습니다 — 만든 적이 없으니까요.
 *   **길을 알려 주지 않으면 그 계정은 잠깁니다.**
 *
 * 🔴 **이 라우트는 «있다/없다»를 흘린다. 그 값을 줄이려고 세 가지를 지킨다:**
 *   ① **로그인이 실패한 뒤에만** 부른다(화면이 그렇게 쓴다). 물어보는 창구로 쓰지 않는다
 *   ② 돌려주는 것은 **`kakaoOnly` 한 칸뿐**이다 — 이름·가입일·사이트 수 같은 것은 절대 안 준다
 *   ③ **카카오만 쓰는 계정일 때만 `true`** 다. 그 밖에는(없는 메일 · 비밀번호가 있는 계정)
 *      전부 `false` 라, 「없는 메일」과 「비밀번호가 틀린 메일」은 **여전히 구별되지 않는다**
 *
 * ⚠ 그래도 «카카오로 가입한 메일이 존재한다»는 사실은 새어 나갑니다. 지시 5번(「어느 쪽이 틀렸는지
 *   알려 주지 마라」)과 **일부 상충**합니다. 권반장 지시 6번이 더 큰 손해(계정 잠김)를 막는다고 보아
 *   그대로 만들었습니다 — **대표님이 아니라고 하시면 이 라우트만 지우면 됩니다**(화면은 그대로 돕니다).
 */
export const dynamic = "force-dynamic";

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const target = String(email ?? "").trim().toLowerCase();
  /* 모양이 아니면 **찾아보지도 않는다** — 목록을 훑게 만드는 입력을 막는다 */
  if (!looksLikeEmail(target) || target.length > 200) return NextResponse.json({ kakaoOnly: false });

  try {
    /* ⚠ `listUsers` 는 한 장씩만 준다. 메일로 바로 찾는 공개 함수가 없어 주소로 거른다.
       ⚠ 사용자가 아주 많아지면 이 방식은 느려진다 — 그때는 `auth.users` 를 직접 읽는
         SQL 함수를 만들어야 한다. 지금은 계정이 손에 꼽아 문제되지 않는다. */
    const sb = sbAdmin();
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ kakaoOnly: false });
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (!found) return NextResponse.json({ kakaoOnly: false });

    /* 🔴 **`listUsers` 는 `identities` 를 «안» 준다 — 늘 `null` 이다** (2026-09-17 실측).
       처음에 그 값을 그냥 믿었더니 **어떤 계정도 카카오로 안 보여** 이 안내가 영영 안 떴다.
       한 명을 다시 물어야 `identities` 가 온다. 한 번 더 왕복하지만, 로그인이 **실패한 뒤에만**
       부르는 길이라 값이 싸다. */
    const one = await sb.auth.admin.getUserById(found.id);
    const providers = (one.data.user?.identities ?? []).map((i) => i.provider);
    /* 카카오만 있고 이메일(비밀번호) 쪽이 없을 때만 참 */
    const kakaoOnly = providers.length > 0 && providers.every((p) => p !== "email");
    return NextResponse.json({ kakaoOnly });
  } catch {
    /* 못 알아봐도 로그인 화면이 멈추면 안 된다 — 모르면 「아니오」로 둔다 */
    return NextResponse.json({ kakaoOnly: false });
  }
}
