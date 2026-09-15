import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { sendSmsRaw, sendEmailRaw, notifyChannels } from "@/lib/notify";
import { readConfig } from "@/lib/admin-config";
import { isValidPhone } from "@/lib/phone";
import { isPremade } from "@/lib/premade";

/**
 * ★★★ **긴급 알림 — 지금 바로 보내기 · 사이트별 켜고 끄기.** (2026-09-15 대표님 지시로 신설)
 *
 * ★ 대표님 말씀: 「가끔 내가 사장님한테 전달할 … 홈페이지 변경이나 그런 소식이 있으면
 *   클릭해서 **사장님에게 바로 문자도 보낼 수 있도록** 하고, 긴급 연락하게 하는 거야.」
 *
 * 🔴 **자물쇠 다섯. 하나라도 빼면 남의 가게로 문자가 나간다:**
 *   ① 운영자만 부를 수 있다
 *   ② 화면이 **「보냅니다」를 타이핑**하게 한다 — 여기서도 다시 확인한다
 *   ③ **견본은 건너뛴다**(`lib/premade.ts`) — 2026-09-13 P0 의 그 자물쇠다.
 *      계약도 안 한 가게의 «진짜 번호»가 견본에 들어 있다
 *   ④ 사이트별 **`settings.alertOff`** 가 켜져 있으면 건너뛴다
 *   ⑤ **하루 상한**(`smsDailyCap`)을 넘으면 멈춘다. 건수는 우리가 못 막는다
 *
 * ⚠ 보낸 기록을 `admin_notes(id="alert_log")` 에 남긴다 — 하루 상한을 세려면 필요하다.
 *   표가 없으면 **상한을 셀 수 없으므로 보내지 않는다.** 모르면 안 보내는 쪽으로 기운다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type LogDay = { day: string; sms: number; email: number };

async function readLog(): Promise<LogDay | null> {
  try {
    const { data } = await sbAdmin().from("admin_notes").select("body").eq("id", "alert_log").maybeSingle();
    if (!data?.body) return { day: "", sms: 0, email: 0 };
    const v = JSON.parse(data.body as string) as LogDay;
    return { day: String(v.day ?? ""), sms: Number(v.sms ?? 0), email: Number(v.email ?? 0) };
  } catch {
    return null;   // 표가 없다 — 세지 못하므로 부르는 쪽이 멈춘다
  }
}

async function writeLog(v: LogDay) {
  try {
    await sbAdmin().from("admin_notes")
      .upsert({ id: "alert_log", body: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch { /* 기록 실패가 발송을 무르게 하지 않는다 — 이미 나갔다 */ }
}

/** 한국 날짜 — 상한은 «하루» 기준이고, 그 하루는 한국 시각이다 */
const seoulDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  /* ───── 사이트별 켜고 끄기 ───── */
  if (body?.mode === "toggle") {
    const slug = String(body.slug ?? "");
    const off = body.off === true;
    const sb = sbAdmin();
    /* ⚠ `owner_id`·`anon_id` 를 함께 읽는다. 이 갈래는 `isPremade` 를 부르지 않지만,
       **검사기가 이 파일 전체의 모든 조회를 본다**(2026-09-13 P0 에서 배운 방식).
       나중에 누가 여기에 견본 판정을 더해도 칸이 비어 있지 않게 미리 담아 둔다. */
    const { data: site } = await sb
      .from("sites").select("id, settings, owner_id, anon_id").eq("slug", slug).maybeSingle();
    if (!site) return NextResponse.json({ error: "사이트가 없어요" }, { status: 404 });
    const settings = ((site.settings as Record<string, unknown>) ?? {});
    settings.alertOff = off;
    const { error } = await sb.from("sites").update({ settings }).eq("id", site.id);
    if (error) return NextResponse.json({ error: error.message.slice(0, 160) }, { status: 500 });
    return NextResponse.json({ ok: true, slug, off });
  }

  /* ───── 지금 바로 보내기 ───── */
  if (body?.mode !== "send") return NextResponse.json({ error: "mode 가 잘못됐어요" }, { status: 400 });

  /* 🔴 자물쇠 ② — 화면이 확인했더라도 서버가 다시 본다 */
  if (String(body.confirm ?? "").trim() !== "보냅니다") {
    return NextResponse.json({ error: "확인 글자를 정확히 입력해 주세요" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (text.length < 5) return NextResponse.json({ error: "보낼 내용이 너무 짧아요" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "500자를 넘었어요" }, { status: 413 });

  const cfg = await readConfig();
  const log = await readLog();
  if (!log) {
    return NextResponse.json({
      error: "admin_notes 표가 없어 «하루 상한»을 셀 수 없습니다. `npx supabase db push` 뒤에 다시 시도해 주세요.",
    }, { status: 503 });
  }
  const today = seoulDay();
  const sentToday = log.day === today ? log.sms : 0;

  const sb = sbAdmin();
  const { data: sites } = await sb
    .from("sites")
    /* ⚠ owner_id·anon_id 를 빼지 마라 — isPremade 가 그 두 칸을 본다(2026-09-13 P0) */
    .select("slug, business_name, settings, status, owner_id, anon_id")
    .in("status", ["trial", "active"]);

  const only = body.slug ? String(body.slug) : null;
  const bySms = body.bySms !== false && notifyChannels().sms;
  const byEmail = body.byEmail !== false && notifyChannels().email;

  let sms = 0, email = 0, failed = 0, skipped = 0, capped = 0;

  for (const s of sites ?? []) {
    if (only && s.slug !== only) continue;
    /* 🔴 자물쇠 ③ — 견본은 절대 안 보낸다 */
    if (isPremade(s)) { skipped++; continue; }
    const settings = (s.settings as Record<string, unknown>) ?? {};
    /* 🔴 자물쇠 ④ */
    if (settings.alertOff === true) { skipped++; continue; }

    const phone = String(settings.phone ?? "").trim();
    const mail = String((settings.notify as { email?: string } | undefined)?.email ?? "").trim();

    if (byEmail && mail) {
      const ok = await sendEmailRaw(mail, "[온스토리] 안내드립니다", text);
      if (ok) email++; else failed++;
    }
    if (bySms && isValidPhone(phone)) {
      /* 🔴 자물쇠 ⑤ — 하루 상한 */
      if (sentToday + sms >= cfg.smsDailyCap) { capped++; continue; }
      const ok = await sendSmsRaw(phone, text);
      if (ok) sms++; else failed++;
    }
  }

  await writeLog({ day: today, sms: sentToday + sms, email: (log.day === today ? log.email : 0) + email });
  console.log(JSON.stringify({ evt: "alert_sent", sms, email, failed, skipped, capped, only }));
  return NextResponse.json({ ok: true, sms, email, failed, skipped, capped });
}
