import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { ERROR_SAY, PROVIDER_NAME, PROVIDERS, getAdapter } from "@/lib/sns";
import * as db from "@/lib/sns/db";
import { captionFor, hasUrl } from "@/lib/sns/no-url";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid(),
  provider: z.enum(PROVIDERS),
});

/**
 * 올리는 중인 것을 **한 걸음 더** 밀어 준다. (2026-09-11)
 *
 * ★★ 이 라우트가 있는 이유: 인스타 ②단계(최대 5분)를 **서버가 기다리지 않기 때문**이다.
 *   화면이 1분에 한 번 여기를 부른다. 서버는 «지금 됐나»만 한 번 보고 바로 답한다.
 *
 * ★★ **①부터 다시 하지 않는다.** `sns_posts.container_id` 가 있으면 그걸 그대로 쓴다.
 *   이게 없으면 폴링 때마다 새 컨테이너가 생겨 **같은 영상이 여러 번 올라간다**(회장님 지시 4).
 *
 * ⚠ 화면을 닫으면 폴링이 멈춘다. 그때는 `processing` 으로 남아 있다가 사장님이 화면에
 *   다시 들어오면 이어서 돈다. **자동으로 마무리하는 크론은 아직 없다 — 확인 필요.**
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const { slug, anonId, entryId, provider } = parsed.data;

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json({ error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" }, { status: forbidden ? 403 : 404 });
  }
  const siteId = r.site.id as string;
  const name = PROVIDER_NAME[provider];

  const post = await db.findLivePost(siteId, entryId, provider);
  if (!post) return NextResponse.json({ state: "none", msg: "올리는 중인 것이 없어요." });
  if (post.status === "published") {
    return NextResponse.json({ state: "published", msg: `${name} 에 올렸어요.`, url: post.remote_url });
  }

  const { data: row } = await sbAdmin().from("story_entries")
    .select("title, question, video_key").eq("id", entryId).eq("site_id", siteId).maybeSingle();
  const videoKey = (row?.video_key as string) ?? "";
  const title = ((row?.question as string) || (row?.title as string) || "사장님 이야기").slice(0, 100);
  const caption = ((row?.question as string) || (row?.title as string) || "").slice(0, 2000);
  const publicUrl = post.public_key ? storage.publicUrl(post.public_key) : "";

  /* ★★ 이어 하기에서도 똑같이 막는다. 시작 때만 막으면 폴링으로 우회된다 —
     돈이 걸린 자리는 **모든 문에** 같은 자물쇠를 단다. */
  const safeCaption = captionFor(provider, caption);
  const safeTitle = captionFor(provider, title);
  if (provider === "x" && (hasUrl(safeCaption) || hasUrl(safeTitle))) {
    console.error(JSON.stringify({ evt: "sns_x_url_blocked", entryId, via: "poll" }));
    await db.updatePost(post.id, { status: "failed", error_kind: "REJECTED", error_detail: "X: URL in caption" });
    return NextResponse.json({ state: "failed", msg: "X 에 보낼 글에서 주소를 다 지우지 못했어요.", kind: "REJECTED" });
  }

  const out = await getAdapter(provider).upload({
    siteId, entryId, publicUrl, sourceKey: videoKey, title: safeTitle, caption: safeCaption,
    containerId: post.container_id,      // ★ 있으면 ①을 건너뛴다
  });

  if (out.state === "published") {
    await db.updatePost(post.id, {
      status: "published", remote_post_id: out.remotePostId, remote_url: out.remoteUrl,
      published_at: new Date().toISOString(), error_kind: null, error_detail: null,
    });
    console.log(JSON.stringify({ evt: "sns_published", provider, entryId, via: "poll" }));
    return NextResponse.json({ state: "published", msg: `${name} 에 올렸어요.`, url: out.remoteUrl });
  }
  if (out.state === "processing") {
    /* 컨테이너 id 가 새로 나왔으면 적어 둔다(첫 폴링에서 생길 수 있다) */
    if (out.containerId && out.containerId !== post.container_id) {
      await db.updatePost(post.id, { container_id: out.containerId, status: "processing" });
    }
    return NextResponse.json({ state: "processing", msg: `${name} 이 영상을 받는 중이에요.` });
  }
  await db.updatePost(post.id, { status: "failed", error_kind: out.kind, error_detail: out.detail.slice(0, 300) });
  console.error(JSON.stringify({ evt: "sns_publish_failed", provider, entryId, kind: out.kind, via: "poll" }));
  return NextResponse.json({ state: "failed", msg: ERROR_SAY[out.kind], kind: out.kind });
}
