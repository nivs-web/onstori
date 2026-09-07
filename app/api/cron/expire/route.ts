import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw } from "@/lib/notify";
import * as storage from "@/lib/storage";
import {
  TRIAL_DAYS, DELETE_AFTER_SUSPEND_DAYS, INQUIRY_RETENTION_DAYS, INQUIRY_MAX_AGE_DAYS, COPY,
  DELETE_NOTICE_DAYS, MEMBERSHIP_PRICE, MEMBERSHIP_NAME,
} from "@/lib/trial";
import { charge } from "@/lib/toss";

/**
 * 매일 03:00 KST (vercel.json crons: 18:00 UTC) — 요금·기간 정책 집행
 * 정책의 단일 출처는 lib/trial.ts. 이 파일은 그 정책을 실행만 한다.
 *
 * 단계가 나뉘어 있다 (2026-09-06 확정: 무료 30일 → 정지 → 정지 후 60일 삭제)
 *   1) 무료 종료 D-3·D-1 안내 문자
 *   2) **정지 단계** — 무료가 끝난 사이트를 expired 로 내리고 suspended_at 을 찍는다. 자료는 그대로 둔다.
 *   3) 손님 문의 파기 — 접수 1년 경과분, 그리고 정지 60일 경과 사이트의 문의 전부
 *   4) **삭제 예고 문자** — 삭제 30일 전·7일 전
 *   5) **삭제 단계** — 정지 후 60일이 지난 미결제 사이트의 자료를 파일까지 영구 삭제
 *   6-0) 결제 3일 전 사전 고지 · 6) 매달 구독 청구
 *
 * ★ 2)와 5)는 반드시 분리돼 있어야 한다. 한 번에 지우면 사장님이 되살릴 기회가 없다.
 * 인증: Vercel 이 CRON_SECRET 을 Bearer 로 보낸다. env 가 없으면 운영자 호출만 허용하기 위해 거부.
 */
export const dynamic = "force-dynamic";

/**
 * D-3·D-1 안내 문자 (2026-09-06 단축).
 * EUC-KR 90바이트를 넘기면 솔라피가 LMS(장문)로 보내 요금이 3배가량 붙는다. 구 문구는 155바이트였다.
 * 상호명을 넣지 않는 이유도 같다 — business_name 은 스키마상 최대 40자라 그것만으로 예산을 넘긴다.
 * 사장님은 링크의 슬러그로 자기 가게를 알아본다. 슬러그가 최댓값(30자)이어도 87바이트로 SMS 안이다.
 */
function nudgeText(days: number, slug: string) {
  return `온스토리 무료 ${days}일 남음. 이후 ${COPY.priceLine} onstori.com/${slug}/edit`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = sbAdmin();
  const now = Date.now();
  const day = 86_400_000;
  const out = { nudged: 0, suspended: 0, inquiriesPurged: 0, photosPurged: 0, deleteNoticed: 0, deleteBlocked: 0, sitesDeleted: 0, filesPurged: 0, chargeNoticed: 0, charged: 0, chargeFailed: 0 };

  // 1) 안내 문자 — 만료까지 3일/1일 남은 사이트 (하루 한 번 도는 크론이므로 24시간 창)
  const { data: soon } = await sb
    .from("sites")
    .select("slug, business_name, settings, trial_ends_at")
    .eq("status", "trial")
    .gte("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(now + 3.5 * day).toISOString());
  for (const s of soon ?? []) {
    const left = Math.ceil((new Date(s.trial_ends_at).getTime() - now) / day);
    if (left !== 3 && left !== 1) continue;
    const phone = (s.settings as { phone?: string } | null)?.phone;
    if (!phone) continue;
    if (await sendSmsRaw(phone, nudgeText(left, s.slug))) out.nudged++;
  }

  // 2) 정지 단계 — 무료가 끝난 사이트를 비공개로. **자료는 건드리지 않는다.**
  //    suspended_at 을 함께 찍어야 5)의 삭제 기한(정지 + 60일)을 정확히 셀 수 있다.
  const { data: exp } = await sb
    .from("sites")
    .update({ status: "expired", suspended_at: new Date(now).toISOString() })
    .eq("status", "trial")
    .lt("trial_ends_at", new Date(now).toISOString())
    .select("slug");
  out.suspended = exp?.length ?? 0;

  // 3) 손님 문의 파기 — 개인정보보호법 제21조(보유기간 경과 시 지체 없이 파기)
  //    두 기준 중 **먼저 오는 때**에 지운다:
  //      (a) 접수일로부터 INQUIRY_MAX_AGE_DAYS(365) — 견적 폼 동의 문구가 손님에게 약속한 값
  //      (b) 사이트 정지일로부터 INQUIRY_RETENTION_DAYS(60) — 손님 개인정보는 오래 갖는 것 자체가 위험
  //    사진 파일을 먼저 지우고 행을 지운다. 순서를 뒤집으면 키를 잃어 파일만 남는 고아가 생긴다.
  const inquiryIds = new Set<string>();
  const inquiryRows: { id: string; photos: unknown }[] = [];

  const { data: aged } = await sb.from("inquiries").select("id, photos")
    .lt("created_at", new Date(now - INQUIRY_MAX_AGE_DAYS * day).toISOString()).limit(500);
  for (const r of aged ?? []) if (!inquiryIds.has(r.id)) { inquiryIds.add(r.id); inquiryRows.push(r); }

  // 정지 60일이 지난 사이트의 문의는 나이와 상관없이 전부
  const { data: longSuspended } = await sb.from("sites").select("id")
    .eq("status", "expired")
    .lt("suspended_at", new Date(now - INQUIRY_RETENTION_DAYS * day).toISOString()).limit(200);
  if (longSuspended?.length) {
    const { data: theirs } = await sb.from("inquiries").select("id, photos")
      .in("site_id", longSuspended.map((x) => x.id)).limit(500);
    for (const r of theirs ?? []) if (!inquiryIds.has(r.id)) { inquiryIds.add(r.id); inquiryRows.push(r); }
  }

  for (const row of inquiryRows) {
    const keys = Array.isArray(row.photos) ? (row.photos as string[]) : [];
    for (const key of keys) {
      try { await storage.remove("private", key); out.photosPurged++; }
      catch (e) {
        // 파일 하나가 이미 없어도 행 삭제는 계속한다 — 남기는 것보다 지우는 쪽이 안전하다
        console.error(JSON.stringify({ evt: "inquiry_photo_purge_failed", key, err: String(e).slice(0, 200) }));
      }
    }
    const { error } = await sb.from("inquiries").delete().eq("id", row.id);
    if (error) console.error(JSON.stringify({ evt: "inquiry_purge_failed", id: row.id, err: error.message }));
    else out.inquiriesPurged++;
  }

  // ── 정지된 사이트의 삭제 시각 = **suspended_at + DELETE_AFTER_SUSPEND_DAYS** ──
  //    가입일 파생이 아니라 정지일 기준이다. 결제 실패로 오늘 정지된 사장님이
  //    가입이 오래됐다는 이유로 곧바로 삭제 대상이 되면 안 된다.
  //    ★ 결제 이력이 있는 사이트는 절대 건드리지 않는다 — 전자상거래법상 5년 보존 대상이다.
  const { data: stopped } = await sb
    .from("sites")
    .select("id, slug, settings, trial_ends_at, suspended_at, paid_at, payment")
    .eq("status", "expired")
    .is("paid_at", null)
    .is("payment", null)
    .limit(500);

  const withDeleteAt = (stopped ?? [])
    // suspended_at 이 없는 옛 데이터는 무료 종료 시각으로 갈음한다(마이그레이션이 채워 준다)
    .map((s) => ({ ...s, suspendedMs: new Date((s.suspended_at ?? s.trial_ends_at) as string).getTime() }))
    .filter((s) => Number.isFinite(s.suspendedMs))
    .map((s) => ({ ...s, deleteMs: s.suspendedMs + DELETE_AFTER_SUSPEND_DAYS * day }));

  // 4) 삭제 예고 문자 — 남은 일수가 예고일과 정확히 같은 날에만 (크론이 하루 한 번이라 중복되지 않는다)
  //    ★ 보낸 사실을 settings.delete_notices 에 기록한다. 5)의 삭제 게이트가 이 기록을 본다.
  for (const s of withDeleteAt) {
    const left = Math.ceil((s.deleteMs - now) / day);
    if (!(DELETE_NOTICE_DAYS as readonly number[]).includes(left)) continue;
    const phone = (s.settings as { phone?: string } | null)?.phone;
    if (!phone) continue;
    // 90바이트(EUC-KR) 안 — 넘으면 LMS 로 나가 요금이 3배가 된다 (2026-09-06 nudgeText 와 같은 제약)
    // 슬러그 최댓값(30자)에서 83바이트. "홈페이지"·"지금"을 뺀 이유가 이것이다 — 넣으면 97바이트로 LMS 가 된다.
    const sent = await sendSmsRaw(phone, `온스토리 ${left}일 뒤 자료 삭제. 결제하면 복구 onstori.com/${s.slug}/edit`);
    if (!sent) continue;
    out.deleteNoticed++;
    const prev = (s.settings as { delete_notices?: string[] } | null)?.delete_notices ?? [];
    await sb.from("sites")
      .update({ settings: { ...(s.settings as Record<string, unknown>), delete_notices: [...prev, `d${left}:${new Date(now).toISOString()}`] } })
      .eq("id", s.id);
  }

  // 5) 유예가 지난 미결제 사이트 자동 삭제 — 파일 먼저, DB 나중
  //    (순서를 뒤집으면 경로를 잃어 파일만 남는 고아가 생긴다)
  //
  // ★ 삭제 게이트 — 예고를 한 번이라도 **실제로 보내지 못했으면 지우지 않는다.**
  //   이용약관이 "삭제 전에 미리 알려드립니다" 를 삭제권의 발생 요건으로 약속했다.
  //   연락처가 없거나 문자가 계속 실패한 사장님의 홈페이지가 예고 한 번 없이 영구 삭제되는 것을 막는다.
  //   크론이 며칠 걸러져 D-3·D-1 을 모두 놓친 경우에도 여기서 걸린다 — 그때는 지우지 않고 로그만 남긴다.
  for (const s of withDeleteAt) {
    if (s.deleteMs > now) continue;
    const notices = (s.settings as { delete_notices?: string[] } | null)?.delete_notices ?? [];
    if (notices.length === 0) {
      console.error(JSON.stringify({ evt: "site_delete_blocked_no_notice", slug: s.slug, reason: "예고 문자를 한 번도 보내지 못했다 — 사람이 확인할 것" }));
      out.deleteBlocked++;
      continue;
    }
    try {
      out.filesPurged += await storage.removePrefix("media", `uploads/${s.slug}/`);
      out.filesPurged += await storage.removePrefix("private", `inquiries/${s.id}/`);
      out.filesPurged += await storage.removePrefix("private", `private/stories/${s.slug}/`);
      // showcase 는 slug 로만 엮여 있어 FK 캐스케이드가 안 걸린다 — 직접 지운다
      await sb.from("showcase").delete().eq("slug", s.slug);
      // sites 를 지우면 story_entries·site_versions·site_progress·inquiries·events 는
      // on delete cascade 로 함께 사라진다 (20260831120000_core.sql)
      const { error } = await sb.from("sites").delete().eq("id", s.id);
      if (error) throw new Error(error.message);
      out.sitesDeleted++;
      console.log(JSON.stringify({ evt: "site_auto_deleted", slug: s.slug, trialEndedAt: s.trial_ends_at }));
    } catch (e) {
      console.error(JSON.stringify({ evt: "site_delete_failed", slug: s.slug, err: String(e).slice(0, 300) }));
    }
  }

  // 6-0) 결제 3일 전 사전 고지 — 정기결제는 청구 전에 금액·날짜·수단·해지 방법을 알려야 한다.
  //      ★ 예고 없이 카드를 긁지 않는다. 이 블록을 지우면 이용약관 제5조의 약속이 깨진다.
  if (process.env.TOSS_SECRET_KEY?.trim()) {
    const from = new Date(now + 2.5 * day).toISOString();
    const to = new Date(now + 3.5 * day).toISOString();
    const { data: upcoming } = await sb
      .from("billing")
      .select("site_id, card_last4, next_charge_at")
      .eq("status", "active").gte("next_charge_at", from).lte("next_charge_at", to).limit(300);
    for (const b of upcoming ?? []) {
      const { data: site } = await sb.from("sites").select("slug, settings").eq("id", b.site_id).maybeSingle();
      const phone = (site?.settings as { phone?: string } | null)?.phone;
      if (!site || !phone) continue;
      const d = new Date(b.next_charge_at);
      const when = `${d.getMonth() + 1}/${d.getDate()}`;
      // EUC-KR 90바이트 안 (슬러그 30자 기준 실측)
      if (await sendSmsRaw(phone, `온스토리 ${when} ${COPY.priceOnly} 결제 예정. 해지는 onstori.com/my`)) out.chargeNoticed++;
    }
  }

  // 6) 매달 구독 청구 — next_charge_at 이 지난 active 구독
  //    ⚠ 가맹 심사 전에는 TOSS_SECRET_KEY 가 없어 charge() 가 던진다. 그때는 조용히 건너뛴다.
  if (process.env.TOSS_SECRET_KEY?.trim()) {
    const { data: due } = await sb
      .from("billing")
      .select("site_id, customer_key, billing_key, next_charge_at, fail_count")
      .eq("status", "active")
      .lte("next_charge_at", new Date(now).toISOString())
      .limit(200);

    for (const b of due ?? []) {
      const { data: site } = await sb.from("sites").select("id, slug, business_name").eq("id", b.site_id).maybeSingle();
      if (!site) continue;
      const orderId = `os-${site.slug}-${new Date(now).toISOString().slice(0, 10)}-${b.fail_count}`;
      const paid = await charge({
        billingKey: b.billing_key,
        customerKey: b.customer_key,
        amount: MEMBERSHIP_PRICE,
        orderId,
        orderName: `${MEMBERSHIP_NAME} (${site.business_name})`,
      });

      if (paid.ok) {
        const next = new Date(b.next_charge_at);
        next.setMonth(next.getMonth() + 1);
        await sb.from("billing").update({
          last_charge_at: new Date(now).toISOString(), next_charge_at: next.toISOString(), fail_count: 0,
        }).eq("site_id", b.site_id);
        await sb.from("payments").insert({
          site_id: site.id, site_slug: site.slug, order_id: orderId, kind: "recurring",
          payment_key: paid.data.paymentKey, amount: paid.data.totalAmount ?? MEMBERSHIP_PRICE,
          status: "paid", method: paid.data.method ?? null,
          approved_at: paid.data.approvedAt ?? new Date(now).toISOString(),
          raw: paid.data as unknown as Record<string, unknown>,
        });
        out.charged++;
      } else {
        // 카드 한도·유효기간 문제는 흔하다. 바로 끊지 않고 3번까지 다음 날 다시 시도한다.
        const fails = (b.fail_count ?? 0) + 1;
        await sb.from("payments").insert({
          site_id: site.id, site_slug: site.slug, order_id: orderId, kind: "recurring", amount: MEMBERSHIP_PRICE,
          status: "failed", fail_code: paid.code, fail_message: paid.message,
        });
        if (fails >= 3) {
          await sb.from("billing").update({ status: "failed", fail_count: fails }).eq("site_id", b.site_id);
          await sb.from("sites").update({ status: "expired" }).eq("id", site.id);
          console.error(JSON.stringify({ evt: "subscription_failed_final", slug: site.slug, code: paid.code }));
        } else {
          const retry = new Date(now + day);
          await sb.from("billing").update({ fail_count: fails, next_charge_at: retry.toISOString() }).eq("site_id", b.site_id);
        }
        out.chargeFailed++;
      }
    }
  }

  console.log(JSON.stringify({ evt: "cron_expire", ...out }));
  return NextResponse.json(out);
}
