import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { SNIFF_BYTES, isPlayableVideo, sniff, whyNotPlayable } from "@/lib/media-sniff";
import { videoSection } from "@/lib/section-defaults";
import { trialInfo } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  anonId: z.string().max(64).optional(),
  entryId: z.string().uuid(),
});

/**
 * 「홈페이지에 걸기」 — 비공개에 보관된 60초 영상을 **공개 버킷으로 복사하고**
 * 손님 사이트에 넣을 «영상 섹션»을 만들어 돌려준다 (2026-09-11, V-1 C).
 *
 * ★★ **`sites.draft` 를 서버가 고치지 않는다.**
 *   편집화면은 doc 을 React state 로 들고 2초마다 **통째로** 저장한다(`/api/site/update`).
 *   서버가 draft 를 고쳐 봐야 사장님 화면의 낡은 doc 이 곧 덮어쓴다.
 *   그래서 서버는 **파일 복사 + story_entries 갱신**만 하고 섹션 객체를 돌려주며,
 *   그 섹션을 자기 doc 에 끼워 넣는 것은 **클라이언트 몫**이다. 그러면 평소 저장 흐름을 탄다.
 *
 * ★ 복사는 R2 안에서 끝난다(`storage.copyToPublic`). 파일이 우리 서버를 통과하지 않는다.
 *   복사하면서 **1년 캐시**를 새로 붙인다 — 브라우저가 쓰는 서명 PUT URL 로는 못 붙이는 값이다.
 *
 * ⚠ 원본(`private/`)은 **그대로 둔다.** 지우지 않는다(불변 규칙 10). 나중에 자막 워커가 쓴다.
 * ⚠ 실패하면 **반드시 이유를 돌려준다.** 조용히 실패하지 않는다(회장님 지시 1).
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  const { slug, anonId, entryId } = parsed.data;

  const r = await loadOwnedSite(slug, anonId);
  if ("error" in r) {
    return NextResponse.json(
      { error: r.error === "forbidden" ? "이 홈페이지를 고칠 권한이 없어요" : "홈페이지를 찾지 못했어요" },
      { status: r.error === "forbidden" ? 403 : 404 },
    );
  }
  /* ⚠ raw status 를 보면 **무료기간이 끝났는데 만료 크론이 아직 안 돈 사이트**를 놓친다.
     그 사이 영상을 걸면 손님에게 안 보이는 홈페이지에 파일만 공개로 복사된다.
     정지·만료 판정의 단일 출처는 `lib/trial.ts` 다(에디터 상단 바·차단 화면도 이것만 본다). */
  if (trialInfo(r.site).expired) {
    return NextResponse.json({ error: "홈페이지가 정지 상태예요. 정기결제를 시작하시면 다시 열려요" }, { status: 402 });
  }

  const sb = sbAdmin();
  const { data: row, error } = await sb
    .from("story_entries")
    .select("id, title, question, video_key")
    .eq("id", entryId)
    .eq("site_id", r.site.id)   // ⚠ 남의 사이트 영상을 걸 수 없게 site_id 를 함께 건다
    .maybeSingle();

  if (error) return NextResponse.json({ error: `영상을 찾지 못했어요: ${error.message.slice(0, 80)}` }, { status: 500 });
  if (!row?.video_key) return NextResponse.json({ error: "그 영상을 찾지 못했어요. 목록을 새로 고쳐 주세요" }, { status: 404 });

  const key = row.video_key as string;
  const publicKey = storage.publicVideoKeyOf(key);
  if (!publicKey) return NextResponse.json({ error: "영상 주소가 이상해요. 다시 찍어 주세요" }, { status: 400 });

  /* ★ 걸기 직전에 형식을 한 번 더 본다.
     A덩어리에서 두 번 걸렀지만, 여기가 **손님에게 나가는 마지막 문**이다.
     못 쓰는 파일이 손님 사이트에 걸리는 것보다 여기서 막는 편이 낫다. */
  try {
    const found = sniff(await storage.readHead("private", key, SNIFF_BYTES));
    if (!isPlayableVideo(found)) {
      console.error(JSON.stringify({ evt: "video_attach_bad_container", slug, entryId, container: found.container }));
      return NextResponse.json({ error: whyNotPlayable(found) }, { status: 422 });
    }
  } catch (e) {
    console.error(JSON.stringify({ evt: "video_attach_head_failed", slug, entryId, err: String(e).slice(0, 160) }));
    return NextResponse.json({ error: "영상 파일을 열지 못했어요. 잠시 후 다시 시도해 주세요" }, { status: 502 });
  }

  try {
    await storage.copyToPublic(key, publicKey, "video/mp4");
  } catch (e) {
    console.error(JSON.stringify({ evt: "video_copy_failed", slug, entryId, err: String(e).slice(0, 200) }));
    return NextResponse.json({ error: "영상을 손님이 볼 수 있는 자리로 옮기지 못했어요. 잠시 후 다시 시도해 주세요" }, { status: 502 });
  }

  /* 표지가 있으면 같이 쓴다. 없어도 영상은 정상으로 나간다(A덩어리 결정) */
  const posterKey = storage.posterKeyOf(key);
  let poster: string | undefined;
  if (posterKey) {
    try { await storage.readHead("media", posterKey, 1); poster = storage.publicUrl(posterKey); }
    catch { poster = undefined; }
  }

  /* story_entries 갱신 — **발행본 주소만** 적는다.
     ⚠ `media_status` 를 건드리지 않는다. 워커용 인덱스가
       `where media_status in (uploaded, processing)` 이라 `ready` 로 올리면
       **STEP 4 자막 워커가 이 영상을 영영 집지 않는다.** 게다가 마이그레이션이 정의한
       `ready` 는 「자막 영상 완성」인데 우리는 자막을 만든 적이 없다 — 화면이 거짓말하는 것과 같다.
       「공개 사본이 있다」는 사실은 `video_out_key` 하나가 이미 다 말한다.
     ⚠ `visible` 도 건드리지 않는다. true 로 바꾸면 **이야기 피드에 내용이 텅 빈 항목이 뜨고**,
       완성도 규칙 story_1(15점)이 저절로 올라간다 — 판정·화면·힌트가 어긋난다(불변 규칙 12).
     ⚠ `sort` 도 건드리지 않는다. 저장소 어느 코드도 그 칸을 읽지 않는다. */
  const { error: upErr } = await sb
    .from("story_entries")
    .update({ video_out_key: publicKey })
    .eq("id", entryId);
  if (upErr) {
    // 파일은 이미 복사됐다. 기록만 실패한 것이라 섹션은 그대로 돌려준다 — 다시 걸면 덮어쓴다
    console.error(JSON.stringify({ evt: "video_attach_row_failed", slug, entryId, err: upErr.message.slice(0, 160) }));
  }

  const section = videoSection({
    url: storage.publicUrl(publicKey),
    poster,
    caption: (row.question as string) || undefined,
  });

  console.log(JSON.stringify({ evt: "video_attached", slug, entryId, poster: !!poster }));
  return NextResponse.json({ section });
}
