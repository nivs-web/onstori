import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sbAdmin } from "@/lib/db-admin";
import { notifyChannels } from "@/lib/notify";

/**
 * 운영자 점검 — docs/specs/inquiry.md 3장.
 * "문의가 들어오는데 알림이 안 갔다"를 사장님 신고 전에 잡으려는 계기판이다.
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = sbAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count: last24h } = await sb
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  // notify_last_error 가 남아 있는 사이트 — jsonb 키 존재 여부로 센다
  const { data: sites } = await sb.from("sites").select("id, slug, settings").not("settings->notify_last_error", "is", null);
  const failing = (sites ?? []).map((s) => ({
    slug: s.slug,
    error: (s.settings as { notify_last_error?: { channel: string; at: string; msg: string } }).notify_last_error,
  }));

  return NextResponse.json({
    inquiries24h: last24h ?? 0,
    channels: notifyChannels(),
    saltConfigured: !!process.env.INQUIRY_SALT?.trim(),
    failingSites: failing.length,
    failing: failing.slice(0, 20),
  });
}
