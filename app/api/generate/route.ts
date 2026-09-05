import { NextResponse } from "next/server";
import { z } from "zod";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";
import { generateSite, type GenerateInput } from "@/lib/generate";
import { checkRateLimit, clientIp, GENERATE_LIMITS } from "@/lib/rate-limit";
import { TRIAL_DAYS } from "@/lib/trial";

export const maxDuration = 60; // LLM 호출 여유

const Input = z.object({
  businessName: z.string().min(1).max(40),
  oneLiner: z.string().min(2).max(120),
  phone: z.string().min(9).max(20),
  slug: z.string().regex(/^[a-z0-9-]{3,30}$/),
  mood: z.enum(["clean", "warm", "premium", "lively"]).default("clean"),
  address: z.string().max(120).optional(),
  whyStarted: z.string().max(300).optional(),
  anonId: z.string().max(64).optional(),
  // 온보딩 5단계 (2026-09-05) — 업종 직접 선택 · 세부 업종명 · 포인트색
  industryId: z.string().max(40).optional(),
  industryLabel: z.string().max(40).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function POST(req: Request) {
  let input: z.infer<typeof Input>;
  try {
    input = Input.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "입력값을 확인해주세요" }, { status: 400 });
  }

  // 비용 방어 — LLM 호출 전에 IP 한도를 본다. 입력 검증 뒤에 두어 오타 요청은 한도를 깎지 않는다.
  const ip = clientIp(req);
  const limit = await checkRateLimit("gen", ip, GENERATE_LIMITS);
  if (!limit.ok) {
    console.warn(JSON.stringify({ evt: "generate_rate_limited", ip, rule: limit.rule.label, slug: input.slug }));
    return NextResponse.json(
      { error: "잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 만들었어요." },
      { status: 429, headers: { "Retry-After": String(limit.rule.window) } },
    );
  }

  const sb = sbAdmin();

  // 슬러그 최종 검증 (서버가 최후의 방어선)
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", input.slug).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", input.slug).maybeSingle(),
  ]);
  if (reserved || taken) {
    return NextResponse.json({ error: "사용할 수 없는 주소예요" }, { status: 409 });
  }

  const started = Date.now();
  try {
    const user = await getSessionUser(); // 로그인 상태면 처음부터 계정 귀속 (anon claim 불필요)
    const { doc, industry, category, copy, inferred } = await generateSite(input as GenerateInput);

    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000); // 14일 무료 (2026-09-05 정회원 정책, lib/trial.ts)
    const { data: site, error } = await sb
      .from("sites")
      .insert({
        slug: input.slug,
        owner_id: user?.id ?? null,
        anon_id: user ? null : input.anonId ?? null,
        business_name: input.businessName,
        industry: industry.id,
        category: category.id,
        template: category.template,
        cta_type: category.cta,
        inferred,
        mood: input.mood,
        status: "trial",
        trial_ends_at: trialEnds.toISOString(),
        theme: doc.theme,
        settings: { phone: input.phone, address: input.address ?? null, oneLiner: input.oneLiner, industryLabel: input.industryLabel ?? null },
        draft: doc,
        published: doc,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    if (copy.firstStory) {
      await sb.from("story_entries").insert({
        site_id: site.id,
        entry_type: "milestone",
        title: copy.firstStory.title,
        body: copy.firstStory.body,
        entry_date: new Date().toISOString().slice(0, 10),
      });
    }
    await sb.from("site_progress").insert({
      site_id: site.id,
      funnel: { created_at: new Date().toISOString() },
    });

    console.log(JSON.stringify({ evt: "generate_ok", slug: input.slug, industry: industry.id, method: inferred.method, ms: Date.now() - started }));
    return NextResponse.json({ url: `https://onstori.com/${input.slug}`, slug: input.slug });
  } catch (e) {
    console.error(JSON.stringify({ evt: "generate_fail", slug: input.slug, ms: Date.now() - started, err: String(e).slice(0, 300) }));
    return NextResponse.json({ error: "생성에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
