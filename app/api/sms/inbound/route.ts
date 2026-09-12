import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/db-admin";
import { isStopWord, phoneKey, readWeekly } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/**
 * 답장 받는 창구 — **「STOP」 한 글자로 문자를 끈다.** (2026-09-13 회장님 결정 2)
 *
 * ★★★ **왜 이것이 꼭 있어야 하나.**
 *   사장님이 번호를 잘못 적으면 **모르는 사람**에게 매주 문자가 간다. 그런데 첫 문자의
 *   【받지 않으시려면】 안내가 데려가는 편집화면은 **주인만** 들어간다 —
 *   받은 사람은 끌 방법이 아예 없다. 답장 한 글자가 그 사람의 **유일한 출구**다.
 *
 * ⚠⚠ **문구만 있고 이 창구가 안 열려 있으면 그 약속은 빈말이다.**
 *   솔라피(또는 쓰는 문자 업체) 쪽에서 **수신(인바운드)** 을 이 주소로 걸어 줘야 답장이 온다.
 *   설정 전에는 사람이 STOP 을 보내도 **아무 데도 도착하지 않는다.** 그 상태로 두지 마라.
 *
 * ★ 안전장치
 *   ① `SMS_INBOUND_SECRET` 이 없으면 **404** — 열쇠가 없으면 이 길도 없다(심사관 로그인과 같은 방식)
 *   ② 그 열쇠가 헤더나 주소에 맞게 와야 받는다. 아무나 남의 알림을 끌 수 없어야 한다
 *   ③ 업체마다 보내는 칸 이름이 달라 **여러 이름을 다 받아 준다** — 한 번에 맞히지 못해
 *      끄기가 안 되는 것이 제일 나쁘다
 *   ④ 끄는 일은 **번호 기준**이다. 그 번호를 쓰는 사이트를 **전부** 끈다 —
 *      한 사람이 사이트를 둘 가진 경우 하나만 꺼지면 다음 주에 또 받는다
 *
 * ⚠ 「STOP 이 뭐예요?」처럼 문장 속에 섞인 것은 안 끈다(`isStopWord` 주석 참고).
 *   물어본 것을 끄면 그것도 사장님 뜻과 다르다.
 */
type Inbound = Record<string, unknown>;

/** 업체마다 칸 이름이 다르다 — 흔한 이름을 모두 본다 */
function pick(body: Inbound, names: string[]): string {
  for (const n of names) {
    const v = body[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(req: Request) {
  const secret = process.env.SMS_INBOUND_SECRET?.trim();
  /* ① 열쇠가 없으면 이 길은 «없는 것»이다 */
  if (!secret) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const given = req.headers.get("x-inbound-secret")?.trim() || url.searchParams.get("k") || "";
  if (given !== secret) {
    console.warn(JSON.stringify({ evt: "sms_inbound_bad_secret" }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Inbound;
  const from = pick(body, ["from", "sender", "phone", "senderNumber", "callerId", "msisdn"]);
  const text = pick(body, ["text", "message", "content", "body", "msg"]);

  if (!from) {
    console.warn(JSON.stringify({ evt: "sms_inbound_no_from", keys: Object.keys(body).slice(0, 12) }));
    /* ⚠ 200 으로 답한다 — 업체가 계속 다시 보내게 두면 로그만 쌓인다 */
    return NextResponse.json({ ok: true, handled: false, why: "보낸 번호를 못 읽었어요" });
  }

  if (!isStopWord(text)) {
    console.log(JSON.stringify({ evt: "sms_inbound_other", len: text.length }));
    return NextResponse.json({ ok: true, handled: false, why: "그만 보내라는 말이 아니에요" });
  }

  /* ④ 그 번호를 쓰는 사이트를 **전부** 끈다 */
  const sb = sbAdmin();
  const { data: sites, error } = await sb.from("sites").select("id, slug, settings");
  if (error) {
    console.error(JSON.stringify({ evt: "sms_inbound_query_failed", err: error.message.slice(0, 160) }));
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const key = phoneKey(from);
  let turnedOff = 0;
  for (const s of sites ?? []) {
    const settings = (s.settings as Record<string, unknown>) ?? {};
    const w = readWeekly(settings);
    const phone = (w?.phone?.trim() || (settings.phone as string) || "").trim();
    if (!phone || phoneKey(phone) !== key) continue;
    if (w && w.on === false) continue;                       // 이미 꺼져 있다
    const { error: offErr } = await sb.from("sites")
      .update({ settings: { ...settings, weekly: { ...(w ?? {}), on: false } } })
      .eq("id", s.id);
    if (offErr) {
      console.error(JSON.stringify({ evt: "sms_stop_off_failed", slug: s.slug, err: offErr.message.slice(0, 120) }));
    } else turnedOff++;
  }

  /* ★ 번호는 로그에도 통째로 남기지 않는다 — 남의 번호일 수 있다 */
  console.log(JSON.stringify({ evt: "sms_stop_handled", tail: key.slice(-4), turnedOff }));
  return NextResponse.json({ ok: true, handled: true, turnedOff });
}
