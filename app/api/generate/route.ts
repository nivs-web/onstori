/* 기간 출처: lib/trial.ts — 주석 속 설명 숫자다 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { uniqueSlug } from "@/lib/slug";
import { cleanOwnerChannels } from "@/config/owner-channels";
import {
  cleanCtaSelection, cleanCtaFormFields, cleanCtaExtraField, ctaNeedsPublicPhone, CTA_EXTRA_FIELD_MAX,
} from "@/config/cta-channels";
import { hasRequired, recordConsents } from "@/lib/consents";
import { isAdmin } from "@/lib/admin-auth";
import { WEEKLY_DEFAULT } from "@/lib/weekly";
import { sbAdmin } from "@/lib/db-admin";
import { getSessionUser } from "@/lib/supabase/server";
import { generateSite, type GenerateInput } from "@/lib/generate";
import { recordAiUsage } from "@/lib/ai-usage";
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
  /**
   * ★★★ **손님 문의 알림이 이 주소로 간다. 그래서 «서버에서도» 필수다.** (2026-09-13 상무님 지적 1)
   *
   * ⚠ 전에는 `optional()` 이었다. 「옛 가입 화면이 이 값을 안 보내니 막으면 그 자리에서
   *   실패한다」는 이유였는데, 그 대가가 **알림이 한 통도 안 가는 홈페이지가 생기는 것**이었다.
   *   화면만 막고 서버가 통과시키면 그 틈으로 들어온 사이트는 아래에서 `notify` 를 아예
   *   안 심고, 그러면 문의가 와도 사장님이 **영영 모른다.** 되돌릴 수 없는 손해다.
   * ★ 이제 주 1회 알림의 기본도 **메일**이다(2026-09-13 대표님 결정 6) — 주소가 없으면
   *   그 상품 자체가 안 간다. 더더욱 필수여야 한다.
   * ⚠ 옛 화면에서 만들던 분은 400 을 받는다. 그편이 «조용히 못 받는 홈페이지»보다 낫다.
   */
  email: z.string().max(120).email("메일 주소를 정확히 입력해 주세요"),
  /* ★ 2026-09-12 — **선택값이 됐다.** 가입 화면에서 「홈페이지 주소」 칸을 뺐다(이탈 1위).
     안 오면 서버가 상호·업종에서 짓는다. 옛 화면이 열려 있어도 보내면 그대로 존중한다. */
  slug: z.string().regex(/^[a-z0-9-]{3,30}$/).optional(),
  mood: z.enum(["clean", "warm", "premium", "lively"]).default("clean"),
  address: z.string().max(120).optional(),
  whyStarted: z.string().max(300).optional(),
  anonId: z.string().max(64).optional(),
  /* ★ 2026-09-15 — 사장님이 운영 중인 다른 채널 주소(선택).
     ⚠ 모양 검사는 `config/channels.ts` 의 `cleanChannels` 한 곳에서 한다 — 화면과 같은 규칙이다.
       여기서는 **통째로 받아만 두고** 아래에서 걸러 넣는다. 화면 값을 그대로 믿지 않는다. */
  channels: z.record(z.string(), z.string()).optional(),
  /* ★ 2026-09-16 — 손님이 누르는 «문의 채널(CTA)» 선택(선택 사항). 최대 2개.
     ⚠ 모양·개수 검사는 `config/cta-channels.ts` 의 `cleanCtaSelection` 한 곳에서 한다 —
       화면 값을 그대로 믿지 않는다(불변 규칙 4). */
  cta: z.object({
    selected: z.array(z.string()).optional(),
    links: z.record(z.string(), z.string()).optional(),
    formFields: z.object({
      name: z.boolean(), phone: z.boolean(), email: z.boolean(), message: z.boolean(),
    }).partial().optional(),
    extraField: z.string().max(CTA_EXTRA_FIELD_MAX).optional(),
  }).optional(),
  // 온보딩 5단계 (2026-09-05) — 업종 직접 선택 · 세부 업종명 · 포인트색
  industryId: z.string().max(40).optional(),
  industryLabel: z.string().max(40).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /* ★ 가입 동의 (2026-09-12). 화면이 체크박스로 받아 보낸다.
     ⚠ **optional 이다.** 열려 있는 옛 화면은 이 값을 안 보낸다 — 필수로 막으면 그 사장님이
       만들던 자리에서 실패한다. 값이 오면 기록하고, 안 오면 「기록 없음」으로 남긴다. */
  consents: z.object({
    terms: z.boolean(), privacy: z.boolean(), marketing: z.boolean(),
  }).partial().optional(),
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
    console.warn(JSON.stringify({ evt: "generate_rate_limited", ip, rule: limit.rule.label, slug: input.slug ?? "(auto)" }));
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

  /* 슬러그 — 화면이 보냈으면 검증하고, 안 보냈으면 **서버가 짓는다.**
     ⚠ 검사 함수를 하나로 묶어 두 길이 **같은 기준**을 쓰게 한다. */
  const isTaken = async (s: string) => {
    const [{ data: r }, { data: t }] = await Promise.all([
      sb.from("reserved_slugs").select("slug").eq("slug", s).maybeSingle(),
      sb.from("sites").select("slug").eq("slug", s).maybeSingle(),
    ]);
    return !!r || !!t;
  };

  let slug = input.slug;
  if (slug) {
    if (await isTaken(slug)) {
      return NextResponse.json({ error: "사용할 수 없는 주소예요" }, { status: 409 });
    }
  } else {
    slug = await uniqueSlug(input.businessName, input.industryId ?? null, isTaken);
  }

  const user = await getSessionUser(); // 로그인 상태면 처음부터 계정 귀속 (anon claim 불필요)

  /* ★ 한 계정에 홈페이지 하나 (config/limits.ts SITES_PER_ACCOUNT).
     ⚠ AI 를 부르기 **전에** 막는다. 만들고 나서 막으면 돈만 나가고 버리게 된다.
     ⚠ 로그인 안 한 익명 생성은 막지 않는다 — 지금 온보딩이 그 순서라 막으면 가입이 끊긴다. */
  /**
   * ★★ **운영자는 «미리 만드는 사람»이다.** (2026-09-13 회장님 지시 B2)
   *
   * 회장님이 콜드콜용 견본을 여러 개 만들어 두셔야 하는데, 한 계정 1곳 제한에 막혀
   * **두 번째부터 409** 가 났다. 운영자 쿠키가 있으면 그 제한을 건너뛴다.
   * ⚠ 사장님은 **1곳 그대로**다 — 제한을 없애는 것이 아니라 운영자만 예외다.
   */
  const admin = await isAdmin();

  if (user && !admin) {
    const { count: mine } = await sb
      .from("sites").select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if ((mine ?? 0) >= SITES_PER_ACCOUNT) {
      return NextResponse.json({ error: SITE_LIMIT_MSG, goMy: true }, { status: 409 });
    }
  }

  /* ★ 2026-09-16 — 문의 채널(CTA) 선택을 서버에서 다시 거른다. 죽은 버튼(주소 없는 url 항목)은
     이 자리에서 이미 빠진다(cleanCtaSelection). */
  const cta = cleanCtaSelection(input.cta?.selected, input.cta?.links);
  const ctaFormFields = cleanCtaFormFields(input.cta?.formFields);
  const ctaExtraField = cleanCtaExtraField(input.cta?.extraField);
  /* ⚠ 「전화걸기」·「문의하기(전화번호 공개형)」·「문자 바로 보내기」를 고르면
     번호를 손님에게 보여 줘야 버튼이 산다. 안 켜면 lib/phone-privacy.ts 가 발행본에서
     번호를 지워 **버튼은 떠 있는데 눌러도 번호가 없는** 죽은 버튼이 된다(불변 규칙 12 의 정신). */
  const ctaPhonePublic = ctaNeedsPublicPhone(cta.selected);

  const started = Date.now();
  try {
    const { doc, industry, category, copy, inferred, aiRaw } = await generateSite(input as GenerateInput);

    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000); // 무료 기간 (일수의 단일 출처는 lib/trial.ts)
    const { data: site, error } = await sb
      .from("sites")
      .insert({
        slug,
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
          /* ★ 이제 이메일은 필수라 «항상» 심긴다 (2026-09-13 상무님 지적 1).
             ⚠ 전에는 값이 없으면 `notify` 를 통째로 빼서, 그 사이트는 문의가 와도 알릴 곳이 없었다. */
          notify: { email: input.email },
          /* ★★ 주 1회 촬영 알림을 **가입 때 심는다** (2026-09-12 회장님 지시 D1).
             ⚠ 안 심으면 `readWeekly` 가 undefined 를 돌려주고 크론이 그 사장님을 **영영 건너뛴다.**
               「기본값이 있으니 되겠지」가 아니다 — 기본값은 **적혀 있어야** 읽힌다.
             ★ 값의 단일 출처는 `lib/weekly.ts` 의 `WEEKLY_DEFAULT` 다. 숫자를 여기 적지 마라.

             ★★★ **`on` 은 광고 동의에 매이지 않는다** (2026-09-12 회장님 승인 · 상무님 지적).

               한때 이 줄을 `on: input.consents?.marketing !== false` 로 두었다. 그때는 가입 화면의
               체크박스가 「촬영 알림·안내를 문자로 받겠습니다」라 **상품과 광고가 한 칸**이었고,
               체크를 안 한 분께도 문자가 가고 있었기 때문이다(물어 놓고 대답을 안 들었다).

               ★ 이제 화면이 둘로 갈렸다:
                 · **주 1회 촬영 질문** — 3단계 전화 칸 아래 «안내». 우리가 판 **상품**이라 묻지 않는다
                 · **할인·행사 소식**   — 4단계 «선택 체크박스». 이것이 광고고, `consents.marketing` 이다
               그래서 여기는 다시 «켜짐»이 기본이다. 체크를 안 했다고 **돈 내고 산 것을 못 받으면**
               그게 더 나쁜 일이다.

             ⚠ 대신 **끄는 길이 반드시 살아 있어야 한다.** 두 곳이다 —
               ①첫 문자의 【받지 않으시려면】 줄(lib/weekly.ts OPT_OUT_LINE)
               ②편집화면 「연결」 탭의 주 1회 촬영 알림 스위치.
               둘 중 하나라도 없어지면 이 기본값은 **광고 무단 발송**이 된다. 같이 지켜라. */
          /**
           * ★★★ **미리 만든 곳은 «꺼진 채»로 만든다.** (2026-09-13 상무님 지적 · 지시 A2)
           *
           * ⚠ 위저드가 네이버·카카오에서 **그 가게의 진짜 번호**를 불러와 위 `phone` 에 넣는다.
           *   그 상태로 켜 두면 **계약도 안 한 가게 사장님께 다음 날 아침 9시에 문자**가 간다.
           * ★ 운영자 쿠키로 만든 것 = 「미리 만든 견본」이다. 꺼 두고, 표시를 남긴다.
           *   사장님이 가져가면(claim) 그때 표시를 떼고 켠다.
           * ⚠ 표시(`premade`)가 진짜 자물쇠다 — 「주인이 아무도 없다」만으로는 못 막는다.
           *   브라우저로 만들면 `anon_id` 가 붙기 때문이다(lib/premade.ts 주석 참고).
           */
          ...(admin ? { premade: true } : {}),
          weekly: { ...WEEKLY_DEFAULT, ...(admin ? { on: false } : {}) },
          /* ★★ 채널 주소 — **위젯이자 «SEO 엔진»이다.** (2026-09-15)
             lib/jsonld.ts 가 이 자리를 읽어 구조화 데이터의 `sameAs` 를 만든다.
             ⚠ 저장 위치를 바꾸지 마라. 바꾸면 검색엔진에 나가던 연결이 조용히 끊긴다.
             ⚠ 빈 객체면 칸 자체를 안 만든다 — 빈 값이 있는 것과 없는 것은 다르다. */
          ...(Object.keys(cleanOwnerChannels(input.channels)).length
            ? { channels: cleanOwnerChannels(input.channels) } : {}),
          /* ★★ 2026-09-16 — 문의 채널(CTA). `config/cta-channels.ts` 의 주석 참고.
             ⚠ `settings.channels`(owner-channels, SEO 용) 과 **다른 칸**이다 — 헷갈리지 마라.
             ⚠ 하나도 안 고르셨으면 칸 자체를 안 만든다 — 빈 값이 있는 것과 없는 것은 다르다. */
          ...(cta.selected.length
            ? { ctaChannels: { selected: cta.selected, links: cta.links, formFields: ctaFormFields, extraField: ctaExtraField || undefined } }
            : {}),
          /* ⚠ CTA 가 전화 공개를 요구할 때만 켠다. 안 고르셨으면 기존 기본(비공개)을 그대로 둔다 —
             여기서 `false` 를 명시로 심지 않는다(다른 경로가 나중에 켤 수도 있는 칸이다). */
          ...(ctaPhonePublic ? { phonePublic: true } : {}),
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

    /* ★★ 가입 동의를 «증거로» 남긴다 (2026-09-12 회장님 지시 2).
       ⚠ 홈페이지는 이미 만들어졌다. 기록에 실패해도 **되돌리지 않는다** —
         사장님은 화면에서 분명히 눌렀고, 못 적은 것은 우리 쪽 문제라 로그로 남겨 사람이 챙긴다.
       ⚠ 옛 화면은 이 값을 안 보낸다. 그때는 「동의 화면을 못 본 가입」이라 로그만 남긴다. */
    if (input.consents) {
      const c = input.consents;
      if (!hasRequired(c)) {
        console.warn(JSON.stringify({ evt: "consent_missing_required", slug, got: c }));
      }
      await recordConsents(site.id, {
        terms: c.terms === true, privacy: c.privacy === true, marketing: c.marketing === true,
      });
    } else {
      console.warn(JSON.stringify({ evt: "consent_absent", slug, why: "옛 가입 화면 — 동의 칸이 없다" }));
    }

    /* ★★ **토큰 영수증을 적는다.** (2026-09-15 대표님 지시 — lib/ai-usage.ts)
       ⚠ 여기가 사이트가 «처음 존재하게 된» 자리다. 만들기 전에는 적을 곳이 없다.
       ⚠ 실패해도 던지지 않는다 — 영수증 때문에 가입이 실패하면 그게 훨씬 나쁘다. */
    await recordAiUsage(slug, "site_create", aiRaw.model, aiRaw.copy);

    console.log(JSON.stringify({ evt: "generate_ok", slug, industry: industry.id, method: inferred.method, ms: Date.now() - started }));
    return NextResponse.json({ url: `https://onstori.com/${slug}`, slug });
  } catch (e) {
    console.error(JSON.stringify({ evt: "generate_fail", slug, ms: Date.now() - started, err: String(e).slice(0, 300) }));
    return NextResponse.json({ error: "생성에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
