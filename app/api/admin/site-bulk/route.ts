import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";

/**
 * ★★★ **고른 사이트를 한꺼번에 — 폐쇄 · 다시 열기 · 이벤트 기간.** (2026-09-15 대표님 지시)
 *
 * ★ 대표님 말씀: 「체크박스 필요 — 선택해서 운영중·폐쇄중 변경할 수 있도록.
 *   … **이벤트 회원**도 있었으면 좋겠다. 초기에 홍보 때문에 아는 지인들 3개월 혹은 6개월
 *   사용권 줄 거야. … 체크박스 체크 후 **이벤트 넣기** 버튼 누르면 **개월 수 입력**해서
 *   특정 개월 수까지 무료로 넣어 주는 거야.」
 *
 *  * ★★★ **2026-09-17 — 「정회원 올리기·내리기」가 생겼다** (대표님 지시 [23]).
 *   대표님 원문: 「정회원으로 내가 누군가를 올려줬어. 근데 **무료회원으로 다시 바꾸는 게 없어.**
 *   … 내가 내 것을 유료로 할 수 없으니까 **나는 설정 가능한 권한이 있어야지.**」
 *
 *   ⚠ 아래 2026-09-15 의 「일부러 안 만들었다」는 **뜻이 여전히 옳다** — 그래서 **지우지 않는다.**
 *     달라진 것은 **길을 막는 대신 «표시»로 가른 것**이다:
 *     · 결제로 된 정회원 → `paid_at` 이 있다
 *     · 손으로 올린 정회원 → `settings.manual_grant` 가 있고 **`paid_at` 은 비어 있다**
 *     ⇒ 장부에서 둘을 언제든 갈라 셀 수 있다. **그것이 원래 막았던 이유였다.**
 *
 * 🔴 **「유료로 전환」은 일부러 안 만들었다** (2026-09-15 대표님 승인 — 아래는 그때의 기록이다).
 *   버튼 한 번으로 `유료회원`이 되면 **결제 기록 없는 유료회원**이 생긴다. 매출 숫자가 틀어지고
 *   나중에 「이분 언제 결제하셨죠?」에 아무도 답을 못 한다.
 *   ⇒ **이벤트 기간**으로 푼다. 화면에서는 똑같이 잘 쓰시고, 장부는 깨끗하다.
 *
 * ★ **왜 줬는지 한 줄을 같이 받는다.** 나중에 「이 사람 왜 공짜죠?」에 답할 수 있어야 한다.
 */
export const dynamic = "force-dynamic";

type Mode = "close" | "open" | "event" | "grade";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "") as Mode;
  const slugs: string[] = Array.isArray(body.slugs) ? body.slugs.map(String).slice(0, 200) : [];
  if (!slugs.length) return NextResponse.json({ error: "고른 사이트가 없어요" }, { status: 400 });

  const sb = sbAdmin();
  const now = new Date();
  let done = 0;

  /* ───── 폐쇄 / 다시 열기 ───── */
  if (mode === "close" || mode === "open") {
    const patch = mode === "close"
      ? { status: "suspended", suspended_at: now.toISOString() }
      /* ⚠ 다시 열 때 `trial` 로 돌린다. `active`(유료)로 올리지 않는다 —
           돈을 안 받았는데 유료가 되면 장부가 틀어진다. 기간은 아래 event 로 준다. */
      : { status: "trial", suspended_at: null };

    const { error, count } = await sb.from("sites").update(patch, { count: "exact" }).in("slug", slugs);
    if (error) return NextResponse.json({ error: error.message.slice(0, 160) }, { status: 500 });
    done = count ?? slugs.length;

    /* 캐시를 푼다 — 안 풀면 최대 60초 동안 옛 화면이 나간다 */
    for (const s of slugs) { try { revalidatePath(`/${s}`); } catch { /* 캐시 실패는 넘어간다 */ } }
    console.log(JSON.stringify({ evt: "site_bulk", mode, slugs, done }));
    return NextResponse.json({ ok: true, done, mode });
  }

  /* ───── 이벤트 기간 주기 ───── */
  if (mode === "event") {
    const months = Number(body.months);
    const reason = String(body.reason ?? "").trim().slice(0, 120);
    if (!Number.isFinite(months) || months < 1 || months > 36) {
      return NextResponse.json({ error: "개월 수는 1~36 사이로 넣어 주세요" }, { status: 400 });
    }
    if (reason.length < 2) {
      return NextResponse.json({ error: "왜 드리는지 한 줄만 적어 주세요 (나중에 이유를 알 수 있어야 합니다)" }, { status: 400 });
    }

    const { data: rows } = await sb
      .from("sites").select("id, slug, settings, trial_ends_at").in("slug", slugs);

    for (const r of rows ?? []) {
      /**
       * ★ **끝나는 날을 «지금»이 아니라 «더 늦은 쪽»에서 센다.**
       *   아직 열흘 남은 분께 3개월을 드리면 «지금+3개월»이 아니라 «남은 날 + 3개월»이어야
       *   손해가 안 난다. 이미 끝난 분은 오늘부터 센다.
       */
      const cur = r.trial_ends_at ? new Date(r.trial_ends_at as string) : null;
      const base = cur && cur.getTime() > now.getTime() ? cur : now;
      const next = new Date(base);
      next.setMonth(next.getMonth() + months);

      const settings = ((r.settings as Record<string, unknown>) ?? {});
      const log = Array.isArray(settings.eventGrants) ? (settings.eventGrants as unknown[]) : [];
      settings.eventGrants = [...log, { at: now.toISOString(), months, reason, until: next.toISOString() }].slice(-20);
      /** ★ 표에서 「이벤트회원」으로 따로 보이게 하는 표시 — 유료와 섞이면 매출 숫자가 흐려진다 */
      settings.eventMember = true;

      const { error } = await sb
        .from("sites")
        .update({ trial_ends_at: next.toISOString(), status: "trial", suspended_at: null, settings })
        .eq("id", r.id);
      if (!error) { done++; try { revalidatePath(`/${r.slug}`); } catch { /* 넘어간다 */ } }
    }
    console.log(JSON.stringify({ evt: "site_bulk_event", slugs, months, reason, done }));
    return NextResponse.json({ ok: true, done, mode, months });
  }

  /* ───── 회원 등급 올리기 · 내리기 (2026-09-17 대표님 지시 [23]) ───── */
  if (mode === "grade") {
    /* 🔴 **한 번에 하나씩.** 실수로 200개를 정회원으로 만들면 되돌릴 수 없다(지시 6번) */
    if (slugs.length !== 1) {
      return NextResponse.json({ error: "등급은 한 번에 한 곳만 바꿀 수 있어요. 하나만 고르고 다시 눌러 주세요." }, { status: 400 });
    }
    const to = String(body.to ?? "");
    if (!["active", "trial", "suspended"].includes(to)) {
      return NextResponse.json({ error: "어디로 바꿀지가 잘못됐어요" }, { status: 400 });
    }
    /* 🔴 **«왜»를 반드시 받는다**(지시 1번). 무료기간 연장과 «같은 규칙»이다 —
       나중에 「이분 왜 정회원이죠?」에 답할 수 있어야 한다. */
    const reason = String(body.reason ?? "").trim().slice(0, 120);
    if (reason.length < 2) {
      return NextResponse.json({ error: "왜 바꾸는지 한 줄만 적어 주세요 (나중에 이유를 알 수 있어야 합니다)" }, { status: 400 });
    }

    const slug = slugs[0];
    const { data: site } = await sb
      .from("sites").select("id, slug, status, paid_at, settings").eq("slug", slug).maybeSingle();
    if (!site) return NextResponse.json({ error: "그 홈페이지를 찾지 못했어요" }, { status: 404 });

    const prev = String(site.status);
    if (prev === to) return NextResponse.json({ error: `이미 그 등급이에요 (${prev})` }, { status: 400 });

    /**
     * 🔴🔴 **내릴 때 — 자동결제가 살아 있으면 «막는다»** (지시 4번).
     *   등급만 내리고 빌링키를 그대로 두면 **다음 달에 또 긁힙니다.**
     *   돈을 받아 놓고 서비스는 내린 꼴이라, 그건 사고다.
     * ⚠ 올릴 때는 안 본다 — 올리는 것은 손해가 안 난다.
     */
    if (to !== "active") {
      const { data: bill } = await sb
        .from("billing").select("status").eq("site_id", site.id).maybeSingle();
      const liveKey = bill && ["active", "paused", "failed"].includes(String(bill.status));
      if (liveKey) {
        return NextResponse.json({
          error: "이 사장님은 자동결제가 걸려 있습니다. 먼저 해지해야 합니다. (그냥 내리면 다음 달에 또 결제됩니다)",
        }, { status: 409 });
      }
    }

    const settings = ((site.settings as Record<string, unknown>) ?? {});
    const at = now.toISOString();
    if (to === "active") {
      /* 🔴 **`paid_at` 을 채우지 않는다.** 그것이 「결제로 된 정회원」의 표시다 —
         손으로 올린 것을 돈 받은 것으로 섞으면 매출이 틀어지고 나중에 세무에서 터진다. */
      settings.manual_grant = { by: "admin", at, reason, prev };
      /* 이벤트회원 표시는 지운다 — 이제 «정회원»으로 보여야 한다 */
      delete settings.eventMember;
    } else {
      /* 내릴 때는 손으로 올렸던 기록을 **지우지 않고** 「언제 내렸는지」를 덧붙인다(지우지 않는다) */
      const g = (settings.manual_grant as Record<string, unknown> | undefined) ?? {};
      settings.manual_grant = { ...g, revokedAt: at, revokeReason: reason, revokedTo: to };
    }

    const patch: Record<string, unknown> = { status: to, settings };
    if (to === "suspended") patch.suspended_at = at;
    if (to === "trial") patch.suspended_at = null;
    if (to === "active") patch.suspended_at = null;

    const { error } = await sb.from("sites").update(patch).eq("id", site.id);
    if (error) return NextResponse.json({ error: error.message.slice(0, 160) }, { status: 500 });

    try { revalidatePath(`/${slug}`); } catch { /* 캐시 실패는 넘어간다 */ }
    /* 🔴 **기록을 남긴다**(지시 5번) — 돈 문제는 반드시 되짚게 된다 */
    console.log(JSON.stringify({ evt: "grade_changed", who: "admin", when: at, what: { slug, from: prev, to }, why: reason }));
    return NextResponse.json({ ok: true, done: 1, mode, to, from: prev });
  }

  return NextResponse.json({ error: "mode 가 잘못됐어요" }, { status: 400 });
}
