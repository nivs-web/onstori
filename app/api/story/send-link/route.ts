import { NextResponse } from "next/server";
import { loadOwnedSite } from "@/lib/site-owner";
import { sendSmsRaw, notifyChannels } from "@/lib/notify";
import { storyLinkUrl } from "@/lib/story-link";
import { pickQuestions } from "@/config/questions";

/**
 * [녹화 링크 문자로 받기] — 에디터(소유자)에서 호출. 문자에 이번 주 질문 1개 + 링크.
 * 문자 채널(솔라피) env 가 없으면 링크만 돌려준다 — 화면이 "지금 열기"로 안내한다.
 */
export async function POST(req: Request) {
  const { slug, anonId } = await req.json().catch(() => ({}));
  const r = await loadOwnedSite(String(slug ?? ""), anonId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error === "forbidden" ? 403 : 404 });

  const origin = new URL(req.url).origin.replace("http://localhost", "https://onstori.com").replace(/^http:\/\/127[^/]*/, "https://onstori.com");
  const link = storyLinkUrl(r.site.slug, origin.startsWith("https://onstori.com") ? "https://onstori.com" : origin);
  const phone = (r.site.settings as { phone?: string } | null)?.phone ?? "";
  const q = pickQuestions(1)[0];
  const text = `[온스토리] ${r.site.business_name} 사장님, 이번 주 질문이에요.\n"${q.text}"\n아래 링크를 크롬에서 열고 60초만 말씀해 주세요. (카톡 안에서 열리면 '크롬으로 열기')\n${link}`;

  let sent = false;
  if (phone && notifyChannels().sms) sent = await sendSmsRaw(phone, text);
  return NextResponse.json({ ok: true, sent, link, phone: phone ? phone.replace(/(\d{3})\d+(\d{4})/, "$1****$2") : null, question: q.text });
}
