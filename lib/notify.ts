import { createHmac, randomBytes } from "crypto";
import { sbAdmin } from "./db-admin";

/**
 * 문의 접수 알림 — docs/specs/inquiry.md 4장.
 *
 * 사장님이 "문의가 왔다"를 60초 안에 아는 것이 이 기능의 전부다(P5 진입 조건 1).
 * 채널은 문자(솔라피) + 이메일(Resend). 카카오 알림톡은 P5 이후 여기에 채널만 더한다.
 *
 * 원칙 셋:
 *  1) **throw 하지 않는다.** 알림 실패가 접수 실패로 번지면 손님이 남긴 문의를 잃는다.
 *     실패는 로그 + `sites.settings.notify_last_error` 에만 남긴다.
 *  2) **env 가 없으면 그 채널을 건너뛴다.** 로컬·미설정 환경에서도 접수는 정상 동작해야 한다.
 *  3) 수신처는 사장님이 정한 값 우선 → 없으면 사이트에 적힌 전화·로그인 이메일로 폴백.
 */

export type NotifyInquiryArgs = {
  siteId: string;
  businessName: string;
  slug: string;
  inquiry: { name: string; phone: string; message?: string; photoCount: number };
};

type Settings = {
  notify?: { phone?: string; email?: string };
  notify_last_error?: { channel: string; at: string; msg: string };
};

const SITE_BASE = "onstori.com";

/** 채널별 env 준비 상태 — 운영자 점검(/api/admin/notify-check)에서도 쓴다. */
export function notifyChannels(): { sms: boolean; email: boolean } {
  return {
    sms: !!(process.env.SOLAPI_API_KEY?.trim() && process.env.SOLAPI_API_SECRET?.trim() && process.env.SOLAPI_SENDER?.trim()),
    email: !!process.env.RESEND_API_KEY?.trim(),
  };
}

async function recordError(siteId: string, channel: string, msg: string) {
  console.error(JSON.stringify({ evt: "notify_fail", channel, siteId, err: msg.slice(0, 300) }));
  try {
    const sb = sbAdmin();
    const { data } = await sb.from("sites").select("settings").eq("id", siteId).maybeSingle();
    const settings = ((data?.settings as Settings) ?? {}) as Settings;
    settings.notify_last_error = { channel, at: new Date().toISOString(), msg: msg.slice(0, 300) };
    await sb.from("sites").update({ settings }).eq("id", siteId);
  } catch (e) {
    // 오류 기록조차 실패하면 로그만 남기고 삼킨다 — 접수 흐름을 막지 않는다.
    console.error(JSON.stringify({ evt: "notify_fail_record_fail", siteId, err: String(e).slice(0, 200) }));
  }
}

/** 솔라피 REST 인증 — HMAC-SHA256(date + salt, apiSecret) */
async function sendSms(to: string, text: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY!.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET!.trim();
  const from = process.env.SOLAPI_SENDER!.trim();
  const date = new Date().toISOString();
  const salt = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({ message: { to: to.replace(/[^0-9]/g, ""), from: from.replace(/[^0-9]/g, ""), text } }),
  });
  if (!res.ok) throw new Error(`solapi ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
    },
    body: JSON.stringify({ from: `온스토리 <noreply@${SITE_BASE}>`, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** 수신처 결정: 사장님 설정 → 사이트에 적힌 전화 / 로그인 이메일 */
async function resolveTargets(siteId: string): Promise<{ phone?: string; email?: string }> {
  const sb = sbAdmin();
  const { data: site } = await sb.from("sites").select("settings, published, owner_id").eq("id", siteId).maybeSingle();
  const settings = ((site?.settings as Settings) ?? {}) as Settings;

  let phone = settings.notify?.phone?.trim();
  if (!phone) {
    const sections = (site?.published as { sections?: { type: string; phone?: string }[] } | null)?.sections ?? [];
    phone = sections.find((s) => s.type === "quoteForm")?.phone?.trim();
  }

  let email = settings.notify?.email?.trim();
  if (!email && site?.owner_id) {
    const { data } = await sb.auth.admin.getUserById(site.owner_id as string);
    email = data.user?.email ?? undefined;
  }
  return { phone: phone || undefined, email: email || undefined };
}

export async function notifyInquiry(args: NotifyInquiryArgs): Promise<void> {
  const { siteId, businessName, slug, inquiry } = args;
  const inboxUrl = `${SITE_BASE}/${slug}/edit?tab=inbox`;
  const ch = notifyChannels();

  let targets: { phone?: string; email?: string } = {};
  try {
    targets = await resolveTargets(siteId);
  } catch (e) {
    await recordError(siteId, "resolve", String(e));
    return;
  }

  if (ch.sms && targets.phone) {
    const text = `[온스토리] ${businessName} 견적 문의 · ${inquiry.name} ${inquiry.phone} · 사진 ${inquiry.photoCount}장 · ${inboxUrl}`;
    try {
      await sendSms(targets.phone, text);
    } catch (e) {
      await recordError(siteId, "sms", String(e));
    }
  }

  if (ch.email && targets.email) {
    const body = [
      `${businessName} 사장님, 새 견적 문의가 왔어요.`,
      "",
      `이름: ${inquiry.name}`,
      `연락처: ${inquiry.phone}`,
      `사진: ${inquiry.photoCount}장`,
      inquiry.message ? `내용: ${inquiry.message}` : "내용: (없음)",
      "",
      `문의함에서 확인: https://${inboxUrl}`,
    ].join("\n");
    try {
      await sendEmail(targets.email, `[견적 문의] ${businessName} — ${inquiry.name}`, body);
    } catch (e) {
      await recordError(siteId, "email", String(e));
    }
  }
}
