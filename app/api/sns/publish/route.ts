import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { trialInfo } from "@/lib/trial";
import { ERROR_SAY, PROVIDER_NAME, PROVIDERS, getAdapter, type SnsProvider } from "@/lib/sns";
import * as db from "@/lib/sns/db";
import { checkForInstagram } from "@/lib/sns/mp4";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid(),
  providers: z.array(z.enum(PROVIDERS)).min(1).max(6),
});

/**
 * 「SNS 에 올리기」 시작. (2026-09-11)
 *
 * ★★ 인스타는 3단계다: ①컨테이너 →②확인(최대 5분) →③게시.
 *   **여기서는 ①과 «첫 확인»까지만** 한다. 5분을 서버가 붙들면 시간 초과로 끊기고,
 *   그 끊김이 곧 «같은 영상 두 번 올리기»의 원인이 된다.
 *   아직이면 `sns_posts.container_id` 에 적어 두고 `processing` 으로 돌려준다.
 *   화면이 1분에 한 번 `/api/sns/publish/poll` 로 이어 간다.
 *
 * ★★ 인스타는 **공개 주소**를 줘야 가져간다. 올리기를 누른 **그 순간** 그 영상 한 개만
 *   공개 창고로 복사한다(`copyToPublic`). 원본(private)은 그대로 둔다(불변 규칙 10).
 *   ⚠ 유튜브는 파일을 직접 보내므로 복사하지 않는다 — 쓸데없이 공개로 내보내지 않는다.
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const { slug, anonId, entryId, providers } = parsed.data;

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json({ error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" }, { status: forbidden ? 403 : 404 });
  }
  if (trialInfo(r.site).expired) {
    return NextResponse.json({ error: "홈페이지가 정지 상태예요. 정기결제를 시작하시면 다시 열려요" }, { status: 402 });
  }
  const siteId = r.site.id as string;

  const { data: row } = await sbAdmin().from("story_entries")
    .select("id, title, question, video_key").eq("id", entryId).eq("site_id", siteId).maybeSingle();
  const videoKey = (row?.video_key as string) ?? "";
  if (!videoKey) return NextResponse.json({ error: "그 영상을 찾지 못했어요. 목록을 새로 고쳐 주세요" }, { status: 404 });

  const title = ((row?.question as string) || (row?.title as string) || "사장님 이야기").slice(0, 100);
  const caption = ((row?.question as string) || (row?.title as string) || "").slice(0, 2000);

  const results = await Promise.all(providers.map((p) => one(p)));
  return NextResponse.json({ results });

  async function one(provider: SnsProvider) {
    const name = PROVIDER_NAME[provider];
    const a = getAdapter(provider);
    const say = (state: string, msg: string, extra: Record<string, unknown> = {}) => ({ provider, name, state, msg, ...extra });

    const av = await a.isAvailable();
    if (!av.ok) return say("skipped", av.why);

    const conn = await a.isConnected(siteId);
    if (!conn || conn.status !== "active") return say("skipped", `${name} 연결이 필요해요.`);
    if (!conn.disclaimerAgreedAt) return say("skipped", `${name} 에서 [올려도 좋아요]를 먼저 눌러 주세요.`);

    /* ★ 중복 방지 — 이미 살아 있는 시도가 있으면 새로 만들지 않는다 */
    if (await a.isDuplicate(siteId, entryId)) {
      const live = await db.findLivePost(siteId, entryId, provider);
      return say(live?.status === "published" ? "published" : "processing", `이미 ${name} 에 올렸거나 올리는 중이에요.`);
    }

    /* ★ 한도 — 여기서 **한 번만** 쓴다(부를 때마다 1이 올라간다) */
    if (!(await db.consumeQuota(provider, siteId))) {
      return say("failed", ERROR_SAY.QUOTA_EXCEEDED, { kind: "QUOTA_EXCEEDED" });
    }

    /* 인스타만: 규격 검사 → 공개 복사 */
    let publicUrl = "";
    let publicKey: string | null = null;
    if (provider === "instagram") {
      const chk = await checkForInstagram(videoKey);
      if (!chk.ok) return say("failed", chk.why, { kind: "REJECTED" });
      const pk = storage.publicVideoKeyOf(videoKey);
      if (!pk) return say("failed", "영상 주소가 이상해요. 다시 찍어 주세요.", { kind: "REJECTED" });
      try {
        await storage.copyToPublic(videoKey, pk, "video/mp4");
      } catch (e) {
        console.error(JSON.stringify({ evt: "sns_copy_failed", provider, err: String(e).slice(0, 160) }));
        return say("failed", "영상을 인스타그램이 가져갈 수 있는 자리로 옮기지 못했어요.", { kind: "TRANSIENT" });
      }
      publicKey = pk;
      publicUrl = storage.publicUrl(pk);
    }

    const post = await db.createPost({ siteId, entryId, provider, publicKey });
    if (!post) return say("failed", "기록을 만들지 못했어요. 잠시 후 다시 시도해 주세요.", { kind: "TRANSIENT" });

    await db.updatePost(post.id, { status: "uploading", attempts: (post.attempts ?? 0) + 1 });
    const out = await a.upload({ siteId, entryId, publicUrl, sourceKey: videoKey, title, caption });

    if (out.state === "published") {
      await db.updatePost(post.id, {
        status: "published", remote_post_id: out.remotePostId, remote_url: out.remoteUrl,
        published_at: new Date().toISOString(), error_kind: null, error_detail: null,
      });
      console.log(JSON.stringify({ evt: "sns_published", provider, entryId }));
      return say("published", `${name} 에 올렸어요.`, { url: out.remoteUrl });
    }
    if (out.state === "processing") {
      await db.updatePost(post.id, { status: "processing", container_id: out.containerId });
      return say("processing", `${name} 이 영상을 받는 중이에요. 잠시만요…`);
    }
    await db.updatePost(post.id, { status: "failed", error_kind: out.kind, error_detail: out.detail.slice(0, 300) });
    console.error(JSON.stringify({ evt: "sns_publish_failed", provider, entryId, kind: out.kind }));
    return say("failed", ERROR_SAY[out.kind], { kind: out.kind });
  }
}
