import { NextResponse } from "next/server";
import { z } from "zod";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";
import { generateSite, type GenerateInput } from "@/lib/generate";
import { checkRateLimit, clientIp, GENERATE_LIMITS } from "@/lib/rate-limit";
import { TRIAL_DAYS, MONTHLY_SITE_CAP } from "@/lib/trial";
import { SITES_PER_ACCOUNT, SITE_LIMIT_MSG } from "@/config/limits";
import { isValidPhone } from "@/lib/phone";

export const maxDuration = 60; // LLM 호출 여유

const Input = z.object({
  businessName: z.string().min(1).max(40),
  oneLiner: z.string().min(2).max(120),
  // .max(20) 은 QuoteForm.phone 의 max(20) 과 맞물리므로 남긴다
  phone: z.string().min(9).max(20).refine((v) => isValidPhone(v), "전화번호를 정확히 입력해 주세요"),
  /* ★ 2026-09-11 — **손님 문의 알림이 이 주소로 간다.**(회장님 결정: 문자→이메일)
     ⚠ 옛 가입 화면은 이 값을 안 보낸다. 그래서 optional 이다 — 필수로 막으면
       열려 있는 옛 화면에서 만들던 사장님이 그 자리에서 실패한다. 화면이 필수로 받는다. */
  email: z.string().max(120).email("메일 주소를 정확히 입력해 주세요").optional(),
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

  // 월 생성 상한 — AI 생성 비용 안전장치 (무료 30일로 늘리면서 2026-09-06 추가).
  // ⚠ 상한값이나 남은 수를 화면에 알리지 않는다(회장님 지시). 일반적인 안내만 준다.
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count: madeThisMonth } = await sb
    .from("sites").select("id", { count: "exact", head: true })
    .gte("created_at", monthStart.toISOString());
  if ((madeThisMonth ?? 0) >= MONTHLY_SITE_CAP) {
    console.error(JSON.stringify({ evt: "monthly_site_cap_hit", made: madeThisMonth, cap: MONTHLY_SITE_CAP }));
    return NextResponse.json({ error: "지금은 홈페이지를 만들 수 없어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  // 슬러그 최종 검증 (서버가 최후의 방어선)
  const [{ data: reserved }, { data: taken }] = await Promise.all([
    sb.from("reserved_slugs").select("slug").eq("slug", input.slug).maybeSingle(),
    sb.from("sites").select("slug").eq("slug", input.slug).maybeSingle(),
  ]);
  if (reserved || taken) {
    return NextResponse.json({ error: "사용할 수 없는 주소예요" }, { status: 409 });
  }

  const user = await getSessionUser(); // 로그인 상태면 처음부터 계정 귀속 (anon claim 불필요)

  /* ★ 한 계정에 홈페이지 하나 (config/limits.ts SITES_PER_ACCOUNT).
     ⚠ AI 를 부르기 **전에** 막는다. 만들고 나서 막으면 돈만 나가고 버리게 된다.
     ⚠ 로그인 안 한 익명 생성은 막지 않는다 — 지금 온보딩이 그 순서라 막으면 가입이 끊긴다. */
  if (user) {
    const { count: mine } = await sb
      .from("sites").select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if ((mine ?? 0) >= SITES_PER_ACCOUNT) {
      return NextResponse.json({ error: SITE_LIMIT_MSG, goMy: true }, { status: 409 });
    }
  }

  const started = Date.now();
  try {
    const { doc, industry, category, copy, inferred } = await generateSite(input as GenerateInput);

    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000); // 무료 기간 (일수의 단일 출처는 lib/trial.ts)
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
        /* ⚠ 이메일은 `notify.email` 에 넣는다. `lib/notify.ts` 의 resolveTargets() 가
           **그 자리**를 읽기 때문이다. 다른 곳에 넣으면 알림이 조용히 안 간다.
           ★ 표를 새로 만들지 않았다 — settings 가 jsonb 라 칸을 늘릴 필요가 없다. */
        settings: {
          phone: input.phone, address: input.address ?? null, oneLiner: input.oneLiner,
          industryLabel: input.industryLabel ?? null,
          ...(input.email ? { notify: { email: input.email } } : {}),
        },
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
