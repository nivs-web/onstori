import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { AdminLogin } from "../ui";
import { shortsStyleOf, shortsOrderOf, stageNOf, cardsNOf, VIDEOS_WARN_AT } from "@/config/shorts";
import * as storage from "@/lib/storage";
import { VideosStyleTable, type SiteRow } from "./ui";

export const metadata = { title: "영상 관리", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 **영상 관리 — 「숏폼 스타일」을 «한눈에 보고 대신 바꿔 주는» 표.** (2026-09-17 지시 [42] §4-②)
 *
 * ★ **사장님 화면이 «주»이고 여기는 «거들기»다**(권반장 판단 · 대표님께 확인 중).
 *   고르는 것은 사이트마다라 사장님 편집화면(`/{상호}/edit` → 영상)이 자연스럽다.
 *   여기는 **사장님이 전화로 「바꿔 주세요」 하실 때 우리가 눌러 드리는 길**이다.
 *
 * ⚠ **같은 창구를 쓴다** — `/api/site/shorts-style`.
 *   `loadOwnedSite` 가 **운영자면 통과**시키므로 어드민 전용 창구를 따로 만들지 않는다.
 *   🔴 창구가 둘이면 «얹어 쓰기»·«모르는 값 거절» 같은 규칙을 두 번 적게 되고,
 *     그러면 한쪽만 고쳐져 어긋난다(`SHORTS_MAX` 가 실제로 그랬다 · [38]①).
 *
 * ⚠ 영상 편수는 **`story_entries` 에서 «걸린 것»만** 센다(`video_out_key` 가 있는 것).
 *   그래야 사장님 편집화면이 말하는 수와 같다.
 */
export default async function VideosAdmin() {
  if (!(await isAdmin())) return <AdminLogin />;

  const sb = sbAdmin();
  const { data: sites } = await sb
    .from("sites")
    .select("id, slug, business_name, status, settings")
    .order("created_at", { ascending: false });

  /* ★ 사이트마다 조회를 반복하지 않는다 — 한 번에 가져와 센다(사이트가 늘어도 조회는 두 번) */
  const ids = (sites ?? []).map((s) => s.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await sb
      .from("story_entries")
      .select("site_id")
      .in("site_id", ids)
      .not("video_out_key", "is", null);
    for (const r of rows ?? []) {
      const k = String(r.site_id);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  /**
   * 🔴 **사장님별 «실제 저장량»을 센다.** (2026-09-17 지시 [47]①)
   *
   * > 대표님: 「진짜 R2 저장소는 무제한 무료야? 영상이 수천 개 올라가도?
   * >   **요금 폭탄 맞을 수 있으니 자세히 알아봐**」
   *
   * ⚠⚠ **올리는 것을 막는 것이 «아무것도 없습니다».** `SHORTS_MAX(200)` 은 **화면에 보여주는 편수**만 자릅니다.
   *   지금은 사장님이 몇 분이라 **0원 구간**이지만, **안 보이면 아무도 모릅니다.**
   *   ⇒ **막지 말고 «보이게»**(권반장 지시). 막는 것은 **대표님 결정**입니다.
   *
   * ⚠ 세는 자리는 **지울 때 지우는 자리와 같습니다**(`site-delete` 의 `PREFIXES`) —
   *   그래야 「보이는 용량」과 「지우면 사라지는 용량」이 같습니다.
   * ⚠ 못 세면 **0 이 아니라 «못 잼»**으로 둡니다. 0이라고 적으면 「없다」는 거짓말이 됩니다.
   */
  const sizeOf = async (slug: string, id: string) => {
    try {
      const parts = await Promise.all([
        storage.sizeOfPrefix("media", `uploads/${slug}/`),
        storage.sizeOfPrefix("private", `private/stories/${slug}/`),
        storage.sizeOfPrefix("media", `shots/${slug}/`),
        storage.sizeOfPrefix("private", `inquiries/${id}/`),
      ]);
      return parts.reduce((a, b) => a + b.bytes, 0);
    } catch (e) {
      console.warn(JSON.stringify({ evt: "admin_size_failed", slug, err: String(e).slice(0, 160) }));
      return null;                    // 못 쟀다 — 0 이 아니다
    }
  };
  const bytesBySlug = new Map<string, number | null>();
  await Promise.all((sites ?? []).map(async (s) => {
    bytesBySlug.set(s.slug as string, await sizeOf(s.slug as string, s.id as string));
  }));

  const list: SiteRow[] = (sites ?? []).map((s) => ({
    bytes: bytesBySlug.get(s.slug as string) ?? null,
    slug: s.slug as string,
    name: (s.business_name as string) ?? "",
    status: (s.status as string) ?? "",
    videos: counts.get(s.id as string) ?? 0,
    style: shortsStyleOf(s.settings),
    stageN: stageNOf(s.settings),
    cardsN: cardsNOf(s.settings),
    order: shortsOrderOf(s.settings),
    /** 🔴 사장님이 «직접 고른 적이 있나» — 없으면 기본값으로 도는 중이다 */
    chosen: !!(s.settings as { shorts?: unknown } | null)?.shorts,
  }));

  return (
    <main className="space-y-4">
      <div>
        <h1 className="t-h2 font-bold">영상 관리</h1>
        <p className="mt-2 t-caption leading-relaxed text-[var(--text-soft)]">
          홈페이지마다 <b>숏폼을 어떤 모양으로 보여 주는지</b>를 한눈에 보고, 여기서 바로 바꿔 드릴 수 있습니다.
          <br />
          ⚠ 원래는 <b>사장님이 편집화면에서 직접 고르는 것</b>입니다. 여기는 전화로 부탁하셨을 때 <b>대신 눌러 드리는 자리</b>입니다.
          <br />
          ⚠ <b>편수는 모양마다 다릅니다</b> — 숏폼형태는 «가두는 편수»(5~10), 카드형태는 «늘어놓는 편수»(10~40)를 고릅니다
          <br />
          ⚠ 어느 쪽이든 <b>영상을 클릭하면 올려 둔 영상이 전부</b> 이어서 재생됩니다(몰입모드).
          <br />
          🔴 <b>영상 편수에 제한이 없습니다.</b> 저장한 용량이 그대로 요금이 되므로 여기서 <b>눈으로 지켜봅니다</b> —
          <b>{VIDEOS_WARN_AT}편</b>이 넘는 곳은 눈에 띄게 표시합니다(막지는 않습니다).
        </p>
      </div>
      <VideosStyleTable rows={list} warnAt={VIDEOS_WARN_AT} />
    </main>
  );
}
