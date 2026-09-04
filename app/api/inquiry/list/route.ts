import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOwnedSite } from "@/lib/site-owner";
import { sbAdmin } from "@/lib/db-admin";
import * as storage from "@/lib/storage";
import { notifyChannels } from "@/lib/notify";

/**
 * 문의함 목록 — docs/specs/inquiry.md 3장. 사장님·운영자만.
 * 사진은 비공개 버킷에 있으므로 원본 키가 아니라 10분짜리 signed URL 로만 내보낸다.
 */

const Input = z.object({
  slug: z.string(),
  anonId: z.string().optional(),
  status: z.enum(["new", "contacted", "done", "spam"]).optional(),
});

export async function POST(req: Request) {
  const body = Input.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const r = await loadOwnedSite(body.data.slug, body.data.anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const sb = sbAdmin();
  let q = sb
    .from("inquiries")
    .select("id, kind, name, phone, message, photos, status, memo, read_at, created_at")
    .eq("site_id", r.site.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (body.data.status) q = q.eq("status", body.data.status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const keys = Array.isArray(row.photos) ? (row.photos as string[]) : [];
      const photos = await Promise.all(
        keys.map(async (key) => {
          try {
            return await storage.signedGetUrl(key, 600);
          } catch {
            return null; // 한 장이 죽어도 문의 자체는 보여준다
          }
        }),
      );
      return { ...row, photos: photos.filter((u): u is string => !!u) };
    }),
  );

  const { count: newCount } = await sb
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("site_id", r.site.id)
    .eq("status", "new");

  // 채널 상태는 서버 env 라 클라이언트가 알 수 없다. 에디터 알림 설정 카드가
  // "문자 알림 준비 중" 을 정확히 띄우려면 이 값이 필요하다(키 자체는 나가지 않는다).
  return NextResponse.json({ items, newCount: newCount ?? 0, channels: notifyChannels() });
}
