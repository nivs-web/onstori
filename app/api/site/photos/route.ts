import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import { SiteDoc, Gallery, type SiteDocT } from "@/lib/schema";
import { PHOTO_LIMITS } from "@/config/limits";
import { applyPublish } from "@/lib/publish-site";

const Input = z.object({
  slug: z.string(),
  anonId: z.string().optional(),
  /** 이미 /api/site/upload 로 올려서 받은 주소들 — 여기서는 파일을 받지 않는다 */
  urls: z.array(z.string().url()).min(1).max(PHOTO_LIMITS.onboarding),
});

/**
 * 가입 «사진 올리기» 단계(반장-지시 [2]) — 이미 업로드된 사진 주소를 갤러리·소개 섹션에 반영한다.
 * ⚠ 완성도 점수 규칙(lib/score.ts photo_real)은 손대지 않는다 — 그 규칙은 story_entries.photos
 *   (이야기에 붙인 사진)를 본다. 이 사진은 갤러리/소개용이라 다른 자리다. 새 점수 규칙을 만들지 않는다
 *   (CLAUDE.md 불변 규칙 12·반장-지시 지시사항).
 * ⚠ **이미지뱅크 사진보다 사장님 사진이 먼저 오게** 앞에 붙인다.
 */
export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const urls = body.data.urls;

  /** doc 하나(draft 또는 published)에 사진을 반영한 새 doc을 만든다. 형태가 안 맞으면 null(그대로 둔다) */
  function withPhotos(docIn: unknown): SiteDocT | null {
    const parsed = SiteDoc.safeParse(docIn);
    if (!parsed.success) return null;
    const doc = parsed.data;
    let sawGallery = false;
    const sections = doc.sections.map((s) => {
      if (s.type === "gallery") {
        sawGallery = true;
        // 사장님 사진을 앞에, 뒤에 기존(뱅크) 사진 — 중복 주소는 한 번만
        const merged = Array.from(new Set([...urls, ...s.photos])).slice(0, PHOTO_LIMITS.gallery);
        return { ...s, photos: merged };
      }
      if (s.type === "about" && !s.image) {
        return { ...s, image: urls[0] };
      }
      return s;
    });
    if (!sawGallery) {
      // ⚠ title 은 zod 기본값("갤러리")을 그대로 쓴다 — 여기서 문자열을 다시 적으면
      //   lib/schema.ts 의 기본값과 두 곳이 된다(단일 출처 원칙, CLAUDE.md 규칙 4).
      sections.push(Gallery.parse({ type: "gallery", photos: urls.slice(0, PHOTO_LIMITS.gallery) }));
    }
    const next = SiteDoc.safeParse({ ...doc, sections });
    return next.success ? next.data : doc; // 20개 상한 등에 걸리면 원래 doc 그대로 둔다
  }

  const nextDraft = withPhotos(r.site.draft);
  if (!nextDraft) return NextResponse.json({ error: "invalid-doc" }, { status: 422 });

  const { error } = await sbAdmin().from("sites").update({ draft: nextDraft }).eq("id", r.site.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* ⚠ 가입 직후 사진이 «바로» 손님 화면에 보이게, 여기서 발행까지 같이 한다(T-0031).
     published 를 여기서 직접 patch 하지 않는다(불변 규칙 5) — app/api/site/publish 와
     완전히 같은 함수(lib/publish-site.ts applyPublish)를 써서 site_versions 스냅샷 +
     revalidatePath + 스크린샷 갱신 + markFunnel + recomputeScore 를 빠짐없이 챙긴다.
     사진 저장(draft update)이 위에서 이미 실패했으면 여기까지 오지 않으므로
     "사진은 안 들어갔는데 발행만 됐다" 는 반쪽 상태가 나지 않는다. */
  const pub = await applyPublish(r.site, nextDraft, new URL(req.url).origin);
  if (!pub.ok) return NextResponse.json({ error: pub.error }, { status: 500 });

  return NextResponse.json({ ok: true, score: pub.score });
}
