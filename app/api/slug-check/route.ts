import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { slugCandidates } from "@/lib/slug";

/**
 * 슬러그(주소) 실시간 검사 — 형식·예약어·중복. 검증은 서버에서 (CLAUDE.md 규칙 4)
 *
 * ★ 2026-09-15 — **추천 주소 3개를 내려 주는 길을 같이 붙였다** (대표님 지시).
 *   `?suggest=1&name=다산 리모델링&industry=interior` → `{ suggestions: ["dasan", …] }`
 *   ⚠ 검사와 같은 파일에 둔다 — **「비어 있는가」를 묻는 규칙이 한 곳이어야** 추천과 검사가 어긋나지 않는다.
 */

/** 이 주소가 이미 쓰이고 있거나 예약어인가 */
async function isTaken(sb: ReturnType<typeof sbAdmin>, slug: string): Promise<boolean> {
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", slug).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", slug).maybeSingle(),
  ]);
  return Boolean(reserved || taken);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const sb = sbAdmin();

  /* ───── 추천 모드 — 가입 3단계에서 단추로 보여 줄 것들 ───── */
  if (q.get("suggest")) {
    const name = (q.get("name") ?? "").slice(0, 60);
    const industry = q.get("industry");
    const cands = slugCandidates(name, industry);

    /* ⚠ **비어 있는 것만** 내려 준다. 찬 주소를 단추로 보여 주면 눌렀다가 거절당한다 —
         그 한 번의 거절이 9월 12일에 사장님들을 나가게 한 바로 그 경험이다. */
    const free: string[] = [];
    for (const c of cands) {
      if (free.length >= 3) break;
      if (!(await isTaken(sb, c))) free.push(c);
    }

    /* 후보가 다 찼거나 상호에서 아무것도 못 뽑았으면 **뒤에 숫자를 붙여** 채운다.
       ⚠ 추천이 «없는» 화면을 만들지 않는다. 빈 화면은 사장님을 멈추게 한다. */
    const base = cands[0] ?? "store";
    for (let i = 2; free.length < 3 && i <= 30; i++) {
      const cand = `${base.slice(0, 27)}-${i}`;
      if (!free.includes(cand) && !(await isTaken(sb, cand))) free.push(cand);
    }
    return NextResponse.json({ suggestions: free });
  }

  /* ───── 검사 모드 — 사장님이 직접 친 주소 ───── */
  const slug = q.get("slug")?.toLowerCase().trim() ?? "";

  /* ★ 2026-09-15 — **왜 안 되는지를 갈라서 말한다.**
     전에는 무엇이 틀렸든 한 문장이었다. 한글을 친 사장님은 「글자가 안 찍힌다」고만 느꼈고
     이유를 못 들어서 나갔다(가입 이탈 1위). 이유를 나누면 다음에 무엇을 할지 알게 된다. */
  if (/[^a-z0-9-]/.test(slug)) {
    return NextResponse.json({
      available: false,
      reason: "주소는 영문 소문자·숫자·하이픈(-)만 됩니다. 한글은 쓸 수 없어요 — 아래 추천을 눌러 보세요",
    });
  }
  if (slug.length < 3 || slug.length > 30) {
    return NextResponse.json({ available: false, reason: "3~30자로 지어 주세요" });
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return NextResponse.json({ available: false, reason: "하이픈(-)으로 시작하거나 끝날 수 없어요" });
  }

  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", slug).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", slug).maybeSingle(),
  ]);
  if (reserved) return NextResponse.json({ available: false, reason: "온스토리가 쓰는 주소라 쓸 수 없어요" });
  if (taken) return NextResponse.json({ available: false, reason: "이미 사용 중인 주소예요" });
  return NextResponse.json({ available: true });
}
