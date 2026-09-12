import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { trialInfo } from "@/lib/trial";
import { ERROR_SAY, PROVIDER_NAME, PROVIDERS, getAdapter, type SnsProvider } from "@/lib/sns";
import * as db from "@/lib/sns/db";
import { checkForInstagram } from "@/lib/sns/mp4";
import { captionFor, hasUrl } from "@/lib/sns/no-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid(),
  providers: z.array(z.enum(PROVIDERS)).min(1).max(6),
  /* ★ 사장님이 직접 쓴 글 (2026-09-12). 안 보내면 예전처럼 질문·제목을 쓴다.
     ⚠ 서버가 다시 자르고, X 는 서버가 링크를 지운다 — 화면 값을 그대로 믿지 않는다. */
  caption: z.string().max(2200).optional(),
  /* ★ 틱톡 전용 — 사장님이 매번 고른 값 (2026-09-12 지시 8).
     ⚠ 다른 SNS 는 이 값을 보지 않는다. 안 보내도 그쪽은 그대로 돈다. */
  tiktok: z.object({
    title: z.string().max(2200).default(""),
    privacyLevel: z.string().min(1).max(64),
    disableComment: z.boolean().default(false),
    disableDuet: z.boolean().default(false),
    disableStitch: z.boolean().default(false),
    /* ★ 상업용 콘텐츠 (2026-09-12 규격서 C). 화면의 토글이 여기로 온다 */
    brandOrganic: z.boolean().default(false),
    brandedContent: z.boolean().default(false),
  }).optional(),
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
  const { slug, anonId, entryId, providers, caption: typed, tiktok: ttChoice } = parsed.data;

  /* ★★ **[간단 등록]에서는 틱톡을 못 고른다** (2026-09-12 회장님 지시 8).
     틱톡은 올릴 때마다 공개범위를 직접 골라야 해서(심사 요건) «5초 흐름»에 들어갈 수 없다.
     화면도 막지만 **서버가 다시 막는다** — 화면 값을 믿지 않는다(불변 규칙 4의 정신).
     ⚠ 조용히 빼지 않는다. 왜 안 되는지 말한다. */
  if (providers.includes("tiktok") && !ttChoice) {
    return NextResponse.json(
      { error: "틱톡은 올릴 때마다 제목·공개범위를 직접 고르셔야 해요. 영상 카드의 [틱톡에 올리기]를 눌러 주세요." },
      { status: 400 },
    );
  }

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
  /* ★ 사장님이 쓴 글이 있으면 그것을 쓴다. 없으면 예전처럼 질문·제목. (2026-09-12) */
  const caption = (typed?.trim() || (row?.question as string) || (row?.title as string) || "").slice(0, 2200);

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

    /* ★ 인스타·틱톡: 규격 검사 → 공개 복사.
       둘 다 «우리가 준 공개 주소를 그쪽이 가져가는» 방식이다(PULL_FROM_URL).
       ⚠ 유튜브는 파일을 직접 보내므로 복사하지 않는다 — 쓸데없이 공개로 내보내지 않는다.
       ⚠ 틱톡은 그 주소의 **도메인이 틱톡에 인증돼 있어야** 받는다. 안 돼 있으면
         `url_ownership_unverified` 로 거절한다 — 화면의 [자세한 이유 보기]에 그대로 뜬다. */
    const needsPublicUrl = provider === "instagram" || provider === "tiktok";
    let publicUrl = "";
    let publicKey: string | null = null;
    let igSpec: { bytes: number | null; width: number | null; moovFirst: boolean | null; container: string | null } | null = null;
    if (needsPublicUrl) {
      const chk = await checkForInstagram(videoKey);
      /* ★★ 잰 값을 **성공해도 함께 돌려준다** (2026-09-12 지시 3).
         첫 실제 게시에서 「왜 거절당했는지」를 사람이 눈으로 대조해야 한다.
         `null` 은 «못 잰 것»이지 «0» 이 아니다 — 화면이 그렇게 말한다. */
      const spec = { bytes: chk.bytes, width: chk.width, moovFirst: chk.moovFirst, container: chk.container };
      if (!chk.ok) return say("failed", chk.why, { kind: "REJECTED", detail: `규격 검사: ${JSON.stringify(spec)}`, spec });
      const pk = storage.publicVideoKeyOf(videoKey);
      if (!pk) return say("failed", "영상 주소가 이상해요. 다시 찍어 주세요.", { kind: "REJECTED" });
      try {
        await storage.copyToPublic(videoKey, pk, "video/mp4");
      } catch (e) {
        console.error(JSON.stringify({ evt: "sns_copy_failed", provider, err: String(e).slice(0, 160) }));
        return say("failed", `영상을 ${name} 이 가져갈 수 있는 자리로 옮기지 못했어요.`, { kind: "TRANSIENT" });
      }
      publicKey = pk;
      publicUrl = storage.publicUrl(pk);
      /* ★ 인스타가 «가져갈» 주소를 로그에 남긴다. 그쪽이 못 가져가면 이 주소를
         브라우저로 직접 열어 보는 것이 첫 확인이다. */
      console.log(JSON.stringify({ evt: "sns_public_ready", provider, entryId, publicUrl, spec }));
      igSpec = spec;
    }


    /* ★★ 돈이 걸린 자리 — X 는 글에 링크가 있으면 요금이 **13배** 뛴다($0.015 → $0.200).
       글의 원본(story_entries.question)은 **녹화 화면이 보낸 값**이라 폰에서 조작될 수 있다.
       그래서 화면이 아니라 **서버가, 보내기 직전에** 지운다. */
    const safeCaption = captionFor(provider, caption);
    const safeTitle = captionFor(provider, title);
    /* ★ 마지막 확인 — 지웠는데도 남아 있으면 **보내지 않는다.**
       13배 요금을 무는 것보다 안 보내고 이유를 말하는 편이 낫다. */
    if (provider === "x" && (hasUrl(safeCaption) || hasUrl(safeTitle))) {
      console.error(JSON.stringify({ evt: "sns_x_url_blocked", entryId }));
      return say("failed", "X 에 보낼 글에서 주소를 다 지우지 못했어요. 글에서 링크를 빼고 다시 시도해 주세요.", { kind: "REJECTED" });
    }

    const post = await db.createPost({ siteId, entryId, provider, publicKey });
    if (!post) return say("failed", "기록을 만들지 못했어요. 잠시 후 다시 시도해 주세요.", { kind: "TRANSIENT" });

    await db.updatePost(post.id, { status: "uploading", attempts: (post.attempts ?? 0) + 1 });
    const out = await a.upload({
      siteId, entryId, publicUrl, sourceKey: videoKey, title: safeTitle, caption: safeCaption,
      /* ★ 그 SNS 에만 있는 것. 지금은 틱톡뿐이다 — 다른 어댑터는 이 칸을 보지 않는다 */
      extra: provider === "tiktok" ? ttChoice : undefined,
    });

    if (out.state === "published") {
      await db.updatePost(post.id, {
        status: "published", remote_post_id: out.remotePostId, remote_url: out.remoteUrl,
        published_at: new Date().toISOString(), error_kind: null, error_detail: null,
      });
      console.log(JSON.stringify({ evt: "sns_published", provider, entryId }));
      return say("published", `${name} 에 올렸어요.`, { url: out.remoteUrl, spec: igSpec });
    }
    if (out.state === "processing") {
      await db.updatePost(post.id, { status: "processing", container_id: out.containerId });
      return say("processing", `${name} 이 영상을 받는 중이에요. 잠시만요…`, { spec: igSpec });
    }
    await db.updatePost(post.id, { status: "failed", error_kind: out.kind, error_detail: out.detail.slice(0, 300) });
    console.error(JSON.stringify({ evt: "sns_publish_failed", provider, entryId, kind: out.kind, detail: out.detail.slice(0, 300) }));
    /* ★★ **그쪽이 준 말을 그대로 함께 보낸다** (2026-09-12 지시 3).
       전에는 네 문장 중 하나(「지금은 안 되네요」)만 갔다. 그러면 회장님이 무엇을 고쳐야 할지 모른다.
       ⚠ 원문은 개발자용이라 화면이 **접어서** 보여 준다 — 사장님에게는 친절한 문장이 먼저다. */
    return say("failed", ERROR_SAY[out.kind], { kind: out.kind, detail: out.detail.slice(0, 300), spec: igSpec });
  }
}
