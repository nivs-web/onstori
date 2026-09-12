import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { autoTags, normalizeTags, MAX_FIXED_TAGS } from "@/lib/hashtags";

export const dynamic = "force-dynamic";

/**
 * 「다듬어서 등록」 검토 화면이 쓰는 **하나뿐인 창구**. (2026-09-12 회장님 지시 C2·C3)
 *
 * ★ 왜 라우트를 하나로 묶었나: 화면이 열릴 때 필요한 것이 셋(저장된 글 · 고정 해시태그 ·
 *   자동 제안)인데, 셋을 따로 부르면 **창을 열 때마다 요청이 셋**이고 그중 하나만 느려도
 *   화면이 어긋난 상태로 잠깐 보인다. 한 번에 준다.
 *
 * ⚠ 이 라우트는 **아무것도 SNS 로 보내지 않는다.** 보내는 것은 `/api/sns/publish` 하나뿐이다.
 *   여기서 하는 일은 「사장님이 고친 것을 우리 표에 적어 두는 것」까지다.
 */

const Save = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid().optional(),
  /** 이 영상의 글. 비우면 지우는 것이 아니라 «빈 글»로 저장된다 */
  caption: z.string().max(5000).optional(),
  /** 가게 고정 해시태그 — 최대 5개(회장님 지시). 넘으면 서버가 자른다 */
  fixedTags: z.array(z.string().max(60)).max(30).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const peek = body as { slug?: string; anonId?: string; read?: boolean; entryId?: string };

  const r = await loadOwnedSite(String(peek.slug ?? ""), peek.anonId);
  if ("error" in r) {
    const forbidden = r.error === "forbidden";
    return NextResponse.json(
      { error: forbidden ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
      { status: forbidden ? 403 : 404 },
    );
  }
  const siteId = r.site.id as string;
  const settings = (r.site.settings as Record<string, unknown>) ?? {};
  const fixed = normalizeTags((settings.hashtags as string[]) ?? [], MAX_FIXED_TAGS);

  /* ★ 자동 태그는 **가게 정보에서 그대로 뽑는다.** 지어내지 않는다(lib/hashtags.ts 참고).
     주소는 발행본(published)에 있으면 그것을, 없으면 작업본(draft)에서 찾는다 —
     아직 한 번도 발행 안 한 사장님도 지역 태그를 받아야 하기 때문이다. */
  /* ⚠ `loadOwnedSite` 는 업종을 안 실어 준다 — 한 줄 더 묻는다. 못 읽어도 그냥 넘어간다
     (업종 태그 하나가 빠질 뿐이고, 그것 때문에 화면이 안 열리면 안 된다) */
  const { data: more } = await sbAdmin().from("sites").select("industry").eq("id", siteId).maybeSingle();
  const auto = autoTags({
    businessName: r.site.business_name as string,
    industryId: (more?.industry as string) ?? null,
    address: addressOf(r.site.published) || addressOf(r.site.draft),
  });

  if (peek.read) {
    let caption = "";
    let question = "";
    let captionColumnMissing = false;
    if (peek.entryId) {
      /* ⚠ `caption` 칸은 마이그레이션(20260912190000) 이후에 생긴다. 아직이면 **조용히 빈 값**으로
         두고 화면에는 「저장은 아직」이라고 **사실대로** 말한다. 화면 자체는 그래도 돈다. */
      const { data, error } = await sbAdmin().from("story_entries")
        .select("caption, question, title").eq("id", peek.entryId).eq("site_id", siteId).maybeSingle();
      if (error) {
        captionColumnMissing = true;
        const { data: fb } = await sbAdmin().from("story_entries")
          .select("question, title").eq("id", peek.entryId).eq("site_id", siteId).maybeSingle();
        question = (fb?.question as string) || (fb?.title as string) || "";
      } else {
        caption = (data?.caption as string) ?? "";
        question = (data?.question as string) || (data?.title as string) || "";
      }
    }
    return NextResponse.json({ caption, question, fixed, auto, captionColumnMissing, maxFixed: MAX_FIXED_TAGS });
  }

  const parsed = Save.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 값이에요" }, { status: 400 });
  const v = parsed.data;

  let savedCaption = false;
  let captionColumnMissing = false;
  if (v.entryId && v.caption !== undefined) {
    const { error } = await sbAdmin().from("story_entries")
      .update({ caption: v.caption }).eq("id", v.entryId).eq("site_id", siteId);
    if (error) {
      /* ⚠ **막지 않는다.** 칸이 없어도 올리기는 된다 — 글은 올릴 때 함께 보내기 때문이다.
         다만 「저장됐다」고 말하면 거짓말이므로 그 사실을 그대로 돌려준다. */
      captionColumnMissing = true;
      console.warn(JSON.stringify({ evt: "story_caption_save_failed", err: error.message.slice(0, 160) }));
    } else savedCaption = true;
  }

  let savedTags = fixed;
  if (v.fixedTags) {
    savedTags = normalizeTags(v.fixedTags, MAX_FIXED_TAGS);
    /* ⚠ `settings` 는 **통째로 덮어쓴다.** 방금 읽은 값에 얹어야 `weekly`·`phone` 이 안 날아간다 */
    const { error } = await sbAdmin().from("sites")
      .update({ settings: { ...settings, hashtags: savedTags } }).eq("id", siteId);
    if (error) {
      console.error(JSON.stringify({ evt: "hashtags_save_failed", err: error.message.slice(0, 160) }));
      return NextResponse.json({ error: "고정 해시태그를 저장하지 못했어요." }, { status: 500 });
    }
  }

  console.log(JSON.stringify({ evt: "story_review_saved", savedCaption, tags: savedTags.length }));
  return NextResponse.json({ ok: true, caption: v.caption ?? "", fixed: savedTags, auto, savedCaption, captionColumnMissing });
}

/** 사이트 문서에서 주소 한 줄을 찾는다 — 「오시는 길」 섹션이 가진 값이다 */
function addressOf(doc: unknown): string {
  const secs = (doc as { sections?: { type?: string; address?: string }[] } | null)?.sections ?? [];
  return secs.find((s) => s?.type === "map" && s.address)?.address ?? "";
}
