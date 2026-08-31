import { z } from "zod";
import { geminiJson } from "./gemini";
import { INDUSTRIES, matchIndustry, categoryOf, type Industry } from "@/config/industries";
import { placeholderFor } from "@/config/placeholder-images";
import { SiteDoc, type SiteDocT } from "./schema";

/**
 * 생성 파이프라인: 분류(사전→LLM) → 카피 생성(LLM) → SiteDoc 조립(코드).
 * 원칙:
 * - LLM에 전체 SiteDoc을 맡기지 않는다 — 카피 조각만 받고 구조는 코드가 조립 (안정성)
 * - 사실 날조 금지: 경력·수치·자격·후기·별점을 지어내지 않는다 (표시광고법 + 신뢰)
 */

export type GenerateInput = {
  businessName: string;
  oneLiner: string;      // "하는 일 한 줄"
  phone: string;
  mood: "clean" | "warm" | "premium" | "lively";
  address?: string;
  whyStarted?: string;   // 첫 스토리 재료
};

/* ── 1) 업종 분류 ── */

const ClassifyOut = z.object({
  industryId: z.string(),
  confidence: z.number().min(0).max(1),
});

export async function classify(input: GenerateInput): Promise<{ industry: Industry; confidence: number; method: string }> {
  const hit = matchIndustry(`${input.businessName} ${input.oneLiner}`);
  if (hit) return { industry: hit, confidence: 0.95, method: "keyword" };

  const taxonomy = INDUSTRIES.map((i) => `${i.id}: ${i.name} (${i.keywords.slice(0, 4).join(",")})`).join("\n");
  const out = await geminiJson(
    `다음 가게를 아래 업종 목록 중 가장 가까운 하나로 분류하라.
가게: "${input.businessName}" — "${input.oneLiner}"
업종 목록:\n${taxonomy}\n
JSON으로만 답하라: {"industryId": "<목록의 id>", "confidence": 0~1}`,
    ClassifyOut,
  );
  const industry = INDUSTRIES.find((i) => i.id === out.industryId) ?? INDUSTRIES[0];
  return { industry, confidence: out.confidence, method: "llm" };
}

/* ── 2) 카피 생성 ── */

const CopyOut = z.object({
  eyebrow: z.string().max(40),
  headline: z.string().max(60),
  sub: z.string().max(160),
  aboutTitle: z.string().max(40),
  aboutBody: z.string().max(600),
  steps: z.array(z.object({ name: z.string().max(20), desc: z.string().max(80) })).min(3).max(4),
  quoteSub: z.string().max(120),
  storyFeedTitle: z.string().max(40),
  firstStory: z.object({ title: z.string().max(60), body: z.string().max(400) }).nullable(),
});

async function generateCopy(input: GenerateInput, industry: Industry) {
  return geminiJson(
    `너는 한국 소상공인 홈페이지 카피라이터다. 아래 가게의 홈페이지 문구를 작성하라.

가게: ${input.businessName}
업종: ${industry.name}
하는 일: ${input.oneLiner}
${input.whyStarted ? `시작한 이유: ${input.whyStarted}` : ""}

규칙 (반드시 지켜라):
- 자연스러운 한국어, 사장님이 직접 말하는 듯한 담백한 톤. 과장·유행어 금지.
- 경력 연차, 시공 건수, 자격증, 수상 등 구체적 사실을 절대 지어내지 마라. 입력에 있는 정보만 쓴다.
- headline은 24자 이내, 줄바꿈이 필요하면 \\n 사용. sub는 한 문장.
- steps는 이 업종의 일반적인 진행 과정 3~4단계 (사실 날조 없이 일반적 절차만).
- firstStory: "시작한 이유"가 있으면 그걸 1인칭 이야기(2~3문장)로 다듬어라. 없으면 null.

JSON으로만 답하라:
{"eyebrow":"지역·전문 분야 한 줄(입력에 지역 없으면 업종 표현만)","headline":"...","sub":"...","aboutTitle":"...","aboutBody":"3~4문장, 줄바꿈은 \\n","steps":[{"name":"...","desc":"..."}],"quoteSub":"문의를 부담없게 만드는 한 문장","storyFeedTitle":"가게 이름을 살린 스토리 코너 제목","firstStory":{"title":"...","body":"..."} 또는 null}`,
    CopyOut,
  );
}

/* ── 3) SiteDoc 조립 ── */

export async function generateSite(input: GenerateInput) {
  const { industry, confidence, method } = await classify(input);
  const cat = categoryOf(industry);
  const copy = await generateCopy(input, industry);
  const img = placeholderFor(industry.id);

  const sections: SiteDocT["sections"] = [
    {
      type: "hero",
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      sub: copy.sub,
      image: img.hero,
      cta: { label: cat.template === "quote" ? "견적 문의" : "전화 문의", action: cat.cta === "quote" ? "quote" : "call" },
    },
    { type: "about", title: copy.aboutTitle, body: copy.aboutBody },
  ];

  if (cat.template === "quote") {
    sections.push(
      { type: "processSteps", title: "진행 과정", steps: copy.steps },
      { type: "storyFeed", title: copy.storyFeedTitle, showCount: 5 },
      { type: "quoteForm", title: "견적 문의", sub: copy.quoteSub, phone: input.phone, allowPhotos: true },
    );
  } else {
    // visit (카페·식당): 메뉴·영업시간은 사실 정보라 생성하지 않음 — 에디터(P3)에서 입력
    sections.push(
      { type: "storyFeed", title: copy.storyFeedTitle, showCount: 5 },
      { type: "quoteForm", title: "문의하기", sub: copy.quoteSub, phone: input.phone, allowPhotos: false },
    );
  }

  if (input.address) {
    sections.push({ type: "map", title: "오시는 길", address: input.address, phone: input.phone });
  }

  const doc = SiteDoc.parse({
    schemaVersion: 1,
    template: cat.template,
    businessName: input.businessName,
    theme: { palette: input.mood, font: "pretendard" },
    sections,
  });

  return { doc, industry, category: cat, copy, inferred: { method, confidence, industryId: industry.id } };
}
