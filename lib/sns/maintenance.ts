import * as storage from "@/lib/storage";
import { sbAdmin } from "@/lib/db-admin";
import * as db from "./db";
import { getAdapter } from "./index";
import { captionFor, hasUrl } from "./no-url";
import { refreshLongLived, isPostAlive } from "./instagram";
import { freshToken as ttFreshToken } from "./tiktok";

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

/* ─────────────── ①-b 틱톡 토큰 ─────────────── */

/**
 * 틱톡 접근 토큰을 밀어 둔다. (2026-09-12)
 *
 * ★★ **틱톡은 24시간짜리다**(인스타는 60일). 그래서 «가끔 갱신»으로는 못 버틴다.
 *   진짜 방어는 **올리기 직전의 갱신**(`tiktok.freshToken`)이고, 이건 그 위의 보조다 —
 *   갱신 토큰(365일)이 살아 있는지 매일 한 번 확인하는 셈이다.
 *
 * ⚠ 실패해도 `expired` 로 내리지 않는다. 올릴 때 다시 시도하면 되고,
 *   거기서도 안 되면 그때 화면이 「다시 연결하기」를 보여 준다.
 */
export async function refreshTiktokTokens(): Promise<{ looked: number; ok: number; failed: number }> {
  const out = { looked: 0, ok: 0, failed: 0 };
  /* 만료가 «언제든» 가까운 것 — 24시간짜리라 사실상 전부다 */
  const due = await db.listForRefresh("tiktok", new Date(Date.now() + 2 * DAY).toISOString());
  for (const c of due) {
    out.looked++;
    const t = await ttFreshToken(c.siteId);
    if (t) out.ok++;
    else { out.failed++; console.warn(JSON.stringify({ evt: "tt_token_stale", siteId: c.siteId })); }
  }
  return out;
}

/* ─────────────── ①-2 올린 글이 아직 살아 있나 ─────────────── */

/** 한 번 확인한 글을 며칠 뒤에 다시 물어보나 */
const RECHECK_AFTER_DAYS = 7;
/** 한 번에 몇 건까지 물어보나 — 호출을 조금씩 나눠 쓴다 */
const RECHECK_LIMIT = 50;

export type AliveOut = { looked: number; alive: number; gone: number; unknown: number };

/**
 * 올린 글이 그쪽에서 **지워졌는지** 확인해 사실대로 적는다. (2026-09-12 회장님 지시 2)
 *
 * ★★ 왜 필요한가: 2026-09-12 회장님이 첫 게시 뒤 인스타 앱에서 그 글을 직접 지우셨다.
 *   우리 화면은 여전히 「올라갔어요 [보기]」라고 말하고, 누르면 없는 글로 간다.
 *   사장님에게도 똑같이 생긴다 — **화면이 사실과 다르면 그 자체가 거짓말이다**(불변 규칙 12).
 *
 * ★★ 세 갈래 중 이것을 골랐다:
 *   ①그냥 두기 → 화면이 계속 거짓말한다
 *   ②「지워졌을 수도 있어요」라고 쓰기 → **추측이다.** 안 지운 사장님에게도 뜬다
 *   ③**확인해서 사실만 적기** ← 이것. 확인 못 하면 **아무 말도 하지 않는다**
 *
 * ⚠ `status` 는 `published` 로 **그대로 둔다.** 우리가 올린 것은 사실이고,
 *   메타 심사의 「성공한 호출」 증거도 그 기록이다.
 */
export async function checkPublishedAlive(now = Date.now()): Promise<AliveOut> {
  const out: AliveOut = { looked: 0, alive: 0, gone: 0, unknown: 0 };
  const sb = sbAdmin();

  /* 아직 지워진 것으로 확인되지 않은 글 중, 한 번도 안 물어봤거나 마지막 확인이 오래된 것 */
  const staleBefore = new Date(now - RECHECK_AFTER_DAYS * DAY).toISOString();
  const { data, error } = await sb.from("sns_posts")
    .select("id, site_id, provider, remote_post_id, remote_checked_at")
    .eq("status", "published").eq("provider", "instagram")
    .is("remote_deleted_at", null)
    .not("remote_post_id", "is", null)
    .or(`remote_checked_at.is.null,remote_checked_at.lte.${staleBefore}`)
    .limit(RECHECK_LIMIT);
  if (error) {
    /* ⚠ 마이그레이션(20260912140000) 전이면 칸이 없어 여기서 실패한다. **조용히 넘어간다** —
       크론의 다른 일(토큰 갱신·멈춘 올리기)까지 멈추면 안 된다. */
    console.warn(JSON.stringify({ evt: "sns_alive_skipped", err: error.message.slice(0, 160) }));
    return out;
  }

  /* 같은 사이트의 토큰을 여러 번 읽지 않는다 */
  const tokenOf = new Map<string, string | null>();

  for (const p of data ?? []) {
    out.looked++;
    const siteId = (p as { site_id: string }).site_id;
    if (!tokenOf.has(siteId)) {
      const tk = await db.readTokens(siteId, "instagram");
      tokenOf.set(siteId, tk?.accessToken ?? null);
    }
    const token = tokenOf.get(siteId);
    if (!token) { out.unknown++; continue; }

    const verdict = await isPostAlive(String((p as { remote_post_id: string }).remote_post_id), token);
    const stamp = new Date(now).toISOString();
    if (verdict === "gone") {
      await sb.from("sns_posts")
        .update({ remote_deleted_at: stamp, remote_checked_at: stamp, updated_at: stamp })
        .eq("id", (p as { id: string }).id);
      out.gone++;
      console.log(JSON.stringify({ evt: "sns_post_gone", provider: "instagram", postId: (p as { id: string }).id }));
    } else if (verdict === "alive") {
      await sb.from("sns_posts")
        .update({ remote_checked_at: stamp })
        .eq("id", (p as { id: string }).id);
      out.alive++;
    } else {
      /* 못 물어봤다 — **아무것도 적지 않는다.** 다음에 다시 묻는다 */
      out.unknown++;
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

    /* ★★★ **유튜브는 크론이 이어서 올리지 않는다.** (2026-09-13 점검에서 잡힌 것)
       아래의 「①단계를 다시 하지 않는다」는 **인스타 이야기**다 — 인스타는 컨테이너 id 가
       있어 이어 갈 수 있지만, 유튜브는 `containerId` 를 아예 쓰지 않고 부를 때마다
       **새 영상을 올린다.** 그대로 두면 첫 시도가 그쪽에서는 성공했는데 응답만 끊긴 흔한
       경우에 **같은 영상이 두 개** 쌓인다.
       ⚠ 감사 통과 «전»이면 그 둘이 **전부 영구 비공개**다 — 사장님이 버리는 60초가 두 배가 된다.
       ★ 그래서 실패로 닫고 사장님께 돌려준다. 다시 올릴지는 사장님이 정한다. */
    if (p.provider === "youtube") {
      await db.updatePost(p.id, {
        status: "failed", error_kind: "TRANSIENT",
        error_detail: "올리는 도중 끊겨서 멈췄어요. 다시 올려 주세요.",
      });
      out.failed++;
      console.log(JSON.stringify({ evt: "yt_stuck_closed", postId: p.id }));
      continue;
    }
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


/* ════════ 해지·정지 때 SNS 토큰 파기 (2026-09-13 김팀장 지적 · 지시 E2) ════════ */

export type PurgeOut = { looked: number; revoked: number; failed: number };

/**
 * ★★★ **그만 쓰시는 사장님의 SNS 열쇠를 우리 손에서 없앤다.**
 *
 * ⚠ 왜 필요한가: 해지하거나 정지돼도 `sns_connections` 의 토큰이 **그대로 남아 있었다.**
 *   그 토큰으로는 그 사장님의 인스타·틱톡·유튜브에 **글을 올릴 수 있다.** 서비스를 그만둔
 *   분의 계정 열쇠를 우리가 계속 쥐고 있는 것이다 — 사고가 나면 변명할 말이 없다.
 *
 * ★ 유튜브 약관은 이것을 **명시적으로 요구**한다 —
 *   「동의가 철회되면 즉시 프로그램으로 폐기하고, **7일 안에** 저장한 자료를 지운다」
 *   (developers.google.com/youtube/terms/developer-policies · Revocation).
 *
 * ★ 어댑터의 `disconnect()` 를 그대로 쓴다. 그 안에 «그쪽에 폐기를 알리는» 절차가 이미 있고
 *   (유튜브·틱톡), 우리 표에서 지우는 것도 거기서 한다. **두 벌을 만들지 않는다.**
 * ⚠ 한 곳이 실패해도 나머지는 계속 지운다 — 하나 때문에 전부 남으면 안 된다.
 */
export async function purgeSnsForSite(siteId: string, why: string): Promise<PurgeOut> {
  const out: PurgeOut = { looked: 0, revoked: 0, failed: 0 };
  const sb = sbAdmin();
  const { data, error } = await sb.from("sns_connections").select("provider").eq("site_id", siteId);
  if (error) {
    console.error(JSON.stringify({ evt: "sns_purge_query_failed", err: error.message.slice(0, 160) }));
    return out;
  }
  for (const row of data ?? []) {
    out.looked++;
    const provider = (row as { provider: string }).provider as Parameters<typeof getAdapter>[0];
    try {
      const r = await getAdapter(provider).disconnect(siteId);
      if (r.ok) out.revoked++; else out.failed++;
    } catch (e) {
      out.failed++;
      console.error(JSON.stringify({ evt: "sns_purge_failed", provider, err: String(e).slice(0, 160) }));
    }
  }
  if (out.looked) console.log(JSON.stringify({ evt: "sns_purged", siteId, why, ...out }));
  return out;
}
