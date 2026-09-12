import * as storage from "@/lib/storage";
import { sbAdmin } from "@/lib/db-admin";
import * as db from "./db";
import { getAdapter } from "./index";
import { captionFor, hasUrl } from "./no-url";
import { refreshLongLived } from "./instagram";

/**
 * SNS 유지보수 — 사람이 화면을 보고 있지 않을 때 대신 손봐 주는 일들. (2026-09-12 회장님 지시 1·8)
 *
 * ★★ **왜 새 크론을 안 만드나.** Vercel 무료(Hobby)는 크론 개수도 제한이 있고,
 *   `vercel.json` 의 크론 한 줄이 틀리면 **배포 전체가 실패한다**(2026-09-12 실제로 12개 항목이
 *   그 한 줄에 막혔다). 지금 크론이 딱 둘(`expire`·`weekly`)이라 셋째 줄을 넣는 것은
 *   그 사고를 다시 부를 위험이 있다. 그래서 **이미 매일 도는 `weekly` 크론이 이 함수를 부른다.**
 *   나중에 Pro 로 올려 크론을 늘릴 때는 이 함수를 부르는 라우트만 새로 만들면 된다 —
 *   **일 자체(이 파일)는 그대로 쓴다.**
 *
 * ★ 두 가지 일이 있다:
 *   ① `refreshInstagramTokens()` — 60일짜리 토큰이 죽기 전에 미리 밀어 준다
 *   ② `finishStuckPosts()`       — 화면을 닫아서 「받는 중」으로 멈춘 영상을 마무리한다
 */

/* ─────────────── ① 토큰 갱신 ─────────────── */

/** 만료 며칠 전부터 미리 미나 — 회장님 지시 「만료 2주 전쯤」 */
const REFRESH_BEFORE_DAYS = 14;
const DAY = 86_400_000;

export type RefreshOut = {
  looked: number; refreshed: number; expired: number; failed: number; skipped: number;
};

/** 갱신 결과를 어떻게 받아들일 것인가 — 세 갈래뿐이다 */
export type RefreshVerdict = "skip" | "dead" | "retry";

/**
 * ★ **시험할 수 있게 떼어 낸 판단.** 60일을 기다려 볼 수는 없어서 여기만 따로 잰다
 * (`npx tsx scripts/sns-refresh-test.ts`).
 *
 * · `skip`  — 부를 필요도 없다(토큰이 없거나 이미 만료됐다)
 * · `dead`  — 끝났다. `expired` 로 내려 화면이 「다시 연결하기」를 보여 준다
 * · `retry` — 잠깐 안 되는 것. **그냥 둔다.** 내일 또 민다
 *
 * ⚠ 애매하면 `retry` 다. 성급하게 `dead` 로 내리면 **멀쩡한 연결을 우리가 끊는 것**이 된다.
 */
export function verdictFor(
  input: { accessToken: string | null; expiresAt: string | null },
  now: number,
  failKind?: "TRANSIENT" | "AUTH_EXPIRED" | "REJECTED" | "QUOTA_EXCEEDED",
): RefreshVerdict {
  if (!input.accessToken) return "skip";
  /* 이미 만료된 토큰은 갱신이 안 된다 — 인스타는 «만료 전»에만 받아 준다 */
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= now) return "dead";
  if (!failKind) return "retry";                                   // 아직 안 불러 봤다
  return failKind === "AUTH_EXPIRED" || failKind === "REJECTED" ? "dead" : "retry";
}

/** 지금 갱신을 밀어야 하는 만료 시각인가 — 「${REFRESH_BEFORE_DAYS}일 안에 죽는가」 */
export function isDue(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return true;   // 모르는 것이 가장 위험하다 — 한 번 밀어 본다
  return new Date(expiresAt).getTime() <= now + REFRESH_BEFORE_DAYS * DAY;
}

/**
 * 인스타 장기 토큰을 미리 갱신한다.
 *
 * ★★ **조용히 죽지 않게 하는 것이 목적이다.** 사장님이 두 달 동안 영상을 안 올리면
 *   토큰이 만료되고, 다음에 올리려 할 때야 「연결이 풀렸어요」를 본다. 그 사이에
 *   무슨 일이 있었는지 아무도 모른다. 그래서 매일 한 번 미리 밀어 둔다.
 *
 * ★ 갱신이 **확실히 끝난 것**(토큰이 죽었다)일 때만 `expired` 로 내린다.
 *   잠깐 안 되는 것(TRANSIENT·QUOTA)은 그냥 둔다 — 내일 또 민다.
 *   여기서 성급하게 내리면 멀쩡한 연결을 우리가 끊는 셈이 된다.
 */
export async function refreshInstagramTokens(now = Date.now()): Promise<RefreshOut> {
  const out: RefreshOut = { looked: 0, refreshed: 0, expired: 0, failed: 0, skipped: 0 };
  const due = await db.listForRefresh("instagram", new Date(now + REFRESH_BEFORE_DAYS * DAY).toISOString());

  for (const c of due) {
    out.looked++;

    /* 부르기 «전» 판단 — 토큰이 없거나 이미 만료된 것은 호출 자체가 낭비다 */
    const pre = verdictFor(c, now);
    if (pre === "skip") { out.skipped++; continue; }
    if (pre === "dead") {
      await db.markExpired(c.siteId, "instagram");
      out.expired++;
      console.error(JSON.stringify({ evt: "ig_token_already_expired", siteId: c.siteId, expiresAt: c.expiresAt }));
      continue;
    }

    const r = await refreshLongLived(c.accessToken!);
    if (r.ok) {
      await db.updateToken(c.siteId, "instagram", r.token, r.expiresAt);
      out.refreshed++;
      console.log(JSON.stringify({ evt: "ig_token_refreshed", siteId: c.siteId, until: r.expiresAt }));
      continue;
    }

    if (verdictFor(c, now, r.kind) === "dead") {
      /* 끝났다 — 사장님이 인스타에서 권한을 뺐거나 토큰이 죽었다.
         화면이 「다시 연결하기」를 보여 줄 수 있게 표시를 내린다. */
      await db.markExpired(c.siteId, "instagram");
      out.expired++;
      console.error(JSON.stringify({ evt: "ig_token_refresh_dead", siteId: c.siteId, kind: r.kind, detail: r.detail.slice(0, 200) }));
    } else {
      /* 잠깐 안 되는 것 — 내일 다시 민다. 멀쩡한 연결을 우리가 끊지 않는다 */
      out.failed++;
      console.warn(JSON.stringify({ evt: "ig_token_refresh_retry", siteId: c.siteId, kind: r.kind, detail: r.detail.slice(0, 200) }));
    }
  }
  return out;
}

/* ─────────────── ② 멈춘 올리기 마무리 ─────────────── */

/** 브라우저가 손을 뗀 것으로 보는 시간. 이보다 최근에 움직인 건은 건드리지 않는다 */
const IDLE_MINUTES = 15;
/** 이보다 오래 「받는 중」이면 포기한다 — 인스타 컨테이너는 하루면 그쪽에서 지워진다 */
const GIVE_UP_HOURS = 24;

export type FinishOut = {
  looked: number; published: number; stillWaiting: number; failed: number; gaveUp: number;
};

/**
 * 화면을 닫아 「받는 중」으로 멈춘 영상을 한 걸음씩 밀어 마무리한다.
 *
 * ★★ **①단계를 다시 하지 않는다.** `container_id` 가 있으면 그대로 쓴다.
 *   여기서 ①부터 다시 하면 **같은 영상이 두 번 올라간다** — 폴링 라우트와 같은 규칙이다.
 *
 * ⚠ 브라우저 폴링과 부딪히지 않게 `updated_at` 이 ${IDLE_MINUTES}분 이상 조용한 건만 집는다.
 */
export async function finishStuckPosts(now = Date.now()): Promise<FinishOut> {
  const out: FinishOut = { looked: 0, published: 0, stillWaiting: 0, failed: 0, gaveUp: 0 };
  const stuck = await db.listStuckPosts(new Date(now - IDLE_MINUTES * 60_000).toISOString());

  for (const p of stuck) {
    out.looked++;
    const provider = p.provider as Parameters<typeof getAdapter>[0];
    const entryId = p.entry_id;

    /* 너무 오래 걸린 것은 포기한다 — 그쪽이 이미 지웠다. 「받는 중」으로 영원히 두지 않는다 */
    if (now - new Date(p.created_at).getTime() > GIVE_UP_HOURS * 3_600_000) {
      await db.updatePost(p.id, {
        status: "failed", error_kind: "REJECTED",
        error_detail: `${GIVE_UP_HOURS}시간이 지나 그쪽에서 영상을 받지 못했어요. 다시 올려 주세요.`,
      });
      out.gaveUp++;
      console.error(JSON.stringify({ evt: "sns_stuck_gave_up", provider, postId: p.id }));
      continue;
    }

    /* 영상 줄이 지워졌으면 더 밀 수 없다 — 기록만 남기고 닫는다 */
    if (!entryId) {
      await db.updatePost(p.id, { status: "failed", error_kind: "REJECTED", error_detail: "영상이 없어졌어요." });
      out.failed++;
      continue;
    }

    const { data: row } = await sbAdmin().from("story_entries")
      .select("title, question, video_key").eq("id", entryId).maybeSingle();
    const title = ((row?.question as string) || (row?.title as string) || "사장님 이야기").slice(0, 100);
    const caption = ((row?.question as string) || (row?.title as string) || "").slice(0, 2000);
    const publicUrl = p.public_key ? storage.publicUrl(p.public_key) : "";

    /* ★ 돈이 걸린 자물쇠는 **모든 문에** 똑같이 단다 — 폴링 라우트와 같은 검사 */
    const safeCaption = captionFor(provider, caption);
    const safeTitle = captionFor(provider, title);
    if (provider === "x" && (hasUrl(safeCaption) || hasUrl(safeTitle))) {
      await db.updatePost(p.id, { status: "failed", error_kind: "REJECTED", error_detail: "X: URL in caption" });
      out.failed++;
      continue;
    }

    try {
      const r = await getAdapter(provider).upload({
        siteId: p.site_id, entryId, publicUrl,
        sourceKey: (row?.video_key as string) ?? "",
        title: safeTitle, caption: safeCaption,
        containerId: p.container_id,        // ★ 있으면 ①을 건너뛴다
      });

      if (r.state === "published") {
        await db.updatePost(p.id, {
          status: "published", remote_post_id: r.remotePostId, remote_url: r.remoteUrl,
          published_at: new Date(now).toISOString(), error_kind: null, error_detail: null,
        });
        out.published++;
        console.log(JSON.stringify({ evt: "sns_published", provider, entryId, via: "cron" }));
      } else if (r.state === "processing") {
        if (r.containerId && r.containerId !== p.container_id) {
          await db.updatePost(p.id, { container_id: r.containerId, status: "processing" });
        } else {
          /* 아무것도 안 바뀌어도 updated_at 은 밀어 둔다 — 다음 크론이 같은 줄을 또 집지 않게 */
          await db.updatePost(p.id, { status: "processing" });
        }
        out.stillWaiting++;
      } else {
        await db.updatePost(p.id, { status: "failed", error_kind: r.kind, error_detail: r.detail.slice(0, 300) });
        out.failed++;
        console.error(JSON.stringify({ evt: "sns_publish_failed", provider, entryId, kind: r.kind, via: "cron" }));
      }
    } catch (e) {
      /* 크론은 한 건 때문에 멈추지 않는다 — 다음 건으로 넘어간다 */
      out.failed++;
      console.error(JSON.stringify({ evt: "sns_stuck_error", provider, postId: p.id, err: String(e).slice(0, 200) }));
    }
  }
  return out;
}
