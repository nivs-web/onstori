import { NextResponse, after } from "next/server";
import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
import { sbAdmin } from "@/lib/db-admin";
import { clientIp, checkRateLimit, type LimitRule } from "@/lib/rate-limit";
import * as storage from "@/lib/storage";
import { notifyInquiry } from "@/lib/notify";

export const maxDuration = 30;

/**
 * 견적 문의 접수 — docs/specs/inquiry.md 3장. 손님(비로그인)이 부르는 유일한 쓰기 라우트다.
 *
 * 손님을 막지 않으면서 스팸만 거르는 게 목적이라 방어를 여러 겹으로 얕게 깐다:
 * IP 레이트리밋 · 허니팟 · 3초 규칙 · 10분 중복 · 스팸 표시 시 30일 차단.
 * insert 는 service-role 로만 한다(anon RLS 정책 없음 — 마이그레이션에서 제거).
 */

const INQUIRY_LIMITS: LimitRule[] = [
  { window: 3600, max: 5, label: "1h" },
  { window: 86400, max: 20, label: "24h" },
];

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** 원 IP 는 저장하지 않는다 — 일 단위 salt 해시만. */
function hashIp(ip: string): string | null {
  const salt = process.env.INQUIRY_SALT?.trim();
  if (!salt) return null;
  return createHash("sha256").update(ip + new Date().toISOString().slice(0, 10) + salt).digest("hex");
}

function referrerClass(ref: string | null): string {
  if (!ref) return "direct";
  const h = (() => { try { return new URL(ref).hostname; } catch { return ""; } })();
  if (h.includes("naver")) return "naver";
  if (h.includes("google")) return "google";
  if (h.includes("instagram")) return "instagram";
  if (h.includes("kakao") || h.includes("daum")) return "kakao";
  return h ? "other" : "direct";
}

type Settings = { blocked_phones?: { phone: string; until: string }[] };

/** 첫 접수 시각 기록 — lib/score.ts 의 markFunnel 은 키 목록이 고정이라 여기서 직접 쓴다. */
async function markFirstInquiry(siteId: string) {
  const sb = sbAdmin();
  const { data } = await sb.from("site_progress").select("funnel").eq("site_id", siteId).maybeSingle();
  const funnel = (data?.funnel as Record<string, string>) ?? {};
  if (funnel.first_inquiry_at) return;
  funnel.first_inquiry_at = new Date().toISOString();
  await sb.from("site_progress").upsert({ site_id: siteId, funnel }, { onConflict: "site_id" });
}

export async function POST(req: Request) {
  // ① 레이트리밋 (판정 실패 시 통과 — lib/rate-limit.ts 의 방침)
  const ip = clientIp(req);
  const limited = await checkRateLimit("inquiry", ip, INQUIRY_LIMITS);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "too-many" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });

  const slug = String(form.get("slug") ?? "");
  const name = String(form.get("name") ?? "").trim() || "이름 미기재";
  const phone = String(form.get("phone") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const consent = String(form.get("consent") ?? "");
  const website = String(form.get("website") ?? "").trim(); // 허니팟 — 사람은 비워둔다
  const t0 = parseInt(String(form.get("t0") ?? "0"), 10);

  // ② 봇 필터. 어느 쪽이든 손님에게는 같은 400 이다(어떤 규칙에 걸렸는지 알려주지 않는다).
  const tooFast = !Number.isFinite(t0) || t0 <= 0 || Date.now() - t0 < 3000;
  if (website || tooFast || consent !== "1") return NextResponse.json({ ok: false }, { status: 400 });
  if (!/^[0-9+-]{9,20}$/.test(phone)) return NextResponse.json({ ok: false, error: "bad-phone" }, { status: 400 });
  if (name.length > 40 || message.length > 1000) return NextResponse.json({ ok: false }, { status: 400 });

  const sb = sbAdmin();

  // ③ 사이트 조회 — 살아있는 사이트만 접수한다
  const { data: site } = await sb
    .from("sites")
    .select("id, slug, business_name, settings, status")
    .eq("slug", slug)
    .in("status", ["trial", "active"])
    .maybeSingle();
  if (!site) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  // ④ 차단 번호 → 403, 10분 내 같은 번호 재접수 → 409
  const settings = ((site.settings as Settings) ?? {}) as Settings;
  const blocked = (settings.blocked_phones ?? []).some((b) => b.phone === phone && new Date(b.until) > new Date());
  if (blocked) return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: dup } = await sb
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("phone", phone)
    .gte("created_at", since);
  if ((dup ?? 0) > 0) return NextResponse.json({ ok: false, error: "duplicate" }, { status: 409 });

  // ⑤ 사진 — 비공개 버킷에만 둔다(조회는 signed URL 10분)
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_PHOTOS);
  const photoKeys: string[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) continue;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const webp = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const { key } = await storage.put("private", `inquiries/${site.id}/${randomUUID()}.webp`, webp, "image/webp");
      photoKeys.push(key);
    } catch (e) {
      // 사진 한 장 실패로 접수 자체를 버리지 않는다 — 연락처가 본체다
      console.error(JSON.stringify({ evt: "inquiry_photo_fail", siteId: site.id, err: String(e).slice(0, 200) }));
    }
  }

  // ⑥ 저장
  const { data: row, error } = await sb
    .from("inquiries")
    .insert({
      site_id: site.id,
      kind: "quote",
      name,
      phone,
      message,
      photos: photoKeys,
      referrer_class: referrerClass(req.headers.get("referer")),
      ip_hash: hashIp(ip),
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error(JSON.stringify({ evt: "inquiry_insert_fail", siteId: site.id, err: error?.message }));
    return NextResponse.json({ ok: false, error: "save-failed" }, { status: 500 });
  }

  // ⑦⑧ 알림·퍼널은 접수 응답을 붙잡지 않는다.
  //
  // ⚠ `void promise` 로 띄워두면 안 된다. 서버리스는 응답을 반환하는 순간 인스턴스를
  //    얼릴 수 있어서, 그때까지 안 끝난 작업은 그대로 사라진다. 2026-09-04 실측:
  //    문의 3건이 접수됐는데 솔라피에는 발송 요청이 0건이었고 notify_last_error 도
  //    비어 있었다(catch 조차 안 돌았다). 반면 DB 한 번만 쓰는 markFirstInquiry(14ms)는
  //    통과했다 — 짧은 건 살고 긴 건 죽는, 보장 없는 동작이다.
  //    after() 는 응답을 보낸 뒤에도 플랫폼이 실행을 보장해 준다.
  after(async () => {
    await notifyInquiry({
      siteId: site.id as string,
      businessName: (site.business_name as string) ?? "",
      slug: site.slug as string,
      inquiry: { name, phone, message: message || undefined, photoCount: photoKeys.length },
    });
  });
  after(async () => {
    await markFirstInquiry(site.id as string);
  });

  // ⑨
  return NextResponse.json({ ok: true, id: row.id });
}
