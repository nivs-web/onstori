import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * ★★★ **홈페이지 주소(slug) 바꾸기 — 운영자만.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「주소 변경 기능 필요, 단 onstori 관리자만 가능.
 *   주소를 변경 원하는 고객은 onstori.com 관리자가 변경해 주는 걸로 가자.」
 *
 * ★★ **왜 사장님에게 안 드리나 — 주소는 «되돌릴 수 없는 것»에 가깝다.**
 *   사장님이 명함·플레이스·현수막에 적어 둔 주소다. 바꾸는 순간 그 종이들이 전부 죽은 링크가 된다.
 *   그래서 **한 번 더 사람이 보는 자리**를 둔다. 전화로 이유를 듣고 우리가 바꾼다.
 *
 * ★ **옛 주소를 「빈 자리」로 남긴다.** `reserved_slugs` 에 넣어 다른 분이 못 가져가게 한다 —
 *   그러지 않으면 옛 명함을 보고 온 손님이 **엉뚱한 가게**를 보게 된다. 그게 가장 나쁘다.
 *   ⚠ 되돌리기(옛 주소 → 새 주소 자동 이동)는 **아직 없다.** 예약만 해 둔다.
 *     만들려면 라우트가 하나 더 필요하다 — 지금 범위 밖이다.
 *
 * 🔴 **문턱 둘.** 하나라도 빼면 실수로 남의 주소를 바꾼다:
 *   ① 새 주소가 형식·예약어·중복을 통과해야 한다 (가입 화면과 **같은 규칙**)
 *   ② 화면이 **상호를 손으로 타이핑**하게 한다 (확인창은 습관적으로 눌린다 — 타이핑은 아니다)
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { from, to, confirmName } = await req.json().catch(() => ({}));
  const cur = String(from ?? "").trim().toLowerCase();
  const next = String(to ?? "").trim().toLowerCase();

  if (!cur || !next) return NextResponse.json({ error: "주소를 둘 다 주세요" }, { status: 400 });
  if (cur === next) return NextResponse.json({ error: "지금 주소와 같아요" }, { status: 400 });
  if (!/^[a-z0-9-]{3,30}$/.test(next) || next.startsWith("-") || next.endsWith("-")) {
    return NextResponse.json({ error: "영문 소문자·숫자·하이픈(-) 3~30자로 지어 주세요" }, { status: 400 });
  }

  const sb = sbAdmin();

  const { data: site } = await sb
    .from("sites")
    .select("id, slug, business_name")
    .eq("slug", cur)
    .maybeSingle();
  if (!site) return NextResponse.json({ error: `'/${cur}' 사이트가 없어요` }, { status: 404 });

  /* 🔴 문턱 ② — 상호를 정확히 쳐야 한다 */
  if (String(confirmName ?? "").trim() !== String(site.business_name ?? "").trim()) {
    return NextResponse.json({ error: "상호를 정확히 입력해 주세요" }, { status: 400 });
  }

  /* 🔴 문턱 ① — 가입 화면과 **같은 규칙**으로 본다. 두 곳이 다르면 한쪽이 거짓말을 한다 */
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", next).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", next).maybeSingle(),
  ]);
  if (reserved) return NextResponse.json({ error: "온스토리가 쓰는 주소라 쓸 수 없어요" }, { status: 409 });
  if (taken) return NextResponse.json({ error: "이미 사용 중인 주소예요" }, { status: 409 });

  const { error } = await sb.from("sites").update({ slug: next }).eq("id", site.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /**
   * ★★★ **주소를 «복사해 둔» 다른 표도 함께 고친다.** (2026-09-15 대표님 지적)
   *
   * ★ 대표님 말씀: 「랜딩에 걸어 둔 홈페이지 주소를 내가 나중에 바꾸면 **랜딩에서 사이트 뜰 때
   *   링크 깨지는 건 아니지?** … 사이트명 주소가 바뀌면 **연결된 다양한 장소에서 링크가 자동으로
   *   업데이트되게** 만들어.」
   *
   * 🔴 **실제로 깨진다.** `showcase` 표는 `slug` 를 **글자로 복사해** 갖고 있다(사이트 id 가 아니다).
   *   주소를 바꾸면 랜딩이 옛 주소로 사이트를 찾다가 못 찾고 **카드가 조용히 사라진다.**
   *   등록은 그대로 남아 있으니 「왜 안 뜨지?」만 남는다 — 조용히 사라지는 것이 가장 나쁘다.
   *
   * ⚠ **바꾸면 «안 되는» 곳도 있다 — 지난 일의 기록이다:**
   *   · `billing_events.site_slug` — 「그때 무엇이었나」를 남기는 칸이다. 고치면 과거가 바뀐다
   *   · `site_deletions.slug`      — 같은 이유
   *   ⇒ **「지금을 가리키는 것」만 고치고, 「그때를 적어 둔 것」은 그대로 둔다.**
   *
   * ⚠ 실패해도 주소 변경 자체를 무르지 않는다. 대신 **화면에 사실대로 알린다** — 조용히 넘기지 않는다.
   */
  const alsoFixed: string[] = [];
  const alsoFailed: string[] = [];
  try {
    const { error: e3, count } = await sb
      .from("showcase").update({ slug: next }, { count: "exact" }).eq("slug", cur);
    if (e3) alsoFailed.push("랜딩 포트폴리오");
    else if ((count ?? 0) > 0) alsoFixed.push("랜딩 포트폴리오");
  } catch { alsoFailed.push("랜딩 포트폴리오"); }

  /* ★ 옛 주소를 잠가 둔다 — 다른 분이 가져가면 옛 명함을 보고 온 손님이 엉뚱한 가게를 본다.
     ⚠ 실패해도 주소 변경 자체를 무르지 않는다. 잠그기는 «덤»이고 변경이 «본체»다. */
  let locked = false;
  try {
    const { error: e2 } = await sb.from("reserved_slugs").insert({ slug: cur });
    locked = !e2;
  } catch { /* 표가 없거나 권한이 다르면 조용히 넘어간다 */ }

  /* 캐시를 푼다 — 안 풀면 최대 60초 동안 옛 화면이 나간다 */
  /* ⚠ 랜딩(`/`)도 함께 푼다 — 포트폴리오 카드가 옛 주소로 굳어 있을 수 있다 */
  try { revalidatePath(`/${cur}`); revalidatePath(`/${next}`); revalidatePath("/"); } catch { /* 캐시 실패가 변경을 무르게 하지 않는다 */ }

  console.log(JSON.stringify({ evt: "site_slug_changed", from: cur, to: next, business: site.business_name, oldLocked: locked, alsoFixed, alsoFailed }));
  return NextResponse.json({ ok: true, from: cur, to: next, oldLocked: locked, alsoFixed, alsoFailed });
}
